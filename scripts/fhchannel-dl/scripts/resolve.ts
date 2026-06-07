/**
 * fhchannel-dl resolver — runs on the user's machine with a logged-in
 * Chromium profile.
 *
 *   1) crawl /videos (and /videos?sort=popular cursor-persisted) HTML —
 *      plain fetch is enough; the listings are server-side rendered
 *   2) for each new /videos/<slug>:
 *        - fetch the watch HTML to get title, studio, related-tags
 *        - open the watch page in Playwright (logged-in profile) to
 *          read the full HLS master URL out of the <video> element
 *   3) push a JSONL job list to R2 internal/fhchannel-jobs.jsonl
 *
 * Run:
 *   pnpm exec tsx scripts/resolve.ts
 *
 * The first run needs you to log into fhchannel.com inside the
 * Playwright Chromium it launches with HEADLESS=0 — see README.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { chromium, type BrowserContext } from "playwright";
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
const JOBS_KEY = process.env.JOBS_KEY || "internal/fhchannel-jobs.jsonl";
const CURSOR_KEY = process.env.CURSOR_KEY || "internal/fhchannel-cursor.json";
const MAX_PAGES_PER_FEED = Math.max(0, Number(process.env.RESOLVE_MAX_PAGES_PER_FEED || "50"));
const STOP_AFTER_KNOWN_PAGES = Math.max(1, Number(process.env.STOP_AFTER_KNOWN_PAGES || "3"));
const HEADLESS = process.env.HEADLESS !== "0";

const ORIGIN = "https://fhchannel.com";
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";
const STATE_DIR = resolve(__dirname, "..", ".state");
const BROWSER_DATA_DIR = resolve(STATE_DIR, "browser-data");
const COOKIE_PATH = resolve(STATE_DIR, "cookies.json");
mkdirSync(STATE_DIR, { recursive: true });

// ──────────────────────── cookies ───────────────────────────────

interface RawCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  expirationDate?: number;
}

function loadCookies(): { headerStr: string; pwCookies: any[] } {
  if (!existsSync(COOKIE_PATH)) {
    console.error(`[fatal] no cookies at ${COOKIE_PATH}`);
    console.error(
      `  → log in to fhchannel.com in Chrome, export cookies (cookie-editor)`,
    );
    console.error(`  → save the JSON array to ${COOKIE_PATH}`);
    process.exit(1);
  }
  const raw: RawCookie[] = JSON.parse(readFileSync(COOKIE_PATH, "utf8"));
  const onlyFh = raw.filter((c) => {
    const d = c.domain || "";
    return !d || d.endsWith("fhchannel.com") || d.endsWith(".fhchannel.com");
  });
  if (onlyFh.length === 0) {
    console.error(`[fatal] no fhchannel.com cookies in ${COOKIE_PATH}`);
    process.exit(1);
  }
  const headerStr = onlyFh.map((c) => `${c.name}=${c.value}`).join("; ");
  // Playwright Cookie shape — needs url or domain+path
  const pwCookies = onlyFh.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain?.startsWith(".") ? c.domain : `.${c.domain || "fhchannel.com"}`.replace(/^\.\./, "."),
    path: c.path || "/",
    secure: c.secure ?? true,
    httpOnly: c.httpOnly ?? false,
    sameSite:
      c.sameSite === "no_restriction"
        ? ("None" as const)
        : c.sameSite === "lax"
          ? ("Lax" as const)
          : c.sameSite === "strict"
            ? ("Strict" as const)
            : ("Lax" as const),
    ...(c.expirationDate ? { expires: Math.floor(c.expirationDate) } : {}),
  }));
  return { headerStr, pwCookies };
}

const COOKIES = loadCookies();

const FEEDS: Array<{ label: string; basePath: string; cursorPersist: boolean }> = [
  { label: "latest", basePath: "/videos", cursorPersist: false },
  { label: "popular", basePath: "/videos?sort=video_viewed&order=desc", cursorPersist: true },
];

// ───────────────────────── infra ─────────────────────────────────

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${need("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: need("R2_ACCESS_KEY_ID"),
    secretAccessKey: need("R2_SECRET_ACCESS_KEY"),
  },
});

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

// ─────────────────────────── http (HTML pages) ───────────────────

const HTML_HEADERS: Record<string, string> = {
  "User-Agent": CHROME_UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "upgrade-insecure-requests": "1",
  Cookie: COOKIES.headerStr,
};

async function getHtml(path: string, referer = `${ORIGIN}/`): Promise<string> {
  const url = path.startsWith("http") ? path : `${ORIGIN}${path}`;
  const r = await fetch(url, { headers: { ...HTML_HEADERS, Referer: referer } });
  if (r.status !== 200) throw new Error(`GET ${url} → ${r.status}`);
  return await r.text();
}

// ───────────────────── HTML parsing ──────────────────────────────

interface WatchMeta {
  title: string;
  studioSlug: string | null;
  studioName: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  /** flat list of related tag links (studios + pornstars + categories + searches) */
  relatedTags: Array<{ kind: "studio" | "pornstar" | "category" | "tag"; slug: string; label: string }>;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function parseWatchHtml(html: string): WatchMeta {
  // title
  const titleMatch = html.match(/<h1[^>]*class="[^"]*video__title[^"]*"[^>]*>([\s\S]+?)<\/h1>/);
  const title = decodeHtmlEntities(stripTags(titleMatch?.[1] || ""));

  // studio (the channel name — used as parent category)
  const studioMatch = html.match(
    /<a[^>]*class="[^"]*video-info-details__studio-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]+?)<\/a>/,
  );
  let studioSlug: string | null = null;
  let studioName: string | null = null;
  if (studioMatch) {
    const slugMatch = studioMatch[1].match(/\/studios\/([^/?#]+)/);
    studioSlug = slugMatch?.[1] || null;
    studioName = decodeHtmlEntities(stripTags(studioMatch[2])) || null;
  }

  // thumbnail — og:image
  const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
  const thumbnailUrl = og ? decodeHtmlEntities(og[1]) : null;

  // duration (seconds) — ld+json blob: "duration":2545
  const durMatch = html.match(/"duration":(\d+)/);
  const duration = durMatch ? Number(durMatch[1]) : null;

  // related tags (the "เกี่ยวกับคลิปนี้" block — all .vid-c anchors)
  const relatedTags: WatchMeta["relatedTags"] = [];
  const seen = new Set<string>();
  const tagRegex =
    /<a[^>]*class="[^"]*vid-c[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]+?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(html)) !== null) {
    const href = decodeHtmlEntities(m[1]);
    const label = decodeHtmlEntities(stripTags(m[2]));
    if (!label) continue;
    const key = `${href}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let kind: "studio" | "pornstar" | "category" | "tag";
    let slug: string;
    if (/^\/studios\/([^/?#]+)/.test(href)) {
      kind = "studio";
      slug = href.match(/^\/studios\/([^/?#]+)/)![1];
    } else if (/\/pornstars\/([^/?#]+)/.test(href)) {
      kind = "pornstar";
      slug = href.match(/\/pornstars\/([^/?#]+)/)![1];
    } else if (/^\/c\/([^/?#]+)/.test(href)) {
      kind = "category";
      slug = href.match(/^\/c\/([^/?#]+)/)![1];
    } else if (/^\/search\/videos\?q=/.test(href)) {
      kind = "tag";
      slug = decodeURIComponent(href.match(/q=([^&]+)/)![1]).replace(/\+/g, " ");
    } else {
      continue;
    }
    relatedTags.push({ kind, slug, label });
  }

  return { title, studioSlug, studioName, thumbnailUrl, duration, relatedTags };
}

function listingSlugs(html: string): string[] {
  // Each video link looks like:  <a … href="/videos/<title-slug-with-id>" …>
  // The id at the end is mixed case, 6+ chars. We grab everything that
  // looks like /videos/<some-slug>, then drop noise like /videos/vr.
  const slugs = new Set<string>();
  const re = /href="\/videos\/([A-Za-z0-9-]+(?:#[^"]*)?)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const slug = m[1].split("#")[0];
    if (!slug || slug === "vr" || slug.length < 4) continue;
    slugs.add(slug);
  }
  return [...slugs];
}

// ───────────────────── HLS URL via Playwright ────────────────────

let ctx: BrowserContext | null = null;
async function getBrowser(): Promise<BrowserContext> {
  if (ctx) return ctx;
  ctx = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: HEADLESS,
    viewport: { width: 1366, height: 800 },
    userAgent: CHROME_UA,
    locale: "en-US",
    timezoneId: "Asia/Bangkok",
  });
  // Inject the cookies from .state/cookies.json so the player thinks
  // it's serving a logged-in premium user.
  await ctx.addCookies(COOKIES.pwCookies);
  return ctx;
}

async function resolveHls(slug: string): Promise<string | null> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  const hlsCandidates: string[] = [];
  page.on("request", (req) => {
    const u = req.url();
    if (/video-nss\.flixcdn\.com\/[^/]+\/media=hls[^"]+\.m3u8/.test(u)) {
      hlsCandidates.push(u);
    }
  });

  try {
    await page.goto(`${ORIGIN}/videos/${slug}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    // Trigger playback so the player resolves the manifest
    await page
      .evaluate(() => {
        const v = document.querySelector("video") as HTMLVideoElement | null;
        if (v) {
          v.muted = true;
          v.play().catch(() => {});
        }
      })
      .catch(() => undefined);

    // Wait until we capture at least one full-video manifest (master or
    // variant — both work for ffmpeg).
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (hlsCandidates.length) break;
      await page.waitForTimeout(500);
    }
  } finally {
    await page.close().catch(() => undefined);
  }

  if (hlsCandidates.length === 0) return null;

  // Prefer the "_TPL_" master template if we caught it; otherwise pick
  // the highest-resolution variant that appeared.
  const master = hlsCandidates.find((u) => u.includes("_TPL_"));
  if (master) return master;
  const ranked = hlsCandidates
    .map((u) => ({ u, res: Number(u.match(/format\/(\d+)\.mp4/)?.[1] || 0) }))
    .sort((a, b) => b.res - a.res);
  return ranked[0].u;
}

