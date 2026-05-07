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

> Windows note: `next build` may fail with `EPERM: symlink` while writing `.next/standalone`. The build itself (compile + page generation) is what matters; the symlink failure only affects local production runs. Real prod builds happen in Docker on Linux.

## Architecture

**Monorepo**: Turborepo + pnpm workspaces. Two Next.js 15 apps share code through internal packages.

### Apps
- **apps/web** — Customer-facing site (kodhom.com). Telegram-style two-panel layout: sidebar with categories, main panel with chat-style clip feed. The `(main)/layout.tsx` renders an auto-rotating banner slider above every page (data from `system_config`).
- **apps/backoffice** — Admin dashboard (bo.kodhom.com). CRUD for categories, clips, banners, pricing plans, users, system config, payments, withdrawals. Protected by `requireAdmin()` in dashboard layout.

### Packages
- **packages/db** — Drizzle ORM schema (PostgreSQL). All tables defined in `src/schema/`. Key enums: `roleEnum` (member/vip/admin), `accessLevelEnum` (member/vip), `subscriptionStatusEnum`, `paymentStatusEnum`.
- **packages/auth** — Better Auth config with `multiSession` plugin (max 5 sessions), `emailAndPassword`, and custom `role` field on users. Exports `auth` (server) and `createClient` (browser).
- **packages/r2** — Cloudflare R2 helpers: `getPresignedUploadUrl`, `getPresignedDownloadUrl`, `deleteObject`, `getPublicUrl`. Upload flow: client requests presigned URL from `/api/upload` (admin-only) → uploads directly to R2 with PUT.
- **packages/validators** — Shared Zod schemas with Thai error messages. Used in both apps for form validation and API input parsing.
- **packages/ui** — Radix UI-based components (shadcn/ui pattern). Also exports utility functions: `cn()`, `formatDuration()`, `formatThaiDate()`, `formatCurrency()`.
- **packages/config** — Shared ESLint (`createEslintConfig()`) and TypeScript configs (`typescript/base.json`, `typescript/nextjs.json`).

### Key Domain Logic

**Access Control** (`apps/web/src/lib/access-control.ts`): Central module for all authorization decisions.
- `hasCategoryAccess(userRole, categoryAccessLevel, hasSubscription)` — admin always; `member` categories open to anyone logged in; `vip` requires active subscription
- `hasActiveSubscription(userId)` — checks subscription validity and **side-effect** auto-marks expired ones as `expired` in DB
- `checkDeviceLimit(userId)` — enforces max concurrent sessions from the user's highest pricing plan

**Auth-aware navigation** (added in PR `0d49847`): Guests are routed to `/login?redirect=<path>` instead of straight to `/pricing`, so they return to the intended page after signing in. `redirect` is sanitized to relative paths only. `ClipCard`, `RestrictedOverlay`, and `PricingCard` all take an `isLoggedIn` prop and switch CTAs accordingly. Both `/login` and `/register` use `useSearchParams` and **must** be wrapped in `<Suspense>` (Next 15 prerender requirement).

**Video Streaming** (`apps/web/src/app/api/clips/[id]/stream/route.ts`): Validates auth → checks device limit → checks subscription + access level → returns presigned R2 GET URL (2hr expiry).

**Banner Slider** (`apps/web/src/components/banner-slider.tsx` + `lib/banners.ts`): Banners are stored as a JSON array in `system_config` (key `banners`) with images in R2 under `banners/`. Each banner: `{ id, imageR2Key, linkUrl, sortOrder, isActive }`. Web reads via `getActiveBanners()` (resolves presigned URLs); backoffice manages via `/api/banners` and `/api/banners/[id]` (DELETE also removes the R2 object). Images render at native size (no `aspect-video`).

**Payment Flow** (AnyPay): Create QR → frontend polls status every 5s → webhook with SHA256 signature verification → auto-creates subscription on success.

### Conventions
- All user-facing text is in **Thai**
- Both `next.config.ts` files use `transpilePackages` for all `@kodhom/*` packages
- Internal package imports use `workspace:*` protocol
- ESLint: `@typescript-eslint/no-explicit-any` is a warning (not error)
- Database schema changes go in `packages/db/src/schema/` — run `pnpm db:generate` then `pnpm db:migrate` after changes
- For long-lived/global settings without their own table, prefer `system_config` (key + JSON value) over a new schema. Only create a new table when the data has its own queries, relations, or indexes.
- R2 bucket needs CORS allowing PUT from backoffice + dev origins for browser-direct uploads. Server-side reads use presigned GETs (no CORS issue).
- Deploys go through Coolify (Docker, Linux). Pre-existing TS error in `apps/web/src/app/api/payments/create/route.ts` (`bankCode` field) is unrelated to current work — leave it unless asked.
