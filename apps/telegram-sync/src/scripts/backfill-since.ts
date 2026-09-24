import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { Api } from "telegram";
import { and, eq, inArray } from "drizzle-orm";
import { db, telegramSyncMessages } from "@kodhom/db";
import { createClient } from "../telegram-client.js";
import { getTelegramGroupIds } from "../config.js";
import { delay } from "../utils.js";

dotenv.config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });

// Metadata-only reconciliation. Existing ledger entries are never overwritten;
// the normal worker owns downloads and retries. Dry-run unless --apply is given.
async function main() {
  const args = process.argv.slice(2);
  const sinceArg = args.find(arg => arg.startsWith("--since="))?.slice(8);
  if (!sinceArg || !/(Z|[+-]\d{2}:\d{2})$/.test(sinceArg)) {
    throw new Error("Use --since=<ISO timestamp with timezone> [--apply]");
  }
  const since = Date.parse(sinceArg);
  const until = Date.now();
  if (!Number.isFinite(since) || since > until) throw new Error("Invalid start date");
  const apply = args.includes("--apply");
  const client = await createClient();
  let errors = 0;
  try {
    const groups = [...new Set(await getTelegramGroupIds())];
    await client.getDialogs({ limit: 500 });
    for (const [groupIndex, groupId] of groups.entries()) {
      const counts = { videos: 0, synced: 0, skipped: 0, failed: 0, missing: 0, queued: 0, unrouted: 0, bytes: 0 };
      try {
        const group = await client.getEntity(groupId);
        const forum = group instanceof Api.Channel && group.forum === true;
        let offsetId = 0;
        let pages = 0;
        while (true) {
          const page = await client.getMessages(group, { limit: 100, offsetId });
          if (!page.length) break;
          const nextOffset = Math.min(...page.map(message => message.id));
          if (offsetId && nextOffset >= offsetId) throw new Error("Pagination did not advance");
          const messages = page.filter((m): m is Api.Message =>
            m instanceof Api.Message && m.date * 1000 >= since && m.date * 1000 <= until &&
            m.media instanceof Api.MessageMediaDocument && m.media.document instanceof Api.Document &&
            m.media.document.mimeType.startsWith("video/")
          );
          const existing = messages.length ? await db.select({
            messageId: telegramSyncMessages.telegramMessageId,
            topicId: telegramSyncMessages.telegramTopicId,
            status: telegramSyncMessages.status,
          }).from(telegramSyncMessages).where(and(
            eq(telegramSyncMessages.telegramGroupId, groupId),
            inArray(telegramSyncMessages.telegramMessageId, messages.map(m => m.id)),
          )) : [];
          const statuses = new Map(existing.map(row => [`${row.topicId}:${row.messageId}`, row.status]));
          const missing = [];
          for (const message of messages) {
            const reply = message.replyTo;
            const topicId = forum ? (reply?.replyToTopId ?? (reply?.forumTopic ? reply.replyToMsgId : 0) ?? 0) : 0;
            // Match the worker's forum routing; an unassigned message cannot be replayed safely.
            if (forum && topicId === 0) { counts.unrouted++; continue; }
            counts.videos++;
            const doc = (message.media as Api.MessageMediaDocument).document as Api.Document;
            counts.bytes += Number(doc.size);
            const status = statuses.get(`${topicId}:${message.id}`);
            if (status) {
              if (status === "synced") counts.synced++;
              else if (status === "failed") counts.failed++;
              else counts.skipped++;
              continue;
            }
            counts.missing++;
            missing.push({
              id: randomUUID(), telegramGroupId: groupId, telegramTopicId: topicId,
              telegramMessageId: message.id, mediaType: "video", status: "failed",
              errorMessage: `Backfill requested from ${new Date(since).toISOString()}`,
              // Eligible for the worker's normal retry queue immediately.
              createdAt: new Date(Date.now() - 16 * 60_000),
            });
          }
          if (apply && missing.length) {
            const inserted = await db.insert(telegramSyncMessages).values(missing)
              .onConflictDoNothing().returning({ id: telegramSyncMessages.id });
            counts.queued += inserted.length;
          }
          pages++;
          console.log(JSON.stringify({ group: groupIndex + 1, pages, apply, ...counts }));
          if (page.some(m => m instanceof Api.Message && m.date * 1000 < since)) break;
          offsetId = nextOffset;
          await delay(500);
        }
        console.log(JSON.stringify({ group: groupIndex + 1, complete: true, since: new Date(since).toISOString(), until: new Date(until).toISOString(), apply, ...counts }));
      } catch (error) {
        errors++;
        console.error(JSON.stringify({ group: groupIndex + 1, complete: false, error: error instanceof Error ? error.message : String(error) }));
        if ((error as { seconds?: number }).seconds) break;
      }
    }
  } finally { await client.disconnect(); }
  return errors ? 1 : 0;
}

main().then(code => process.exit(code)).catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
