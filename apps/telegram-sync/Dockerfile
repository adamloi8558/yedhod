FROM public.ecr.aws/docker/library/node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/telegram-sync/package.json ./apps/telegram-sync/
COPY packages/db/package.json ./packages/db/
COPY packages/r2/package.json ./packages/r2/
RUN pnpm install --frozen-lockfile

# --- Runner ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/Asia/Bangkok /etc/localtime \
    && echo "Asia/Bangkok" > /etc/timezone
ENV TZ=Asia/Bangkok

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/telegram-sync/node_modules ./apps/telegram-sync/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/r2/node_modules ./packages/r2/node_modules

COPY packages/db/ ./packages/db/
COPY packages/r2/ ./packages/r2/
COPY apps/telegram-sync/ ./apps/telegram-sync/
COPY tsconfig.json ./
COPY package.json ./

CMD ["/app/apps/telegram-sync/node_modules/.bin/tsx", "apps/telegram-sync/src/index.ts"]
