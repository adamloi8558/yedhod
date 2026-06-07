# syntax=docker/dockerfile:1.7
# Build context = monorepo root.  In Coolify set "base directory" = / and
# "dockerfile location" = /scripts/kbjfree-dl/Dockerfile
#
# Playwright image already ships with system libs needed by Firefox /
# Chromium and a recent Node. We only add pnpm and the two native deps
# Camoufox needs (better-sqlite3, impit) which pnpm 10 ignores by default.

FROM mcr.microsoft.com/playwright:v1.60.0-noble

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# 1) bring in the workspace manifest + every workspace package.json so pnpm
#    can resolve the dep graph without copying full source
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

# 2) install worker + workspace deps. Root package.json has
#    pnpm.onlyBuiltDependencies including better-sqlite3 + impit, so
#    their lifecycle scripts run automatically during install.
RUN pnpm install --filter @kodhom/kbjfree-dl... --frozen-lockfile

# 3) copy actual source for the worker and its deps
COPY packages/db   packages/db
COPY scripts/kbjfree-dl scripts/kbjfree-dl

WORKDIR /app/scripts/kbjfree-dl

# 4) download the Camoufox Firefox build (~200MB) at build time so the
#    container is self-contained and starts fast.
RUN pnpm exec camoufox-js fetch

ENV NODE_ENV=production \
    STATE_DIR=/data/state \
    HEADLESS=1

# Coolify persistent volume should be mounted at /data
VOLUME ["/data"]

CMD ["pnpm", "start"]
