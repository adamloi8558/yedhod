import { Bot, InputFile } from "grammy";
import { db, clips, categories, telegramPostedClips } from "@kodhom/db";
import { eq, and, isNull } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { nanoid, delay } from "./utils.js";

// Telegram Bot API hard limit for sendVideo via multipart upload.
const MAX_SIZE_BYTES = 50 * 1024 * 1024;
// Public site URL used when a clip is too big to upload — we post a
// link instead so the customer can watch on the web. Falls back to the
// production host if the env var isn't set.
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

function buildClipMessage(clip: {
  id: string;
  title: string;
  categoryName: string;
}, sizeMb: string): string {
  // Plain text — Telegram autolinks the URL and renders a card preview
  // from the page's open-graph tags. No HTML/MarkdownV2 escaping
  // headaches.
  const url = `${SITE_URL}/clip/${clip.id}`;
  return [
    `🎬 ${clip.title}`,
    `📁 ${clip.categoryName}  ·  ${sizeMb} MB`,
    "",
    `▶️ ดูคลิป: ${url}`,
  ].join("\n");
}

export async function postClip(
  bot: Bot,
  clip: { id: string; title: string; r2Key: string; duration: number | null; fileSize: number | null; categoryName: string },
  targetGroupId: string
): Promise<void> {
  try {
    // Cheap pre-flight: file_size is already stored on the clip row.
    // If the file is over Telegram's 50MB cap we DON'T download it —
    // instead we post a text message with a link to the web player.
    // The customer still hears about every new clip, the bot doesn't
    // OOM/timeout on multi-GB uploads, and we get free site traffic.
    if (clip.fileSize && clip.fileSize > MAX_SIZE_BYTES) {
      const mb = (clip.fileSize / 1024 / 1024).toFixed(1);
      console.log(`[poster] Posting link for clip ${clip.id} (${mb}MB > 50MB)`);
      const msg = await bot.api.sendMessage(targetGroupId, buildClipMessage(clip, mb));
      await db.insert(telegramPostedClips).values({
        id: nanoid(),
        clipId: clip.id,
        telegramMessageId: msg.message_id,
        targetGroupId,
        status: "posted",
        errorMessage: `link-only (${mb}MB)`,
      });
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

    // Fallback in case file_size was missing or stale: same link-fallback
    // path as the pre-flight branch above.
    if (buffer.length > MAX_SIZE_BYTES) {
      const mb = (buffer.length / 1024 / 1024).toFixed(1);
      console.log(`[poster] Posting link for clip ${clip.id} (${mb}MB > 50MB, post-download)`);
      const msg = await bot.api.sendMessage(targetGroupId, buildClipMessage(clip, mb));
      await db.insert(telegramPostedClips).values({
        id: nanoid(),
        clipId: clip.id,
        telegramMessageId: msg.message_id,
        targetGroupId,
        status: "posted",
        errorMessage: `link-only (${mb}MB)`,
      });
      return;
    }

    // Send video to Telegram group
    const msg = await bot.api.sendVideo(
      targetGroupId,
      new InputFile(buffer, `${clip.id}.mp4`),
      {
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