// ───────────────────── cursor (R2) ───────────────────────────────

type CursorState = Record<string, number>;

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

// ───────────────────── main crawl ────────────────────────────────

interface Job {
  id: string; // the trailing alphanumeric id from the slug (last segment after final '-')
  slug: string; // full URL slug, used in source_url
  title: string;
  hlsUrl: string;
  thumbnailUrl?: string;
  studioSlug: string | null;
  studioName: string | null;
  duration: number | null;
  relatedTags: WatchMeta["relatedTags"];
}

function slugToId(slug: string): string {
  // last token after dash is typically the alphanumeric id (e.g. K1Jj01)
  const parts = slug.split("-");
  return parts[parts.length - 1] || slug;
}

async function processSlug(slug: string): Promise<Job | null> {
  const sourceUrl = `${ORIGIN}/videos/${slug}`;
  if (await clipExists(sourceUrl)) return null;

  let html: string;
  try {
    html = await getHtml(`/videos/${slug}`);
  } catch (e: any) {
    console.warn(`[skip] ${slug}: html fetch ${e?.message}`);
    return null;
  }
  const meta = parseWatchHtml(html);
  if (!meta.title) {
    console.warn(`[skip] ${slug}: no title`);
    return null;
  }

  const hlsUrl = await resolveHls(slug);
  if (!hlsUrl) {
    console.warn(`[skip] ${slug}: could not resolve HLS (premium gated?)`);
    return null;
  }

  return {
    id: slugToId(slug),
    slug,
    title: meta.title,
    hlsUrl,
    thumbnailUrl: meta.thumbnailUrl ?? undefined,
    studioSlug: meta.studioSlug,
    studioName: meta.studioName,
    duration: meta.duration,
    relatedTags: meta.relatedTags,
  };
}

