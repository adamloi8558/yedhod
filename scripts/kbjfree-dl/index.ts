/**
 * kbjfree-dl  —  long-running worker
 *
 *   loop forever:
 *     1) make sure playwright is logged in to kbjfree.com
 *     2) crawl /videos for new video IDs (newest first)
 *     3) for each ID not already in DB (clips.sourceUrl):
 *          - resolve mp4 + category-slug + model-slug
 *          - upsert parent category   = kbjfree category
 *          - upsert child  category   = model      (parentId = parent.id)
 *              accessLevel = "vip" if parent slug/name contains VIP_CATEGORY_KEYWORD
 *              else "member"
 *          - stream the mp4 directly into R2  (multipart, no disk)
 *          - insert clips row pointing at the child category
 *     4) sleep LOOP_INTERVAL_SEC, repeat
 *
 * Dedup keys (ANY one match → skip download):
 *   - clips.sourceUrl   = "https://kbjfree.com/watch/<id>"
 *   - R2 HeadObject on the deterministic key
 */

import { S3Client, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "node:stream";
import { mkdirSync, existsSync } from "node:fs";
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

type Locator = {
  first(): Locator;
  count(): Promise<number>;
  getAttribute(name: string): Promise<string | null>;
  fill(value: string): Promise<void>;
  click(options?: { timeout?: number; position?: { x: number; y: number } }): Promise<void>;
};

type JsHandle<T = unknown> = {
  jsonValue(): Promise<T>;
};

type Page = {
  url(): string;
  goto(url: string, options?: { waitUntil?: "domcontentloaded"; timeout?: number }): Promise<unknown>;
  reload(options?: { waitUntil?: "domcontentloaded"; timeout?: number }): Promise<unknown>;
  title(): Promise<string>;
  content(): Promise<string>;
  waitForFunction<T = unknown>(
    pageFunction: (() => T) | string,
    options?: { timeout?: number },
  ): Promise<JsHandle<T>>;
  locator(selector: string): Locator;
  waitForURL(predicate: (url: URL) => boolean, options?: { timeout?: number }): Promise<void>;
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<unknown>;
  $$eval<T>(selector: string, pageFunction: (elements: Element[]) => T): Promise<T>;
  evaluate<T>(pageFunction: () => T | Promise<T>): Promise<T>;
  frames(): Frame[];
};

type Frame = {
  url(): string;
  name(): string;
  locator(selector: string): Locator;
};

type BrowserContext = {
  pages(): Page[];
  newPage(): Promise<Page>;
  storageState(options: { path: string }): Promise<unknown>;
  close(): Promise<void>;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, ".env") });
loadEnv({ path: resolve(__dirname, "../../.env") });

process.on("uncaughtException", (e: any) => {
  const msg = String(e?.stack || e?.message || e);
  if (
    msg.includes("Cannot read properties of undefined (reading 'url')") &&
    msg.includes("FFBrowserContext") &&
    msg.includes("_onUncaughtError")
  ) {
    console.warn("[browser] ignored pageerror event with missing location");
    return;
  }
  console.error("[fatal]", e);
  process.exit(1);
});

const env = (key: string, fallback?: string): string => {
  const v = process.env[key] ?? fallback;
  if (!v) {
    console.error(`[env] missing: ${key}`);
    process.exit(1);
  }
  return v;
};

