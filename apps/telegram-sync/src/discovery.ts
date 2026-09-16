import { Api, TelegramClient } from "telegram";
import { db, telegramSyncMessages } from "@kodhom/db";
import { getLastSyncedMessageId, saveSyncCursor } from "./db-operations.js";
import { getMediaInfo } from "./media.js";
import { isForumGroup } from "./topics.js";
import { delay, nanoid } from "./utils.js";

// Metadata discovery is independent of slow historical downloads. The reserved
// -1 cursor is source-wide; ordinary topic cursors still preserve older history.
export async function discoverNewMessages(client: TelegramClient, group: Api.TypeEntityLike, groupId: string): Promise<void> {
  let cursor = await getLastSyncedMessageId(groupId, -1);
  await saveSyncCursor(groupId, -1, cursor);
  const forum = await isForumGroup(client, group);
  for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
    const messages = await client.getMessages(group, { limit: 100, minId: cursor ?? 0, reverse: true });
    if (!messages.length) return;
    const next = Math.max(...messages.map(message => message.id));
    if (next <= (cursor ?? 0)) throw new Error("Telegram discovery did not advance");
    const rows = messages.map(message => {
      const reply = message instanceof Api.Message ? message.replyTo : undefined;
      const topicId = forum ? (reply?.replyToTopId ?? (reply?.forumTopic ? reply.replyToMsgId : 0) ?? 0) : 0;
      const media = message instanceof Api.Message ? getMediaInfo(message) : null;
      const unrouted = !!media && forum && topicId === 0;
      if (unrouted) console.error(`[discovery] Message ${message.id} has no forum topic`);
      const queued = !!media && !unrouted;
      return {
        id: nanoid(), telegramGroupId: groupId, telegramTopicId: topicId,
        telegramMessageId: message.id, mediaType: media?.mediaType ?? null,
        status: queued ? "failed" : "skipped",
        errorMessage: queued ? "Backfill requested from live discovery" : unrouted ? "Forum topic unavailable" : null,
        createdAt: new Date(Date.now() - (queued ? 16 * 60_000 : 0)),
      };
    });
    // Save old topic positions before recording newer metadata; otherwise an
    // initial topic cursor could incorrectly bootstrap from the newer rows.
    for (const topicId of new Set(rows.map(row => row.telegramTopicId))) {
      await saveSyncCursor(groupId, topicId, await getLastSyncedMessageId(groupId, topicId));
    }
    await db.insert(telegramSyncMessages).values(rows).onConflictDoNothing();
    await saveSyncCursor(groupId, -1, next);
    cursor = next;
    console.log(`[discovery] Scanned ${messages.length} new messages; queued ${rows.filter(row => row.status === "failed").length} videos`);
    if (messages.length < 100) return;
    await delay(500);
  }
}
