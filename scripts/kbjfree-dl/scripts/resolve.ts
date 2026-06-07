/**
 * resolve.ts — runs on the user's machine (IP that's whitelisted by
 * Cloudflare for kbjfree.com). Crawls /videos, opens each /watch/<id>,
 * extracts mp4Url + thumbnailUrl + category + model, and pushes the
 * job list to R2 as JSONL. The server-side downloader (index.ts)
 * picks it up.
 *
 * Run:
 *   cd scripts/kbjfree-dl
 *   pnpm exec tsx scripts/resolve.ts
 *
 * Schedule it (Windows Task Scheduler / cron) every hour or two so new
 * clips show up automatically.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "@kodhom/db/schema";
import { clips } from "@kodhom/db/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "..", ".env") });
loadEnv({ path: resolve(__dirname, "..", "..", "..", ".env") });

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) {
    console.error("missing env:", k);
    process.exit(1);
  }
  return v;
};

const DATABASE_URL = need("DATABASE_URL");
const R2_BUCKET_NAME = need("R2_BUCKET_NAME");
const JOBS_KEY = process.env.JOBS_KEY || "internal/kbjfree-jobs.jsonl";
// Default 100 pages — enough for a first-time backfill (~2400 clips)
// without slamming Cloudflare. 0 = unbounded, walk until end-of-list.
const MAX_PAGES = Math.max(0, Number(process.env.RESOLVE_MAX_PAGES || "100"));
// Stop early once we see N pages in a row where every clip is already
// in the DB. Keeps re-runs cheap on the incremental case.
const STOP_AFTER_KNOWN_PAGES = Math.max(1, Number(process.env.STOP_AFTER_KNOWN_PAGES || "3"));
const ORIGIN = "https://kbjfree.com";
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

// ─────────────────────────── cookies ─────────────────────────────

interface Cookie {
  name: string;
  value: string;
}

const COOKIE_PATH = resolve(__dirname, "..", ".state", "cookies.json");
if (!existsSync(COOKIE_PATH)) {
  console.error(`no cookies at ${COOKIE_PATH}`);
  console.error(
    "  → log in to kbjfree.com in Chrome (the host that produced this cookie file)",
  );
  console.error(
    "  → copy cf_clearance + kgateway.auth.access + kgateway.auth.refresh into a JSON array",
  );
  console.error(`  → save as ${COOKIE_PATH}`);
  console.error('  format: [{"name":"cf_clearance","value":"…"}, ...]');
  process.exit(1);
}
const cookies: Cookie[] = JSON.parse(readFileSync(COOKIE_PATH, "utf8"));
const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

const HEADERS: Record<string, string> = {
  "User-Agent": CHROME_UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "upgrade-insecure-requests": "1",
  Cookie: cookieStr,
};

// ───────────────────────── DB connection ─────────────────────────

const pg = postgres(DATABASE_URL, { max: 2, idle_timeout: 10 });
const db = drizzle(pg, { schema });
const clipsTable = clips as any;

async function clipExists(sourceUrl: string): Promise<boolean> {
  const row = await db
    .select({ id: clipsTable.id })
    .from(clipsTable)
    .where(eq(clipsTable.sourceUrl, sourceUrl))
    .limit(1);
  return row.length > 0;
}

// ───────────────────────── HTTP ──────────────────────────────────

async function getHtml(path: string, referer = `${ORIGIN}/`): Promise<string> {
  const url = path.startsWith("http") ? path : `${ORIGIN}${path}`;
  const r = await fetch(url, { headers: { ...HEADERS, Referer: referer } });
  if (r.status !== 200) {
    throw new Error(
      `GET ${url} → ${r.status} (cookies expired? refresh ${COOKIE_PATH} and retry)`,
    );
  }
  return await r.text();
}

// ───────────────────────── crawl + parse ─────────────────────────

interface Job {
  id: string;
  title: string;
  mp4Url: string;
  thumbnailUrl?: string;
  categorySlug: string;
  modelSlug: string;
}

function parseWatchHtml(id: string, html: string): Job {
  const ldMatch = html.match(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]+?)<\/script>/,
  );
  let mp4Url = "";
  let thumbnailUrl: string | undefined;
  let title = "";
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1]);
      mp4Url = typeof ld.contentUrl === "string" ? ld.contentUrl : "";
      const t = ld.thumbnailUrl;
      thumbnailUrl = typeof t === "string" ? t : Array.isArray(t) ? t[0] : undefined;
      title = ld.name || "";
    } catch {
      /* fall through */
    }
  }
  if (!mp4Url) throw new Error("no contentUrl in JSON-LD");

  if (!thumbnailUrl) {
    const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
    if (og) thumbnailUrl = og[1].replace(/&amp;/g, "&");
  }
  const catMatch = html.match(/\/category\/([A-Za-z0-9_-]+)/);
  const modMatch = html.match(/\/model\/([A-Za-z0-9_-]+)/);
  if (!catMatch || !modMatch) throw new Error("missing category/model link");

  if (!title) {
    const t = html.match(/<title>([^<]+)<\/title>/);
    title = (t?.[1] || id).replace(/\s*-\s*KBJFree\s*$/, "").trim() || id;
  }
  mp4Url = mp4Url.replace(/&amp;/g, "&");
  if (thumbnailUrl) thumbnailUrl = thumbnailUrl.replace(/&amp;/g, "&");

  return {
    id,
    title,
    mp4Url,
    thumbnailUrl,
    categorySlug: catMatch[1],
    modelSlug: modMatch[1],
  };
}

