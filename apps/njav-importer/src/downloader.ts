import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { CONFIG } from "./config.js";
import type { Stream } from "./extractor.js";

export interface DownloadedClip {
  videoPath: string;
  thumbnailPath: string | null;
  durationSeconds: number | null;
  fileSize: number;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(CONFIG.ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (b) => {
      stderr += b.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}\n${stderr.slice(-2000)}`));
    });
  });
}

function runFfprobe(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(CONFIG.ffprobePath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (b) => (out += b.toString()));
    child.stderr.on("data", (b) => (err += b.toString()));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`ffprobe exited ${code}: ${err}`));
    });
  });
}

export async function downloadClip(
  slug: string,
  stream: Stream,
  thumbnailUrl: string | null
): Promise<DownloadedClip> {
  await fs.mkdir(CONFIG.workDir, { recursive: true });
  const videoPath = path.join(CONFIG.workDir, `${slug}.mp4`);
  const thumbPath = path.join(CONFIG.workDir, `${slug}.jpg`);

  const headers =
    `Referer: ${stream.playerOrigin}/\r\n` +
    `Origin: ${stream.playerOrigin}\r\n` +
    `User-Agent: ${CONFIG.userAgent}\r\n`;

  await runFfmpeg([
    "-hide_banner",
    "-loglevel", "warning",
    "-y",
    "-headers", headers,
    "-extension_picky", "0",
    "-f", "hls",
    "-i", stream.hlsUrl,
    "-c", "copy",
    "-bsf:a", "aac_adtstoasc",
    videoPath,
  ]);

  // Thumbnail: prefer the njav listing image (already on a CDN), fall back to upload host poster, then ffmpeg snapshot.
  let thumbnailPath: string | null = null;
  const candidates = [thumbnailUrl, stream.posterUrl].filter(
    (u): u is string => !!u
  );
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": CONFIG.userAgent, Referer: stream.refererUrl },
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1024) continue;
      await fs.writeFile(thumbPath, buf);
      thumbnailPath = thumbPath;
      break;
    } catch {
      /* try next */
    }
  }
  if (!thumbnailPath) {
    try {
      await runFfmpeg([
        "-hide_banner", "-loglevel", "error", "-y",
        "-ss", "30",
        "-i", videoPath,
        "-frames:v", "1",
        "-q:v", "3",
        thumbPath,
      ]);
      thumbnailPath = thumbPath;
    } catch {
      thumbnailPath = null;
    }
  }

  let duration: number | null = null;
  try {
    const out = await runFfprobe([
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ]);
    const n = parseFloat(out);
    if (Number.isFinite(n)) duration = n;
  } catch {
    duration = null;
  }

  const stat = await fs.stat(videoPath);
  return {
    videoPath,
    thumbnailPath,
    durationSeconds: duration,
    fileSize: stat.size,
  };
}

export async function cleanup(...paths: (string | null)[]) {
  await Promise.all(
    paths
      .filter((p): p is string => !!p)
      .map((p) => fs.unlink(p).catch(() => {}))
  );
}
