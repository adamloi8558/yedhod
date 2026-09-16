import { TelegramClient, Api } from "telegram";
import { NewMessage } from "telegram/events/index.js";
import { getMediaInfo, downloadAndUploadMedia } from "./media.js";
import {
  createClipRecord,
  recordSyncedMessage,
  isMessageSynced,
  getLastSyncedMessageId,
  getFailedMessageIds,
} from "./db-operations.js";
import { isForumGroup, getGroupTitle, getForumTopics, getOrCreateCategory } from "./topics.js";
import { getTopicAccessLevels, getAccessLevelForTopic } from "./config.js";
import { delay } from "./utils.js";

function getMessageTopicId(message: Api.Message): number {
  const reply = message.replyTo;
  return reply?.replyToTopId ?? (reply?.forumTopic ? reply.replyToMsgId : 0) ?? 0;
}

async function processMessage(
  client: TelegramClient,
  message: Api.Message,
  topicId: number,
  categoryId: string,
  groupId: string,
  group: Api.TypeEntityLike
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
  // References fetched at the start of a large batch can expire while earlier
  // videos download. Refresh immediately before each media download.
  const [fresh] = await client.getMessages(group, { ids: [message.id] });
  if (!(fresh instanceof Api.Message)) throw new Error("Source message unavailable");
  let result;
  try { result = await downloadAndUploadMedia(client, fresh); }
  catch (error) {
    if (!(error instanceof Error) || !error.message.includes("FILE_REFERENCE_EXPIRED")) throw error;
    const [renewed] = await client.getMessages(group, { ids: [message.id] });
    if (!(renewed instanceof Api.Message)) throw error;
    result = await downloadAndUploadMedia(client, renewed);
  }
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
    throw new Error("Failed to download/upload media");
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
  const startedAt = Date.now();

  console.log(
    `[sync] Syncing topic ${topicId}, last synced message: ${lastSyncedId ?? "none"}`
  );

  // Bounded work per group prevents a large historical import starving others.
  {
    const messages = await client.getMessages(group, {
      limit: 100,
      offsetId: 0,
      ...(topicId > 0 ? { replyTo: topicId } : {}),
      minId: lastSyncedId ?? 0,
      reverse: true,
    });

    const retryIds = await getFailedMessageIds(groupId, topicId);
    const retries = retryIds.length ? await client.getMessages(group, { ids: retryIds }) : [];
    if (messages.length === 0 && retries.length === 0) return 0;

    // Process oldest first
    const sorted = [...messages].sort((a, b) => a.id - b.id);
    // New clips have priority. Retry a bounded batch of old failures when time permits.
    const seen = new Set(sorted.map(message => message.id));
    for (const retry of retries) if (!seen.has(retry.id)) sorted.push(retry);

    for (const message of sorted) {
      if (!(message instanceof Api.Message)) continue;

      const alreadySynced = await isMessageSynced(
        groupId,
        topicId,
        message.id
      );
      if (alreadySynced) continue;

      try {
        await processMessage(client, message, topicId, categoryId, groupId, group);
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
        // Respect account-wide rate limits; other failed media stays in the retry
        // ledger without preventing later messages from being processed.
        const failure = err as { seconds?: number; errorMessage?: string };
        if (failure.seconds || /FLOOD/i.test(failure.errorMessage ?? "")) throw err;
      }

      // Rate limit protection
      await delay(500);
      if (Date.now() - startedAt > 60_000) break;
    }


  }

  return synced;
}

async function backfillForum(
  client: TelegramClient,
  group: Api.TypeEntityLike,
  groupId: string
): Promise<number> {
  const topics = await getForumTopics(client, group);
  const accessLevels = await getTopicAccessLevels();
  console.log(`[sync] Found ${topics.size} topics`);

  let totalSynced = 0;

  for (const [topicId, topicTitle] of topics) {
    const accessLevel = getAccessLevelForTopic(topicId, accessLevels);
    console.log(`[sync] Processing topic: "${topicTitle}" (${topicId}) [${accessLevel}]`);
    const categoryId = await getOrCreateCategory(topicId, topicTitle, groupId, accessLevel);
    const count = await syncTopic(client, group, topicId, categoryId, groupId);
    totalSynced += count;
    console.log(`[sync] Topic "${topicTitle}": synced ${count} messages`);
  }

  return totalSynced;
}

async function backfillNormalGroup(
  client: TelegramClient,
  group: Api.TypeEntityLike,
  groupId: string
): Promise<number> {
  const groupTitle = await getGroupTitle(client, group);
  // Use topicId = 0 for normal groups (no topics)
  const categoryId = await getOrCreateCategory(0, groupTitle, groupId, "vip");
  console.log(`[sync] Syncing normal group as category: "${groupTitle}"`);
  return await syncTopic(client, group, 0, categoryId, groupId);
}

export async function backfill(
  client: TelegramClient,
  group: Api.TypeEntityLike,
  groupId: string
): Promise<void> {
  console.log("[sync] Starting backfill...");

  const isForum = await isForumGroup(client, group);
  let totalSynced: number;

  if (isForum) {
    console.log("[sync] Detected forum group");
    totalSynced = await backfillForum(client, group, groupId);
  } else {
    console.log("[sync] Detected normal group");
    totalSynced = await backfillNormalGroup(client, group, groupId);
  }

  console.log(`[sync] Backfill complete. Total synced: ${totalSynced}`);
}

export async function startRealtimeListener(
  client: TelegramClient,
  group: Api.TypeEntityLike,
  groupId: string
): Promise<void> {
  console.log("[sync] Starting realtime listener...");

  const isForum = await isForumGroup(client, group);

  client.addEventHandler(async (event) => {
    const message = event.message;
    if (!(message instanceof Api.Message)) return;

    const mediaInfo = getMediaInfo(message);
    if (!mediaInfo) return;

    let topicId: number;
    let categoryId: string;

    if (isForum) {
      // Forum group: get topic from reply
      topicId = getMessageTopicId(message);
      if (topicId === 0) return;

      const alreadySynced = await isMessageSynced(groupId, topicId, message.id);
      if (alreadySynced) return;

      const topics = await getForumTopics(client, group);
      const topicTitle = topics.get(topicId) || `Topic ${topicId}`;
      const accessLevels = await getTopicAccessLevels();
      const accessLevel = getAccessLevelForTopic(topicId, accessLevels);
      categoryId = await getOrCreateCategory(topicId, topicTitle, groupId, accessLevel);
    } else {
      // Normal group: use topicId = 0
      topicId = 0;

      const alreadySynced = await isMessageSynced(groupId, topicId, message.id);
      if (alreadySynced) return;

      const groupTitle = await getGroupTitle(client, group);
      categoryId = await getOrCreateCategory(0, groupTitle, groupId, "vip");
    }

    try {
      await processMessage(client, message, topicId, categoryId, groupId, group);
    } catch (err) {
      console.error(
        `[realtime] Error processing message ${message.id}:`,
        err
      );
    }
  }, new NewMessage({ chats: [group] }));

  console.log("[sync] Realtime listener active");
}
