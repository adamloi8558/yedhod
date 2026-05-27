import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface Job {
  /** Path under njav.com starting with /th/, e.g. /th/genre/ชุดจีน */
  njavPath: string;
  /** Target categories.id in our DB */
  categoryId: string;
  /** member | vip */
  accessLevel: "member" | "vip";
  /** Display name (for logs only) */
  label?: string;
}

export const CONFIG = {
  baseUrl: "https://www.njav.com",
  uploadedBy:
    process.env.NJAV_UPLOADER_ID ?? "EpPgHKxKDHMCtgfbt0SRxvACMnVQTWTm",
  concurrency: Number(process.env.NJAV_CONCURRENCY ?? 2),
  cycleDelayMs: Number(process.env.NJAV_CYCLE_DELAY_MS ?? 30 * 60 * 1000),
  workDir: process.env.NJAV_WORK_DIR ?? path.resolve(__dirname, "../.tmp"),
  ffmpegPath: process.env.FFMPEG_PATH ?? "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH ?? "ffprobe",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
};

export function loadJobs(): Job[] {
  // 1. JSON file is authoritative if present.
  const jsonPath = path.resolve(__dirname, "../jobs.json");
  if (fs.existsSync(jsonPath)) {
    const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    if (!Array.isArray(raw)) throw new Error("jobs.json must be an array");
    return raw.map((j: Job) => ({
      njavPath: j.njavPath,
      categoryId: j.categoryId,
      accessLevel: j.accessLevel ?? "member",
      label: j.label ?? j.njavPath,
    }));
  }
  // 2. Fallback to a single default job (the original ชุดจีน → nJAV mapping).
  return [
    {
      njavPath: "/th/genre/%E0%B8%8A%E0%B8%B8%E0%B8%94%E0%B8%88%E0%B8%B5%E0%B8%99",
      categoryId: "52zn637g2sl15b776l1ag",
      accessLevel: "member",
      label: "ชุดจีน → nJAV",
    },
  ];
}