const KBJ_EMAIL = env("KBJ_EMAIL");
const KBJ_PASSWORD = env("KBJ_PASSWORD");
const DATABASE_URL = env("DATABASE_URL");
const R2_ACCOUNT_ID = env("R2_ACCOUNT_ID");
const R2_ACCESS_KEY_ID = env("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = env("R2_SECRET_ACCESS_KEY");
const R2_BUCKET_NAME = env("R2_BUCKET_NAME");
const R2_KEY_PREFIX = process.env.R2_KEY_PREFIX || "clips/kbjfree/";
const STATE_DIR = process.env.STATE_DIR || resolve(__dirname, ".state");
const LOOP_INTERVAL_SEC = Math.max(60, Number(process.env.LOOP_INTERVAL_SEC || "600"));
// 0 = ไม่จำกัด — เดินจน /videos หน้าใดหน้าหนึ่งว่าง หรือทุก ID ในหน้านั้นมีใน DB แล้ว
const MAX_PAGES_PER_CYCLE = Math.max(0, Number(process.env.MAX_PAGES_PER_CYCLE || "0"));
// เจอ N หน้าติดที่ทุกคลิปเก่าหมดแล้ว → หยุด crawl (กันการไล่ลง deep ทุกรอบ)
const STOP_AFTER_KNOWN_PAGES = Math.max(1, Number(process.env.STOP_AFTER_KNOWN_PAGES || "2"));
const VIP_KEYWORD = (process.env.VIP_CATEGORY_KEYWORD || "premium").toLowerCase();
const ONESHOT = process.env.ONESHOT === "1";
// จำกัดจำนวนคลิปที่ download ต่อ cycle (0 = ไม่จำกัด)
const MAX_DOWNLOADS_PER_CYCLE = Math.max(0, Number(process.env.MAX_DOWNLOADS_PER_CYCLE || "0"));
const BROWSER_HEADLESS = process.env.HEADLESS !== "0";

const ORIGIN = "https://kbjfree.com";
const CF_GOTO_ATTEMPTS = Math.max(1, Number(process.env.CF_GOTO_ATTEMPTS || "3"));
const CF_CLICK_ROUNDS = Math.max(1, Number(process.env.CF_CLICK_ROUNDS || "8"));
const CF_SETTLE_MS = Math.max(1_000, Number(process.env.CF_SETTLE_MS || "5_000"));
const CF_WAIT_PER_ROUND_MS = Math.max(5_000, Number(process.env.CF_WAIT_PER_ROUND_MS || "20_000"));
const STATE_PATH = resolve(STATE_DIR, "state.json");
const BROWSER_DATA_DIR = resolve(STATE_DIR, "browser-data");
mkdirSync(STATE_DIR, { recursive: true });
mkdirSync(BROWSER_DATA_DIR, { recursive: true });

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

const BOOTSTRAP_KEY = process.env.STATE_BOOTSTRAP_KEY || "internal/kbjfree-state.tar.gz";

/**
 * On first boot — when /data/state is empty — pull a pre-warmed Camoufox
 * profile + login cookies + cf_clearance from R2 and extract them. This
 * lets the container skip the first Cloudflare interstitial (which is
 * the hardest one) without ever having to interactively solve it on
 * the VPS's IP.
 *
 * The bundle is created locally via `tar -czf - -C .state . | aws s3 cp`
 * and only needs to be refreshed when the cf_clearance cookie expires
 * (≈ a couple of weeks). The script never overwrites a non-empty state
 * dir.
 */
async function maybeRestoreState(): Promise<void> {
  if (existsSync(STATE_PATH)) {
    console.log("[bootstrap] state.json already present — using cached profile");
    return;
  }
  try {
    console.log(`[bootstrap] fetching ${BOOTSTRAP_KEY} from R2…`);
    const res = await s3.send(
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: BOOTSTRAP_KEY }),
    );
    if (!res.Body) throw new Error("empty body");
    const stream = res.Body as Readable;
    await new Promise<void>((done, fail) => {
      const tar = spawn("tar", ["xzf", "-", "-C", STATE_DIR], {
        stdio: ["pipe", "inherit", "inherit"],
      });
      tar.on("error", fail);
      tar.on("exit", (code) => (code === 0 ? done() : fail(new Error(`tar exit ${code}`))));
      stream.pipe(tar.stdin);
    });
    console.log("[bootstrap] state restored");
  } catch (e: any) {
    console.warn(`[bootstrap] could not restore state: ${e?.message ?? e} (will solve CF live)`);
  }
}

