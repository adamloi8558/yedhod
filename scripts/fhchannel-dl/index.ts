/**
 * fhchannel-dl downloader (server side)
 *
 *   loop forever:
 *     1) pull internal/fhchannel-jobs.jsonl from R2 (produced by
 *        scripts/resolve.ts running on the user's machine)
 *     2) for each job not already in DB (clips.sourceUrl):
 *          - ensure category = the studio (parent, member access)
 *          - pipe HLS → mp4 via ffmpeg → R2 multipart upload
 *          - fetch poster image → R2
 *          - insert clips row, putting the related-tags JSON in
 *            clips.description so the "เกี่ยวกับคลิปนี้" block can
 *            render the studio + pornstars + categories + tags
 *     3) sleep LOOP_INTERVAL_SEC, repeat
 *
 * No browser, no Cloudflare workarounds — the CDN serves signed HLS
 * with Access-Control-Allow-Origin:* so any IP can fetch as long as
 * the URL is still within its token's expiry window (~5h).
 */

import { S3Client, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable, PassThrough } from "node:stream";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as schema from "@kodhom/db/schema";
import { categories, clips } from "@kodhom/db/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, ".env") });
loadEnv({ path: resolve(__dirname, "../../.env") });

const env = (key: string): string => {
  const v = process.env[key];
  if (!v) {
    console.error(`[env] missing: ${key}`);
    process.exit(1);
  }
  return v;
};

const DATABASE_URL = env("DATABASE_URL");
const R2_ACCOUNT_ID = env("R2_ACCOUNT_ID");
const R2_ACCESS_KEY_ID = env("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = env("R2_SECRET_ACCESS_KEY");
const R2_BUCKET_NAME = env("R2_BUCKET_NAME");
const R2_KEY_PREFIX = process.env.R2_KEY_PREFIX || "clips/fhchannel/";
const R2_THUMB_PREFIX = process.env.R2_THUMB_PREFIX || "clips/fhchannel-thumbs/";
const LOOP_INTERVAL_SEC = Math.max(60, Number(process.env.LOOP_INTERVAL_SEC || "300"));
const ONESHOT = process.env.ONESHOT === "1";
const MAX_DOWNLOADS_PER_CYCLE = Math.max(0, Number(process.env.MAX_DOWNLOADS_PER_CYCLE || "0"));
const JOBS_KEY = process.env.JOBS_KEY || "internal/fhchannel-jobs.jsonl";
const FFMPEG = process.env.FFMPEG || "ffmpeg";

const ORIGIN = "https://fhchannel.com";
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

// ───────────────────────── infra clients ─────────────────────────

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const pg = postgres(DATABASE_URL, { max: 5, idle_timeout: 20 });
const db = drizzle(pg, { schema });
const categoriesTable = categories as any;
const clipsTable = clips as any;

// ─────────────────────────── helpers ─────────────────────────────

function slug(input: string): string {
  return (
    input
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled"
  );
}

function safeName(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 100) || "video"
  );
}

async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch (e: any) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === "NotFound") return false;
    throw e;
  }
}

async function clipExists(sourceUrl: string): Promise<boolean> {
  const row = await db
    .select({ id: clipsTable.id })
    .from(clipsTable)
    .where(eq(clipsTable.sourceUrl, sourceUrl))
    .limit(1);
  return row.length > 0;
}

async function ensureCategory(args: {
  slug: string;
  name: string;
  accessLevel: "member" | "vip";
}): Promise<{ id: string; accessLevel: "member" | "vip" }> {
  const existing = await db
    .select({ id: categoriesTable.id, accessLevel: categoriesTable.accessLevel })
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, args.slug))
    .limit(1);
  if (existing.length) return existing[0];

  const id = nanoid();
  try {
    const [row] = await db
      .insert(categoriesTable)
      .values({
        id,
        slug: args.slug,
        name: args.name,
        parentId: null,
        accessLevel: args.accessLevel,
        isActive: true,
      })
      .returning({ id: categoriesTable.id, accessLevel: categoriesTable.accessLevel });
    console.log(`[cat] created ${args.slug} (${args.accessLevel})`);
    return row;
  } catch {
    const again = await db
      .select({ id: categoriesTable.id, accessLevel: categoriesTable.accessLevel })
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, args.slug))
      .limit(1);
    if (again.length) return again[0];
    throw new Error(`ensureCategory race: ${args.slug}`);
  }
}

