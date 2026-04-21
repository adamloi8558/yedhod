# SEO + UX/UI Redesign — เย็ดโหด.com

**Date:** 2026-04-21
**Goals:** (A) organic Google traffic, (B) rich social previews, (D) brand-search dominance — while fully declaring adult content and respecting SafeSearch.

---

## 1. Strategy

- **Canonical domain = Punycode** `https://xn--l3ca4bxbygoa7a.com` (user-facing `เย็ดโหด.com`). IDN breaks LINE/FB/X unfurlers; Google treats Punycode as authoritative. Redirect Unicode→Punycode at the edge (Coolify/Cloudflare).
- **Declared adult, not hidden.** Ship RTA label + `rating=adult` + ICRA + `age-rating=18+` globally. Google indexes; SafeSearch filters. Hiding adult nature gets sites removed.
- **Brand-search dominance.** Title suffix ` | เย็ดโหด` on every page, H1 on home includes brand, SearchAction JSON-LD gives sitelinks search box, unique titles per page, internal linking through footer + breadcrumb + related clips.
- **Block AI scrapers** (GPTBot, CCBot, ClaudeBot, anthropic-ai, Google-Extended, PerplexityBot, Bytespider) — adult content has zero value in LLM training; keep Googlebot, Bingbot, Twitterbot, facebookexternalhit, LINE, TelegramBot, Applebot.
- **No cloaking, no keyword stuffing, no fake reviews, no noindex-in-sitemap.**

---

## 2. Architecture Overview

Three orthogonal layers added to `apps/web`:

1. **SEO layer** — `app/robots.ts`, `app/sitemap.ts` (with `generateSitemaps`), per-page `generateMetadata`, JSON-LD server components, `/api/thumbnail/[id]` presign proxy, GSC + GA4.
2. **UI layer** — new shared components in `apps/web/src/components/` (breadcrumb, share-row, related-clips, category-meta-bar, home-hero, category-hero, category-tiles, clip-meta-chips, clip-description-article, section-divider, skeleton-card, site-footer).
3. **Integration** — rewrite `(main)/page.tsx`, `(main)/category/[slug]/page.tsx`, `(main)/clip/[id]/page.tsx`. New `(main)/about/page.tsx`. `(main)/layout.tsx` gets `<SiteFooter />`. Root `app/layout.tsx` gains full metadata + adult-compliance tags + GA4.

Existing auth, access-control, R2, banner slider, header, sidebar, backoffice — **unchanged**.

---

## 3. Complete File Manifest

### 3.1 New files (36)

```
apps/web/public/google4_S0HkzgexgmrG7P0gofWle4J52v1U1zyDr6f-HvmqM.html
apps/web/src/app/robots.ts
apps/web/src/app/sitemap.ts
apps/web/src/app/opengraph-image.tsx
apps/web/src/app/_fonts/Kanit-Bold.ttf
apps/web/src/app/api/thumbnail/[id]/route.ts
apps/web/src/app/(main)/about/page.tsx
apps/web/src/app/(main)/category/[slug]/opengraph-image.tsx
apps/web/src/app/(main)/clip/[id]/opengraph-image.tsx
apps/web/src/components/analytics.tsx
apps/web/src/components/breadcrumb.tsx
apps/web/src/components/share-row.tsx
apps/web/src/components/related-clips.tsx
apps/web/src/components/category-meta-bar.tsx
apps/web/src/components/home-hero.tsx
apps/web/src/components/category-hero.tsx
apps/web/src/components/category-tiles.tsx
apps/web/src/components/clip-meta-chips.tsx
apps/web/src/components/clip-description-article.tsx
apps/web/src/components/section-divider.tsx
apps/web/src/components/skeleton-card.tsx
apps/web/src/components/site-footer.tsx
apps/web/src/components/jsonld/website.tsx
apps/web/src/components/jsonld/breadcrumb.tsx
apps/web/src/components/jsonld/video-object.tsx
apps/web/src/components/jsonld/collection-page.tsx
apps/web/src/components/jsonld/product.tsx
apps/web/src/lib/seo/metadata.ts
apps/web/src/lib/sitemap-data.ts
apps/web/src/lib/related-clips.ts
apps/web/src/lib/format-iso-duration.ts
```

