# syntax=docker/dockerfile:1.7
# Build context = monorepo root. In Coolify set "base directory" = / and
# "dockerfile location" = /scripts/fhchannel-dl/Dockerfile.

FROM node:22-bookworm-slim

# ffmpeg for HLS → mp4 remuxing
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json                 packages/db/package.json
COPY packages/auth/package.json               packages/auth/package.json
COPY packages/r2/package.json                 packages/r2/package.json
COPY packages/ui/package.json                 packages/ui/package.json
COPY packages/validators/package.json         packages/validators/package.json
COPY packages/config/package.json             packages/config/package.json
COPY apps/web/package.json                    apps/web/package.json
COPY apps/backoffice/package.json             apps/backoffice/package.json
COPY apps/njav-importer/package.json          apps/njav-importer/package.json
COPY apps/telegram-poster/package.json        apps/telegram-poster/package.json
COPY apps/telegram-sync/package.json          apps/telegram-sync/package.json
COPY scripts/kbjfree-dl/package.json          scripts/kbjfree-dl/package.json
COPY scripts/fhchannel-dl/package.json        scripts/fhchannel-dl/package.json

RUN pnpm install --filter @kodhom/fhchannel-dl... --frozen-lockfile

COPY packages/db   packages/db
COPY scripts/fhchannel-dl scripts/fhchannel-dl

WORKDIR /app/scripts/fhchannel-dl

ENV NODE_ENV=production

CMD ["pnpm", "start"]
