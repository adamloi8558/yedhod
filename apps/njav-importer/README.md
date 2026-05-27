# @kodhom/njav-importer

Long-running worker that scrapes njav.com genre pages, downloads each clip via the player's HLS playlist, uploads it to R2, and inserts a row in the `clips` table. Re-runs every 30 min to pick up new releases.

## Add or change which categories to import

Edit `apps/njav-importer/jobs.json`:

```json
[
  {
    "label": "ชุดจีน → nJAV",
    "njavPath": "/th/genre/%E0%B8%8A%E0%B8%B8%E0%B8%94%E0%B8%88%E0%B8%B5%E0%B8%99",
    "categoryId": "52zn637g2sl15b776l1ag",
    "accessLevel": "member"
  },
  {
    "label": "อีกหมวด → VIP",
    "njavPath": "/th/genre/<url-encoded-genre>",
    "categoryId": "<categories.id from DB>",
    "accessLevel": "vip"
  }
]
```

- `njavPath`: any njav listing path (genre, actor, tag, new-release). Anything starting with `/th/`.
- `categoryId`: must already exist in the `categories` table. Look it up in `bo.kodhom.com` or `select id, name from categories;`.
- `accessLevel`: `member` (free, requires login) or `vip` (paid).

After editing the file the worker picks up the new list on its next cycle (no rebuild needed).

## First-time DB migration

`source_url` column was added to `clips`. Run once:

```
pnpm db:generate
pnpm db:migrate
```

## Run locally

```
pnpm install
pnpm --filter @kodhom/njav-importer start
```

Requires `ffmpeg` + `ffprobe` on PATH (or set `FFMPEG_PATH` / `FFPROBE_PATH`). Uses the same `.env` at the repo root (`DATABASE_URL`, `R2_*`).

## Tunables (env)

- `NJAV_CONCURRENCY` — clips processed in parallel (default 2)
- `NJAV_CYCLE_DELAY_MS` — pause between full passes (default 30 min)
- `NJAV_WORK_DIR` — temp dir for downloads (default `./.tmp`)
- `NJAV_UPLOADER_ID` — admin user id used as `uploaded_by`
