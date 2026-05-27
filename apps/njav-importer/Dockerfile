FROM node:22-alpine
RUN apk add --no-cache ffmpeg ca-certificates
WORKDIR /app

# Workspace setup
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY packages ./packages
COPY apps/njav-importer ./apps/njav-importer

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
RUN pnpm install --frozen-lockfile --prod=false --filter @kodhom/njav-importer...

WORKDIR /app/apps/njav-importer
ENV NODE_ENV=production
CMD ["pnpm", "start"]