// ─────────────────────────── helpers ─────────────────────────────

function slug(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

function safeName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 100) || "video";
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

/**
 * Atomically upsert a category by slug.
 *
 * The DB has a UNIQUE on slug, so two workers crawling in parallel can't
 * create dupes — second one hits the conflict and we re-read the existing
 * row. `parentId` is only set on INSERT; we never mutate the parent of an
 * existing category.
 */
async function ensureCategory(args: {
  slug: string;
  name: string;
  parentId: string | null;
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
        parentId: args.parentId,
        accessLevel: args.accessLevel,
        isActive: true,
      })
      .returning({ id: categoriesTable.id, accessLevel: categoriesTable.accessLevel });
    console.log(`[cat] created ${args.slug} (${args.accessLevel})${args.parentId ? " <child>" : ""}`);
    return row;
  } catch (e) {
    // race: somebody else inserted between our SELECT and INSERT — re-read
    const again = await db
      .select({ id: categoriesTable.id, accessLevel: categoriesTable.accessLevel })
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, args.slug))
      .limit(1);
    if (again.length) return again[0];
    throw e;
  }
}

// ─────────────────────────── playwright ──────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CF_TITLE_RE = /just a moment|attention required|cloudflare|verify you are human/i;
const CF_HTML_RE =
  /cf-browser-verification|cf-challenge|__cf_chl_|cf-turnstile|challenges\.cloudflare\.com|verify you are human|checking your browser/i;

async function isCloudflareChallenge(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => "");
  const html = await page.content().catch(() => "");
  return CF_TITLE_RE.test(title) || CF_HTML_RE.test(html);
}

async function clickCloudflareTurnstile(page: Page): Promise<boolean> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const frame = page.frames().find((f) =>
      f.url().includes("challenges.cloudflare.com") || f.name().startsWith("cf-chl-widget"),
    );
    if (frame) {
      for (const selector of ['input[type="checkbox"]', "body"]) {
        try {
          await frame.locator(selector).click({ position: { x: 25, y: 35 }, timeout: 5_000 });
          return true;
        } catch {}
      }
    }
    await sleep(750);
  }
  return false;
}

async function gotoSafe(page: Page, url: string): Promise<void> {
  for (let navAttempt = 1; navAttempt <= CF_GOTO_ATTEMPTS; navAttempt++) {
    if (navAttempt === 1 || page.url() === "about:blank") {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    } else {
      console.warn(`[cf] reload retry ${navAttempt}/${CF_GOTO_ATTEMPTS} for ${url}`);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 }).catch(async () => {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      });
    }

    await sleep(CF_SETTLE_MS);
    if (!(await isCloudflareChallenge(page))) return;

    console.warn(`[cf] challenge on ${url} - attempting Turnstile clearance (${navAttempt}/${CF_GOTO_ATTEMPTS})`);
    for (let round = 1; round <= CF_CLICK_ROUNDS; round++) {
      const clicked = await clickCloudflareTurnstile(page);
      if (clicked) console.log(`[cf] Turnstile click round ${round}/${CF_CLICK_ROUNDS}`);

      await page
        .waitForFunction(
          () => {
            const title = document.title || "";
            const html = document.documentElement?.innerHTML || "";
            return (
              !/just a moment|attention required|cloudflare|verify you are human/i.test(title) &&
              !/cf-browser-verification|cf-challenge|__cf_chl_|cf-turnstile|challenges\.cloudflare\.com|verify you are human|checking your browser/i.test(
                html,
              )
            );
          },
          { timeout: CF_WAIT_PER_ROUND_MS },
        )
        .catch(() => undefined);

      await sleep(1_500);
      if (!(await isCloudflareChallenge(page))) {
        console.log(`[cf] clearance OK for ${url}`);
        return;
      }
    }
  }

  throw new Error(`Cloudflare challenge could not be solved on ${url}`);
}