// ─────────────────────────── job queue ───────────────────────────

interface Job {
  id: string;
  slug: string;
  title: string;
  hlsUrl: string;
  thumbnailUrl?: string;
  studioSlug: string | null;
  studioName: string | null;
  duration: number | null;
  relatedTags: Array<{ kind: string; slug: string; label: string }>;
}

async function loadJobs(): Promise<Job[]> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: JOBS_KEY }));
    if (!res.Body) return [];
    const chunks: Buffer[] = [];
    for await (const c of res.Body as Readable) chunks.push(Buffer.from(c));
    const text = Buffer.concat(chunks).toString("utf8");
    const jobs: Job[] = [];
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        jobs.push(JSON.parse(t));
      } catch {
        console.warn(`[jobs] skipping unparseable line`);
      }
    }
    return jobs;
  } catch (e: any) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === "NoSuchKey") {
      console.warn(`[jobs] ${JOBS_KEY} not in R2 yet — waiting for resolver`);
      return [];
    }
    throw e;
  }
}

// ─────────────────────────── ffmpeg HLS → mp4 ────────────────────

/**
 * Spawn ffmpeg to pipe an HLS master/variant URL into a fragmented mp4
 * stream on stdout. We deliberately use `-c copy` so no transcoding
 * happens — the segments are already AVC+AAC, ffmpeg just remuxes.
 *
 * `-movflags +frag_keyframe+empty_moov+default_base_moof` makes the
 * output streamable (no need to seek back to write the moov atom),
 * which is exactly what the R2 multipart Upload needs.
 */
function hlsToMp4Stream(hlsUrl: string): { stream: Readable; done: Promise<void> } {
  const out = new PassThrough();
  const proc = spawn(
    FFMPEG,
    [
      "-hide_banner",
      "-loglevel", "warning",
      "-headers", `Referer: ${ORIGIN}/\r\nUser-Agent: ${CHROME_UA}\r\n`,
      "-i", hlsUrl,
      "-c", "copy",
      "-bsf:a", "aac_adtstoasc",
      "-movflags", "+frag_keyframe+empty_moov+default_base_moof",
      "-f", "mp4",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  proc.stdout.pipe(out);
  proc.stderr.on("data", (d) => process.stderr.write(`[ffmpeg] ${d.toString()}`));

  const done = new Promise<void>((res, rej) => {
    proc.on("error", rej);
    proc.on("close", (code) => {
      if (code === 0) res();
      else rej(new Error(`ffmpeg exited ${code}`));
    });
  });

  return { stream: out, done };
}

async function streamHlsToR2(args: {
  hlsUrl: string;
  key: string;
  label: string;
}): Promise<void> {
  console.log(`[${args.label}] starting ffmpeg → R2 ${args.key}`);
  const { stream, done } = hlsToMp4Stream(args.hlsUrl);
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: R2_BUCKET_NAME,
      Key: args.key,
      Body: stream,
      ContentType: "video/mp4",
    },
    queueSize: 4,
    partSize: 8 * 1024 * 1024,
  });
  let lastMb = 0;
  upload.on("httpUploadProgress", (p) => {
    const mb = (p.loaded ?? 0) / 1024 / 1024;
    if (mb - lastMb >= 50) {
      lastMb = mb;
      console.log(`[${args.label}] ${mb.toFixed(0)} MB uploaded`);
    }
  });
  await Promise.all([upload.done(), done]);
}

async function streamImageToR2(args: {
  url: string;
  key: string;
  contentType: string;
  referer: string;
  label: string;
}): Promise<number> {
  const res = await fetch(args.url, {
    headers: { "User-Agent": CHROME_UA, Accept: "*/*", Referer: args.referer },
  });
  if (!res.ok || !res.body) throw new Error(`fetch ${args.label} failed: ${res.status}`);
  const len = Number(res.headers.get("content-length") || 0);
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: R2_BUCKET_NAME,
      Key: args.key,
      Body: Readable.fromWeb(res.body as any) as any,
      ContentType: args.contentType,
    },
  });
  await upload.done();
  return len;
}

// ─────────────────────────── pipeline ────────────────────────────

