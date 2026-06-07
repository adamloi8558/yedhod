# fhchannel-dl

Mirror new clips from fhchannel.com (FapHouse) into the kodhom R2 bucket
and database. Same shape as `kbjfree-dl`: a local resolver produces a
JSONL job list in R2, and a Coolify-side downloader consumes it.

## Schema mapping

| kodhom column | fhchannel source |
|---|---|
| `clips.title` | `<h1 class="video__title">` text |
| `clips.description` | JSON of related-tag links from the "เกี่ยวกับคลิปนี้" block (studios + pornstars + categories + tags). The frontend should JSON-parse this and render. |
| Parent category | `<a class="video-info-details__studio-link">` (the studio = the channel that produced the clip). Slug is namespaced as `fh-<studio-slug>` so it doesn't clash with kbjfree categories. |
| `clips.duration` | `"duration":<seconds>` from the SSR ld+json blob |
| `clips.r2Key` | `clips/fhchannel/<id>_<title>.mp4` |
| `clips.thumbnailR2Key` | `clips/fhchannel-thumbs/<id>.jpg` (from `og:image`) |
| `clips.sourceUrl` | `https://fhchannel.com/videos/<slug>` |
| `clips.accessLevel` | always `member` — fhchannel has no premium/VIP gate in kodhom terms |

## Why split

The studio list, video metadata, and trailer URL are all in the
server-side HTML, so listing crawl is plain `fetch` (no browser needed).
But the **full** HLS master URL is only injected into the DOM by the
client-side player, and only when a logged-in premium session is present.
So the resolver uses Playwright with a persistent profile that holds the
user's premium cookies; the downloader has nothing to do with that —
the HLS CDN serves any IP as long as the URL is within its token's
expiry window.

## Setup

```bash
cd scripts/fhchannel-dl
cp .env.example .env       # copy R2 + DATABASE_URL from ../../.env

pnpm install
pnpm exec playwright install chromium
```

## First-time login

The resolver uses a persistent Chromium profile under `.state/browser-data`.
You need to log into fhchannel.com once so that profile holds the
premium session:

```bash
# launch headed Chromium once:
HEADLESS=0 pnpm exec tsx scripts/resolve.ts
```

It will open Chromium, you log in, then close. Future runs can be
headless.

## Daily flow

1. **Run the resolver** (your machine, premium logged-in profile):
   ```bash
   # double-click resolve.bat   — or:
   pnpm exec tsx scripts/resolve.ts
   ```
   Crawls 50 pages of `/videos` (latest) + 50 pages of `/videos?sort=...`
   (popular, cursor-persisted), parses metadata for new ones, opens each
   in headless Chromium to grab the HLS master URL, then uploads the
   job list to R2.

2. **Server side** (Coolify worker) loops every 5 minutes, pulls the
   JSONL, pipes each HLS through ffmpeg into a streaming mp4 upload to
   R2, and inserts the `clips` row.

## Env vars (selected)

| Var | Used by | Meaning |
|---|---|---|
| `DATABASE_URL`, `R2_*` | both | kodhom postgres + R2 |
| `JOBS_KEY` | both | R2 key for the JSONL queue (default `internal/fhchannel-jobs.jsonl`) |
| `RESOLVE_MAX_PAGES_PER_FEED` | resolver | pages per feed per run (default 50) |
| `STOP_AFTER_KNOWN_PAGES` | resolver | early-exit on N known-only pages of the latest feed (default 3) |
| `HEADLESS` | resolver | `0` to launch headed Chromium (first-time login) |
| `LOOP_INTERVAL_SEC` | downloader | seconds between polls (default 300) |
| `MAX_DOWNLOADS_PER_CYCLE` | downloader | cap clips per cycle (`0` = no cap) |
| `FFMPEG` | downloader | ffmpeg binary path (default `ffmpeg`) |