async function warmCloudflare(page: Page): Promise<void> {
  console.log("[cf] warming Cloudflare session");
  await gotoSafe(page, ORIGIN);
  await sleep(3_000);
}

async function ensureLoggedIn(page: Page): Promise<void> {
  await warmCloudflare(page);
  const accountBtn = page.locator('[aria-label^="Account menu"]').first();
  if (await accountBtn.count()) {
    const label = (await accountBtn.getAttribute("aria-label")) ?? "";
    if (label.includes("@")) {
      console.log("[auth] session active");
      return;
    }
  }
  console.log("[auth] logging in…");
  await gotoSafe(page, `${ORIGIN}/login`);
  await page.locator('input[type="email"], input[name="email"]').first().fill(KBJ_EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(KBJ_PASSWORD);

  for (let attempt = 1; attempt <= 2; attempt++) {
    await clickCloudflareTurnstile(page);
    await new Promise((r) => setTimeout(r, 2_000));
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 }).catch(() => undefined);

    if (!new URL(page.url()).pathname.startsWith("/login")) {
      console.log("[auth] login OK");
      return;
    }
    console.warn(`[auth] login still on /login after attempt ${attempt}`);
  }

  throw new Error("login did not complete");
}

async function discoverIds(page: Page): Promise<string[]> {
  const ids = new Set<string>();
  let knownStreak = 0; // หน้าติดต่อกันที่ทุก ID อยู่ใน DB แล้ว
  const cap = MAX_PAGES_PER_CYCLE === 0 ? Number.POSITIVE_INFINITY : MAX_PAGES_PER_CYCLE;

  for (let p = 1; p <= cap; p++) {
    const url = p === 1 ? `${ORIGIN}/videos` : `${ORIGIN}/videos?page=${p}`;
    await gotoSafe(page, url);
    await page
      .waitForSelector('a[href^="/watch/"]', { timeout: 15_000 })
      .catch(() => undefined);
    const pageIds: string[] = await page.$$eval('a[href^="/watch/"]', (els) =>
      Array.from(
        new Set(
          els
            .map((e) => (e as HTMLAnchorElement).getAttribute("href") || "")
            .map((h) => h.split("/").pop() || "")
            .filter(Boolean),
        ),
      ),
    );

    if (pageIds.length === 0) {
      console.log(`[discover] page=${p} empty → end of list`);
      break;
    }

    // เช็คความใหม่ทีละหน้า: ถ้าเก่าหมดติด N หน้า → หยุด
    let pageHasNew = false;
    for (const id of pageIds) {
      if (!ids.has(id)) {
        // เช็ค DB เป็นรายตัวเฉพาะตอน peek ว่าใหม่ไหม
        const exists = await clipExists(`${ORIGIN}/watch/${id}`);
        if (!exists) {
          ids.add(id);
          pageHasNew = true;
        }
      }
    }
    if (pageHasNew) {
      knownStreak = 0;
    } else {
      knownStreak++;
      console.log(`[discover] page=${p} all-known streak=${knownStreak}`);
      if (knownStreak >= STOP_AFTER_KNOWN_PAGES) {
        console.log(`[discover] stopping — ${knownStreak} pages of nothing new`);
        break;
      }
    }
    console.log(`[discover] /videos page=${p} +${pageIds.length} (new-total ${ids.size})`);
  }
  return [...ids];
}

interface ClipMeta {
  id: string;
  title: string;
  mp4Url: string;
  categorySlug: string;
  modelSlug: string;
  duration?: number;
}

