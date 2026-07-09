# Multi-Tenant Clone Sites — Design Spec

**Date:** 2026-07-09
**Owner:** @adamloi8558

## Problem

เว็บ yedhod.com มีคลิปฟรี (access level `member`) จำนวนมากที่คนไม่ต้อง login/สมัคร VIP ก็ดูได้ ตอนนี้คลิปพวกนี้ใช้แค่ดึงคนเข้ามาเป็น VIP อย่างเดียว เจ้าของเว็บอยากใช้ประโยชน์เพิ่ม โดยเปิดเว็บใหม่ (multi-domain) ที่ mirror content คลิปฟรี แล้ว **หารายได้จากป้ายโฆษณา (ad network embed + banner)** — เป้าหมาย 20+ เว็บ แต่ละเว็บ branding/domain ต่างกัน

## Goals

- เปิดเว็บ tenant ใหม่ได้ **โดยไม่ต้อง rebuild/redeploy** — แค่ insert DB row + ชี้ DNS + เพิ่ม domain ใน Coolify
- Anonymous access (ไม่มี login) → friction ต่ำสุด, ad impression สูงสุด
- แต่ละ tenant เลือก **subset** ของ categories (คลิปฟรีเท่านั้น) ได้อิสระ
- Admin (เจ้าของ) จัดการ tenants ทั้งหมดจาก `bo.yedhod.com`
- โฆษณา mix ได้ 2 แบบ — embed HTML/JS + banner image ตาม slot ต่างๆ
- Hotlink protection — คลิปสตรีมผ่าน presigned URL ที่ผูกกับ tenant + category subset

## Non-Goals

- ไม่ทำระบบ partner/reseller login (เจ้าของเปิดเว็บเองทั้งหมด)
- ไม่ทำ user auth บนเว็บ tenant (ไม่มี favorite/history)
- ไม่ทำ VIP/subscription บน tenant (ad-revenue only)
- ไม่ทำ multiple layout templates (layout เดียว, เปลี่ยนแค่ branding)
- ไม่ทำ per-tenant analytics dashboard (ใช้ ad network analytics เอง)
- ไม่ทำ alias domain (`www.siteA.com` = `siteA.com`) ใน v1 — YAGNI
- ไม่แตะ endpoint / logic ของ `apps/web` (yedhod.com หลัก) และ `apps/backoffice` เดิม
- ไม่แตะ package scope `@kodhom/*` (rename เป็นงานแยก)

---

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │  Cloudflare / DNS (A → server IP)       │
                    │  siteA.com, siteB.com, siteC.com, ...   │
                    └────────────────┬────────────────────────┘
                                     │
                    ┌────────────────▼────────────────┐
                    │  Coolify + Traefik              │
                    │  (auto SSL per domain)          │
                    └────────────────┬────────────────┘
                                     │
                    ┌────────────────▼────────────────┐
                    │  apps/tenant  (Next.js 15)      │
                    │  port 3002                      │
                    │  middleware: Host → domain      │
                    │  server: resolve tenant + render│
                    └────────────────┬────────────────┘
                                     │ shared
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
        ┌───────────┐          ┌───────────┐          ┌───────────┐
        │ Postgres  │          │    R2     │          │Backoffice │
        │ (Drizzle) │          │  (clips)  │          │(bo.yedhod)│
        │ + tenants │          │  (assets) │          │+ Tenants  │
        └───────────┘          └───────────┘          │    UI     │
                                                     └───────────┘
```

**New app**: `apps/tenant` (Next.js 15, port 3002) — เสิร์ฟทุก tenant sites ผ่าน middleware ที่ inspect `Host` header
**Modified app**: `apps/backoffice` — เพิ่มเมนู "Tenants" + API routes
**Modified package**: `packages/db` — เพิ่ม 3 tables (`tenants`, `tenant_categories`, `tenant_ads`) + enums
**Untouched**: `apps/web` (yedhod.com), `apps/telegram-*`, `apps/njav-importer`

---

## Data Model

### Enums (`packages/db/src/schema/enums.ts` — เพิ่ม)

```ts
export const adSlotEnum = pgEnum("ad_slot", [
  "header",
  "sidebar_top",
  "sidebar_bot",
  "in_feed",
  "footer",
  "before_video",
  "after_video",
]);

