# Multi-Tenant Clone Sites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a multi-tenant Next.js app (`apps/tenant`) that serves 20+ ad-driven clone sites, each with its own domain, branding, category subset, and ad slots — all managed from the existing backoffice, and visually distinct from yedhod.com (tube-grid layout instead of chat-style).

**Architecture:** New Next.js app `apps/tenant` uses Host-header middleware to resolve the current tenant from Postgres on every request. Shares `@kodhom/db`, `@kodhom/r2`, `@kodhom/ui`, `@kodhom/validators`, `@kodhom/config` with existing apps. Backoffice gets a `/dashboard/tenants` CRUD area. Streaming endpoint is tenant-scoped: it only serves clips whose category is enabled for the current tenant and whose access level is `member`.

**Tech Stack:** Next.js 15 App Router, React 19, Drizzle ORM, PostgreSQL, Cloudflare R2, Tailwind v4, Zod, Better Auth (backoffice only), TypeScript.

**Reference spec:** `docs/superpowers/specs/2026-07-09-multi-tenant-clone-design.md`

**No test framework in repo — verification uses `npx tsc --noEmit`, seed scripts, and manual curl/browser checks.** Do not add a test framework.

---

## Task 1: Add new enums (`ad_slot`, `ad_type`)

**Files:**
- Modify: `packages/db/src/schema/enums.ts`

- [ ] **Step 1: Add the two new enums**

Append to `packages/db/src/schema/enums.ts`:

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

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit -p apps/backoffice/tsconfig.json`
Expected: no new errors (there may be pre-existing errors — note them but do not fix here).

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/enums.ts
git commit -m "db: add ad_slot and ad_type enums for tenant ads"
```

---

## Task 2: Create `tenants` schema

**Files:**
- Create: `packages/db/src/schema/tenants.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Write `tenants.ts`**

Create `packages/db/src/schema/tenants.ts`:

```ts
import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const tenants = pgTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    primaryDomain: text("primary_domain").notNull().unique(),

    logoR2Key: text("logo_r2_key"),
    faviconR2Key: text("favicon_r2_key"),
    tagline: text("tagline"),
    footerText: text("footer_text"),
    primaryColor: text("primary_color").notNull().default("#3b82f6"),
    accentColor: text("accent_color").notNull().default("#60a5fa"),
    backgroundColor: text("background_color").notNull().default("#0b0d13"),
    fgColor: text("fg_color").notNull().default("#e6e9f2"),

    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),

    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    domainIdx: index("tenants_domain_idx").on(t.primaryDomain),
    slugIdx: index("tenants_slug_idx").on(t.slug),
  })
);
```

- [ ] **Step 2: Export from schema index**

Modify `packages/db/src/schema/index.ts` — add before `./relations`:

```ts
export * from "./tenants";
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p apps/backoffice/tsconfig.json`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/tenants.ts packages/db/src/schema/index.ts
git commit -m "db: add tenants table"
```

---

## Task 3: Create `tenant_categories` schema

**Files:**
- Create: `packages/db/src/schema/tenant-categories.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Write the file**

Create `packages/db/src/schema/tenant-categories.ts`:

```ts
import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { categories } from "./categories";

export const tenantCategories = pgTable(
  "tenant_categories",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    uniquePair: uniqueIndex("tenant_categories_unique").on(
      t.tenantId,
      t.categoryId
    ),
    tenantIdx: index("tenant_categories_tenant_idx").on(t.tenantId),
  })
);
```

- [ ] **Step 2: Export from schema index**

Modify `packages/db/src/schema/index.ts` — add after `./tenants`:

```ts
export * from "./tenant-categories";
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p apps/backoffice/tsconfig.json`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/tenant-categories.ts packages/db/src/schema/index.ts
git commit -m "db: add tenant_categories junction table"
```

---

## Task 4: Create `tenant_ads` schema

**Files:**
- Create: `packages/db/src/schema/tenant-ads.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Write the file**

Create `packages/db/src/schema/tenant-ads.ts`:

```ts
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { adSlotEnum, adTypeEnum } from "./enums";

export const tenantAds = pgTable(
  "tenant_ads",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    slot: adSlotEnum("slot").notNull(),
    type: adTypeEnum("type").notNull(),

    embedCode: text("embed_code"),

    imageR2Key: text("image_r2_key"),
    linkUrl: text("link_url"),
    altText: text("alt_text"),

    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    tenantSlotIdx: index("tenant_ads_tenant_slot_idx").on(t.tenantId, t.slot),
  })
);
```

- [ ] **Step 2: Export from schema index**

Modify `packages/db/src/schema/index.ts` — add after `./tenant-categories`:

```ts
export * from "./tenant-ads";
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p apps/backoffice/tsconfig.json`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/tenant-ads.ts packages/db/src/schema/index.ts
git commit -m "db: add tenant_ads table"
```

---

## Task 5: Generate + apply migration

**Files:**
- Create: `packages/db/drizzle/00XX_multi_tenant.sql` (generated)

- [ ] **Step 1: Generate migration**

Run: `pnpm db:generate`
Expected: a new `.sql` file appears in `packages/db/drizzle/` containing:
- `CREATE TYPE "public"."ad_slot" AS ENUM(...)`
- `CREATE TYPE "public"."ad_type" AS ENUM(...)`
- `CREATE TABLE tenants (...)`
- `CREATE TABLE tenant_categories (...)`
- `CREATE TABLE tenant_ads (...)`
- Indexes as declared

- [ ] **Step 2: Inspect the generated SQL**

Open the new file. Confirm the foreign keys reference `categories(id)` and `tenants(id)` as `text` (not uuid). If any type mismatch, fix the schema and re-run `pnpm db:generate`.

- [ ] **Step 3: Apply migration**

Run: `pnpm db:migrate`
Expected: migration applied without error. New tables visible in DB.

- [ ] **Step 4: Commit**

```bash
git add packages/db/drizzle/
git commit -m "db: migration for tenants, tenant_categories, tenant_ads"
```

---

## Task 6: Add tenant validators

**Files:**
- Modify: `packages/validators/src/index.ts`

- [ ] **Step 1: Append validators**

Append to `packages/validators/src/index.ts`:

```ts
// Tenants
const hostnameRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export const tenantCreateSchema = z.object({
  slug: z
    .string()
    .min(1, "กรุณากรอก slug")
    .regex(/^[a-z0-9-]+$/, "slug ใช้ได้เฉพาะ a-z, 0-9, -"),
  name: z.string().min(1, "กรุณากรอกชื่อเว็บ"),
  primaryDomain: z
    .string()
    .min(1, "กรุณากรอกโดเมน")
    .transform((v) => v.toLowerCase().trim())
    .refine((v) => hostnameRegex.test(v) || /\.local$/.test(v), {
      message: "โดเมนไม่ถูกต้อง",
    }),
  logoR2Key: z.string().nullable().optional(),
  faviconR2Key: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
  footerText: z.string().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "สีต้องเป็น hex #RRGGBB").default("#3b82f6"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#60a5fa"),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0b0d13"),
  fgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#e6e9f2"),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const tenantUpdateSchema = tenantCreateSchema.partial();

export const tenantCategoriesSchema = z.object({
  items: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        sortOrder: z.number().int().default(0),
      })
    )
    .default([]),
});

const AD_SLOTS = [
  "header",
  "sidebar_top",
  "sidebar_bot",
  "in_feed",
  "footer",
  "before_video",
  "after_video",
] as const;

export const tenantAdCreateSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("embed"),
    slot: z.enum(AD_SLOTS),
    embedCode: z.string().min(1, "กรุณาใส่โค้ดโฆษณา"),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("banner"),
    slot: z.enum(AD_SLOTS),
    imageR2Key: z.string().min(1, "กรุณาอัปโหลดรูป"),
    linkUrl: z.string().url("ลิงก์ไม่ถูกต้อง").nullable().optional(),
    altText: z.string().nullable().optional(),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  }),
]);

export const tenantAdUpdateSchema = z.object({
  slot: z.enum(AD_SLOTS).optional(),
  embedCode: z.string().nullable().optional(),
  imageR2Key: z.string().nullable().optional(),
  linkUrl: z.string().url().nullable().optional(),
  altText: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type TenantCreateInput = z.infer<typeof tenantCreateSchema>;
export type TenantUpdateInput = z.infer<typeof tenantUpdateSchema>;
export type TenantCategoriesInput = z.infer<typeof tenantCategoriesSchema>;
export type TenantAdCreateInput = z.infer<typeof tenantAdCreateSchema>;
export type TenantAdUpdateInput = z.infer<typeof tenantAdUpdateSchema>;
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit -p apps/backoffice/tsconfig.json`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add packages/validators/src/index.ts
git commit -m "validators: add tenant + tenant ad schemas"
```

---

## Task 7: Backoffice — extend upload endpoint for tenant assets

**Files:**
- Modify: `apps/backoffice/src/app/api/upload/route.ts` (if exists — else create)

- [ ] **Step 1: Read current upload route**

Look at `apps/backoffice/src/app/api/upload/route.ts` (or find the closest analog by grepping `getPresignedUploadUrl` in `apps/backoffice`). It should follow the same admin-gated presign pattern used in `apps/web`.

- [ ] **Step 2: Ensure the route accepts new folders**

Extend `folder` allowlist to include: `tenant-logos`, `tenant-favicons`, `tenant-ads`.

Example (adjust to match the existing signature — do not overwrite unrelated fields):

```ts
const ALLOWED_FOLDERS = new Set([
  "avatars",
  "banners",
  "categories",
  "clips",
  "clip-thumbs",
  "tenant-logos",
  "tenant-favicons",
  "tenant-ads",
]);