async function resolveClip(page: Page, id: string): Promise<ClipMeta> {
  await gotoSafe(page, `${ORIGIN}/watch/${id}`);

  // play() so currentSrc is populated even on lazy players
  await page.evaluate(() => {
    const v = document.querySelector("video") as HTMLVideoElement | null;
    if (v) {
      v.muted = true;
      v.play().catch(() => {});
    }
  });

  const mp4Url = (await page
    .waitForFunction(
      () => {
        const v = document.querySelector("video") as HTMLVideoElement | null;
        const src = v?.currentSrc || v?.src || "";
        return src.startsWith("http") ? src : null;
      },
      { timeout: 20_000 },
    )
    .then((h) => h.jsonValue())) as string;

  // category/model: pick the FIRST /category/ + /model/ link that lives
  // inside the same container as the <video>, walking up until we find
  // a container that has at least one of each. That avoids picking the
  // sidebar's grid of unrelated categories.
  const meta = await page.evaluate(() => {
    const video = document.querySelector("video");
    let container: HTMLElement | null = video?.closest("div") ?? null;
    while (container) {
      const cat = container.querySelector('a[href^="/category/"]');
      const mod = container.querySelector('a[href^="/model/"]');
      if (cat && mod) {
        return {
          categoryHref: cat.getAttribute("href")!,
          categoryName: cat.textContent?.trim() || "",
          modelHref: mod.getAttribute("href")!,
          modelName: mod.textContent?.trim() || "",
        };
      }
      container = container.parentElement;
    }
    return null;
  });

  if (!meta) throw new Error("could not locate category/model on watch page");

  const categorySlug = meta.categoryHref.replace(/^\/category\//, "").trim();
  const modelSlug = meta.modelHref.replace(/^\/model\//, "").trim();
  if (!categorySlug || !modelSlug) throw new Error("empty category/model slug");

  const title = (await page.title()).replace(/\s*-\s*KBJFree\s*$/, "").trim() || id;
  const duration = (await page.evaluate(() => {
    const v = document.querySelector("video") as HTMLVideoElement | null;
    return v && Number.isFinite(v.duration) ? v.duration : null;
  })) as number | null;

  return {
    id,
    title,
    mp4Url,
    categorySlug,
    modelSlug,
    duration: duration ?? undefined,
  };
}

// ─────────────────────────── pipeline ────────────────────────────

async function streamUploadToR2(meta: ClipMeta, key: string): Promise<number> {
  console.log(`[fetch] ${meta.id} → ${key}`);
  const res = await fetch(meta.mp4Url, {
    headers: {
      Referer: `${ORIGIN}/watch/${meta.id}`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok || !res.body) throw new Error(`fetch ${meta.id} failed: ${res.status}`);

  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength) console.log(`[fetch] size ≈ ${(contentLength / 1024 / 1024).toFixed(1)} MB`);

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: Readable.fromWeb(res.body as any),
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
      console.log(`[upload]  ${meta.id}  ${mb.toFixed(0)} MB`);
    }
  });

  await upload.done();
  console.log(`[done] ${key}`);
  return contentLength;
}

async function processOne(page: Page, id: string): Promise<"ok" | "skip" | "fail"> {
  const sourceUrl = `${ORIGIN}/watch/${id}`;
  if (await clipExists(sourceUrl)) {
    console.log(`[skip] db already has ${id}`);
    return "skip";
  }

  let meta: ClipMeta;
  try {
    meta = await resolveClip(page, id);
  } catch (e: any) {
    console.error(`[err] resolve ${id}: ${e?.message ?? e}`);
    return "fail";
  }

  const r2Key = `${R2_KEY_PREFIX}${meta.id}_${safeName(meta.title)}.mp4`;

  // Parent category (kbjfree's category, e.g. "popkontv")
  const parentName = meta.categorySlug;
  const parentAccess: "member" | "vip" =
    parentName.toLowerCase().includes(VIP_KEYWORD) ? "vip" : "member";
  const parent = await ensureCategory({
    slug: slug(parentName),
    name: parentName,
    parentId: null,
    accessLevel: parentAccess,
  });

  // Child category (model). Inherits VIP from parent.
  const child = await ensureCategory({
    slug: `${slug(parentName)}-${slug(meta.modelSlug)}`,
    name: meta.modelSlug,
    parentId: parent.id,
    accessLevel: parent.accessLevel,
  });

  let bytes = 0;
  if (await objectExists(r2Key)) {
    console.log(`[r2] already exists ${r2Key} — reusing, only inserting clip row`);
  } else {
    try {
      bytes = await streamUploadToR2(meta, r2Key);
    } catch (e: any) {
      console.error(`[err] upload ${id}: ${e?.message ?? e}`);
      return "fail";
    }
  }

  try {
    await db.insert(clipsTable).values({
      id: nanoid(),
      title: meta.title,
      categoryId: child.id,
      accessLevel: child.accessLevel,
      r2Key,
      duration: meta.duration,
      fileSize: bytes || undefined,
      mimeType: "video/mp4",
      isActive: true,
      sourceUrl,
    });
    console.log(`[clip] inserted ${meta.id} → ${child.accessLevel} / ${parentName} / ${meta.modelSlug}`);
    return "ok";
  } catch (e: any) {
    // unique violation on sourceUrl → another worker grabbed it first; fine
    if (String(e?.message).includes("clips_source_url_unique")) {
      console.log(`[skip] db race on ${id}`);
      return "skip";
    }
    console.error(`[err] insert clip ${id}: ${e?.message ?? e}`);
    return "fail";
  }
}