async function listingIds(page: number): Promise<string[]> {
  const path = page === 1 ? "/videos" : `/videos?page=${page}`;
  const html = await getHtml(path);
  return [...new Set([...html.matchAll(/\/watch\/([A-Za-z0-9_-]+)/g)].map((m) => m[1]))];
}

async function main() {
  const cap = MAX_PAGES === 0 ? Number.POSITIVE_INFINITY : MAX_PAGES;
  console.log(
    `[resolve] crawling /videos — cap=${MAX_PAGES === 0 ? "∞" : MAX_PAGES} pages, stop after ${STOP_AFTER_KNOWN_PAGES} known-only pages`,
  );
  const jobs: Job[] = [];
  const seenIds = new Set<string>();
  let knownStreak = 0; // consecutive pages where all clips are already in DB

  for (let p = 1; p <= cap; p++) {
    let ids: string[];
    try {
      ids = await listingIds(p);
    } catch (e: any) {
      console.error(`[err] listing page=${p}: ${e?.message ?? e}`);
      break;
    }
    if (ids.length === 0) {
      console.log(`[resolve] page=${p} empty → end of list`);
      break;
    }

    // First decide which ids on this page are genuinely new (not yet in DB,
    // not yet queued in this run).
    const newIds: string[] = [];
    for (const id of ids) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const sourceUrl = `${ORIGIN}/watch/${id}`;
      if (!(await clipExists(sourceUrl))) newIds.push(id);
    }

    if (newIds.length === 0) {
      knownStreak++;
      console.log(
        `[resolve] page=${p} all-known streak=${knownStreak}/${STOP_AFTER_KNOWN_PAGES}`,
      );
      if (knownStreak >= STOP_AFTER_KNOWN_PAGES) {
        console.log(`[resolve] stopping — ${knownStreak} pages of nothing new`);
        break;
      }
      continue;
    }

    knownStreak = 0;
    for (const id of newIds) {
      try {
        const html = await getHtml(`/watch/${id}`, `${ORIGIN}/videos`);
        const job = parseWatchHtml(id, html);
        jobs.push(job);
        console.log(`[ok] ${id} → ${job.categorySlug}/${job.modelSlug}`);
      } catch (e: any) {
        console.warn(`[skip] ${id}: ${e?.message}`);
      }
    }
    console.log(`[resolve] page=${p} +${newIds.length} new (total ${jobs.length})`);
  }

  if (jobs.length === 0) {
    console.log("[resolve] no new jobs to push");
    await pg.end({ timeout: 5 });
    return;
  }

  const jsonl = jobs.map((j) => JSON.stringify(j)).join("\n") + "\n";
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${need("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: need("R2_ACCESS_KEY_ID"),
      secretAccessKey: need("R2_SECRET_ACCESS_KEY"),
    },
  });
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: JOBS_KEY,
      Body: jsonl,
      ContentType: "application/x-ndjson",
    }),
  );
  console.log(`[push] uploaded ${jobs.length} jobs → ${JOBS_KEY}`);
  await pg.end({ timeout: 5 });
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
