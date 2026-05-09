import { TelegramClient, Api } from "telegram";
import { uploadBuffer } from "@kodhom/r2";
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

  console.log(`[media] Downloading ${info.mediaType} (${info.mimeType})...`);

  const buffer = await client.downloadMedia(message, {});
  if (!buffer || !(buffer instanceof Buffer)) {
    console.error("[media] Failed to download media");
    return null;
  }

  console.log(`[media] Uploading to R2: ${r2Key} (${buffer.length} bytes)`);
  await uploadBuffer(r2Key, buffer, info.mimeType, buffer.length);

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
    fileSize: buffer.length,
    duration: info.duration,
    mediaType: info.mediaType,
  };
}
