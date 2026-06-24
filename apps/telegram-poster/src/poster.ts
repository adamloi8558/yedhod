import { Bot, InputFile } from "grammy";
import { db, clips, categories, telegramPostedClips } from "@kodhom/db";
import { eq, and, isNull } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { nanoid, delay } from "./utils.js";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Telegram Bot API hard limit for sendVideo via multipart upload.
const MAX_SIZE_BYTES = 50 * 1024 * 1024;
// When a clip is too big to upload, we trim a short preview with
// ffmpeg and post that instead. The preview targets ≤30s ≤40MB so it
// stays comfortably under Telegram's cap with room for container
// overhead. We only need the head of the source file — MP4s in R2 are
// stored with +faststart so moov sits at byte 0 and 100MB is plenty
// to seek to second 30.
const PREVIEW_SEC = 30;
const PREVIEW_BUDGET_BYTES = 40 * 1024 * 1024;
const SOURCE_HEAD_BYTES = 100 * 1024 * 1024;
const SITE_URL =
  process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://xn--l3ca4bxbygoa7a.com";

export async function getUnpostedClips(targetGroupId: string) {
  const result = await db
    .select({
      id: clips.id,
      title: clips.title,
      r2Key: clips.r2Key,
      duration: clips.duration,
      fileSize: clips.fileSize,
      categoryName: categories.name,
    })
    .from(clips)
    .innerJoin(categories, eq(clips.categoryId, categories.id))
    .leftJoin(
      telegramPostedClips,
      and(
        eq(clips.id, telegramPostedClips.clipId),
        eq(telegramPostedClips.targetGroupId, targetGroupId)
      )
    )
    .where(
      and(
        eq(categories.accessLevel, "member"),
        eq(categories.isActive, true),
        eq(clips.isActive, true),
        isNull(telegramPostedClips.id)
      )
    )
    .orderBy(clips.createdAt)
    .limit(5);

  return result;
}

/**
 * Pull just the head of the source from R2 with an HTTP Range request.
 * Our MP4s are written with +faststart so moov is at byte 0 — 100 MB
 * is enough to find the first 30s of any reasonable bitrate.
 */
