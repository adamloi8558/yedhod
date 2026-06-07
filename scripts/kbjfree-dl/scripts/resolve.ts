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

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
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
// We crawl two feeds — newest first, then popular — capping each one at
// MAX_PAGES_PER_FEED. Default 50 each → 100 pages / ~2400 clips per run.
const MAX_PAGES_PER_FEED = Math.max(0, Number(process.env.RESOLVE_MAX_PAGES_PER_FEED || "50"));
// Stop early once we see N pages in a row where every clip is already
// in the DB. Keeps re-runs cheap on the incremental case.
const STOP_AFTER_KNOWN_PAGES = Math.max(1, Number(process.env.STOP_AFTER_KNOWN_PAGES || "3"));

// Each entry is a (label, base path, paginated) tuple. The path is what
// we pass to fetch; ?page=N (or &page=N) is appended for page > 1.
// `cursorPersist` tells the script to remember the page we got to so the
// next run can keep walking instead of starting at page 1.
const FEEDS: Array<{ label: string; basePath: string; cursorPersist: boolean }> = [
  { label: "latest", basePath: "/videos", cursorPersist: false },
  { label: "popular", basePath: "/videos?filter=all&sort=popular", cursorPersist: true },
];

const CURSOR_KEY = process.env.CURSOR_KEY || "internal/kbjfree-cursor.json";
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
  console.error("  → log in to kbjfree.com in Chrome and export cookies via your");
  console.error("    cookie-editor extension; save as the path above");
  process.exit(1);
}

// Accept either format:
//   [{"name":"…","value":"…"}, …]                       — minimal
//   [{"domain":"…","name":"…","value":"…", …}, …]       — Chrome extension export
// Keep only cookies whose domain ends in kbjfree.com (if domain is given).
const rawCookies: Array<Record<string, unknown>> = JSON.parse(
  readFileSync(COOKIE_PATH, "utf8"),
);
const cookies: Cookie[] = rawCookies
  .filter((c) => {
    const d = typeof c.domain === "string" ? c.domain : "";
    return !d || d.endsWith("kbjfree.com") || d.endsWith(".kbjfree.com");
  })
  .map((c) => ({ name: String(c.name), value: String(c.value) }))
  .filter((c) => c.name && c.value);

if (cookies.length === 0) {
  console.error(`[fatal] no usable cookies in ${COOKIE_PATH}`);
  process.exit(1);
}

const required = ["cf_clearance", "kgateway.auth.access", "kgateway.auth.refresh"];
const haveNames = new Set(cookies.map((c) => c.name));
const missing = required.filter((n) => !haveNames.has(n));
if (missing.length) {
  console.warn(`[warn] missing expected cookies: ${missing.join(", ")} — continuing anyway`);
}
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

function pagedUrl(basePath: string, page: number): string {
  if (page === 1) return basePath;
  return basePath.includes("?") ? `${basePath}&page=${page}` : `${basePath}?page=${page}`;
}

async function listingIds(basePath: string, page: number): Promise<string[]> {
  const html = await getHtml(pagedUrl(basePath, page));
  return [...new Set([...html.matchAll(/\/watch\/([A-Za-z0-9_-]+)/g)].map((m) => m[1]))];
}

// ─────────────────────── cursor (R2-persisted) ───────────────────

// shape: { popular: 51, ... }  — next page to start at
type CursorState = Record<string, number>;

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${need("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: need("R2_ACCESS_KEY_ID"),
    secretAccessKey: need("R2_SECRET_ACCESS_KEY"),
  },
});

async function loadCursor(): Promise<CursorState> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: CURSOR_KEY }));
    if (!res.Body) return {};
    const chunks: Buffer[] = [];
    for await (const c of res.Body as Readable) chunks.push(Buffer.from(c));
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (e: any) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === "NoSuchKey") return {};
    console.warn(`[cursor] load failed: ${e?.message ?? e}`);
    return {};
  }
}

async function saveCursor(state: CursorState): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: CURSOR_KEY,
      Body: JSON.stringify(state),
      ContentType: "application/json",
    }),
  );
}

async function crawlFeed(
  feed: { label: string; basePath: string; cursorPersist: boolean },
  startPage: number,
  jobs: Job[],
  seenIds: Set<string>,
): Promise<number> {
  const cap = MAX_PAGES_PER_FEED === 0 ? Number.POSITIVE_INFINITY : MAX_PAGES_PER_FEED;
  const stopAt = startPage + cap - 1;
  console.log(
    `[${feed.label}] crawling pages ${startPage}…${cap === Number.POSITIVE_INFINITY ? "∞" : stopAt}` +
      (feed.cursorPersist ? " (cursor-persisted)" : ""),
  );
  let knownStreak = 0;
  let lastTouchedPage = startPage - 1;

  for (let p = startPage; p <= stopAt; p++) {
    let ids: string[];
    try {
      ids = await listingIds(feed.basePath, p);
    } catch (e: any) {
      console.error(`[err] [${feed.label}] listing page=${p}: ${e?.message ?? e}`);
      break;
    }
    if (ids.length === 0) {
      console.log(`[${feed.label}] page=${p} empty → end of list`);
      // For a persisted-cursor feed, restart from page 1 next run.
      if (feed.cursorPersist) return 1;
      return p;
    }

    const newIds: string[] = [];
    for (const id of ids) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const sourceUrl = `${ORIGIN}/watch/${id}`;
      if (!(await clipExists(sourceUrl))) newIds.push(id);
    }
    lastTouchedPage = p;

    if (newIds.length === 0) {
      knownStreak++;
      console.log(
        `[${feed.label}] page=${p} all-known streak=${knownStreak}/${STOP_AFTER_KNOWN_PAGES}`,
      );
      // For latest: every clip in DB → no point going deeper this run.
      // For popular: keep walking — the user wants to backfill in chunks.
      if (!feed.cursorPersist && knownStreak >= STOP_AFTER_KNOWN_PAGES) {
        console.log(`[${feed.label}] stopping — ${knownStreak} pages of nothing new`);
        break;
      }
      continue;
    }

    knownStreak = 0;
    for (const id of newIds) {
      try {
        const html = await getHtml(`/watch/${id}`, `${ORIGIN}${feed.basePath}`);
        const job = parseWatchHtml(id, html);
        jobs.push(job);
        console.log(`[ok] ${id} → ${job.categorySlug}/${job.modelSlug}`);
      } catch (e: any) {
        console.warn(`[skip] ${id}: ${e?.message}`);
      }
    }
    console.log(`[${feed.label}] page=${p} +${newIds.length} new (total ${jobs.length})`);
  }
  return lastTouchedPage + 1;
}

async function main() {
  const cursor = await loadCursor();
  const jobs: Job[] = [];
  const seenIds = new Set<string>();

  for (const feed of FEEDS) {
    const start = feed.cursorPersist ? Math.max(1, cursor[feed.label] || 1) : 1;
    const next = await crawlFeed(feed, start, jobs, seenIds);
    if (feed.cursorPersist) {
      cursor[feed.label] = next;
      await saveCursor(cursor);
      console.log(`[${feed.label}] cursor advanced → next run starts at page ${next}`);
    }
  }

  if (jobs.length === 0) {
    console.log("[resolve] no new jobs to push");
    await pg.end({ timeout: 5 });
    return;
  }

  const jsonl = jobs.map((j) => JSON.stringify(j)).join("\n") + "\n";
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
