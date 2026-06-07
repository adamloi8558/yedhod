# kbjfree-dl

Two-piece system that mirrors new clips from kbjfree.com into the kodhom
R2 bucket and database.

## Why two pieces

Cloudflare on kbjfree.com binds `cf_clearance` to the IP of the browser
that solved the challenge, so the VPS can never request the listing or
watch pages directly. The CDN that hosts the actual mp4/webp files
(`speed.marshlecdn.com`, `storage.marshlecdn.com`) doesn't care about
the IP — it only requires a `Referer` header pointing at kbjfree.com.

So we split the work:

| Side | What it does | Where it runs |
|---|---|---|
| **`scripts/resolve.ts`** | log in once, crawl `/videos`, parse every `/watch/<id>` HTML, extract `mp4Url` + `thumbnailUrl` + category + model | Your local Windows box (whitelisted IP) |
| **`index.ts`**           | poll the job list from R2, stream mp4 + thumb into R2, upsert categories + insert `clips` row | Coolify container (any IP) |

The resolver pushes the parsed jobs to R2 as `internal/kbjfree-jobs.jsonl`;
the downloader picks them up on its next loop.

## One-time setup

```bash
cd scripts/kbjfree-dl
cp .env.example .env
# fill in DATABASE_URL + R2_* (copy from ../../.env of the monorepo)

pnpm install
```

## Daily flow

1. **Cookie refresh** (once every couple of days, or whenever the
   resolver starts returning 403):
   - log in to kbjfree.com in Chrome
   - open DevTools → Application → Cookies → `https://kbjfree.com`
   - copy `cf_clearance`, `kgateway.auth.access`, `kgateway.auth.refresh`
   - save as `scripts/kbjfree-dl/.state/cookies.json` in this shape:
     ```json
     [
       {"name": "cf_clearance", "value": "…"},
       {"name": "kgateway.auth.access", "value": "…"},
       {"name": "kgateway.auth.refresh", "value": "…"}
     ]
     ```

2. **Resolve and push jobs** (run from your machine):
   ```bash
   pnpm exec tsx scripts/resolve.ts
   ```
   Output:
   ```
   [resolve] crawling up to 3 pages of /videos…
   [ok] pclP57BDmIJ → stripchat/Moonamour
   …
   [push] uploaded 12 jobs → internal/kbjfree-jobs.jsonl
   ```

3. **Server side** runs forever (deployed on Coolify). On each cycle it
   pulls the JSONL, downloads every clip that isn't already in the DB,
   then sleeps `LOOP_INTERVAL_SEC` seconds.

You can automate step 2 with Windows Task Scheduler (e.g. every 30 min)
or as a cron job, so new clips show up without you doing anything.

## Env vars (selected)

| Var | Used by | Meaning |
|---|---|---|
| `DATABASE_URL` | both | kodhom postgres |
| `R2_*` | both | bucket + creds |
| `JOBS_KEY` | both | R2 key for the JSONL queue (default `internal/kbjfree-jobs.jsonl`) |
| `R2_KEY_PREFIX` | downloader | prefix for mp4 files (default `clips/kbjfree/`) |
| `R2_THUMB_PREFIX` | downloader | prefix for thumbnails (default `clips/kbjfree-thumbs/`) |
| `LOOP_INTERVAL_SEC` | downloader | seconds between polls (default 300) |
| `VIP_CATEGORY_KEYWORD` | downloader | parent categories containing this string get `access_level=vip` (default `premium`) |
| `MAX_DOWNLOADS_PER_CYCLE` | downloader | cap clips per cycle (`0` = no cap) |
| `RESOLVE_MAX_PAGES` | resolver | how many `/videos?page=N` pages to crawl (default 3) |