if (!ALLOWED_FOLDERS.has(folder)) {
  return NextResponse.json({ error: "โฟลเดอร์ไม่ถูกต้อง" }, { status: 400 });
}
```

Keep the MIME allowlist as is; add `image/svg+xml` only if the existing logo/banner path already allows it.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p apps/backoffice/tsconfig.json`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backoffice/src/app/api/upload/route.ts
git commit -m "backoffice: allow tenant asset folders in upload endpoint"
```

---

## Task 8: Backoffice API — `GET /api/tenants`, `POST /api/tenants`

**Files:**
- Create: `apps/backoffice/src/app/api/tenants/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { tenants } from "@kodhom/db/schema";
import { desc } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { tenantCreateSchema } from "@kodhom/validators";
import { nanoid } from "@/lib/nanoid";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.select().from(tenants).orderBy(desc(tenants.createdAt));
  return NextResponse.json({ tenants: rows });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = tenantCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 }
    );
  }

  const id = nanoid();
  const [row] = await db
    .insert(tenants)
    .values({ id, ...parsed.data })
    .returning();
  return NextResponse.json({ tenant: row });
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit -p apps/backoffice/tsconfig.json`
Expected: no new errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add apps/backoffice/src/app/api/tenants/route.ts
git commit -m "backoffice: list + create tenants API"
```

---

## Task 9: Backoffice API — `GET/PATCH/DELETE /api/tenants/[id]`

**Files:**
- Create: `apps/backoffice/src/app/api/tenants/[id]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { tenants, tenantAds } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { tenantUpdateSchema } from "@kodhom/validators";
import { deleteObject } from "@kodhom/r2";

async function loadTenant(id: string) {
  const [row] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return row ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = await loadTenant(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ tenant: row });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const parsed = tenantUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 }
    );
  }
  const [row] = await db
    .update(tenants)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(tenants.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ tenant: row });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await loadTenant(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Collect R2 keys to clean up
  const keys: string[] = [];
  if (existing.logoR2Key) keys.push(existing.logoR2Key);
  if (existing.faviconR2Key) keys.push(existing.faviconR2Key);
  const ads = await db
    .select({ imageR2Key: tenantAds.imageR2Key })
    .from(tenantAds)
    .where(eq(tenantAds.tenantId, id));
  for (const a of ads) if (a.imageR2Key) keys.push(a.imageR2Key);

  // Cascade delete rows (FK cascade handles tenant_categories/tenant_ads)
  await db.delete(tenants).where(eq(tenants.id, id));

  // Best-effort R2 cleanup
  await Promise.allSettled(keys.map((k) => deleteObject(k)));

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit -p apps/backoffice/tsconfig.json`

- [ ] **Step 3: Commit**

```bash
git add apps/backoffice/src/app/api/tenants/[id]/route.ts
git commit -m "backoffice: get/update/delete tenant API"
```

---

## Task 10: Backoffice API — replace tenant categories

**Files:**
- Create: `apps/backoffice/src/app/api/tenants/[id]/categories/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { tenantCategories, categories } from "@kodhom/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { tenantCategoriesSchema } from "@kodhom/validators";
import { nanoid } from "@/lib/nanoid";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rows = await db
    .select()
    .from(tenantCategories)
    .where(eq(tenantCategories.tenantId, id));
  return NextResponse.json({ items: rows });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tenantId } = await params;

  const body = await req.json();
  const parsed = tenantCategoriesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 }
    );
  }

  const requested = parsed.data.items;
  if (requested.length > 0) {
    // Enforce: all categoryIds must exist AND be accessLevel='member'
    const ids = requested.map((r) => r.categoryId);
    const rows = await db
      .select({ id: categories.id, accessLevel: categories.accessLevel })
      .from(categories)
      .where(inArray(categories.id, ids));
    const validSet = new Set(
      rows.filter((r) => r.accessLevel === "member").map((r) => r.id)
    );
    const invalid = ids.filter((x) => !validSet.has(x));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `หมวดหมู่บางรายการไม่พบหรือไม่ใช่ระดับ member: ${invalid.join(", ")}` },
        { status: 400 }
      );
    }
  }

  // Replace atomically
  await db.transaction(async (tx) => {
    await tx.delete(tenantCategories).where(eq(tenantCategories.tenantId, tenantId));
    if (requested.length > 0) {
      await tx.insert(tenantCategories).values(
        requested.map((r) => ({
          id: nanoid(),
          tenantId,
          categoryId: r.categoryId,
          sortOrder: r.sortOrder,
        }))
      );
    }
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit -p apps/backoffice/tsconfig.json`

- [ ] **Step 3: Commit**

```bash
git add apps/backoffice/src/app/api/tenants/[id]/categories/route.ts
git commit -m "backoffice: replace tenant categories API"
```

---

## Task 11: Backoffice API — tenant ads CRUD

**Files:**
- Create: `apps/backoffice/src/app/api/tenants/[id]/ads/route.ts`
- Create: `apps/backoffice/src/app/api/tenants/[id]/ads/[adId]/route.ts`

- [ ] **Step 1: Write list + create**

`apps/backoffice/src/app/api/tenants/[id]/ads/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { tenantAds } from "@kodhom/db/schema";
import { eq, asc } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { tenantAdCreateSchema } from "@kodhom/validators";
import { nanoid } from "@/lib/nanoid";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rows = await db
    .select()
    .from(tenantAds)
    .where(eq(tenantAds.tenantId, id))
    .orderBy(asc(tenantAds.slot), asc(tenantAds.sortOrder));
  return NextResponse.json({ ads: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tenantId } = await params;

  const body = await req.json();
  const parsed = tenantAdCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 }
    );
  }

  const base = {
    id: nanoid(),
    tenantId,
    slot: parsed.data.slot,
    type: parsed.data.type,
    sortOrder: parsed.data.sortOrder,
    isActive: parsed.data.isActive,
  };
  const record =
    parsed.data.type === "embed"
      ? { ...base, embedCode: parsed.data.embedCode, imageR2Key: null, linkUrl: null, altText: null }
      : {
          ...base,
          embedCode: null,
          imageR2Key: parsed.data.imageR2Key,
          linkUrl: parsed.data.linkUrl ?? null,
          altText: parsed.data.altText ?? null,
        };

  const [row] = await db.insert(tenantAds).values(record).returning();
  return NextResponse.json({ ad: row });
}
```

- [ ] **Step 2: Write update + delete**