export const adTypeEnum = pgEnum("ad_type", ["embed", "banner"]);
```

### `tenants` (`packages/db/src/schema/tenants.ts`)

```ts
import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),                        // nanoid (align with clips/categories)
  slug: text("slug").notNull().unique(),              // "site-a" — internal ref for admin URLs
  name: text("name").notNull(),                       // "ชื่อเว็บ"
  primaryDomain: text("primary_domain").notNull().unique(),  // "sitea.com" (lowercased)

  // Branding
  logoR2Key: text("logo_r2_key"),
  faviconR2Key: text("favicon_r2_key"),
  tagline: text("tagline"),
  footerText: text("footer_text"),
  primaryColor: text("primary_color").notNull().default("#3b82f6"),      // cool blue (differentiate from yedhod red)
  accentColor: text("accent_color").notNull().default("#60a5fa"),
  backgroundColor: text("background_color").notNull().default("#0b0d13"),
  fgColor: text("fg_color").notNull().default("#e6e9f2"),

  // SEO
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),

  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  domainIdx: index("tenants_domain_idx").on(t.primaryDomain),
  slugIdx: index("tenants_slug_idx").on(t.slug),
}));
```

**Note:** `id` เป็น `text` (nanoid) ตาม pattern `clips`/`categories` เดิม ไม่ใช่ uuid

### `tenant_categories` (M:N — tenant ↔ categories)

```ts
export const tenantCategories = pgTable("tenant_categories", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniquePair: uniqueIndex("tenant_categories_unique").on(t.tenantId, t.categoryId),
  tenantIdx: index("tenant_categories_tenant_idx").on(t.tenantId),
}));
```

**Constraint (application-level):** เลือกได้เฉพาะ category ที่ `accessLevel = 'member'` — enforce ใน API validation + UI filter

### `tenant_ads`

```ts
export const tenantAds = pgTable("tenant_ads", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  slot: adSlotEnum("slot").notNull(),
  type: adTypeEnum("type").notNull(),

  // type = 'embed'
  embedCode: text("embed_code"),

  // type = 'banner'
  imageR2Key: text("image_r2_key"),
  linkUrl: text("link_url"),
  altText: text("alt_text"),

  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  tenantSlotIdx: index("tenant_ads_tenant_slot_idx").on(t.tenantId, t.slot),
}));
```

**Embed security:** `embedCode` เก็บ raw HTML/JS, inject ผ่าน `dangerouslySetInnerHTML` — **admin-only input**, risk ยอมรับได้

### Relations

```
tenants (1) ─┬─ (N) tenant_categories ─── (1) categories [existing]
             │                                   │
             │                                   └─ (N) clips [existing]
             │                                       filter: accessLevel='member' + isActive=true
             │
             └─ (N) tenant_ads
