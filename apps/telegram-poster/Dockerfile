FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/telegram-poster/package.json ./apps/telegram-poster/
COPY packages/db/package.json ./packages/db/
COPY packages/r2/package.json ./packages/r2/
RUN pnpm install --frozen-lockfile

# --- Runner ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/telegram-poster/node_modules ./apps/telegram-poster/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/r2/node_modules ./packages/r2/node_modules

COPY packages/db/ ./packages/db/
COPY packages/r2/ ./packages/r2/
COPY apps/telegram-poster/ ./apps/telegram-poster/
COPY tsconfig.json ./
COPY package.json ./

CMD ["npx", "tsx", "apps/telegram-poster/src/index.ts"]
