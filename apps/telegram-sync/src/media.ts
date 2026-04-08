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

  // Try to download video thumbnail
  let thumbnailR2Key: string | null = null;
  if (
    info.mediaType === "video" &&
    message.media instanceof Api.MessageMediaDocument
  ) {
    const doc = message.media.document;
    if (doc instanceof Api.Document && doc.thumbs && doc.thumbs.length > 0) {
      try {
        const thumbBuffer = await client.downloadMedia(message, {
          thumb: 0,
        });
        if (thumbBuffer && thumbBuffer instanceof Buffer) {
          thumbnailR2Key = `clips/${id}_thumb.jpg`;
          await uploadBuffer(thumbnailR2Key, thumbBuffer, "image/jpeg", thumbBuffer.length);
          console.log(`[media] Uploaded thumbnail: ${thumbnailR2Key}`);
        }
      } catch {
        // Thumbnail download failed, not critical
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