`apps/backoffice/src/app/api/tenants/[id]/ads/[adId]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { tenantAds } from "@kodhom/db/schema";
import { and, eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { tenantAdUpdateSchema } from "@kodhom/validators";
import { deleteObject } from "@kodhom/r2";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; adId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tenantId, adId } = await params;

  const body = await req.json();
  const parsed = tenantAdUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 }
    );
  }

  const [row] = await db
    .update(tenantAds)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(tenantAds.id, adId), eq(tenantAds.tenantId, tenantId)))
    .returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ad: row });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; adId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tenantId, adId } = await params;

  const [row] = await db
    .select({ imageR2Key: tenantAds.imageR2Key })
    .from(tenantAds)
    .where(and(eq(tenantAds.id, adId), eq(tenantAds.tenantId, tenantId)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db
    .delete(tenantAds)
    .where(and(eq(tenantAds.id, adId), eq(tenantAds.tenantId, tenantId)));

  if (row.imageR2Key) {
    await deleteObject(row.imageR2Key).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p apps/backoffice/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add apps/backoffice/src/app/api/tenants/
git commit -m "backoffice: tenant ads CRUD API"
```

---

## Task 12: Backoffice UI — Tenants list page

**Files:**
- Create: `apps/backoffice/src/app/(dashboard)/dashboard/tenants/page.tsx`
- Modify: `apps/backoffice/src/components/admin-sidebar.tsx`

- [ ] **Step 1: Add sidebar nav item**

Modify `apps/backoffice/src/components/admin-sidebar.tsx` — import `Globe` from lucide-react, and add to `navItems` array (place after the "banners" entry, before "config"):

```ts
{ href: "/dashboard/tenants", label: "เว็บ Clone", icon: Globe },
```

- [ ] **Step 2: Write list page**

Create `apps/backoffice/src/app/(dashboard)/dashboard/tenants/page.tsx`:

```tsx
import Link from "next/link";
import { db } from "@kodhom/db";
import { tenants } from "@kodhom/db/schema";
import { desc } from "drizzle-orm";
import { Button } from "@kodhom/ui/components/button";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const rows = await db.select().from(tenants).orderBy(desc(tenants.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">เว็บ Clone (Tenants)</h1>
        <Link href="/dashboard/tenants/new">
          <Button>+ เพิ่มเว็บใหม่</Button>
        </Link>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3 text-left">ชื่อ</th>
              <th className="p-3 text-left">โดเมน</th>
              <th className="p-3 text-left">Slug</th>
              <th className="p-3 text-left">สถานะ</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-3">{t.name}</td>
                <td className="p-3">
                  <a
                    className="text-primary underline"
                    href={`https://${t.primaryDomain}`}
                    target="_blank"
                    rel="noopener"
                  >
                    {t.primaryDomain}
                  </a>
                </td>
                <td className="p-3 font-mono text-xs">{t.slug}</td>
                <td className="p-3">
                  {t.isActive ? (
                    <span className="rounded bg-green-500/10 px-2 py-0.5 text-green-500">active</span>
                  ) : (
                    <span className="rounded bg-red-500/10 px-2 py-0.5 text-red-500">inactive</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <Link href={`/dashboard/tenants/${t.id}`}>
                    <Button variant="outline" size="sm">แก้ไข</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  ยังไม่มี tenant
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p apps/backoffice/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add apps/backoffice/src/app/(dashboard)/dashboard/tenants/page.tsx apps/backoffice/src/components/admin-sidebar.tsx
git commit -m "backoffice: tenants list page + sidebar link"
```

---

## Task 13: Backoffice UI — Tenants new page

**Files:**
- Create: `apps/backoffice/src/app/(dashboard)/dashboard/tenants/new/page.tsx`
- Create: `apps/backoffice/src/app/(dashboard)/dashboard/tenants/new/new-tenant-form.tsx`

- [ ] **Step 1: Server wrapper**

`apps/backoffice/src/app/(dashboard)/dashboard/tenants/new/page.tsx`:

```tsx
import NewTenantForm from "./new-tenant-form";

export default function NewTenantPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">เพิ่มเว็บใหม่</h1>
      <NewTenantForm />
    </div>
  );
}
```

- [ ] **Step 2: Client form**

`apps/backoffice/src/app/(dashboard)/dashboard/tenants/new/new-tenant-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@kodhom/ui/components/button";
import { Input } from "@kodhom/ui/components/input";
import { Label } from "@kodhom/ui/components/label";

export default function NewTenantForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    primaryDomain: "",
    tagline: "",
    primaryColor: "#3b82f6",
    accentColor: "#60a5fa",
    backgroundColor: "#0b0d13",
    fgColor: "#e6e9f2",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(json.error ?? "error");
      return;
    }
    router.push(`/dashboard/tenants/${json.tenant.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label>ชื่อเว็บ</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div>
        <Label>Slug (a-z, 0-9, -)</Label>
        <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
      </div>
      <div>
        <Label>โดเมนหลัก (เช่น sitea.com)</Label>
        <Input value={form.primaryDomain} onChange={(e) => setForm({ ...form, primaryDomain: e.target.value })} required />
      </div>
      <div>
        <Label>Tagline</Label>
        <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>สี Primary</Label>
          <Input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
        </div>
        <div>
          <Label>สี Accent</Label>
          <Input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} />
        </div>
        <div>
          <Label>พื้นหลัง</Label>
          <Input type="color" value={form.backgroundColor} onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })} />
        </div>
        <div>
          <Label>สีตัวหนังสือ</Label>
          <Input type="color" value={form.fgColor} onChange={(e) => setForm({ ...form, fgColor: e.target.value })} />
        </div>
      </div>
      {err && <p className="text-sm text-red-500">{err}</p>}
      <Button type="submit" disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึก"}</Button>
    </form>
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p apps/backoffice/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add apps/backoffice/src/app/(dashboard)/dashboard/tenants/new/
git commit -m "backoffice: tenants create form"
```

---

## Task 14: Backoffice UI — Tenants edit page (General tab)

**Files:**
- Create: `apps/backoffice/src/app/(dashboard)/dashboard/tenants/[id]/page.tsx`
- Create: `apps/backoffice/src/app/(dashboard)/dashboard/tenants/[id]/edit-tenant-form.tsx`

- [ ] **Step 1: Server wrapper**

`apps/backoffice/src/app/(dashboard)/dashboard/tenants/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { db } from "@kodhom/db";
import { tenants, categories, tenantCategories, tenantAds } from "@kodhom/db/schema";
import { eq, asc, and } from "drizzle-orm";
import EditTenantForm from "./edit-tenant-form";

export const dynamic = "force-dynamic";

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [t] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!t) notFound();

  const memberCats = await db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(categories)
    .where(and(eq(categories.accessLevel, "member"), eq(categories.isActive, true)))
    .orderBy(asc(categories.name));

  const chosen = await db
    .select()
    .from(tenantCategories)
    .where(eq(tenantCategories.tenantId, id));

  const ads = await db
    .select()
    .from(tenantAds)
    .where(eq(tenantAds.tenantId, id))
    .orderBy(asc(tenantAds.slot), asc(tenantAds.sortOrder));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t.name}</h1>
      <EditTenantForm tenant={t} memberCategories={memberCats} chosenCategories={chosen} ads={ads} />
    </div>
  );
}
```

- [ ] **Step 2: Client form (tabs)**

`apps/backoffice/src/app/(dashboard)/dashboard/tenants/[id]/edit-tenant-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@kodhom/ui/components/button";
import { Input } from "@kodhom/ui/components/input";
import { Label } from "@kodhom/ui/components/label";

type Tenant = {
  id: string;
  slug: string;
  name: string;
  primaryDomain: string;
  tagline: string | null;
  footerText: string | null;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fgColor: string;
  metaTitle: string | null;
  metaDescription: string | null;
  isActive: boolean;
  logoR2Key: string | null;
  faviconR2Key: string | null;
};

type MemberCat = { id: string; name: string; slug: string };
type Chosen = { categoryId: string; sortOrder: number };
type Ad = {
  id: string;
  slot: string;
  type: string;
  embedCode: string | null;
  imageR2Key: string | null;
  linkUrl: string | null;
  altText: string | null;
  sortOrder: number;
  isActive: boolean;
};

export default function EditTenantForm({
  tenant,
  memberCategories,
  chosenCategories,
  ads,
}: {
  tenant: Tenant;
  memberCategories: MemberCat[];
  chosenCategories: Chosen[];
  ads: Ad[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"general" | "categories" | "ads">("general");

  return (
    <div>
      <div className="mb-6 flex gap-2 border-b">
        {(["general", "categories", "ads"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm ${tab === t ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
          >
            {t === "general" ? "ทั่วไป" : t === "categories" ? "หมวดหมู่" : "โฆษณา"}
          </button>
        ))}
      </div>

      {tab === "general" && <GeneralTab tenant={tenant} onSaved={() => router.refresh()} />}
      {tab === "categories" && (
        <CategoriesTab
          tenantId={tenant.id}
          memberCategories={memberCategories}
          initial={chosenCategories}
          onSaved={() => router.refresh()}
        />
      )}
      {tab === "ads" && <AdsTab tenantId={tenant.id} initial={ads} onSaved={() => router.refresh()} />}
    </div>
  );
}

function GeneralTab({ tenant, onSaved }: { tenant: Tenant; onSaved: () => void }) {
  const [form, setForm] = useState(tenant);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    const { id, ...body } = form;
    const res = await fetch(`/api/tenants/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json()).error ?? "error");
      return;
    }
    onSaved();
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div><Label>ชื่อเว็บ</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
      <div><Label>โดเมน</Label><Input value={form.primaryDomain} onChange={(e) => setForm({ ...form, primaryDomain: e.target.value })} /></div>
      <div><Label>Tagline</Label><Input value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></div>
      <div><Label>Footer text</Label><Input value={form.footerText ?? ""} onChange={(e) => setForm({ ...form, footerText: e.target.value })} /></div>
      <div><Label>Meta title</Label><Input value={form.metaTitle ?? ""} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })} /></div>
      <div><Label>Meta description</Label><Input value={form.metaDescription ?? ""} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Primary</Label><Input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} /></div>
        <div><Label>Accent</Label><Input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} /></div>
        <div><Label>Background</Label><Input type="color" value={form.backgroundColor} onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })} /></div>
        <div><Label>Foreground</Label><Input type="color" value={form.fgColor} onChange={(e) => setForm({ ...form, fgColor: e.target.value })} /></div>
      </div>
      <div>
        <Label>Logo (upload folder = tenant-logos)</Label>
        <UploadField folder="tenant-logos" value={form.logoR2Key} onChange={(k) => setForm({ ...form, logoR2Key: k })} />
      </div>
      <div>
        <Label>Favicon (upload folder = tenant-favicons)</Label>
        <UploadField folder="tenant-favicons" value={form.faviconR2Key} onChange={(k) => setForm({ ...form, faviconR2Key: k })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
        />
        Active
      </label>
      {err && <p className="text-sm text-red-500">{err}</p>}
      <Button onClick={save} disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึก"}</Button>
    </div>
  );
}

