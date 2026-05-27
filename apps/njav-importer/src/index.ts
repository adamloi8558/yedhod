import PQueue from "p-queue";
import { CONFIG, loadJobs, type Job } from "./config.js";
import { scrapeAllPages } from "./scraper.js";
import { processClip } from "./process.js";

let stopping = false;
process.on("SIGTERM", () => {
  console.log("[main] SIGTERM, finishing current items then exit");
  stopping = true;
});
process.on("SIGINT", () => {
  console.log("[main] SIGINT, finishing current items then exit");
  stopping = true;
});

async function runJob(job: Job): Promise<void> {
  console.log(`[job:${job.label}] scraping ${job.njavPath}`);
  const items = await scrapeAllPages(job.njavPath);
  console.log(`[job:${job.label}] found ${items.length} items`);

  const queue = new PQueue({ concurrency: CONFIG.concurrency });
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    queue.add(async () => {
      if (stopping) return;
      const r = await processClip(item, job);
      if (r === "imported") imported++;
      else if (r === "skipped") skipped++;
      else failed++;
    });
  }
  await queue.onIdle();
  console.log(
    `[job:${job.label}] done: imported=${imported} skipped=${skipped} failed=${failed}`
  );
}

async function runCycle() {
  const jobs = loadJobs();
  console.log(`[main] cycle start with ${jobs.length} job(s)`);
  for (const job of jobs) {
    if (stopping) break;
    try {
      await runJob(job);
    } catch (err) {
      console.error(`[job:${job.label}] cycle failed:`, err);
    }
  }
  console.log("[main] cycle done");
}

async function main() {
  console.log("[main] njav-importer starting");
  console.log(`[main] concurrency=${CONFIG.concurrency} workDir=${CONFIG.workDir}`);
  while (!stopping) {
    const startedAt = Date.now();
    await runCycle();
    if (stopping) break;
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(CONFIG.cycleDelayMs - elapsed, 0);
    console.log(`[main] sleeping ${(wait / 1000).toFixed(0)}s before next cycle`);
    await new Promise((r) => setTimeout(r, wait));
  }
  console.log("[main] exiting");
  process.exit(0);
}

main().catch((err) => {
  console.error("[main] fatal:", err);
  process.exit(1);
});
