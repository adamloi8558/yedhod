import { TelegramClient, Api } from "telegram";
import { NewMessage } from "telegram/events/index.js";
import { getMediaInfo, downloadAndUploadMedia } from "./media.js";
import {
  createClipRecord,
  recordSyncedMessage,
  isMessageSynced,
  getLastSyncedMessageId,
} from "./db-operations.js";
import { getForumTopics, getOrCreateCategory } from "./topics.js";
import { getTopicAccessLevels, getAccessLevelForTopic } from "./config.js";
import { delay } from "./utils.js";

async function processMessage(
  client: TelegramClient,
  message: Api.Message,
  topicId: number,
  categoryId: string,
  groupId: string
): Promise<void> {
  const mediaInfo = getMediaInfo(message);

  // Skip messages without media
  if (!mediaInfo) {
    await recordSyncedMessage({
      telegramMessageId: message.id,
      telegramTopicId: topicId,
      telegramGroupId: groupId,
      clipId: null,
      categoryId,
      mediaType: null,
      status: "skipped",
    });
    return;
  }

  // Download and upload media
  const result = await downloadAndUploadMedia(client, message);
  if (!result) {
    await recordSyncedMessage({
      telegramMessageId: message.id,
      telegramTopicId: topicId,
      telegramGroupId: groupId,
      clipId: null,
      categoryId,
      mediaType: mediaInfo.mediaType,
      status: "failed",
      errorMessage: "Failed to download/upload media",
    });
    return;
  }

  // Determine title: caption -> filename -> empty
  const caption = message.message?.trim() || "";
  const title = caption || mediaInfo.fileName || "";

  // Create clip record (access level is now on category, not clip)
  const clipId = await createClipRecord({
    title,
    categoryId,
    r2Key: result.r2Key,
    thumbnailR2Key: result.thumbnailR2Key,
    mimeType: result.mimeType,
    fileSize: result.fileSize,
    duration: result.duration,
  });

  await recordSyncedMessage({
    telegramMessageId: message.id,
    telegramTopicId: topicId,
    telegramGroupId: groupId,
    clipId,
    categoryId,
    mediaType: result.mediaType,
    status: "synced",
  });

  console.log(
    `[sync] Synced message ${message.id} -> clip ${clipId} (${result.mediaType})`
  );
}

async function syncTopic(
  client: TelegramClient,
  group: Api.TypeEntityLike,
  topicId: number,
  categoryId: string,
  groupId: string
): Promise<number> {
  const lastSyncedId = await getLastSyncedMessageId(groupId, topicId);
  let synced = 0;
  let offsetId = 0;

  console.log(
    `[sync] Syncing topic ${topicId}, last synced message: ${lastSyncedId ?? "none"}`
  );

  while (true) {
    const messages = await client.getMessages(group, {
      limit: 100,
      offsetId,
      replyTo: topicId,
      minId: lastSyncedId ?? undefined,
    });

    if (messages.length === 0) break;

    // Process oldest first
    const sorted = [...messages].reverse();

    for (const message of sorted) {
      if (!(message instanceof Api.Message)) continue;

      const alreadySynced = await isMessageSynced(
        groupId,
        topicId,
        message.id
      );
      if (alreadySynced) continue;

      try {
        await processMessage(client, message, topicId, categoryId, groupId);
        synced++;
      } catch (err) {
        console.error(
          `[sync] Error processing message ${message.id}:`,
          err
        );
        await recordSyncedMessage({
          telegramMessageId: message.id,
          telegramTopicId: topicId,
          telegramGroupId: groupId,
          clipId: null,
          categoryId,
          mediaType: null,
          status: "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }

      // Rate limit protection
      await delay(500);
    }

    // Move offset to oldest message for next batch
    offsetId = messages[messages.length - 1]!.id;
  }

  return synced;
}

export async function backfill(
  client: TelegramClient,
  group: Api.TypeEntityLike,
  groupId: string
): Promise<void> {
  console.log("[sync] Starting backfill...");

  const topics = await getForumTopics(client, group);
  const accessLevels = await getTopicAccessLevels();
  console.log(`[sync] Found ${topics.size} topics`);

  let totalSynced = 0;

  for (const [topicId, topicTitle] of topics) {
    const accessLevel = getAccessLevelForTopic(topicId, accessLevels);
    console.log(`[sync] Processing topic: "${topicTitle}" (${topicId}) [${accessLevel}]`);
    const categoryId = await getOrCreateCategory(topicId, topicTitle, accessLevel);
    const count = await syncTopic(client, group, topicId, categoryId, groupId);
    totalSynced += count;
    console.log(`[sync] Topic "${topicTitle}": synced ${count} messages`);
  }

  console.log(`[sync] Backfill complete. Total synced: ${totalSynced}`);
}

export async function startRealtimeListener(
  client: TelegramClient,
  group: Api.TypeEntityLike,
  groupId: string
): Promise<void> {
  console.log("[sync] Starting realtime listener...");

  client.addEventHandler(async (event) => {
    const message = event.message;
    if (!(message instanceof Api.Message)) return;

    // Determine topic ID from reply
    const topicId = message.replyTo?.replyToTopId;
    if (!topicId) return; // Message not in a topic

    const mediaInfo = getMediaInfo(message);
    if (!mediaInfo) return; // Not a media message

    // Check if already synced
    const alreadySynced = await isMessageSynced(groupId, topicId, message.id);
    if (alreadySynced) return;

    try {
      const topics = await getForumTopics(client, group);
      const topicTitle = topics.get(topicId) || `Topic ${topicId}`;
      const accessLevels = await getTopicAccessLevels();
      const accessLevel = getAccessLevelForTopic(topicId, accessLevels);
      const categoryId = await getOrCreateCategory(topicId, topicTitle, accessLevel);

      await processMessage(client, message, topicId, categoryId, groupId);
    } catch (err) {
      console.error(
        `[realtime] Error processing message ${message.id}:`,
        err
      );
    }
  }, new NewMessage({ chats: [group] }));

  console.log("[sync] Realtime listener active");
}