function UploadField({
  folder,
  value,
  onChange,
}: {
  folder: string;
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    try {
      const presign = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type, folder }),
      });
      const { url, key } = await presign.json();
      await fetch(url, { method: "PUT", headers: { "content-type": file.type }, body: file });
      onChange(key);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {value && <span className="text-xs text-muted-foreground">{value}</span>}
      {value && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          ลบ
        </Button>
      )}
    </div>
  );
}

function CategoriesTab({
  tenantId,
  memberCategories,
  initial,
  onSaved,
}: {
  tenantId: string;
  memberCategories: MemberCat[];
  initial: Chosen[];
  onSaved: () => void;
}) {
  const [items, setItems] = useState<Chosen[]>(initial);
  const [busy, setBusy] = useState(false);
  const chosenSet = new Set(items.map((i) => i.categoryId));

  function toggle(id: string) {
    if (chosenSet.has(id)) setItems(items.filter((i) => i.categoryId !== id));
    else setItems([...items, { categoryId: id, sortOrder: items.length }]);
  }

  async function save() {
    setBusy(true);
    await fetch(`/api/tenants/${tenantId}/categories`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setBusy(false);
    onSaved();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        เลือกได้เฉพาะหมวดหมู่ระดับ member (คลิปฟรี)
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
        {memberCategories.map((c) => (
          <label key={c.id} className="flex items-center gap-2 rounded border p-2 text-sm">
            <input
              type="checkbox"
              checked={chosenSet.has(c.id)}
              onChange={() => toggle(c.id)}
            />
            {c.name}
          </label>
        ))}
      </div>
      <Button onClick={save} disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึก"}</Button>
    </div>
  );
}

function AdsTab({
  tenantId,
  initial,
  onSaved,
}: {
  tenantId: string;
  initial: Ad[];
  onSaved: () => void;
}) {
  const [ads, setAds] = useState<Ad[]>(initial);
  const [form, setForm] = useState({
    slot: "header",
    type: "embed" as "embed" | "banner",
    embedCode: "",
    imageR2Key: "",
    linkUrl: "",
    altText: "",
  });
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    const body =
      form.type === "embed"
        ? { type: "embed", slot: form.slot, embedCode: form.embedCode }
        : {
            type: "banner",
            slot: form.slot,
            imageR2Key: form.imageR2Key,
            linkUrl: form.linkUrl || undefined,
            altText: form.altText || undefined,
          };
    const res = await fetch(`/api/tenants/${tenantId}/ads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error ?? "error");
      return;
    }
    setAds([...ads, json.ad]);
    onSaved();
  }

  async function del(id: string) {
    await fetch(`/api/tenants/${tenantId}/ads/${id}`, { method: "DELETE" });
    setAds(ads.filter((a) => a.id !== id));
    onSaved();
  }

  return (
    <div className="space-y-6">
      <div className="rounded border p-4">
        <h3 className="mb-3 font-medium">โฆษณาทั้งหมด</h3>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Slot</th>
              <th className="text-left">Type</th>
              <th className="text-left">Preview</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ads.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="py-2 font-mono text-xs">{a.slot}</td>
                <td className="py-2">{a.type}</td>
                <td className="py-2 text-xs text-muted-foreground">
                  {a.type === "embed" ? (a.embedCode ?? "").slice(0, 40) + "..." : a.imageR2Key}
                </td>
                <td className="py-2 text-right">
                  <Button variant="outline" size="sm" onClick={() => del(a.id)}>ลบ</Button>
                </td>
              </tr>
            ))}
            {ads.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">ยังไม่มีโฆษณา</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded border p-4">
        <h3 className="mb-3 font-medium">เพิ่มโฆษณาใหม่</h3>
        <div className="space-y-3">
          <div>
            <Label>Slot</Label>
            <select
              className="w-full rounded border bg-background p-2"
              value={form.slot}
              onChange={(e) => setForm({ ...form, slot: e.target.value })}
            >
              {["header", "sidebar_top", "sidebar_bot", "in_feed", "footer", "before_video", "after_video"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Type</Label>
            <select
              className="w-full rounded border bg-background p-2"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "embed" | "banner" })}
            >
              <option value="embed">embed (HTML/JS)</option>
              <option value="banner">banner (image)</option>
            </select>
          </div>
          {form.type === "embed" ? (
            <div>
              <Label>Embed HTML/JS</Label>
              <textarea
                className="w-full rounded border bg-background p-2 font-mono text-xs"
                rows={6}
                value={form.embedCode}
                onChange={(e) => setForm({ ...form, embedCode: e.target.value })}
              />
            </div>
          ) : (
            <>
              <div>
                <Label>รูปโฆษณา</Label>
                <UploadField
                  folder="tenant-ads"
                  value={form.imageR2Key || null}
                  onChange={(k) => setForm({ ...form, imageR2Key: k ?? "" })}
                />
              </div>
              <div><Label>ลิงก์ (optional)</Label><Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} /></div>
              <div><Label>Alt text</Label><Input value={form.altText} onChange={(e) => setForm({ ...form, altText: e.target.value })} /></div>
            </>
          )}
          {err && <p className="text-sm text-red-500">{err}</p>}
          <Button onClick={create}>เพิ่มโฆษณา</Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p apps/backoffice/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add apps/backoffice/src/app/(dashboard)/dashboard/tenants/[id]/
git commit -m "backoffice: tenant edit page with tabs"
```

---

## Task 15: Scaffold `apps/tenant`

**Files:**
- Create: `apps/tenant/package.json`
- Create: `apps/tenant/tsconfig.json`
- Create: `apps/tenant/next.config.ts`
- Create: `apps/tenant/next-env.d.ts`
- Create: `apps/tenant/postcss.config.mjs`
- Create: `apps/tenant/tailwind.config.ts`
- Create: `apps/tenant/src/app/layout.tsx` (minimal)
- Create: `apps/tenant/src/app/page.tsx` (placeholder)
- Create: `apps/tenant/src/styles/globals.css`
- Create: `apps/tenant/src/lib/nanoid.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@kodhom/tenant",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build",
    "start": "next start --port 3002",
    "lint": "next lint"
  },
  "dependencies": {
    "@kodhom/config": "workspace:*",
    "@kodhom/db": "workspace:*",
    "@kodhom/r2": "workspace:*",
    "@kodhom/ui": "workspace:*",
    "@kodhom/validators": "workspace:*",
    "drizzle-orm": "^0.39.0",
    "lucide-react": "^0.460.0",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: tsconfig.json**

Copy `apps/web/tsconfig.json` verbatim (same paths `"@/*": ["./src/*"]`).

- [ ] **Step 3: next.config.ts**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: require("path").join(__dirname, "../../"),
  transpilePackages: [
    "@kodhom/ui",
    "@kodhom/db",
    "@kodhom/r2",
    "@kodhom/validators",
    "@kodhom/config",
  ],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.r2.dev" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "interest-cohort=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 4: next-env.d.ts**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 5: postcss.config.mjs**

Copy from `apps/web/postcss.config.mjs`.

- [ ] **Step 6: tailwind.config.ts**

Copy from `apps/web/tailwind.config.ts` (or omit if project uses only PostCSS + Tailwind v4).

- [ ] **Step 7: globals.css**

Create `apps/tenant/src/styles/globals.css`:

```css
@import "tailwindcss";

:root {
  --tenant-primary: #3b82f6;
  --tenant-accent: #60a5fa;
  --tenant-bg: #0b0d13;
  --tenant-fg: #e6e9f2;
}

html, body {
  background: var(--tenant-bg);
  color: var(--tenant-fg);
}

a { color: var(--tenant-primary); }
a:hover { color: var(--tenant-accent); }
```

- [ ] **Step 8: nanoid**

Copy `apps/web/src/lib/nanoid.ts` to `apps/tenant/src/lib/nanoid.ts`.

- [ ] **Step 9: Minimal layout + page**

`apps/tenant/src/app/layout.tsx`:

```tsx
import "@/styles/globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
```

`apps/tenant/src/app/page.tsx`:

```tsx
export default function Home() {
  return <div className="p-8">tenant scaffold ok</div>;
}
```

- [ ] **Step 10: Install + verify**

Run: `pnpm install`
Run: `pnpm --filter @kodhom/tenant dev`
Expected: server boots on port 3002, `http://localhost:3002` shows "tenant scaffold ok".
Stop the server.

- [ ] **Step 11: Commit**

```bash
git add apps/tenant/ pnpm-lock.yaml
git commit -m "tenant: scaffold Next.js app on port 3002"
```

---

## Task 16: Middleware — forward Host as `x-tenant-domain`

**Files:**
- Create: `apps/tenant/src/middleware.ts`

- [ ] **Step 1: Write middleware**

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

- [ ] **Step 2: Verify at runtime**

Run: `pnpm --filter @kodhom/tenant dev`
In another shell: `curl -I http://localhost:3002/`
Expected: response includes header `x-tenant-domain: localhost`.
Stop the server.

- [ ] **Step 3: Commit**

```bash
git add apps/tenant/src/middleware.ts
git commit -m "tenant: middleware forwards Host as x-tenant-domain"
```

---

## Task 17: Tenant resolver + queries

**Files:**
- Create: `apps/tenant/src/lib/tenant.ts`
- Create: `apps/tenant/src/lib/tenant-queries.ts`

- [ ] **Step 1: Resolver**

```ts
// apps/tenant/src/lib/tenant.ts
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

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.primaryDomain, domain), eq(tenants.isActive, true)))
    .limit(1);

  if (!tenant) notFound();
  return tenant;
});
```

- [ ] **Step 2: Queries**

```ts
// apps/tenant/src/lib/tenant-queries.ts
import { db } from "@kodhom/db";
import {
  categories,
  clips,
  tenantAds,
  tenantCategories,
} from "@kodhom/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export async function getTenantCategories(tenantId: string) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      coverImage: categories.coverImage,
      sortOrder: tenantCategories.sortOrder,
    })
    .from(tenantCategories)
    .innerJoin(categories, eq(categories.id, tenantCategories.categoryId))
    .where(and(eq(tenantCategories.tenantId, tenantId), eq(categories.isActive, true)))
    .orderBy(asc(tenantCategories.sortOrder), asc(categories.name));
}

async function tenantCategoryIds(tenantId: string) {
  const rows = await db
    .select({ categoryId: tenantCategories.categoryId })
    .from(tenantCategories)
    .where(eq(tenantCategories.tenantId, tenantId));
  return rows.map((r) => r.categoryId);
}

export async function getTenantClips(
  tenantId: string,
  opts: { categoryId?: string; limit?: number; offset?: number } = {}
) {
  const catIds = await tenantCategoryIds(tenantId);
  if (catIds.length === 0) return [];
  const idFilter = opts.categoryId
    ? eq(clips.categoryId, opts.categoryId)
    : inArray(clips.categoryId, catIds);
  const rows = await db
    .select({
      id: clips.id,
      title: clips.title,
      thumbnailR2Key: clips.thumbnailR2Key,
      duration: clips.duration,
      categoryId: clips.categoryId,
    })
    .from(clips)
    .where(and(eq(clips.isActive, true), eq(clips.accessLevel, "member"), idFilter))
    .orderBy(desc(clips.createdAt))
    .limit(opts.limit ?? 60)
    .offset(opts.offset ?? 0);
  return rows;
}

export async function getTenantClipInScope(tenantId: string, clipId: string) {
  const catIds = await tenantCategoryIds(tenantId);
  if (catIds.length === 0) return null;
  const [row] = await db
    .select()
    .from(clips)
    .where(
      and(
        eq(clips.id, clipId),
        eq(clips.isActive, true),
        eq(clips.accessLevel, "member"),
        inArray(clips.categoryId, catIds)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function getTenantAds(tenantId: string, slot?: string) {
  const filters = [eq(tenantAds.tenantId, tenantId), eq(tenantAds.isActive, true)];
  if (slot) filters.push(eq(tenantAds.slot, slot as never));
  return db
    .select()
    .from(tenantAds)
    .where(and(...filters))
    .orderBy(asc(tenantAds.slot), asc(tenantAds.sortOrder));
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p apps/tenant/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/tenant/src/lib/tenant.ts apps/tenant/src/lib/tenant-queries.ts
git commit -m "tenant: resolver + tenant-scoped queries"
```

---

## Task 18: Dev seed script

**Files:**
- Create: `apps/tenant/scripts/seed-dev-tenant.ts`
- Create: `apps/tenant/scripts/tsconfig.json`

- [ ] **Step 1: tsconfig for scripts**

`apps/tenant/scripts/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler"
  },
  "include": ["./*.ts"]
}
```

- [ ] **Step 2: Seed script**

`apps/tenant/scripts/seed-dev-tenant.ts`:

```ts
import "dotenv/config";
import { db } from "@kodhom/db";
import { tenants, tenantCategories, categories } from "@kodhom/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "../src/lib/nanoid";

async function main() {
  const domain = "site-a.local";
  const existing = await db.select().from(tenants).where(eq(tenants.primaryDomain, domain)).limit(1);
  let tenantId = existing[0]?.id;

  if (!tenantId) {
    tenantId = nanoid();
    await db.insert(tenants).values({
      id: tenantId,
      slug: "site-a",
      name: "Site A Demo",
      primaryDomain: domain,
      tagline: "Dev demo tenant",
      isActive: true,
    });
    console.log("created tenant", tenantId);
  } else {
    console.log("tenant exists", tenantId);
  }

  const memberCats = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.accessLevel, "member"), eq(categories.isActive, true)))
    .limit(5);

  for (let i = 0; i < memberCats.length; i++) {
    const c = memberCats[i]!;
    const dup = await db
      .select()
      .from(tenantCategories)
      .where(and(eq(tenantCategories.tenantId, tenantId!), eq(tenantCategories.categoryId, c.id)))
      .limit(1);
    if (dup.length === 0) {
      await db.insert(tenantCategories).values({
        id: nanoid(),
        tenantId: tenantId!,
        categoryId: c.id,
        sortOrder: i,
      });
    }
  }

  console.log("done. add to hosts:  127.0.0.1  site-a.local");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Run seed**

Run: `pnpm --filter @kodhom/tenant exec tsx scripts/seed-dev-tenant.ts`
(if `tsx` is missing, add `-D tsx` to `@kodhom/tenant` and rerun)
Expected: prints "created tenant ..." or "tenant exists ...", then "done".

- [ ] **Step 4: Update Windows hosts**

Add to `C:\Windows\System32\drivers\etc\hosts` (admin required):

```
127.0.0.1  site-a.local
127.0.0.1  site-b.local
```

- [ ] **Step 5: Commit**

```bash
git add apps/tenant/scripts/ apps/tenant/package.json
git commit -m "tenant: dev seed script for demo tenant"
```

---

## Task 19: Theme injection in root layout

**Files:**
- Modify: `apps/tenant/src/app/layout.tsx`

- [ ] **Step 1: Replace with tenant-aware layout**

```tsx
import "@/styles/globals.css";
import { getCurrentTenant } from "@/lib/tenant";
import { getPresignedDownloadUrl } from "@kodhom/r2";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  try {
    const t = await getCurrentTenant();
    return {
      title: t.metaTitle ?? t.name,
      description: t.metaDescription ?? t.tagline ?? undefined,
      icons: t.faviconR2Key
        ? { icon: await getPresignedDownloadUrl(t.faviconR2Key, 3600) }
        : undefined,
    };
  } catch {
    return { title: "Not found" };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let themeCss = "";
  try {
    const t = await getCurrentTenant();
    themeCss = `:root{--tenant-primary:${t.primaryColor};--tenant-accent:${t.accentColor};--tenant-bg:${t.backgroundColor};--tenant-fg:${t.fgColor};}`;
  } catch {
    // notFound() throws — Next handles rendering
  }

  return (
    <html lang="th">
      <head>{themeCss && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}</head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @kodhom/tenant dev`
Open `http://site-a.local:3002` — check page source: `<style>` inline block with tenant colors present. Title reflects tenant name.
Stop the server.

- [ ] **Step 3: Commit**

```bash
git add apps/tenant/src/app/layout.tsx
git commit -m "tenant: inject theme + metadata from current tenant"
```

---

## Task 20: `not-found.tsx`

**Files:**
- Create: `apps/tenant/src/app/not-found.tsx`

- [ ] **Step 1: Write generic 404**

```tsx
export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0d13", color: "#e6e9f2" }}>
      <div>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>404</h1>
        <p>Page not found.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify unknown domain**

With dev server running, `curl -H 'Host: unknown.com' http://localhost:3002/`
Expected: HTML containing "Page not found." — no leak of "yedhod" or "kodhom".

- [ ] **Step 3: Commit**

```bash
git add apps/tenant/src/app/not-found.tsx
git commit -m "tenant: generic 404 for unknown domains"
```

---

## Task 21: Ad rendering components

**Files:**
- Create: `apps/tenant/src/components/ad-render.tsx`
- Create: `apps/tenant/src/components/ad-slot.tsx`

- [ ] **Step 1: AdRender**

```tsx
// apps/tenant/src/components/ad-render.tsx
import { getPresignedDownloadUrl } from "@kodhom/r2";

export async function AdRender({ ad }: { ad: {
  id: string;
  type: string;
  embedCode: string | null;
  imageR2Key: string | null;
  linkUrl: string | null;
  altText: string | null;
} }) {
  if (ad.type === "embed" && ad.embedCode) {
    return <div dangerouslySetInnerHTML={{ __html: ad.embedCode }} />;
  }
  if (ad.type === "banner" && ad.imageR2Key) {
    const src = await getPresignedDownloadUrl(ad.imageR2Key, 7200);
    const img = <img src={src} alt={ad.altText ?? ""} style={{ maxWidth: "100%", height: "auto" }} />;
    return ad.linkUrl ? (
      <a href={ad.linkUrl} target="_blank" rel="nofollow noopener">{img}</a>
    ) : img;
  }
  return null;
}
```

- [ ] **Step 2: AdSlot**

```tsx
// apps/tenant/src/components/ad-slot.tsx
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantAds } from "@/lib/tenant-queries";
import { AdRender } from "./ad-render";

const VALID_SLOTS = [
  "header",
  "sidebar_top",
  "sidebar_bot",
  "in_feed",
  "footer",
  "before_video",
  "after_video",
] as const;

export type AdSlotName = (typeof VALID_SLOTS)[number];

export async function AdSlot({ slot }: { slot: AdSlotName }) {
  const tenant = await getCurrentTenant();
  const ads = await getTenantAds(tenant.id, slot);
  if (ads.length === 0) return null;
  return (
    <div data-ad-slot={slot} className="ad-slot my-4 flex flex-col gap-3">
      {ads.map((a) => (
        <AdRender key={a.id} ad={a} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p apps/tenant/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add apps/tenant/src/components/ad-render.tsx apps/tenant/src/components/ad-slot.tsx
git commit -m "tenant: ad slot + render components"
```

---

## Task 22: Tenant shell (header + top-nav + footer)

**Files:**
- Create: `apps/tenant/src/components/tenant-shell.tsx`

- [ ] **Step 1: Write shell**

```tsx
import Link from "next/link";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantCategories } from "@/lib/tenant-queries";
import { AdSlot } from "./ad-slot";

export async function TenantShell({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  const cats = await getTenantCategories(tenant.id);
  const logo = tenant.logoR2Key ? await getPresignedDownloadUrl(tenant.logoR2Key, 7200) : null;

  return (
    <div className="min-h-screen">
      <AdSlot slot="header" />
      <header className="sticky top-0 z-30 border-b border-white/10 backdrop-blur" style={{ background: "color-mix(in oklab, var(--tenant-bg) 85%, black)" }}>
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt={tenant.name} className="h-8" />
            ) : (
              <span className="text-lg font-bold" style={{ color: "var(--tenant-primary)" }}>{tenant.name}</span>
            )}
          </Link>
          {tenant.tagline && (
            <span className="hidden text-sm text-white/60 md:inline">{tenant.tagline}</span>
          )}
        </div>
        <nav className="mx-auto max-w-6xl overflow-x-auto px-4 pb-3">
          <ul className="flex gap-2 whitespace-nowrap">
            <li>
              <Link href="/" className="rounded-full border border-white/15 px-3 py-1 text-sm hover:border-white/40">ทั้งหมด</Link>
            </li>
            {cats.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/category/${c.slug}`}
                  className="rounded-full border border-white/15 px-3 py-1 text-sm hover:border-white/40"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div>{children}</div>
          <aside className="hidden lg:block">
            <AdSlot slot="sidebar_top" />
            <AdSlot slot="sidebar_bot" />
          </aside>
        </div>
      </main>

      <footer className="mt-12 border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-4 text-sm text-white/60">
          <AdSlot slot="footer" />
          {tenant.footerText && <p className="mb-2">{tenant.footerText}</p>}
          <p>© {new Date().getFullYear()} {tenant.name}</p>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit -p apps/tenant/tsconfig.json`

- [ ] **Step 3: Commit**

```bash
git add apps/tenant/src/components/tenant-shell.tsx
git commit -m "tenant: shell with top nav, category pills, sidebar ads, footer"
```

---

## Task 23: Clip card + grid + feed

**Files:**
- Create: `apps/tenant/src/components/clip-card.tsx`
- Create: `apps/tenant/src/components/clip-feed.tsx`

- [ ] **Step 1: ClipCard**

```tsx
// apps/tenant/src/components/clip-card.tsx
import Link from "next/link";
import { getPresignedDownloadUrl } from "@kodhom/r2";

function fmtDur(d: number | null): string {
  if (!d) return "";
  const m = Math.floor(d / 60);
  const s = Math.floor(d % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function ClipCard({
  clip,
}: {
  clip: { id: string; title: string; thumbnailR2Key: string | null; duration: number | null };
}) {
  const thumb = clip.thumbnailR2Key
    ? await getPresignedDownloadUrl(clip.thumbnailR2Key, 7200)
    : null;
  return (
    <Link href={`/clip/${clip.id}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-md bg-white/5">
        {thumb ? (
          <img src={thumb} alt={clip.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/40">no thumb</div>
        )}
        {clip.duration && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs">{fmtDur(clip.duration)}</span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium">{clip.title}</p>
    </Link>
  );
}
```

- [ ] **Step 2: ClipFeed (with in-feed ads every 8 clips)**

```tsx
// apps/tenant/src/components/clip-feed.tsx
import { AdSlot } from "./ad-slot";
import { ClipCard } from "./clip-card";

const IN_FEED_EVERY = 8;

type FeedClip = { id: string; title: string; thumbnailR2Key: string | null; duration: number | null };

export function ClipFeed({ clips }: { clips: FeedClip[] }) {
  const groups: FeedClip[][] = [];
  for (let i = 0; i < clips.length; i += IN_FEED_EVERY) {
    groups.push(clips.slice(i, i + IN_FEED_EVERY));
  }
  return (
    <div className="space-y-8">
      {groups.map((group, idx) => (
        <div key={idx}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {group.map((c) => (
              // ClipCard is async — Next handles server component nesting
              /* @ts-expect-error async server component */
              <ClipCard key={c.id} clip={c} />
            ))}
          </div>
          {idx < groups.length - 1 && <AdSlot slot="in_feed" />}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p apps/tenant/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add apps/tenant/src/components/clip-card.tsx apps/tenant/src/components/clip-feed.tsx
git commit -m "tenant: clip card + feed with in-feed ads"
```

---

## Task 24: Home page

**Files:**
- Modify: `apps/tenant/src/app/page.tsx`

- [ ] **Step 1: Replace scaffold with real home**

```tsx
import { TenantShell } from "@/components/tenant-shell";
import { ClipFeed } from "@/components/clip-feed";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantClips } from "@/lib/tenant-queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tenant = await getCurrentTenant();
  const clips = await getTenantClips(tenant.id, { limit: 60 });
  return (
    <TenantShell>
      <h1 className="mb-6 text-xl font-semibold">คลิปล่าสุด</h1>
      <ClipFeed clips={clips} />
    </TenantShell>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @kodhom/tenant dev`
Open `http://site-a.local:3002` — see grid of clips from the seeded tenant. Stop server.

- [ ] **Step 3: Commit**

```bash
git add apps/tenant/src/app/page.tsx
git commit -m "tenant: home page with clip grid"
```

---

## Task 25: Category page

**Files:**
- Create: `apps/tenant/src/app/category/[slug]/page.tsx`

- [ ] **Step 1: Write page**

```tsx
import { notFound } from "next/navigation";
import { db } from "@kodhom/db";
import { categories } from "@kodhom/db/schema";
import { and, eq } from "drizzle-orm";
import { TenantShell } from "@/components/tenant-shell";
import { ClipFeed } from "@/components/clip-feed";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantCategories, getTenantClips } from "@/lib/tenant-queries";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getCurrentTenant();

  const [cat] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, true), eq(categories.accessLevel, "member")))
    .limit(1);
  if (!cat) notFound();

  // Confirm the category is enabled for this tenant
  const enabled = await getTenantCategories(tenant.id);
  if (!enabled.find((c) => c.id === cat.id)) notFound();

  const clips = await getTenantClips(tenant.id, { categoryId: cat.id, limit: 60 });

  return (
    <TenantShell>
      <h1 className="mb-6 text-xl font-semibold">{cat.name}</h1>
      <ClipFeed clips={clips} />
    </TenantShell>
  );
}
```

- [ ] **Step 2: Verify**

Run dev server. Click a category pill. Expected: URL becomes `/category/<slug>`, clips filtered.

- [ ] **Step 3: Commit**

```bash
git add apps/tenant/src/app/category/
git commit -m "tenant: category page"
```

---

## Task 26: Streaming + thumbnail APIs

**Files:**
- Create: `apps/tenant/src/app/api/clips/[id]/stream/route.ts`
- Create: `apps/tenant/src/app/api/clips/[id]/thumbnail/route.ts`
- Create: `apps/tenant/src/app/api/health/route.ts`

- [ ] **Step 1: Stream endpoint**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantClipInScope } from "@/lib/tenant-queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const clip = await getTenantClipInScope(tenant.id, id);
  if (!clip) return NextResponse.json({ error: "ไม่พบคลิป" }, { status: 404 });
  const url = await getPresignedDownloadUrl(clip.r2Key, 7200);
  return NextResponse.json({ url });
}
```

- [ ] **Step 2: Thumbnail endpoint**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantClipInScope } from "@/lib/tenant-queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const clip = await getTenantClipInScope(tenant.id, id);
  if (!clip?.thumbnailR2Key) return new NextResponse(null, { status: 404 });
  const url = await getPresignedDownloadUrl(clip.thumbnailR2Key, 3600);
  return NextResponse.redirect(url, 302);
}
```

- [ ] **Step 3: Health**

```ts
// apps/tenant/src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { tenants } from "@kodhom/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(tenants);
  return NextResponse.json({ ok: true, tenants: count });
}
```

- [ ] **Step 4: Verify with curl**

Start dev server. Seed some tenant categories that include known clip IDs.
Run:
```
curl -H 'Host: site-a.local' http://localhost:3002/api/clips/<valid-id>/stream
```
Expected: `{"url":"https://..."}`. With an invalid ID: `{"error":"ไม่พบคลิป"}` (404).

Also verify hotlink protection:
```
curl -H 'Host: unknown.com' http://localhost:3002/api/clips/<valid-id>/stream
```
Expected: 404 not-found HTML page (tenant not resolved).

- [ ] **Step 5: Commit**

```bash
git add apps/tenant/src/app/api/
git commit -m "tenant: streaming, thumbnail, health API routes"
```

---

## Task 27: Clip detail page + video player

**Files:**
- Create: `apps/tenant/src/components/video-player.tsx`
- Create: `apps/tenant/src/app/clip/[id]/page.tsx`

- [ ] **Step 1: VideoPlayer (client)**

```tsx
// apps/tenant/src/components/video-player.tsx
"use client";

import { useEffect, useState } from "react";

export default function VideoPlayer({ clipId }: { clipId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/clips/${clipId}/stream`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.url) setUrl(j.url);
        else setErr(j.error ?? "error");
      })
      .catch(() => setErr("error"));
    return () => {
      alive = false;
    };
  }, [clipId]);

  if (err) return <div className="rounded bg-white/5 p-6 text-center text-white/60">โหลดคลิปไม่สำเร็จ</div>;
  if (!url) return <div className="aspect-video w-full animate-pulse rounded bg-white/5" />;
  return (
    <video src={url} controls playsInline className="aspect-video w-full rounded bg-black" />
  );
}
```

- [ ] **Step 2: Clip detail page**

```tsx
// apps/tenant/src/app/clip/[id]/page.tsx
import { notFound } from "next/navigation";
import { TenantShell } from "@/components/tenant-shell";
import { AdSlot } from "@/components/ad-slot";
import { ClipFeed } from "@/components/clip-feed";
import VideoPlayer from "@/components/video-player";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantClipInScope, getTenantClips } from "@/lib/tenant-queries";

