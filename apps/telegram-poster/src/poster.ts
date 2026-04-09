import { Bot, InputFile } from "grammy";
import { db, clips, categories, telegramPostedClips } from "@kodhom/db";
import { eq, and, isNull } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { nanoid, delay } from "./utils.js";

export async function getUnpostedClips(targetGroupId: string) {
  const result = await db
    .select({
      id: clips.id,
      title: clips.title,
      r2Key: clips.r2Key,
      duration: clips.duration,
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
  clip: { id: string; title: string; r2Key: string; duration: number | null; categoryName: string },
  targetGroupId: string
): Promise<void> {
  try {
    // Get download URL from R2
    const downloadUrl = await getPresignedDownloadUrl(clip.r2Key, 3600);

    // Download video
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download from R2: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    // Send video to Telegram group
    const caption = clip.title || clip.categoryName;
    const msg = await bot.api.sendVideo(
      targetGroupId,
      new InputFile(buffer, `${clip.id}.mp4`),
      {
        caption: caption || undefined,
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