### 3.2 Modified files (9)

```
apps/web/next.config.ts
apps/web/package.json
apps/web/.env.example
apps/web/src/app/layout.tsx
apps/web/src/app/(main)/layout.tsx
apps/web/src/app/(main)/page.tsx
apps/web/src/app/(main)/category/[slug]/page.tsx
apps/web/src/app/(main)/clip/[id]/page.tsx
apps/web/src/app/(main)/pricing/page.tsx
apps/web/src/components/clip-card.tsx
```

**`ClipCard` change:** adds a `categoryName` prop and renders a single `{categoryName} • {duration}` line (e.g. "เย็ดแรง • 5:23") above the date. Provides meaningful anchor text for Google + minimal UI impact. Callers already join category in their queries — just pass the name.

---

## 4. Key Specifications

### 4.1 Metadata helpers (`apps/web/src/lib/seo/metadata.ts`)

**IMPORTANT: `clip.title` in DB is the raw filename (e.g. `IMG_2341.mp4`) — UNUSABLE for SEO.** Every user-facing / crawler-facing title and description for a clip is **generated programmatically** from `(category, duration, createdAt, id)`. Admin never writes SEO titles.

```ts
export const SITE_URL = 'https://xn--l3ca4bxbygoa7a.com';
export const BRAND = 'เย็ดโหด';
export const BRAND_SUFFIX = ' | เย็ดโหด';

absoluteUrl(path): string         // always Punycode absolute
canonical(path): { canonical }     // for Metadata.alternates
pageTitle(subject): string         // `${subject}${BRAND_SUFFIX}`, capped 60
categoryTitle(name, page?): string
clipDisplayTitle(clip, category): string   // UI card + H1 source
  // → `ดูคลิป${category.name} ความยาว ${formatDuration(clip.duration)} อัปเดต ${formatThaiDateShort(clip.createdAt)}`
  //    e.g. "ดูคลิปเย็ดแรง ความยาว 5:23 อัปเดต 12 เม.ย. 2569"
clipPageTitle(clip, category): string
  // → `${clipDisplayTitle(...)} | เย็ดโหด` (truncated to 60)
clipDescription(clip, category): string
  // → `ชม${category.name}ความยาว${duration}นาทีที่${BRAND} คลิปคุณภาพสำหรับผู้ใหญ่อายุ 18+ อัปเดตใหม่ทุกวัน สมัครสมาชิกเพื่อดูคลิป VIP แบบไม่จำกัด` (trimmed to 155)
categoryDescription(cat, count): string   // fallback if cat.description null
adultMetaOther(): Record<string,string>   // rating/RTA/ICRA/age-rating
```

**Uniqueness:** clip titles differ by `duration + date` combination. In the rare case two clips in the same category share both the same duration and same date, Google tolerates duplicate titles if URLs are distinct + canonical is correct. We accept this edge case over adding visible random IDs to user-facing text.

**Adult compliance tags (global via `metadata.other`):**
```
rating: adult
RATING: RTA-5042-1996-1400-1577-RTA
content-rating: Mature
age-rating: 18+
ICRA: nudity adult violence language
```

### 4.2 Root layout metadata

`metadataBase: new URL(SITE_URL)`, `title: { default: 'เย็ดโหด | คลิปวิดีโอผู้ใหญ่คุณภาพ', template: '%s | เย็ดโหด' }`, `alternates.canonical: '/'`, `alternates.languages: { 'th-TH': '/', 'x-default': '/' }`, `openGraph: { type:'website', locale:'th_TH', siteName:'เย็ดโหด' }`, `twitter.card: 'summary_large_image'`, `robots: { index:true, follow:true, googleBot:{ 'max-image-preview':'large', 'max-snippet':-1 } }`, `verification.google: '4_S0HkzgexgmrG7P0gofWle4J52v1U1zyDr6f-HvmqM'`, `other: adultMetaOther()`.

Mount `<GoogleAnalytics gaId="G-SSEFS20STL" />` via `@next/third-parties/google`.

### 4.3 robots.ts