export const dynamic = "force-dynamic";

export default async function ClipDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const clip = await getTenantClipInScope(tenant.id, id);
  if (!clip) notFound();

  const related = await getTenantClips(tenant.id, { categoryId: clip.categoryId, limit: 24 });

  return (
    <TenantShell>
      <AdSlot slot="before_video" />
      <VideoPlayer clipId={clip.id} />
      <h1 className="mt-4 text-lg font-semibold">{clip.title}</h1>
      {clip.description && <p className="mt-1 text-sm text-white/70">{clip.description}</p>}
      <AdSlot slot="after_video" />
      <hr className="my-6 border-white/10" />
      <h2 className="mb-4 text-base font-semibold">คลิปที่เกี่ยวข้อง</h2>
      <ClipFeed clips={related.filter((c) => c.id !== clip.id)} />
    </TenantShell>
  );
}
```

- [ ] **Step 3: Verify**

Start dev server. Click a clip card. Expected: player renders, video plays, related grid shows below. Ad slots (if any) render around player.

- [ ] **Step 4: Commit**

```bash
git add apps/tenant/src/components/video-player.tsx apps/tenant/src/app/clip/
git commit -m "tenant: clip detail page + client video player"
```

---

## Task 28: Cache headers for tenant routes

**Files:**
- Modify: `apps/tenant/next.config.ts`

- [ ] **Step 1: Add per-path cache headers**

Replace the `headers()` return in `apps/tenant/next.config.ts` with:

```ts
async headers() {
  return [
    {
      source: "/",
      headers: [
        { key: "Cache-Control", value: "public, max-age=60, s-maxage=300, stale-while-revalidate=1800" },
        { key: "Vary", value: "Host" },
      ],
    },
    {
      source: "/category/:slug*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=60, s-maxage=600, stale-while-revalidate=3600" },
        { key: "Vary", value: "Host" },
      ],
    },
    {
      source: "/api/clips/:id/thumbnail",
      headers: [
        { key: "Cache-Control", value: "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400" },
      ],
    },
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "interest-cohort=()" },
      ],
    },
  ];
},
```

- [ ] **Step 2: Verify**

`curl -I -H 'Host: site-a.local' http://localhost:3002/`
Expected: `Cache-Control: public, max-age=60, ...` and `Vary: Host`.