// ───────────────────────────── loop ──────────────────────────────

async function cycle(ctx: BrowserContext, page: Page): Promise<void> {
  await ensureLoggedIn(page);
  await ctx.storageState({ path: STATE_PATH });

  const fresh = await discoverIds(page);
  console.log(`[cycle] ${fresh.length} new videos`);

  let ok = 0, skip = 0, fail = 0;
  for (const id of fresh) {
    if (MAX_DOWNLOADS_PER_CYCLE && ok >= MAX_DOWNLOADS_PER_CYCLE) {
      console.log(`[cycle] reached MAX_DOWNLOADS_PER_CYCLE=${MAX_DOWNLOADS_PER_CYCLE} → stop`);
      break;
    }
    const r = await processOne(page, id);
    if (r === "ok") ok++;
    else if (r === "skip") skip++;
    else fail++;
  }
  console.log(`[cycle] done  ok=${ok}  skip=${skip}  fail=${fail}`);
}

async function main() {
  console.log(`[boot] kbjfree-dl worker — interval=${LOOP_INTERVAL_SEC}s`);
  await maybeRestoreState();
  let ctx: BrowserContext;
  let page: Page;

  const open = async () => {
    const { Camoufox } = await import("camoufox-js");
    const ctx = (await Camoufox({
      user_data_dir: BROWSER_DATA_DIR,
      headless: BROWSER_HEADLESS,
      os: process.platform === "win32" ? "windows" : "linux",
      window: [1366, 900],
      screen: { minWidth: 1366, maxWidth: 1366, minHeight: 900, maxHeight: 900 },
      locale: "en-US",
      humanize: 2,
      block_webrtc: true,
      disable_coop: true,
      enable_cache: true,
      firefox_user_prefs: {
        "media.navigator.enabled": false,
        "media.peerconnection.enabled": false,
        "privacy.resistFingerprinting.letterboxing": false,
      },
    })) as BrowserContext;
    return {
      ctx,
      page: ctx.pages()[0] ?? (await ctx.newPage()),
    };
  };

  ({ ctx, page } = await open());

  // Keep the browser alive across cycles. Recreate on crash.
  for (;;) {
    try {
      await cycle(ctx, page);
    } catch (e: any) {
      console.error(`[cycle] error: ${e?.message ?? e}`);
      try { await ctx.close(); } catch {}
      await new Promise((r) => setTimeout(r, 5_000));
      if (ONESHOT) process.exit(1);
      ({ ctx, page } = await open());
    }
    if (ONESHOT) {
      console.log("[oneshot] exiting after single cycle");
      try { await ctx.close(); } catch {}
      try { await pg.end({ timeout: 5 }); } catch {}
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