Allow `/`, `/api/thumbnail/`. Disallow `/api/`, `/profile`, `/devices`, `/payment`, `/search`, `/login`, `/register`, `/*?redirect=*`. Block GPTBot/CCBot/ClaudeBot/anthropic-ai/Google-Extended/PerplexityBot/Bytespider. Reference `sitemap: SITE_URL + '/sitemap.xml'`.

### 4.4 Sitemap (`generateSitemaps` pattern)

For ~10k clips → 4 sub-sitemaps: `pages`, `categories`, `clips-0`, `clips-1` (5000 per chunk). Each clip entry uses `clip.updatedAt` as `lastModified`. Stable ordering `ORDER BY created_at DESC, id ASC`. `revalidate = 3600`.

### 4.5 `/api/thumbnail/[id]/route.ts`

302 redirect to fresh R2 presigned URL (2h TTL) with `Cache-Control: public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400`. Stable URL for use in JSON-LD + sitemap where presigned URLs would expire.

### 4.6 JSON-LD components

- `<WebsiteJsonLd />` — WebSite + Organization + SearchAction graph (home)
- `<BreadcrumbJsonLd items={[{name,url}]} />` — rendered inside `<Breadcrumb>` component; one `items` array feeds both UI and JSON-LD
- `<VideoObjectJsonLd clip category />` — `isFamilyFriendly:false`, `contentRating:'adult'`, `thumbnailUrl: absoluteUrl('/api/thumbnail/'+id)`, `uploadDate: createdAt.toISOString()`, `duration: formatIsoDuration(seconds)`, `embedUrl: absoluteUrl('/clip/'+id)`. **No `contentUrl`** (presigned URLs expire).
- `<CollectionPageJsonLd category clips />` — first 20 clip URLs as `hasPart`
- `<ProductJsonLd plans />` — Product + Offer per pricing plan

All render `<script type="application/ld+json">` server-side.

### 4.7 Per-route OG images (`opengraph-image.tsx`)

- Root `/opengraph-image.tsx`: branded fallback, dark gradient, "เย็ดโหด" display text, "18+" badge, Kanit-Bold font loaded from `_fonts/Kanit-Bold.ttf`
- `/category/[slug]/opengraph-image.tsx`: eyebrow "หมวดหมู่", category name, clip count, brand watermark
- `/clip/[id]/opengraph-image.tsx`: eyebrow = category name, `clipDisplayTitle(clip, category)` (generated, never the raw filename; 60-char + 2-line clamp), brand watermark. **Never uses thumbnails** — text only, guaranteed SFW, won't get throttled by LINE/FB.

All 1200×630 PNG, `runtime = 'nodejs'`, `revalidate = 86400`.

### 4.8 UI components spec

**Type scale (Kanit):**
- Display H1 (home): `text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight`
- Page H1 (clip/category): `text-2xl md:text-4xl font-bold tracking-tight leading-tight`
- H2: `text-lg md:text-xl font-semibold tracking-tight`
- Body: `text-sm md:text-base text-foreground/90 leading-relaxed`
- Meta: `text-xs font-medium text-muted-foreground uppercase tracking-wider`

**Surface treatments:** hero = gradient + `ring-1 ring-border/40` + `shadow-[0_0_80px_-20px] shadow-primary/20`. Cards on hover: `hover:ring-primary/40 hover:-translate-y-0.5`. Dividers: `h-px bg-gradient-to-r from-transparent via-border to-transparent`.

**Container widths:** Home/Category `max-w-6xl`, Clip `max-w-5xl`. Padding `px-4 md:px-6 lg:px-8 py-6 md:py-10`.

### 4.9 Page-level specs

**Home (`/`)** — revalidate 300s:
1. `<HomeHero />` — display H1 "เย็ดโหด", tagline, stat pills (total clips/categories/new today)
2. Section H2 "คลิปล่าสุด" — 8 clips
3. Section H2 "ยอดนิยมสัปดาห์นี้" — 8 clips (createdAt within 7d)
4. Section H2 "สำรวจตามหมวดหมู่" — `<CategoryTiles />` with cover thumbnails
5. Section H2 "ทั้งหมด" — infinite scroll 20/page
6. `<WebsiteJsonLd />`