- [ ] **Step 3: Commit**

```bash
git add apps/tenant/next.config.ts
git commit -m "tenant: cache-control + Vary: Host per route"
```

---

## Task 29: Turbo pipeline + Dockerfile

**Files:**
- Modify: `turbo.json`
- Create: `apps/tenant/Dockerfile`

- [ ] **Step 1: Turbo — nothing to add**

Inspect `turbo.json`. If tasks (`dev`, `build`, `lint`) already glob-match all workspaces, no change needed. Confirm by reading the file. If they reference apps by name, add `@kodhom/tenant` to the same lists.

- [ ] **Step 2: Dockerfile**

Copy the pattern from `apps/backoffice/Dockerfile` (or `apps/web/Dockerfile` if it exists). If neither exists in repo, use this Next.js standalone template:

```dockerfile
# apps/tenant/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/tenant/package.json ./apps/tenant/
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @kodhom/tenant build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/apps/tenant/.next/standalone ./
COPY --from=builder /app/apps/tenant/.next/static ./apps/tenant/.next/static
COPY --from=builder /app/apps/tenant/public ./apps/tenant/public
EXPOSE 3002
ENV PORT=3002
CMD ["node", "apps/tenant/server.js"]
```

Adjust to match the repo's existing Dockerfile conventions if they differ.

