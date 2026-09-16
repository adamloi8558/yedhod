import { TelegramClient, Api } from "telegram";
import { uploadBuffer, uploadStream } from "@kodhom/r2";
import { createReadStream } from "node:fs";
import { mkdtemp, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finished } from "node:stream/promises";
import { nanoid, getExtensionFromMime } from "./utils.js";

export interface MediaResult {
  r2Key: string;
  thumbnailR2Key: string | null;
  mimeType: string;
  fileSize: number | null;
  duration: number | null;
  mediaType: "video" | "photo";
}

export function getMediaInfo(message: Api.Message): {
  mediaType: "video" | "photo";
  mimeType: string;
  fileSize: number | null;
  duration: number | null;
  fileName: string | null;
} | null {
  if (!message.media) return null;

  // Skip photos — only support video
  if (message.media instanceof Api.MessageMediaPhoto) {
    return null;
  }

  if (message.media instanceof Api.MessageMediaDocument) {
    const doc = message.media.document;
    if (!(doc instanceof Api.Document)) return null;

    const mimeType = doc.mimeType;
    const isVideo = mimeType.startsWith("video/");

    if (!isVideo) return null;

    let duration: number | null = null;
    let fileName: string | null = null;

    for (const attr of doc.attributes) {
      if (attr instanceof Api.DocumentAttributeVideo) {
        duration = attr.duration;
      }
      if (attr instanceof Api.DocumentAttributeFilename) {
        fileName = attr.fileName;
      }
    }

    return {
      mediaType: isVideo ? "video" : "photo",
      mimeType,
      fileSize: Number(doc.size) || null,
      duration,
      fileName,
    };
  }

  return null;
}

export async function downloadAndUploadMedia(
  client: TelegramClient,
  message: Api.Message
): Promise<MediaResult | null> {
  const info = getMediaInfo(message);
  if (!info) return null;

  const ext = getExtensionFromMime(info.mimeType);
  const id = nanoid();
  const r2Key = `clips/${id}.${ext}`;

  console.log(`[media] Downloading message ${message.id} (${info.fileSize ?? "unknown"} bytes)...`);
  const directory = await mkdtemp(join(tmpdir(), "yedhod-sync-download-"));
  const file = join(directory, "media");
  let fileSize: number;
  let lastProgress = Date.now();
  try {
    await client.downloadMedia(message, {
      outputFile: file,
      progressCallback: async (received, total) => {
        if (Date.now() - lastProgress >= 30_000) {
          console.log(`[media] Message ${message.id}: ${Number(received)}/${Number(total)} bytes downloaded`);
          lastProgress = Date.now();
        }
      },
    });
    const downloaded = await stat(file);
    if (!downloaded.isFile() || !downloaded.size || (info.fileSize !== null && downloaded.size !== info.fileSize)) {
      throw new Error(`Incomplete media download: expected ${info.fileSize}, received ${downloaded.size}`);
    }
    fileSize = downloaded.size;
    console.log(`[media] Uploading to R2: ${r2Key} (${fileSize} bytes)`);
    const stream = createReadStream(file);
    try { await uploadStream(r2Key, stream, info.mimeType, fileSize, AbortSignal.timeout(10 * 60_000)); }
    finally { stream.destroy(); await finished(stream).catch(() => {}); }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  // Try to download video thumbnail.
  // Telegram returns thumbs sorted small→large. thumb[0] is a stripped
  // ~40px preview that renders blurry at any reasonable size; pick the
  // last (largest) thumb instead. Skip PhotoStrippedSize entries since
  // those are the tiny inline previews regardless of position.
  let thumbnailR2Key: string | null = null;
  if (
    info.mediaType === "video" &&
    message.media instanceof Api.MessageMediaDocument
  ) {
    const doc = message.media.document;
    if (doc instanceof Api.Document && doc.thumbs && doc.thumbs.length > 0) {
      try {
        // Find largest non-stripped thumb. PhotoSize / PhotoCachedSize are
        // real images; PhotoStrippedSize is the ~40px placeholder.
        let bestIdx = -1;
        let bestArea = 0;
        for (let i = 0; i < doc.thumbs.length; i++) {
          const t = doc.thumbs[i];
          if (t instanceof Api.PhotoStrippedSize) continue;
          // PhotoSize and PhotoCachedSize both expose w/h
          const w = (t as { w?: number }).w ?? 0;
          const h = (t as { h?: number }).h ?? 0;
          const area = w * h;
          if (area > bestArea) {
            bestArea = area;
            bestIdx = i;
          }
        }
        // Fallback: last thumb if no sized thumb found
        const thumbIdx = bestIdx >= 0 ? bestIdx : doc.thumbs.length - 1;

        const thumbBuffer = await client.downloadMedia(message, {
          thumb: thumbIdx,
        });
        if (thumbBuffer && thumbBuffer instanceof Buffer) {
          thumbnailR2Key = `clips/${id}_thumb.jpg`;
          await uploadBuffer(
            thumbnailR2Key,
            thumbBuffer,
            "image/jpeg",
            thumbBuffer.length
          );
          console.log(
            `[media] Uploaded thumbnail (idx=${thumbIdx}, ${thumbBuffer.length} bytes): ${thumbnailR2Key}`
          );
        }
      } catch (err) {
        console.warn("[media] Thumbnail download failed:", err);
      }
    }
  }

  return {
    r2Key,
    thumbnailR2Key,
    mimeType: info.mimeType,
    fileSize,
    duration: info.duration,
    mediaType: info.mediaType,
  };
}