async function fetchHead(url: string, bytes: number): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { Range: `bytes=0-${bytes - 1}` },
  });
  if (!res.ok && res.status !== 206) {
    throw new Error(`R2 head fetch failed: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Trim a short, low-bitrate preview from the source MP4. Re-encodes so
 * the output is guaranteed under the size budget even if the source is
 * 4K. Returns the preview bytes ready for sendVideo.
 */
async function buildPreview(srcMp4: Buffer): Promise<Buffer> {
  const dir = mkdtempSync(join(tmpdir(), "tgp-"));
  const inPath = join(dir, "src.mp4");
  const outPath = join(dir, "preview.mp4");
  writeFileSync(inPath, srcMp4);
  try {
    await new Promise<void>((resolve, reject) => {
      const ff = spawn(
        "ffmpeg",
        [
          "-y",
          "-ss", "0",
          "-i", inPath,
          "-t", String(PREVIEW_SEC),
          "-vf", "scale='min(720,iw)':-2",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "30",
          "-c:a", "aac",
          "-b:a", "96k",
          "-movflags", "+faststart",
          outPath,
        ],
        { stdio: ["ignore", "ignore", "pipe"] }
      );
      let stderr = "";
      ff.stderr.on("data", (d) => { stderr += d.toString(); });
      ff.on("error", reject);
      ff.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
      });
    });
    const out = readFileSync(outPath);
    if (out.length > PREVIEW_BUDGET_BYTES) {
      throw new Error(`preview ${(out.length / 1024 / 1024).toFixed(1)}MB > budget`);
    }
    return out;
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

/**
 * Caption used on every clip we post — both full uploads (<=50MB) and
 * trimmed previews. The link drives traffic from the Telegram group
 * back to the site, which is the whole point of the channel.
 *
 * `kind` decides the call-to-action wording:
 *   - "full"    → for clips we uploaded in full ("ดูบนเว็บ" works as
 *                 thumbnail/related-clip discovery hook).
 *   - "preview" → for trimmed previews ("ดูเต็มที่บนเว็บ" matters more).
 *
 * Telegram caption hard cap is 1024 chars; titles are short so we
 * don't bother truncating.
 */
function clipCaption(
  clip: { id: string; title: string; categoryName: string },
  kind: "full" | "preview",
  meta?: { sizeMb?: string }
): string {
  const url = `${SITE_URL}/clip/${clip.id}`;
  const cta =
    kind === "preview"
      ? `🔥 พรีวิว ${PREVIEW_SEC} วิ — ดูเต็มที่บนเว็บ: ${url}`
      : `👉 ดูบนเว็บ: ${url}`;
  const sizeLine = meta?.sizeMb
    ? `📁 ${clip.categoryName}  ·  ${meta.sizeMb} MB`
    : `📁 ${clip.categoryName}`;
  return [`🎬 ${clip.title}`, sizeLine, "", cta].join("\n");
}

export async function postClip(
  bot: Bot,
  clip: { id: string; title: string; r2Key: string; duration: number | null; fileSize: number | null; categoryName: string },
  targetGroupId: string
): Promise<void> {
  try {
    // Big clips: trim a short preview and post that with a link to the
    // full page on the web. Pre-flight uses clips.file_size so we
    // never download an entire multi-GB file just to abort.
    if (clip.fileSize && clip.fileSize > MAX_SIZE_BYTES) {
      const mb = (clip.fileSize / 1024 / 1024).toFixed(1);
      console.log(`[poster] Trimming preview for clip ${clip.id} (${mb}MB > 50MB)`);
      try {
        const downloadUrl = await getPresignedDownloadUrl(clip.r2Key, 3600);
        const head = await fetchHead(downloadUrl, SOURCE_HEAD_BYTES);
        const preview = await buildPreview(head);
        const msg = await bot.api.sendVideo(
          targetGroupId,
          new InputFile(preview, `${clip.id}-preview.mp4`),
          {
            caption: clipCaption(clip, "preview", { sizeMb: mb }),
            duration: PREVIEW_SEC,
            supports_streaming: true,
          }
        );
        await db.insert(telegramPostedClips).values({
          id: nanoid(),
          clipId: clip.id,
          telegramMessageId: msg.message_id,
          targetGroupId,
          status: "posted",
          errorMessage: `preview-only (${mb}MB source)`,
        });
        console.log(`[poster] Posted preview for clip ${clip.id} -> message ${msg.message_id}`);
      } catch (prevErr) {
        // Preview build can fail (codec quirks, byte-range short read).
        // Record as skipped with the reason — the next deploy can
        // requeue these for retry by deleting the row.
        const reason = prevErr instanceof Error ? prevErr.message : String(prevErr);
        console.warn(`[poster] Preview build failed for ${clip.id}: ${reason}`);
        await db.insert(telegramPostedClips).values({
          id: nanoid(),
          clipId: clip.id,
          targetGroupId,
          status: "skipped",
          errorMessage: `preview-build-failed: ${reason.slice(0, 200)}`,
        });
      }
      return;
    }

    // Get download URL from R2
    const downloadUrl = await getPresignedDownloadUrl(clip.r2Key, 3600);

    // Download video
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download from R2: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    // Fallback in case file_size was missing or stale — same preview
    // path as the pre-flight branch above. The buffer we already
    // downloaded works as the source so no second fetch.
    if (buffer.length > MAX_SIZE_BYTES) {
      const mb = (buffer.length / 1024 / 1024).toFixed(1);
      console.log(`[poster] Trimming preview for clip ${clip.id} (post-download ${mb}MB)`);
      try {
        const preview = await buildPreview(buffer);
        const msg = await bot.api.sendVideo(
          targetGroupId,
          new InputFile(preview, `${clip.id}-preview.mp4`),
          {
            caption: clipCaption(clip, "preview", { sizeMb: mb }),
            duration: PREVIEW_SEC,
            supports_streaming: true,
          }
        );
        await db.insert(telegramPostedClips).values({
          id: nanoid(),
          clipId: clip.id,
          telegramMessageId: msg.message_id,
          targetGroupId,
          status: "posted",
          errorMessage: `preview-only (${mb}MB source)`,
        });
      } catch (prevErr) {
        const reason = prevErr instanceof Error ? prevErr.message : String(prevErr);
        console.warn(`[poster] Preview build failed for ${clip.id}: ${reason}`);
        await db.insert(telegramPostedClips).values({
          id: nanoid(),
          clipId: clip.id,
          targetGroupId,
          status: "skipped",
          errorMessage: `preview-build-failed: ${reason.slice(0, 200)}`,
        });
      }
      return;
    }

    // Send video to Telegram group, with a caption linking back to the
    // clip page on the site. Customers in the group can tap through to
    // the related-clips row, ratings, etc.
    const msg = await bot.api.sendVideo(
      targetGroupId,
      new InputFile(buffer, `${clip.id}.mp4`),
      {
        caption: clipCaption(clip, "full"),
        duration: clip.duration ? Math.round(clip.duration) : undefined,
      }
    );

    // Record success
    await db.insert(telegramPostedClips).values({
      id: nanoid(),
      clipId: clip.id,
      telegramMessageId: msg.message_id,
      targetGroupId,
      status: "posted",
    });

    console.log(`[poster] Posted clip ${clip.id} -> message ${msg.message_id}`);
  } catch (err) {
    // Record failure
    await db.insert(telegramPostedClips).values({
      id: nanoid(),
      clipId: clip.id,
      targetGroupId,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    });

    console.error(`[poster] Failed to post clip ${clip.id}:`, err);
  }
}

export async function pollAndPost(bot: Bot, targetGroupId: string): Promise<number> {
  const unposted = await getUnpostedClips(targetGroupId);

  if (unposted.length === 0) return 0;

  console.log(`[poster] Found ${unposted.length} unposted clips`);

  let posted = 0;
  for (const clip of unposted) {
    await postClip(bot, clip, targetGroupId);
    posted++;
    // Rate limit: wait 3s between posts
    await delay(3000);
  }

  return posted;
}
