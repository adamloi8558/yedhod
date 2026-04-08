# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs all apps + packages concurrently)
pnpm dev

# Build all
pnpm build

# Lint all
pnpm lint

# Run a single app
pnpm --filter @kodhom/web dev      # port 3000
pnpm --filter @kodhom/backoffice dev  # port 3001

# Database (Drizzle ORM)
pnpm db:generate   # generate migrations from schema changes
pnpm db:migrate    # apply migrations
pnpm db:push       # push schema directly (dev only)
pnpm db:studio     # open Drizzle Studio GUI

# TypeScript check (no turbo task defined — run directly)
npx tsc --noEmit -p apps/web/tsconfig.json
npx tsc --noEmit -p apps/backoffice/tsconfig.json
```

## Architecture

**Monorepo**: Turborepo + pnpm workspaces. Two Next.js 15 apps share code through internal packages.

### Apps
- **apps/web** — Customer-facing site (kodhom.com). Telegram-style two-panel layout: sidebar with categories, main panel with chat-style clip feed.
- **apps/backoffice** — Admin dashboard (bo.kodhom.com). CRUD for categories, clips, pricing plans, users, system config, payments, withdrawals. Protected by `requireAdmin()` in dashboard layout.

### Packages
- **packages/db** — Drizzle ORM schema (PostgreSQL). All tables defined in `src/schema/`. Key enums: `roleEnum` (member/vip/admin), `accessLevelEnum` (member/vip), `subscriptionStatusEnum`, `paymentStatusEnum`.
- **packages/auth** — Better Auth config with `multiSession` plugin (max 5 sessions), `emailAndPassword`, and custom `role` field on users. Exports `auth` (server) and `createClient` (browser).
- **packages/r2** — Cloudflare R2 helpers: `getPresignedUploadUrl`, `getPresignedDownloadUrl`, `deleteObject`, `getPublicUrl`. Upload flow: client gets presigned URL from API → uploads directly to R2.
- **packages/validators** — Shared Zod schemas with Thai error messages. Used in both apps for form validation and API input parsing.
- **packages/ui** — Radix UI-based components (shadcn/ui pattern). Also exports utility functions: `cn()`, `formatDuration()`, `formatThaiDate()`, `formatCurrency()`.
- **packages/config** — Shared ESLint (`createEslintConfig()`) and TypeScript configs (`typescript/base.json`, `typescript/nextjs.json`).

### Key Domain Logic

**Access Control** (`apps/web/src/lib/access-control.ts`): Central module for all authorization decisions.
- `hasClipAccess(userRole, clipAccessLevel, hasSubscription)` — determines if a user can watch a clip based on role + subscription
- `getActiveSubscription(userId, categoryId)` — checks subscription validity and auto-marks expired ones in DB
- `checkDeviceLimit(userId)` — enforces max concurrent sessions from the user's highest pricing plan

**Video Streaming** (`apps/web/src/app/api/clips/[id]/stream/route.ts`): Validates auth → checks subscription + access level → returns presigned R2 GET URL (2hr expiry).

**Payment Flow** (AnyPay): Create QR → frontend polls status every 5s → webhook with SHA256 signature verification → auto-creates subscription on success.

### Conventions
- All user-facing text is in **Thai**
- Both `next.config.ts` files use `transpilePackages` for all `@kodhom/*` packages
- Internal package imports use `workspace:*` protocol
- ESLint: `@typescript-eslint/no-explicit-any` is a warning (not error)
- Database schema changes go in `packages/db/src/schema/` — run `pnpm db:generate` then `pnpm db:migrate` after changes