**Category (`/category/[slug]`)** — revalidate 600s:
1. `<Breadcrumb items={[หน้าแรก, category.name]} />`
2. `<CategoryHero>` — eyebrow "หมวดหมู่", H1=category.name, `<CategoryMetaBar>` (count/new-this-week/VIP/updatedAt), description (line-clamp-3 + toggle if >300 chars)
3. Filter/sort bar (Radix Select: ล่าสุด/ยอดนิยม/ยาวที่สุด/VIP ก่อน)
4. Grid 24/page, `rel=prev/next`, self-referential canonical on paginated URLs
5. Section H2 "หมวดหมู่ที่เกี่ยวข้อง" — 4-6 related category tiles
6. `<CollectionPageJsonLd />`

**Clip (`/clip/[id]`)** — revalidate 3600s:
1. `<Breadcrumb items={[หน้าแรก, category.name→link, clipDisplayTitle→truncate]} />` (NOT `clip.title` — that's a filename)
2. `<ClipPlayer />` — wrap with `rounded-2xl overflow-hidden ring-1 ring-border/40 shadow-[0_8px_40px_-8px] shadow-black/50`; on mobile `-mx-4 rounded-none`
3. `<ClipMetaChips>` — VIP badge / category / duration / createdAt / (optional view count)
4. **`<h1>{clipDisplayTitle(clip, category)}</h1>`** — generated from category+duration+date (NOT the raw filename)
5. `<ShareRow>` (copy / X / LINE / Telegram / Facebook) + optional VIP upgrade nudge if not subscribed
6. H2 "เกี่ยวกับคลิปนี้" + `<ClipDescriptionArticle>` (in `<article class="prose prose-invert">`, fallback template if description null)
7. `<SectionDivider />`
8. H2 "คลิปที่เกี่ยวข้อง" — 8 clips, same category
9. `<VideoObjectJsonLd />`

**About (`/about`)** — new, revalidate 86400s. H1 "เกี่ยวกับเย็ดโหด", 300+ Thai words describing the platform, content policy, 18+ notice, contact. Feeds Google knowledge panel.

**Pricing (`/pricing`)** — add generateMetadata + `<ProductJsonLd>`.

### 4.10 Site footer

4-column grid on desktop (in `(main)/layout.tsx`):
1. หมวดหมู่ยอดนิยม — top 8 categories by clip count
2. เกี่ยวกับ — `/about`, brand
3. บริการ — `/pricing`, VIP, login, register
4. ข้อกำหนด — 18+ notice, RTA label, copyright

---

## 5. Data model

No schema changes needed. Confirmed:
- `clips.title notNull` — **stores raw filename (e.g. `IMG_2341.mp4`), NEVER surfaced to users or crawlers.** All user-facing titles are computed by `clipDisplayTitle(clip, category)`.
- `clips.description` nullable (fallback template), `clips.updatedAt notNull`
- `categories.description` nullable (fallback template), `categories.updatedAt notNull`, `categories.coverImage` nullable (gradient fallback)
- `clips.thumbnailR2Key` nullable (thumbnail proxy 404s gracefully)

Category description fallback template:
> `ชมคลิป${category.name}ทั้งหมด${clipCount}คลิปบน${BRAND} อัปเดตใหม่ทุกวัน คุณภาพ HD พร้อมรับชมได้ทันทีหลังสมัครสมาชิก`

Clip description fallback:
> `ชม${clipTitle}ในหมวดหมู่${categoryName}ได้ที่${BRAND} แหล่งรวมคลิปวิดีโอคุณภาพสำหรับผู้ใหญ่ อัปเดตใหม่ทุกวัน สมัครสมาชิกเพื่อดูคลิป VIP แบบไม่จำกัด`

"ยอดนิยมสัปดาห์นี้" uses createdAt-within-7d as proxy for now (future: add viewCount column).

---

## 6. Risks & gotchas

- **Punycode:** `metadataBase: new URL('https://xn--l3ca4bxbygoa7a.com')`. All internal URLs must go through `absoluteUrl()`. Domain-level redirects at Coolify/Cloudflare, not in app.
- **Thai in OG images:** must ship `Kanit-Bold.ttf` (~100KB) at `apps/web/src/app/_fonts/` and load via `fetch(new URL(..., import.meta.url))`. `runtime = 'nodejs'` required.
- **Long clip titles in OG:** 60-char substring + CSS `-webkit-line-clamp: 2` at 72px Kanit.
- **`generateSitemaps` cardinality:** 10k clips → 4 sub-sitemaps. Grows by 1 per 5000 new clips.
- **Next 15 `searchParams` type:** `Promise<{ [key: string]: string | string[] | undefined }>` in `generateMetadata`.
- **Banner slider coexistence:** banner stays in `(main)/layout.tsx`; new `<HomeHero />` renders inside page body. No conflict.
- **Pre-existing TS error in `api/payments/create/route.ts`:** leave alone (per CLAUDE.md). `ignoreBuildErrors: true` keeps builds green; local check via `npx tsc --noEmit`.
- **VIP clips in sitemap:** included — title/description/thumbnail are public metadata, only video bytes are gated. Not cloaking.
- **Presigned URLs never in structured data or sitemap.** Always use `/api/thumbnail/[id]` proxy.
- **Do not put noindex URLs in sitemap** (GSC hard error).

---

## 7. Build-time safety

- Local TS check: `npx tsc --noEmit -p apps/web/tsconfig.json`
- Revalidate per route: home 300s, category 600s, clip 3600s, about 86400s, sitemap 3600s, thumbnail proxy 1800s, OG images 86400s
- HSTS header in `next.config.ts`: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` + `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: interest-cohort=()`

---

## 8. Incremental delivery (single PR, 7 stages for review)

1. **Foundation** — metadataBase, root layout meta, robots.ts, GSC file, GA4, adult-compliance `other`, HSTS headers
2. **Dynamic metadata** — `generateMetadata` for home/category/clip/pricing
3. **Sitemap + thumbnail proxy**
4. **JSON-LD** components wired in
5. **OG images** — root + per-route + Kanit-Bold.ttf
6. **UI redesign** — new components + rewrite 3 pages
7. **About + footer**

---

## 9. Testing plan

**Manual per stage:**
- View-source each page type → confirm `<title>`, `<meta description>`, `<link rel=canonical>`, og:*, twitter:card, `meta[name=rating]=adult`, RTA label, `meta[name=google-site-verification]`
- JSON-LD validates at https://search.google.com/test/rich-results
- `curl -I /` → HSTS
- `curl /robots.txt` → expected rules
- `curl /sitemap.xml` → index listing 4 children; each validates
- `/api/thumbnail/<id>` → 302 to R2 with Cache-Control; invalid id → 404
- Visit `/opengraph-image`, per-route OG → 1200×630 PNG with Thai rendered
- Share URLs in Telegram/X dev validator → branded OG preview

**Automated:**
- Lighthouse SEO target 100
- Link-check: no anchors to `/profile`, `/devices`, `/payment` without `rel=nofollow`
- After deploy: GSC URL Inspection → "URL available to Google"; submit sitemap; check Coverage after 48h
- Grep sitemap XML for `/login`, `/profile`, etc. → should be empty

---

## 10. Environment / secrets

- `NEXT_PUBLIC_SITE_URL=https://xn--l3ca4bxbygoa7a.com`
- `NEXT_PUBLIC_GA_ID=G-SSEFS20STL`
- GSC verification token (static): `4_S0HkzgexgmrG7P0gofWle4J52v1U1zyDr6f-HvmqM` — baked into `metadata.verification.google` + `public/google{token}.html`

---

## 11. Non-goals

- Server-side A/B testing, personalization, paid-search landing variants
- Multi-language (Thai only; `x-default` → Thai)
- Reviews/ratings schema (no real review data yet; fake aggregation is manual-action trigger)
- Wikipedia entries (not feasible for adult sites)
- CSP strict mode (defer; may conflict with GA4 and presigned R2 URLs)

---

## 12. Handoff

Ready for implementation plan (writing-plans skill). First PR bundles all 7 stages. Target deployable behind feature-flag? No — SEO changes must land all at once to avoid split-brain signals (mix of old and new metadata confuses crawlers).
