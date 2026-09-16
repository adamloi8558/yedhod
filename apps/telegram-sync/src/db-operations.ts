import { db, clips, telegramSyncMessages, systemConfig } from "@kodhom/db";
import { eq, and, max, ne, lt, asc, like, sql, inArray } from "drizzle-orm";
import { nanoid } from "./utils.js";

export async function createClipRecord(params: {
  title: string;
  categoryId: string;
  r2Key: string;
  thumbnailR2Key: string | null;
  mimeType: string;
  fileSize: number | null;
  duration: number | null;
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
    accessLevel: "member",
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
  await db
    .insert(telegramSyncMessages)
    .values({
      id,
      telegramMessageId: params.telegramMessageId,
      telegramTopicId: params.telegramTopicId,
      telegramGroupId: params.telegramGroupId,
      clipId: params.clipId,
      categoryId: params.categoryId,
      mediaType: params.mediaType,
      status: params.status,
      errorMessage: params.errorMessage,
    })
    .onConflictDoUpdate({
      target: [
        telegramSyncMessages.telegramGroupId,
        telegramSyncMessages.telegramTopicId,
        telegramSyncMessages.telegramMessageId,
      ],
      set: {
        clipId: params.clipId,
        categoryId: params.categoryId,
        mediaType: params.mediaType,
        status: params.status,
        errorMessage: params.status === "failed" && params.errorMessage !== undefined
          ? sql`case when ${telegramSyncMessages.errorMessage} like 'Backfill requested from %'
              then split_part(${telegramSyncMessages.errorMessage}, ' | last error: ', 1) || ' | last error: ' || ${params.errorMessage}
              else ${params.errorMessage} end`
          : params.errorMessage,
        // Failed records use the last attempt time to rotate the retry queue.
        createdAt: new Date(),
      },
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
  return !!existing && existing.status !== "failed";
}

export async function getLastSyncedMessageId(
  groupId: string,
  topicId: number
): Promise<number | null> {
  const cursor = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, "telegram_sync_cursors"),
  });
  const cursorKey = `${groupId}:${topicId}`;
  if (cursor && cursor.value && typeof cursor.value === "object" && Object.hasOwn(cursor.value, cursorKey)) {
    const messageId = (cursor.value as Record<string, unknown>)[cursorKey];
    if (messageId === null || (typeof messageId === "number" && Number.isSafeInteger(messageId) && messageId >= 0)) return messageId;
    throw new Error("Invalid Telegram discovery cursor");
  }
  const result = await db
    .select({ maxId: max(telegramSyncMessages.telegramMessageId) })
    .from(telegramSyncMessages)
    .where(
      and(
        eq(telegramSyncMessages.telegramGroupId, groupId),
        eq(telegramSyncMessages.telegramTopicId, topicId),
        ne(telegramSyncMessages.status, "failed")
      )
    );

  return result[0]?.maxId ?? null;
}

// Discovery advances independently of out-of-order retries. A requested replay
// must not move the history cursor past messages that have never been examined.
export async function saveSyncCursor(groupId: string, topicId: number, messageId: number | null): Promise<void> {
  const value = { [`${groupId}:${topicId}`]: messageId };
  await db.insert(systemConfig).values({
    id: nanoid(), key: "telegram_sync_cursors", value,
  }).onConflictDoUpdate({ target: systemConfig.key, set: {
    value: sql`${systemConfig.value} || ${JSON.stringify(value)}::jsonb`, updatedAt: new Date(),
  } });
}

export async function getRequestedBackfillMessageIds(groupId: string, topicId: number): Promise<number[]> {
  const rows = await db.select({ id: telegramSyncMessages.telegramMessageId }).from(telegramSyncMessages)
    .where(and(eq(telegramSyncMessages.telegramGroupId, groupId), eq(telegramSyncMessages.telegramTopicId, topicId),
      eq(telegramSyncMessages.status, "failed"), like(telegramSyncMessages.errorMessage, "Backfill requested from %"),
      lt(telegramSyncMessages.createdAt, new Date(Date.now() - 15 * 60_000))))
    .orderBy(asc(telegramSyncMessages.telegramMessageId)).limit(100);
  return rows.map(row => row.id);
}

export async function hasReadyRequestedBackfill(groupIds: string[]): Promise<boolean> {
  if (!groupIds.length) return false;
  const rows = await db.select({ id: telegramSyncMessages.id }).from(telegramSyncMessages)
    .where(and(eq(telegramSyncMessages.status, "failed"),
      inArray(telegramSyncMessages.telegramGroupId, groupIds),
      like(telegramSyncMessages.errorMessage, "Backfill requested from %"),
      lt(telegramSyncMessages.createdAt, new Date(Date.now() - 15 * 60_000))))
    .limit(1);
  return rows.length > 0;
}

export async function getFailedMessageIds(groupId: string, topicId: number): Promise<number[]> {
  const rows = await db.select({ id: telegramSyncMessages.telegramMessageId }).from(telegramSyncMessages)
    .where(and(eq(telegramSyncMessages.telegramGroupId, groupId), eq(telegramSyncMessages.telegramTopicId, topicId),
      eq(telegramSyncMessages.status, "failed"), lt(telegramSyncMessages.createdAt, new Date(Date.now() - 15 * 60_000))))
    .orderBy(asc(telegramSyncMessages.createdAt)).limit(5);
  return rows.map(row => row.id);
}
