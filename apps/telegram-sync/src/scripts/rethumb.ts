/**
 * Re-extract video thumbnails for existing clips.
 *
 * Each clip in the database has a thumbnailR2Key recorded by an older
 * version of the sync script that pulled Telegram's PhotoStrippedSize
 * (~40px placeholder). This script joins clips to telegram_sync_messages,
 * fetches the original message, picks the LARGEST thumb, and overwrites
 * the existing R2 object so the URL stays the same and CDN cache will
 * eventually clear.
 *
 * Run inside the telegram-sync container:
 *   pnpm --filter @kodhom/telegram-sync exec tsx src/scripts/rethumb.ts
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { Api } from "telegram";
import { db } from "@kodhom/db";
import { clips, telegramSyncMessages } from "@kodhom/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { uploadBuffer } from "@kodhom/r2";
import { createClient } from "../telegram-client.js";

interface Job {
  clipId: string;
  thumbnailR2Key: string;
  telegramMessageId: number;
  telegramGroupId: string;
}

const ARG_LIMIT = Number(process.env.RETHUMB_LIMIT ?? "0"); // 0 = all
const ARG_DRY = process.env.RETHUMB_DRY === "1";

async function loadJobs(): Promise<Job[]> {
  const rows = await db
    .select({
      clipId: clips.id,
      thumbnailR2Key: clips.thumbnailR2Key,
      telegramMessageId: telegramSyncMessages.telegramMessageId,
      telegramGroupId: telegramSyncMessages.telegramGroupId,
    })
    .from(clips)
    .innerJoin(
      telegramSyncMessages,
      eq(telegramSyncMessages.clipId, clips.id)
    )
    .where(
      and(
        eq(clips.isActive, true),
        isNotNull(clips.thumbnailR2Key)
      )
    );

  const jobs = rows
    .filter((r): r is Job => Boolean(r.thumbnailR2Key))
    .map((r) => ({
      clipId: r.clipId,
      thumbnailR2Key: r.thumbnailR2Key as string,
      telegramMessageId: r.telegramMessageId,
      telegramGroupId: r.telegramGroupId,
    }));

  return ARG_LIMIT > 0 ? jobs.slice(0, ARG_LIMIT) : jobs;
}

function pickLargestThumbIdx(thumbs: Api.TypePhotoSize[]): number {
  let bestIdx = -1;
  let bestArea = 0;
  for (let i = 0; i < thumbs.length; i++) {
    const t = thumbs[i];
    if (t instanceof Api.PhotoStrippedSize) continue;
    const w = (t as { w?: number }).w ?? 0;
    const h = (t as { h?: number }).h ?? 0;
    const area = w * h;
    if (area > bestArea) {
      bestArea = area;
      bestIdx = i;
    }
  }
  return bestIdx >= 0 ? bestIdx : thumbs.length - 1;
}

async function main() {
  const jobs = await loadJobs();
  console.log(
    `[rethumb] ${jobs.length} clip(s) to process${ARG_DRY ? " (DRY RUN)" : ""}`
  );
  if (jobs.length === 0) return;

  const client = await createClient();

  // Group by group id to limit getMessages roundtrips
  const byGroup = new Map<string, Job[]>();
  for (const j of jobs) {
    const list = byGroup.get(j.telegramGroupId) ?? [];
    list.push(j);
    byGroup.set(j.telegramGroupId, list);
  }

  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const [groupId, groupJobs] of byGroup) {
    console.log(
      `[rethumb] group ${groupId}: ${groupJobs.length} clip(s)`
    );
    let entity;
    try {
      entity = await client.getEntity(groupId);
    } catch (err) {
      console.error(
        `[rethumb] cannot resolve group ${groupId}, skipping all clips:`,
        err
      );
      failCount += groupJobs.length;
      continue;
    }

    // Fetch messages in batches of 100 (Telegram limit)
    const ids = groupJobs.map((j) => j.telegramMessageId);
    const messageMap = new Map<number, Api.Message>();
    const batchSize = 100;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      try {
        const msgs = await client.getMessages(entity, { ids: batch });
        for (const m of msgs) {
          if (m && "id" in m && typeof m.id === "number") {
            messageMap.set(m.id, m as Api.Message);
          }
        }
      } catch (err) {
        console.error(`[rethumb] getMessages batch failed:`, err);
      }
    }

    let processed = 0;
    for (const job of groupJobs) {
      processed += 1;
      const m = messageMap.get(job.telegramMessageId);
      if (!m || !m.media) {
        console.warn(
          `[rethumb]   ${job.clipId}: message ${job.telegramMessageId} not found`
        );
        skipCount += 1;
        continue;
      }
      if (!(m.media instanceof Api.MessageMediaDocument)) {
        skipCount += 1;
        continue;
      }
      const doc = m.media.document;
      if (!(doc instanceof Api.Document) || !doc.thumbs?.length) {
        skipCount += 1;
        continue;
      }

      const thumbIdx = pickLargestThumbIdx(doc.thumbs);
      const sized = doc.thumbs[thumbIdx];
      const w = (sized as { w?: number }).w ?? 0;
      const h = (sized as { h?: number }).h ?? 0;

      if (ARG_DRY) {
        console.log(
          `[rethumb]   ${job.clipId}: would download thumb idx=${thumbIdx} ${w}x${h}`
        );
        okCount += 1;
        continue;
      }

      try {
        const thumbBuffer = await client.downloadMedia(m, { thumb: thumbIdx });
        if (!thumbBuffer || !(thumbBuffer instanceof Buffer)) {
          console.warn(`[rethumb]   ${job.clipId}: empty download`);
          failCount += 1;
          continue;
        }
        await uploadBuffer(
          job.thumbnailR2Key,
          thumbBuffer,
          "image/jpeg",
          thumbBuffer.length
        );
        console.log(
          `[rethumb]   ${job.clipId}: ${w}x${h}, ${thumbBuffer.length}B → ${job.thumbnailR2Key} [${processed}/${groupJobs.length}]`
        );
        okCount += 1;
      } catch (err) {
        console.error(`[rethumb]   ${job.clipId}: failed`, err);
        failCount += 1;
      }
    }
  }

  console.log(
    `\n[rethumb] done: ok=${okCount} skip=${skipCount} fail=${failCount}`
  );
  await client.disconnect();
}

main().catch((err) => {
  console.error("[rethumb] fatal:", err);
  process.exit(1);
});