```

**คลิปเดิมไม่แตะ** — query filter runtime: `accessLevel = 'member'` + `categoryId IN (tenant's categories)` + `isActive = true`

### Migration

- Run `pnpm db:generate` → generate migration
- Review generated SQL → ensure `text` FK matches existing `categories.id` / `tenants.id`
- Run `pnpm db:migrate`
- Export ใหม่ใน `packages/db/src/schema/index.ts`

---

## Multi-Domain Routing

### Middleware (`apps/tenant/src/middleware.ts`)

```ts
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const domain = host.split(":")[0].toLowerCase();

  const res = NextResponse.next();
  res.headers.set("x-tenant-domain", domain);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
```

Middleware ไม่ hit DB — แค่ forward `Host` เป็น `x-tenant-domain` header ให้ server-side ใช้

### Tenant Resolver (`apps/tenant/src/lib/tenant.ts`)

```ts
import { cache } from "react";
import { headers } from "next/headers";
import { db } from "@kodhom/db";
import { tenants } from "@kodhom/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";

export type Tenant = typeof tenants.$inferSelect;

export const getCurrentTenant = cache(async (): Promise<Tenant> => {
  const h = await headers();
  const domain = h.get("x-tenant-domain") ?? "";
  if (!domain) notFound();

  const [tenant] = await db.select().from(tenants)
    .where(and(eq(tenants.primaryDomain, domain), eq(tenants.isActive, true)))
    .limit(1);

  if (!tenant) notFound();
  return tenant;
});
```

`cache()` = React server cache → DB hit ครั้งเดียวต่อ request แม้ layout/page/nested เรียกหลายครั้ง

### Onboarding flow (ops)

1. **DNS** — A record ของ `siteA.com` → server IP
2. **Coolify** — เพิ่ม domain `siteA.com` ให้ container `apps/tenant` → Traefik auto-cert (Let's Encrypt)
3. **Backoffice** — `bo.yedhod.com/dashboard/tenants/new` → กรอก config + เลือก categories + save
4. **Done** — `https://siteA.com` live

### Local dev

- Windows `hosts` file: `127.0.0.1  site-a.local`
- `pnpm --filter @kodhom/tenant dev` (port 3002)
- เปิด `http://site-a.local:3002`
- Seed script: `apps/tenant/scripts/seed-dev-tenant.ts` — insert tenant demo + link categories

### Unknown domain

- `getCurrentTenant()` → `notFound()` → generic Next.js 404 page (ไม่ leak internal info)

---

## Backoffice: Tenant Management UI

เพิ่มเมนู "Tenants" ที่ `bo.yedhod.com/dashboard/tenants`

### Pages

| Path | Purpose |
|---|---|
| `/dashboard/tenants` | List tenants (name, domain, isActive, actions) |
| `/dashboard/tenants/new` | Create form |
| `/dashboard/tenants/[id]` | Edit — split เป็น tabs: **General**, **Categories**, **Ads** |

**General tab** — name, slug, primaryDomain, tagline, footerText, primaryColor, accentColor, metaTitle, metaDescription, logo upload, favicon upload, isActive toggle

**Categories tab** — checkbox list ของ categories ที่ `accessLevel = 'member'` (filter server-side), drag-to-sort สำหรับ `sortOrder`

**Ads tab** — group by `slot` (7 slots), แต่ละ slot list ads ที่มีอยู่ + ปุ่ม "Add ad" (เลือก `type` = embed หรือ banner) + drag-to-sort

### API Routes (`apps/backoffice/src/app/api/tenants/`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/tenants` | List all tenants |
| POST | `/api/tenants` | Create tenant |
| GET | `/api/tenants/[id]` | Get single |
| PATCH | `/api/tenants/[id]` | Update fields |
| DELETE | `/api/tenants/[id]` | Delete (cascade tenant_categories + tenant_ads; clean R2 assets) |
| PUT | `/api/tenants/[id]/categories` | Replace category set + sortOrder |
| GET | `/api/tenants/[id]/ads` | List ads |
| POST | `/api/tenants/[id]/ads` | Create ad |
| PATCH | `/api/tenants/[id]/ads/[adId]` | Update ad |
| DELETE | `/api/tenants/[id]/ads/[adId]` | Delete ad (clean R2 image if banner) |

ทุก route wrap ด้วย `getAdminSession()` เดิม → 401 ถ้าไม่ใช่ admin

### R2 Upload

- Extend `apps/backoffice/src/app/api/upload/route.ts` (หรือ create ใหม่) รองรับ folder: `tenant-logos/`, `tenant-favicons/`, `tenant-ads/`
- Frontend request presigned URL → PUT ตรงไป R2 (pattern เดิม)

### Validation

`packages/validators` เพิ่ม:
- `tenantCreateSchema` — slug regex `/^[a-z0-9-]+$/`, primaryDomain lowercased + valid hostname
- `tenantUpdateSchema` — partial
- `tenantAdCreateSchema` — discriminated union ตาม `type` (embed → `embedCode` required; banner → `imageR2Key` required)

---

## Tenant Frontend (`apps/tenant`)

### File Structure

```
apps/tenant/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # root layout — reads tenant, sets <head> title/favicon/meta, applies theme CSS vars
│   │   ├── page.tsx                # home — latest clips across tenant's categories
│   │   ├── category/[slug]/page.tsx  # single category feed
│   │   ├── clip/[id]/page.tsx      # clip detail + player
│   │   ├── not-found.tsx           # unknown domain / 404
│   │   └── api/
│   │       ├── clips/[id]/stream/route.ts  # tenant-scoped stream endpoint
│   │       ├── clips/[id]/thumbnail/route.ts  # tenant-scoped thumb
│   │       └── health/route.ts     # liveness
│   ├── components/
│   │   ├── tenant-shell.tsx        # header + sidebar + footer (theme applied)
│   │   ├── clip-feed.tsx
│   │   ├── clip-card.tsx           # no VIP overlay, no login CTA
│   │   ├── video-player.tsx
│   │   ├── ad-slot.tsx             # renders <TenantAd slot="header" /> etc.
│   │   └── ad-render.tsx           # switches embed vs banner
│   ├── lib/
│   │   ├── tenant.ts               # getCurrentTenant() (React cache)
│   │   ├── tenant-queries.ts       # getTenantCategories, getTenantClips, getTenantAds
│   │   └── access-guard.ts         # assertClipInTenant(clipId, tenantId)
│   ├── middleware.ts
│   └── styles/globals.css
├── scripts/
│   └── seed-dev-tenant.ts
├── next.config.ts
├── package.json                    # transpilePackages same as apps/web
└── tsconfig.json
```

### Rendering

- `layout.tsx` — resolve tenant → inject theme CSS vars (`--tenant-primary`, `--tenant-accent`) via inline `<style>` on `<html>`, set `<title>` = `metaTitle`, favicon = presigned URL of `faviconR2Key`
- Category sidebar reads `getTenantCategories(tenantId)` → join `tenant_categories` + `categories` order by `sortOrder`
- Clip feed reads `getTenantClips(tenantId, categoryId?)` → join `tenant_categories` + `clips` filter `accessLevel='member'` + `isActive=true`
- No login button, no pricing link, no VIP overlay

### Ad rendering (`components/ad-slot.tsx`)

```tsx
export async function AdSlot({ slot }: { slot: AdSlot }) {
  const tenant = await getCurrentTenant();
  const ads = await getTenantAds(tenant.id, slot); // isActive + sortOrder
  if (!ads.length) return null;
  return (
    <div className="ad-slot" data-slot={slot}>
      {ads.map((ad) => <AdRender key={ad.id} ad={ad} />)}
    </div>
  );
}
```

`AdRender` switches:
- `embed` → `<div dangerouslySetInnerHTML={{ __html: ad.embedCode }} />`
- `banner` → `<a href={ad.linkUrl} target="_blank" rel="nofollow noopener"><img src={presignedUrl} alt={ad.altText} /></a>`

Slots placed in:
- `header` → top of `TenantShell`
- `sidebar_top`, `sidebar_bot` → in sidebar
- `in_feed` → every N clips (N = configurable const, e.g. 5)
- `footer` → bottom of `TenantShell`
- `before_video`, `after_video` → in `clip/[id]/page.tsx` around `<VideoPlayer />`

---

## Streaming Endpoint (Tenant-Scoped)

`apps/tenant/src/app/api/clips/[id]/stream/route.ts`

```ts
export async function GET(_req, { params }) {
  const { id } = await params;
  const tenant = await getCurrentTenant();  // 404 if unknown domain

  // Verify: clip is active, member-level, and its category is enabled for this tenant
  const [row] = await db
    .select({ r2Key: clips.r2Key })
    .from(clips)
    .innerJoin(categories, eq(categories.id, clips.categoryId))
    .innerJoin(tenantCategories, and(
      eq(tenantCategories.categoryId, categories.id),
      eq(tenantCategories.tenantId, tenant.id),
    ))
    .where(and(
      eq(clips.id, id),
      eq(clips.isActive, true),
      eq(clips.accessLevel, "member"),
    ))
    .limit(1);

  if (!row) return NextResponse.json({ error: "ไม่พบคลิป" }, { status: 404 });

  const url = await getPresignedDownloadUrl(row.r2Key, 7200);
  return NextResponse.json({ url });
}
```

**Guards:**
- Anonymous OK (no session check)
- Clip must be `active` + `accessLevel = 'member'`
- Clip's category must be in `tenant_categories` of the current tenant
- Presigned URL expires in 2hr (same as `apps/web`)

Same pattern for `/api/clips/[id]/thumbnail/route.ts` (presigned thumb).

**Rate limiting:** ไม่ทำใน v1 (ตาม existing pattern of `apps/web`); Cloudflare in front handles abuse.

---

## Layout / Branding

**Design goal:** tenant sites ต้อง **ไม่หน้าตาเหมือน yedhod.com** — คนละ layout, คนละ tone, คนละ vibe ทั้งเพื่อไม่ให้ Google/ad network จับว่าเป็นเครือเดียวกันของเว็บหลัก และเพื่อ position tenant sites เป็น "tube site แบบ mainstream" (ดู pageview/ads-driven) ไม่ใช่ "chat-style premium" แบบ yedhod

### สรุปความแตกต่าง

| aspect | **yedhod.com** (เว็บหลัก) | **tenant sites** (v1) |
|---|---|---|
| Layout style | Telegram-style 2-panel, chat feed | **Tube-style grid** — masonry/grid thumbnails |
| Sidebar | Left, always visible (categories chat list) | **Top nav bar** — categories เป็น pill/tag แถวบน (mobile-first) |
| Clip card | Full-width horizontal card, chat bubble | **Thumbnail grid** — 2 คอลัมน์ mobile / 3-4 desktop, thumb-first, title ใต้ภาพ |
| Player | Inline in feed | **Dedicated page** — player + related clips ด้านล่าง |
| Colors | Dark, red-primary chat vibe | Configurable per tenant (default = **cool dark blue** ไม่ใช่ red) |
| Typography | Sans, chat-app style | Sans, **content-forward** — bigger title, more whitespace |
| Header | Compact top bar with logo + banner slider | Sticky top nav — logo + search + category pills |
| Footer | Minimal | **Rich footer** — footer text + copyright + links (typical tube-site style) |
| Login/VIP | Prominent CTA everywhere | **None** — ไม่มีเลย |
| Banner slider | Auto-rotating banner (system_config) | **No hero slider** — ตรงข้ามให้ค่า thumb grid |

### Base layout (tenant)

```
┌────────────────────────────────────────────────────────┐
│ [ header ad slot ]                                     │
├────────────────────────────────────────────────────────┤
│ 🔵 LOGO   [ 🔍 search ]           [ nav item · item ] │  ← sticky top nav
│ [ cat1 ] [ cat2 ] [ cat3 ] [ cat4 ] [ ... ]            │  ← category pills row
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐            │
│  │ thumb │  │ thumb │  │ thumb │  │ thumb │            │
│  │       │  │       │  │       │  │       │            │
│  └───────┘  └───────┘  └───────┘  └───────┘            │
│  title      title      title      title                │
│  duration   duration   duration   duration             │
│                                                        │
│  [ in-feed ad slot (banner or embed) — full row ]      │
│                                                        │
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐            │
│  ...                                                   │
│                                                        │
├────────────────────────────────────────────────────────┤
│ [ footer ad slot ]                                     │
│ tagline · footer text · © YEAR site name               │
└────────────────────────────────────────────────────────┘
```

Clip detail page:

```
┌────────────────────────────────────────────────────────┐
│ header + nav + pills                                   │
├────────────────────────────────────────────────────────┤
│ [ before-video ad slot ]                               │
│ ┌────────────────────────────────────────────────────┐ │
│ │                                                    │ │
│ │              VIDEO PLAYER (16:9)                   │ │
│ │                                                    │ │
│ └────────────────────────────────────────────────────┘ │
│ Title (h1)                                             │
│ category · duration                                    │
│ [ after-video ad slot ]                                │
│                                                        │
│ ── Related ──                                          │
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐            │
│  │ thumb │  │ thumb │  │ thumb │  │ thumb │            │
│  └───────┘  └───────┘  └───────┘  └───────┘            │
├────────────────────────────────────────────────────────┤
│ footer                                                 │
└────────────────────────────────────────────────────────┘
```

Sidebar slots (`sidebar_top`, `sidebar_bot`) — **only on desktop ≥1280px** as right rail; on mobile they collapse into `in_feed` positions.

### Theme parametrization

- CSS vars set in `layout.tsx` via inline `<style>`:
  ```
  --tenant-primary: {primaryColor};
  --tenant-accent: {accentColor};
  --tenant-bg: {backgroundColor ?? "#0b0d13"};
  --tenant-fg: {fgColor ?? "#e6e9f2"};
  ```
- Applied to buttons, category pill active-state, link hover, badge, focus ring
- No component override, no upload of custom CSS (YAGNI)

**Extra branding fields** to add to `tenants` schema for full differentiation (update Data Model section):

- `backgroundColor` (default `#0b0d13` — dark cool-blue)
- `fgColor` (default `#e6e9f2`)
- `layoutVariant` — reserved for future; default `"grid"`, currently only value

(→ update `tenants` table below to include these two extra text columns)

---

## Deployment (Coolify)

- New Coolify service `yedhod-tenant` → build `apps/tenant` (Dockerfile pattern of `apps/web`)
- Port 3002 internal
- Attach multiple domains in Coolify UI as tenants are onboarded
- Traefik auto-issues Let's Encrypt certs per domain
- Env vars shared with `apps/web`: `DATABASE_URL`, R2 keys, `BETTER_AUTH_SECRET` (not used but Better Auth package imports may require it) — reuse `.env` template

### Dockerfile

Copy pattern from `apps/web/Dockerfile` (if exists) or `apps/backoffice/Dockerfile`. Standalone Next.js output (`output: 'standalone'` in `next.config.ts`).

### Monitoring

- `/api/health` route returns 200 + tenant count
- Coolify healthcheck hits it every 30s

---

## Error handling

| Case | Behavior |
|---|---|
| Unknown `Host` | 404 (generic Next.js not-found page) |
| Tenant `isActive = false` | Same as unknown → 404 |
| Clip in URL doesn't belong to tenant's categories | 404 from `/api/clips/[id]/stream` |
| Missing tenant favicon/logo | Fallback to default (bundled asset) |
| No ads in slot | `AdSlot` returns `null` (no empty div) |
| R2 presign failure | 500 + generic error message |
| DB down | Next.js error boundary → 500 |

---

## Testing

- **Manual** — seed 2 dev tenants (`site-a.local`, `site-b.local`), verify branding/categories/ads differ
- **Type checks** — `npx tsc --noEmit -p apps/tenant/tsconfig.json` and `apps/backoffice/tsconfig.json`
- **Integration** — hit `/api/clips/[id]/stream` with wrong tenant's clip → expect 404
- **Domain leak test** — request `Host: unknown.com` → expect 404, no tenant info in response
- No formal unit test suite (matches existing project convention — no test setup in repo)

---

## Open questions / follow-ups (out of scope for v1)

- Alias domains (`www.` redirect)
- Sitemap/robots.txt per tenant
- Per-tenant analytics dashboard
- LRU cache for tenant lookup (if traffic grows)
- Rate limiting on stream endpoint
- Category subset can override `sortOrder` — should tenant also customize `name` per tenant? (probably no — same content everywhere)

---

## Rollout Plan (high level — details in implementation plan)

1. Schema + migration
2. Backoffice API + UI (Tenants CRUD)
3. `apps/tenant` scaffold + middleware + resolver
4. Feed + clip pages
5. Streaming endpoint
6. Ad slots + rendering
7. Dockerfile + Coolify service
8. Onboard first tenant (`site-a.com`) — validate end-to-end
9. Onboard remaining tenants incrementally