- [ ] **Step 3: Commit**

```bash
git add turbo.json apps/tenant/Dockerfile
git commit -m "tenant: Dockerfile for Coolify deploy"
```

---

## Task 30: End-to-end smoke test + docs

**Files:**
- Create: `apps/tenant/README.md`

- [ ] **Step 1: README**

```md
# @kodhom/tenant

Multi-tenant clone app. Serves multiple ad-driven sites off one Next.js process.
See design spec: `docs/superpowers/specs/2026-07-09-multi-tenant-clone-design.md`.

## Dev

1. Add to `C:\Windows\System32\drivers\etc\hosts`:
   ```
   127.0.0.1  site-a.local
   ```
2. Seed a demo tenant: `pnpm --filter @kodhom/tenant exec tsx scripts/seed-dev-tenant.ts`
3. Start: `pnpm --filter @kodhom/tenant dev`
4. Open `http://site-a.local:3002`

## Prod

- Deploy behind Coolify (Traefik) with multiple domains attached to the same container.
- Each domain maps to a row in `tenants` (managed from `bo.yedhod.com/dashboard/tenants`).
```

- [ ] **Step 2: Manual smoke test**

Start dev server. Verify each check:

1. `http://site-a.local:3002/` — home renders with tenant branding, clip grid loads.
2. Click a category pill — `/category/<slug>` shows filtered clips.
3. Click a clip — `/clip/<id>` shows player, plays video, shows related clips.
4. `curl -H 'Host: unknown.com' http://localhost:3002/` — returns 404 body without leaking tenant info.
5. `curl -H 'Host: site-a.local' http://localhost:3002/api/clips/<id-not-in-tenant-scope>/stream` — returns 404 JSON.
6. In `bo.yedhod.com/dashboard/tenants` — create, edit, delete tenant. Assign categories. Add an embed ad and a banner ad, then reload the tenant site and confirm they render in the correct slots.

