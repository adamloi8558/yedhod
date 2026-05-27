import path from "path";
import { CONFIG, type Job } from "./config.js";
import { fetchDetail, type ListItem } from "./scraper.js";
import { extractStream } from "./extractor.js";
import { downloadClip, cleanup } from "./downloader.js";
import { uploadFile } from "./uploader.js";
import { clipExists, insertClip } from "./persister.js";
import { nanoid } from "./nanoid.js";

export async function processClip(item: ListItem, job: Job): Promise<"skipped" | "imported" | "failed"> {
  const sourceUrl = item.pageUrl;
  if (await clipExists(sourceUrl)) {
    console.log(`[${item.slug}] skip (already imported)`);
    return "skipped";
  }

  let videoPath: string | null = null;
  let thumbnailPath: string | null = null;

  try {
    console.log(`[${item.slug}] resolving stream`);
    const [detail, stream] = await Promise.all([
      fetchDetail(item.slug).catch(() => null),
      extractStream(item.slug),
    ]);

    const title = detail?.title || item.title || item.slug;
    const description = detail?.description ?? null;

    console.log(`[${item.slug}] downloading "${title}"`);
    const dl = await downloadClip(item.slug, stream, item.thumbnailUrl);
    videoPath = dl.videoPath;
    thumbnailPath = dl.thumbnailPath;
    console.log(
      `[${item.slug}] downloaded ${(dl.fileSize / 1024 / 1024).toFixed(1)} MiB, ${dl.durationSeconds?.toFixed(0) ?? "?"}s`
    );

    const videoKey = `clips/${nanoid()}.mp4`;
    const thumbKey = thumbnailPath
      ? `thumbnails/${nanoid()}${path.extname(thumbnailPath) || ".jpg"}`
      : null;

    // Upload thumb first (small, fast) so we don't lose it if the long video upload disturbs the file.
    let finalThumbKey: string | null = null;
    if (thumbnailPath && thumbKey) {
      const ext = path.extname(thumbnailPath).toLowerCase();
      const ct =
        ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : "image/jpeg";
      console.log(`[${item.slug}] uploading thumb → ${thumbKey}`);
      try {
        await uploadFile(thumbKey, thumbnailPath, ct);
        finalThumbKey = thumbKey;
      } catch (err) {
        console.warn(
          `[${item.slug}] thumb upload failed, continuing without thumb:`,
          err instanceof Error ? err.message : err
        );
      }
      // Free local thumb file as soon as it's on R2 (or if upload failed and we gave up).
      await cleanup(thumbnailPath);
      thumbnailPath = null;
    }

    console.log(`[${item.slug}] uploading video → ${videoKey}`);
    await uploadFile(videoKey, videoPath, "video/mp4");
    // Free local video file the moment R2 has it; no need to wait for the DB insert.
    await cleanup(videoPath);
    videoPath = null;

    const id = await insertClip({
      title,
      description,
      categoryId: job.categoryId,
      accessLevel: job.accessLevel,
      r2Key: videoKey,
      thumbnailR2Key: finalThumbKey,
      duration: dl.durationSeconds,
      fileSize: dl.fileSize,
      mimeType: "video/mp4",
      sourceUrl,
    });
    if (!id) {
      console.log(`[${item.slug}] ↩ already imported (race) — uploaded files will linger`);
      return "skipped";
    }
    console.log(`[${item.slug}] ✓ inserted clip ${id}${finalThumbKey ? "" : " (no thumb)"}`);
    return "imported";
  } catch (err) {
    console.error(`[${item.slug}] FAILED:`, err instanceof Error ? err.message : err);
    return "failed";
  } finally {
    await cleanup(videoPath, thumbnailPath);
  }
}
