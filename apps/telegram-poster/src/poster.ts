import { Bot, InputFile } from "grammy";
import { db, clips, categories, telegramPostedClips } from "@kodhom/db";
import { eq, and, isNull } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { nanoid, delay } from "./utils.js";

// Telegram Bot API hard limit for sendVideo via multipart upload.
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

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

export async function postClip(
  bot: Bot,
  clip: { id: string; title: string; r2Key: string; duration: number | null; fileSize: number | null; categoryName: string },
  targetGroupId: string
): Promise<void> {
  try {
    // Cheap pre-flight: file_size is already stored on the clip row.
    // If the file is over Telegram's 50MB cap we skip BEFORE trying to
    // download it. Previously the poster pulled the whole file into a
    // Buffer just to abort — a 3.4 GB KBJ recording would OOM the
    // container or time out the R2 stream, producing the "terminated"
    // errors we've been seeing since 7 Jun.
    if (clip.fileSize && clip.fileSize > MAX_SIZE_BYTES) {
      const mb = (clip.fileSize / 1024 / 1024).toFixed(1);
      console.log(`[poster] Skipping clip ${clip.id} (pre-flight): ${mb}MB > 50MB`);
      await db.insert(telegramPostedClips).values({
        id: nanoid(),
        clipId: clip.id,
        targetGroupId,
        status: "skipped",
        errorMessage: `File too large (pre-flight): ${mb}MB`,
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

    // Fallback in case file_size was missing or stale.
    if (buffer.length > MAX_SIZE_BYTES) {
      console.log(`[poster] Skipping clip ${clip.id}: ${(buffer.length / 1024 / 1024).toFixed(1)}MB exceeds 50MB limit`);
      await db.insert(telegramPostedClips).values({
        id: nanoid(),
        clipId: clip.id,
        targetGroupId,
        status: "skipped",
        errorMessage: `File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB`,
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