Fix any failures inline before committing. If any check fails, add a fix task under the task that owns the failing code.

- [ ] **Step 3: TypeScript sanity**

Run:
```
npx tsc --noEmit -p apps/tenant/tsconfig.json
npx tsc --noEmit -p apps/backoffice/tsconfig.json
```
Expected: no new errors introduced by this plan.

- [ ] **Step 4: Final commit**

```bash
git add apps/tenant/README.md
git commit -m "tenant: readme + smoke test checklist"
```

---

## Self-review notes

- **Spec coverage:**
  - Enums (spec §Data Model) → Task 1 ✓
  - `tenants` table → Task 2 ✓
  - `tenant_categories` → Task 3 ✓
  - `tenant_ads` → Task 4 ✓
  - Migration → Task 5 ✓
  - Validators → Task 6 ✓
  - Backoffice upload folders → Task 7 ✓
  - Backoffice CRUD API → Tasks 8, 9, 10, 11 ✓
  - Backoffice UI (list, new, edit with tabs) → Tasks 12, 13, 14 ✓
  - `apps/tenant` scaffold → Task 15 ✓
  - Middleware → Task 16 ✓
  - Resolver + queries → Task 17 ✓
  - Dev seed → Task 18 ✓
  - Theme + metadata → Task 19 ✓
  - Not found → Task 20 ✓
  - Ad rendering → Task 21 ✓
  - Shell layout (distinct tube-grid) → Task 22 ✓
  - Clip card + feed with in-feed ad → Task 23 ✓
  - Home → Task 24 ✓
  - Category → Task 25 ✓
  - Streaming (tenant-scoped) + thumbnail + health → Task 26 ✓
  - Clip detail + player → Task 27 ✓
  - Cache headers → Task 28 ✓
  - Docker + turbo → Task 29 ✓
  - README + smoke test → Task 30 ✓
- **Placeholder scan:** no TBD / TODO / "similar to Task N" left; each code step has full source.
- **Type consistency:** `getCurrentTenant`, `getTenantCategories`, `getTenantClips`, `getTenantClipInScope`, `getTenantAds`, `AdSlot`, `AdRender`, `TenantShell`, `ClipCard`, `ClipFeed`, `VideoPlayer` are referenced consistently across tasks. R2 helper names (`getPresignedDownloadUrl`, `deleteObject`) match `packages/r2`.
