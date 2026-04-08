import { db, clips, telegramSyncMessages } from "@kodhom/db";
import { eq, and, max } from "drizzle-orm";
import { nanoid } from "./utils.js";

export async function createClipRecord(params: {
  title: string;
  categoryId: string;
  r2Key: string;
  thumbnailR2Key: string | null;
  mimeType: string;
  fileSize: number | null;
  duration: number | null;
  accessLevel: "member" | "vip";
}): Promise<string> {
  const id = nanoid();
  await db.insert(clips).values({
    id,
    title: params.title || "",
    categoryId: params.categoryId,
    r2Key: params.r2Key,
    thumbnailR2Key: params.thumbnailR2Key,
    mimeType: params.mimeType,
    fileSize: params.fileSize,
    duration: params.duration,
    accessLevel: params.accessLevel,
    isActive: true,
    sortOrder: 0,
  });
  return id;
}

export async function recordSyncedMessage(params: {
  telegramMessageId: number;
  telegramTopicId: number;
  telegramGroupId: string;
  clipId: string | null;
  categoryId: string;
  mediaType: string | null;
  status: string;
  errorMessage?: string;
}): Promise<void> {
  const id = nanoid();
  await db.insert(telegramSyncMessages).values({
    id,
    telegramMessageId: params.telegramMessageId,
    telegramTopicId: params.telegramTopicId,
    telegramGroupId: params.telegramGroupId,
    clipId: params.clipId,
    categoryId: params.categoryId,
    mediaType: params.mediaType,
    status: params.status,
    errorMessage: params.errorMessage,
  });
}

export async function isMessageSynced(
  groupId: string,
  topicId: number,
  messageId: number
): Promise<boolean> {
  const existing = await db.query.telegramSyncMessages.findFirst({
    where: and(
      eq(telegramSyncMessages.telegramGroupId, groupId),
      eq(telegramSyncMessages.telegramTopicId, topicId),
      eq(telegramSyncMessages.telegramMessageId, messageId)
    ),
  });
  return !!existing;
}

export async function getLastSyncedMessageId(
  groupId: string,
  topicId: number
): Promise<number | null> {
  const result = await db
    .select({ maxId: max(telegramSyncMessages.telegramMessageId) })
    .from(telegramSyncMessages)
    .where(
      and(
        eq(telegramSyncMessages.telegramGroupId, groupId),
        eq(telegramSyncMessages.telegramTopicId, topicId)
      )
    );

  return result[0]?.maxId ?? null;
}