async function processOne(job: Job): Promise<"ok" | "skip" | "fail"> {
  const sourceUrl = `${ORIGIN}/videos/${job.slug}`;
  if (await clipExists(sourceUrl)) {
    console.log(`[skip] db already has ${job.id}`);
    return "skip";
  }

  // Category = the studio. If a clip has no studio (rare), fall back
  // to a single "fhchannel" bucket category so we still land it.
  const catSlug = job.studioSlug ? `fh-${slug(job.studioSlug)}` : "fhchannel";
  const catName = job.studioName || "FapHouse";
  const cat = await ensureCategory({
    slug: catSlug,
    name: catName,
    accessLevel: "member",
  });

  const r2Key = `${R2_KEY_PREFIX}${job.id}_${safeName(job.title)}.mp4`;
  if (await objectExists(r2Key)) {
    console.log(`[r2] mp4 already exists ${r2Key} — reusing`);
  } else {
    try {
      await streamHlsToR2({ hlsUrl: job.hlsUrl, key: r2Key, label: `mp4 ${job.id}` });
    } catch (e: any) {
      console.error(`[err] mp4 ${job.id}: ${e?.message ?? e}`);
      return "fail";
    }
  }

  let thumbR2Key: string | undefined;
  if (job.thumbnailUrl) {
    const ext = (job.thumbnailUrl.match(/\.(webp|jpg|jpeg|png|gif)/i)?.[1] || "jpg").toLowerCase();
    thumbR2Key = `${R2_THUMB_PREFIX}${job.id}.${ext}`;
    if (await objectExists(thumbR2Key)) {
      console.log(`[r2] thumb already exists`);
    } else {
      try {
        const ctype =
          ext === "webp"
            ? "image/webp"
            : ext === "png"
              ? "image/png"
              : ext === "gif"
                ? "image/gif"
                : "image/jpeg";
        await streamImageToR2({
          url: job.thumbnailUrl,
          key: thumbR2Key,
          contentType: ctype,
          referer: sourceUrl,
          label: `thumb ${job.id}`,
        });
      } catch (e: any) {
        console.warn(`[warn] thumb ${job.id} failed: ${e?.message ?? e}`);
        thumbR2Key = undefined;
      }
    }
  }

  // Description = JSON of structured related tags. The frontend can
  // render the "เกี่ยวกับคลิปนี้" block from this.
  const description = JSON.stringify({ relatedTags: job.relatedTags });

  try {
    await db.insert(clipsTable).values({
      id: nanoid(),
      title: job.title,
      description,
      categoryId: cat.id,
      accessLevel: cat.accessLevel,
      r2Key,
      thumbnailR2Key: thumbR2Key,
      duration: job.duration ?? undefined,
      mimeType: "video/mp4",
      isActive: true,
      sourceUrl,
    });
    console.log(
      `[clip] inserted ${job.id} → ${cat.accessLevel} / ${catName}` +
        (thumbR2Key ? " (+thumb)" : ""),
    );
    return "ok";
  } catch (e: any) {
    if (String(e?.message).includes("clips_source_url_unique")) return "skip";
    console.error(`[err] insert ${job.id}: ${e?.message ?? e}`);
    return "fail";
  }
}

// ─────────────────────────── loop ────────────────────────────────

async function cycle(): Promise<void> {
  const jobs = await loadJobs();
  console.log(`[cycle] ${jobs.length} jobs from ${JOBS_KEY}`);
  let ok = 0,
    skip = 0,
    fail = 0;
  for (const job of jobs) {
    if (MAX_DOWNLOADS_PER_CYCLE && ok >= MAX_DOWNLOADS_PER_CYCLE) {
      console.log(`[cycle] reached MAX_DOWNLOADS_PER_CYCLE=${MAX_DOWNLOADS_PER_CYCLE} → stop`);
      break;
    }
    const r = await processOne(job);
    if (r === "ok") ok++;
    else if (r === "skip") skip++;
    else fail++;
  }
  console.log(`[cycle] done  ok=${ok}  skip=${skip}  fail=${fail}`);
}

async function main() {
  console.log(`[boot] fhchannel-dl downloader — interval=${LOOP_INTERVAL_SEC}s jobs=${JOBS_KEY}`);
  for (;;) {
    try {
      await cycle();
    } catch (e: any) {
      console.error(`[cycle] error: ${e?.message ?? e}`);
    }
    if (ONESHOT) {
      console.log("[oneshot] exiting after single cycle");
      try {
        await pg.end({ timeout: 5 });
      } catch {}
      process.exit(0);
    }
    console.log(`[loop] sleeping ${LOOP_INTERVAL_SEC}s`);
    await new Promise((r) => setTimeout(r, LOOP_INTERVAL_SEC * 1000));
  }
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