async function crawlFeed(
  feed: { label: string; basePath: string; cursorPersist: boolean },
  startPage: number,
  jobs: Job[],
  seenSlugs: Set<string>,
): Promise<number> {
  const cap = MAX_PAGES_PER_FEED === 0 ? Number.POSITIVE_INFINITY : MAX_PAGES_PER_FEED;
  const stopAt = startPage + cap - 1;
  console.log(
    `[${feed.label}] crawling pages ${startPage}…${cap === Number.POSITIVE_INFINITY ? "∞" : stopAt}` +
      (feed.cursorPersist ? " (cursor-persisted)" : ""),
  );
  let knownStreak = 0;
  let lastTouched = startPage - 1;

  for (let p = startPage; p <= stopAt; p++) {
    const url =
      p === 1
        ? feed.basePath
        : feed.basePath.includes("?")
          ? `${feed.basePath}&page=${p}`
          : `${feed.basePath}?page=${p}`;
    let html: string;
    try {
      html = await getHtml(url);
    } catch (e: any) {
      console.error(`[err] [${feed.label}] page=${p}: ${e?.message}`);
      break;
    }
    const slugs = listingSlugs(html);
    if (slugs.length === 0) {
      console.log(`[${feed.label}] page=${p} empty → end of list`);
      if (feed.cursorPersist) return 1;
      return p;
    }

    const newSlugs: string[] = [];
    for (const s of slugs) {
      if (seenSlugs.has(s)) continue;
      seenSlugs.add(s);
      if (!(await clipExists(`${ORIGIN}/videos/${s}`))) newSlugs.push(s);
    }
    lastTouched = p;

    if (newSlugs.length === 0) {
      knownStreak++;
      console.log(`[${feed.label}] page=${p} all-known streak=${knownStreak}/${STOP_AFTER_KNOWN_PAGES}`);
      if (!feed.cursorPersist && knownStreak >= STOP_AFTER_KNOWN_PAGES) {
        console.log(`[${feed.label}] stopping — ${knownStreak} pages of nothing new`);
        break;
      }
      continue;
    }
    knownStreak = 0;

    for (const slug of newSlugs) {
      const job = await processSlug(slug);
      if (job) {
        jobs.push(job);
        console.log(`[ok] ${slug} → ${job.studioSlug || "no-studio"} (${job.title.slice(0, 50)})`);
      }
    }
    console.log(`[${feed.label}] page=${p} +${newSlugs.length} processed (total ${jobs.length})`);
  }
  return lastTouched + 1;
}

async function main() {
  const cursor = await loadCursor();
  const jobs: Job[] = [];
  const seenSlugs = new Set<string>();

  for (const feed of FEEDS) {
    const start = feed.cursorPersist ? Math.max(1, cursor[feed.label] || 1) : 1;
    const next = await crawlFeed(feed, start, jobs, seenSlugs);
    if (feed.cursorPersist) {
      cursor[feed.label] = next;
      await saveCursor(cursor);
      console.log(`[${feed.label}] cursor advanced → next run starts at page ${next}`);
    }
  }

  if (ctx) await ctx.close().catch(() => undefined);

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

main().catch(async (e) => {
  console.error("[fatal]", e);
  if (ctx) await ctx.close().catch(() => undefined);
  process.exit(1);
});
