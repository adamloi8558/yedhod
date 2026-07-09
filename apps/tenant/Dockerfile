FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/tenant/package.json ./apps/tenant/
COPY packages/db/package.json ./packages/db/
COPY packages/r2/package.json ./packages/r2/
COPY packages/ui/package.json ./packages/ui/
COPY packages/validators/package.json ./packages/validators/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile

# --- Builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/tenant/node_modules ./apps/tenant/node_modules
COPY --from=deps /app/packages/*/node_modules ./packages/
COPY . .

ARG DATABASE_URL
ARG R2_ACCOUNT_ID
ARG R2_ACCESS_KEY_ID
ARG R2_SECRET_ACCESS_KEY
ARG R2_BUCKET_NAME
ARG R2_PUBLIC_URL

ENV DATABASE_URL=$DATABASE_URL
ENV R2_ACCOUNT_ID=$R2_ACCOUNT_ID
ENV R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID
ENV R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY
ENV R2_BUCKET_NAME=$R2_BUCKET_NAME
ENV R2_PUBLIC_URL=$R2_PUBLIC_URL

RUN pnpm --filter @kodhom/tenant build

# --- Runner ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/Asia/Bangkok /etc/localtime \
    && echo "Asia/Bangkok" > /etc/timezone
ENV TZ=Asia/Bangkok
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/tenant/public ./apps/tenant/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/tenant/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/tenant/.next/static ./apps/tenant/.next/static

USER nextjs
EXPOSE 3002
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/tenant/server.js"]
