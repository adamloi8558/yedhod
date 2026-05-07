# Audit Fixes + EasySlip Integration — Design

Date: 2026-05-08
Author: brainstorm session

## Goal

Two parallel goals delivered together:

1. **Resolve all blocker/high audit findings** from the 4-agent audit run on 2026-05-08.
2. **Add EasySlip as an alternative payment provider** with admin-controlled global mode switch and weighted multi-account routing.

## Non-goals

- Changing AnyPay flow itself (kept as-is, just hardened).
- Mobile app, partial payment, refund flow.
- Real-time slip review by humans (purely automated via EasySlip).
- Reworking pricing plans, subscriptions schema beyond the indexes/columns this work requires.

---

## Part A — Audit Fixes

### A.1 Critical Security

**A.1.1 Webhook signature timing attack**
- `apps/web/src/app/api/payments/webhook/route.ts:8-13`
- `apps/backoffice/src/app/api/withdraw/webhook/route.ts:7-12`
- Replace `===` with `crypto.timingSafeEqual` on equal-length hex buffers.

**A.1.2 Webhook idempotency**
- `apps/web/src/app/api/payments/webhook/route.ts:39-69`
- Before inserting subscription: short-circuit when `payment.status === "completed"` and return 200.
- Add `paymentRef` UNIQUE on `subscriptions` and use `ON CONFLICT DO NOTHING` for second-line defense.

**A.1.3 Upload route admin-only + folder allowlist**
- `apps/web/src/app/api/upload/route.ts`: only allow `folder ∈ {"avatars"}` and require any logged-in user (not admin) — this is the avatar uploader, scope it tightly.
- `apps/backoffice/src/app/api/upload/route.ts`: keep admin-only; allowlist `folder ∈ {"clips","thumbnails","banners","slips"}`.

**A.1.4 Avatar r2Key validation**
- `apps/web/src/app/api/profile/avatar/route.ts:15-25`: reject `r2Key` that doesn't start with `avatars/`.

**A.1.5 Banner linkUrl scheme**
- `packages/validators/src/index.ts` `bannerSchema.linkUrl`: add `.refine(v => /^https?:\/\//.test(v), "ลิงก์ต้องขึ้นต้นด้วย http(s)://")`.

**A.1.6 Webhook log-after-verify**
- Move `console.log("[webhook] Received:", ...)` to after signature check; never log signature.

### A.2 DB Indexes & Performance

**A.2.1 Indexes** (single migration):
- `clips(category_id, is_active, created_at DESC)`
- `subscriptions(user_id, status)`
- `payments(anypay_ref)` UNIQUE (nullable still allowed; one row per AnyPay ref)
- `subscriptions(payment_ref)` UNIQUE
- `sessions(user_id, expires_at)`
- `withdrawals(anypay_ref)` UNIQUE

**A.2.2 EasySlip-related schema** (rolled into same migration to keep migration count low):
- New columns on `payments`:
  - `provider` text NOT NULL DEFAULT `'anypay'` (enum-like, allowed: `'anypay'`, `'easyslip'`)
  - `slip_image_r2_key` text NULL
  - `easyslip_trans_ref` text NULL
  - UNIQUE index on `easyslip_trans_ref` (partial WHERE not null) — guarantees no two slips with same EasySlip transRef can be accepted
  - `account_snapshot` jsonb NULL — frozen snapshot of the receiving account at create-time

**A.2.3 Bulk subscription expiry**
- `apps/web/src/lib/access-control.ts`: replace `for (const sub of expired) await update(...)` with one `db.update(subscriptions).set({status:'expired'}).where(and(eq(userId,…), eq(status,'active'), lt(endDate, now)))`.

**A.2.4 Stop signing thumbnails per-render**
- `apps/web/src/app/(main)/page.tsx`, `category/[slug]/page.tsx`, `clip/[id]/page.tsx`: ClipCard receives `clip.id` and renders `<img src={`/api/thumbnail/${id}`} />` (route already exists with cache headers).

**A.2.5 Category page bounds**
- `(main)/category/[slug]/page.tsx`: add `.limit(60)`; replace count-via-rows with `db.select({count: count()}).from(...)`.

### A.3 Next 15 Compatibility & Error UX

**A.3.1 OG image params**
- `(main)/clip/[id]/opengraph-image.tsx`, `(main)/category/[slug]/opengraph-image.tsx`: change `params: { id|slug: string }` → `params: Promise<{...}>`, await before use.

**A.3.2 Error/loading/not-found pages**
- Create:
  - `app/global-error.tsx` (root, full HTML — Next 15 requires)
  - `app/(main)/error.tsx` (client, "use client", `reset` button)
  - `app/(main)/not-found.tsx` (Thai 404 with link home)
  - `app/(main)/loading.tsx` (skeleton-style spinner)
- All copy in Thai.

**A.3.3 robots/canonical for utility routes**
- `app/(main)/search/page.tsx`, `profile/page.tsx`, `devices/page.tsx`, `payment/page.tsx`, `(auth)/login/page.tsx`, `register/page.tsx`: add `metadata = { robots: { index: false, follow: false } }`.

**A.3.4 title.template cleanup**
- `app/layout.tsx`: remove `title.template: "%s"` (no-op). Per-page `pageTitle()` keeps appending `BRAND_SUFFIX`.

**A.3.5 Payment polling guards**
- `app/(main)/payment/page.tsx`: pause polling when `document.visibilityState === "hidden"`, resume on `visible`. Hard cap at 60 attempts (= 5 min). Stop when QR `expiresAt < now`.

### A.4 UX & Accessibility

**A.4.1 ClipCard title**
- `components/clip-card.tsx`: render `<h3>{clipDisplayTitle(clip, category)}</h3>` above the meta line. Keep meta line.

**A.4.2 Banner slider hardening**
- `components/banner-slider.tsx`:
  - `pointer-events-none` + `aria-hidden` + `tabIndex={-1}` on inactive slides
  - root: `role="region" aria-roledescription="carousel" aria-label="แบนเนอร์โปรโมชัน"`
  - Pause on `onFocus`/`onBlur` in addition to mouse
  - Honor `prefers-reduced-motion: reduce` → disable auto-advance
  - Add `alt: string` to `Banner` schema (Zod) and to the data model; render `alt={b.alt ?? ""}`

**A.4.3 Header icon buttons aria-label**
- `components/header.tsx`: add `aria-label="เปิดเมนู"`, `"ค้นหา"`, `"สลับธีม"`.

**A.4.4 Show-password button**
- `(auth)/login/page.tsx:104`, `register/page.tsx:108`: remove `tabIndex={-1}`; add `aria-label="แสดง/ซ่อนรหัสผ่าน"`, `aria-pressed={showPassword}`.

**A.4.5 Skip-to-content link**
- `app/layout.tsx`: visually-hidden anchor jumping to `#main` as first focusable element. `(main)/layout.tsx` wraps children in `<main id="main">`.

**A.4.6 Decorative images**
- `components/clip-card.tsx`: image `alt=""` (parent link already has aria-label).
- `components/sidebar.tsx`: category cover image `alt=""`.

### A.5 Code Quality

**A.5.1 getSession helper**
- `apps/web/src/lib/auth-server.ts` exports `getSession()` already. Replace inline `auth.api.getSession({headers: await headers()})` in: `api/upload/route.ts`, `api/devices/check/route.ts`, `api/profile/avatar/route.ts`, `api/clips/[id]/stream/route.ts`, `api/payments/create/route.ts`, `api/payments/[ref]/status/route.ts` with `getSession()` import.

**A.5.2 Constants module**
- New `packages/config/src/constants.ts`:
  - `PAYMENT_POLL_MS = 5000`
  - `PAYMENT_POLL_MAX_ATTEMPTS = 60`
  - `BANNER_ROTATE_MS = 5000`
  - `R2_PRESIGN_STREAM_TTL = 7200`
  - `R2_PRESIGN_THUMBNAIL_TTL = 3600`
  - `R2_PRESIGN_BANNER_TTL = 7200`
  - `LIFETIME_DAYS_THRESHOLD = 36500`
  - `EASYSLIP_BASE_URL = "https://api.easyslip.com/v2"`
  - `EASYSLIP_TIMEOUT_MS = 15000`
  - `EASYSLIP_MAX_FILE_BYTES = 4 * 1024 * 1024`
  - `EASYSLIP_ALLOWED_MIME = ["image/jpeg","image/png","image/gif","image/webp"]`
- Wire imports in callers.

**A.5.3 Profile page join**
- `(main)/profile/page.tsx`: change `innerJoin(categories, eq(subscriptions.categoryId, categories.id))` to `leftJoin(...)` so global subscriptions (categoryId NULL) are not silently dropped.

---

## Part B — EasySlip Integration

### B.1 Data Model

System config keys (single source of truth, JSON values):

**`payment_mode`**
```ts
{ provider: "anypay" | "easyslip" }
```

**`easyslip_config`**
```ts
{ apiKey: string }
```

**`payment_accounts`**
```ts
[
  {
    id: string,           // nanoid, stable for snapshots
    bankCode: string,     // EasySlip bank id, e.g. "004" KBANK
    bankName: string,     // Thai display, e.g. "กสิกรไทย"
    accountNumber: string,// canonical, e.g. "1234567890" (digits only) — display formatted on UI
    accountName: string,  // Thai display
    weight: number,       // integer 0..100
    isActive: boolean
  }
]
```

**Invariant:** `sum(weight where isActive) === 100`. Saving a list that violates this returns 400.

### B.2 Validators (`packages/validators`)

```ts
export const paymentModeSchema = z.object({ provider: z.enum(["anypay","easyslip"]) });
export const easyslipConfigSchema = z.object({ apiKey: z.string().min(1) });
export const paymentAccountSchema = z.object({
  id: z.string().min(1),
  bankCode: z.string().regex(/^\d{3}$/, "รหัสธนาคารไม่ถูกต้อง"),
  bankName: z.string().min(1),
  accountNumber: z.string().regex(/^\d{8,15}$/, "เลขบัญชีต้องเป็นตัวเลข 8-15 หลัก"),
  accountName: z.string().min(1),
  weight: z.number().int().min(0).max(100),
  isActive: z.boolean(),
});
export const paymentAccountsListSchema = z.array(paymentAccountSchema)
  .refine(arr => arr.filter(a => a.isActive).reduce((s,a)=>s+a.weight,0) === 100,
          { message: "น้ำหนักรวมของบัญชีที่ใช้งานต้องเท่ากับ 100" });
```

### B.3 EasySlip Client (`packages/easyslip`)

New internal package mirroring `packages/r2`:

```ts
// packages/easyslip/src/client.ts
export interface EasySlipVerifyInput {
  apiKey: string;
  imageBuffer: Buffer;
  imageMime: string;
  matchAmount: number;
  checkDuplicate: true;
}
export interface EasySlipRawSlip {
  payload: string;
  transRef: string;
  date: string; // ISO 8601 with TZ
  countryCode: string;
  amount: { amount: number; local: { amount: number; currency: string } };
  fee: number;
  sender: { bank: { id: string; name: string; short: string }; account: {...} };
  receiver: { bank: { id: string; name: string; short: string }; account: {...} };
}
export interface EasySlipSuccess {
  isDuplicate: boolean;
  amountInSlip: number;
  amountInOrder: number;
  isAmountMatched: boolean;
  matchedAccount: object | null;
  rawSlip: EasySlipRawSlip;
}
export type EasySlipResult =
  | { ok: true; data: EasySlipSuccess }
  | { ok: false; code: EasySlipErrorCode; message: string };

export async function verifyBankSlip(input: EasySlipVerifyInput): Promise<EasySlipResult>
```

- Uses `fetch` with AbortController timeout = `EASYSLIP_TIMEOUT_MS`.
- Sends `multipart/form-data` with field `image`, `matchAmount`, `checkDuplicate`.
- Maps errors via `errorMap` (see B.7).
- Re-throws on network/timeout as `{ ok:false, code:"NETWORK", message:"กรุณาลองใหม่" }`.

### B.4 Backoffice — `/dashboard/payment-config`

Single page, server component shell + small client islands:

- Section 1: Provider toggle (radio: AnyPay / EasySlip). Saves to `payment_mode`.
- Section 2: EasySlip API key input (password field, masked when displayed). Saves to `easyslip_config`.
- Section 3: Payment accounts list — editable table with columns: ธนาคาร, ชื่อบัญชี, เลขบัญชี, น้ำหนัก (%), ใช้งาน, จัดการ. Add row, delete row, edit inline.
  - Live "รวมน้ำหนัก: 100/100" indicator (green) or "85/100 (ต้อง 100)" (red).
  - Save button disabled until sum = 100 across active rows.
- Routes:
  - `GET /api/payment-config` — admin only, returns current 3 keys merged.
  - `PUT /api/payment-config/mode` — set provider.
  - `PUT /api/payment-config/easyslip` — set apiKey.
  - `PUT /api/payment-config/accounts` — replace full list (validated server-side).
- Reuse existing `requireAdmin()`.

### B.5 Web — Payment flow per provider

`apps/web/src/app/(main)/payment/page.tsx` becomes a server component that:

```ts
const mode = await getPaymentMode(); // reads system_config
return mode.provider === "anypay"
  ? <AnyPayForm planId={planId} />
  : <EasySlipForm planId={planId} />;
```

- `AnyPayForm` = current client component, refactored out (no behavior change).
- `EasySlipForm` = new client component:
  - Step 1 (`qrData === null`): create button — `POST /api/payments/create-easyslip {pricingPlanId}`.
  - Step 2: shows `accountSnapshot` (bankName + accountNumber w/ copy button + accountName + amount), countdown to `expiresAt` (default 30 min), file input (jpg/png/gif/webp ≤ 4MB), submit → `POST /api/payments/{paymentId}/verify-slip`.
  - Step 3 success: same component as AnyPay success.
  - Inline error region for verify failures; user can pick another file and retry.

### B.6 Web — API Routes

**B.6.1 `POST /api/payments/create-easyslip`**
- Validate body: `{ pricingPlanId: string }`.
- Require session.
- Read `payment_accounts`, filter `isActive`, weighted-random pick (cumulative weights).
- Insert `payments` row:
  - `provider: "easyslip"`, `status: "pending"`
  - `amount: plan.priceThb`
  - `accountSnapshot: {bankCode,bankName,accountNumber,accountName}` (frozen)
  - `expiresAt: now + 30min`
- Response: `{ paymentId, account: accountSnapshot, amount, expiresAt }`.

**B.6.2 `POST /api/payments/[paymentId]/verify-slip`**
- Multipart form, field `slip` (file).
- Require session; load payment WHERE `id=? AND userId=?`.
- Reject if `provider !== "easyslip"`, `status !== "pending"`, or `expiresAt < now`.
- Validate file: mime ∈ allowlist, size ≤ 4MB.
- Upload to R2 at `slips/${paymentId}.${ext}`, save `slipImageR2Key`.
- Read `easyslip_config.apiKey`.
- Call `verifyBankSlip(...)`.
- If `!ok`, return mapped error; do NOT mark payment failed (allow retry).
- Run all verification rules (Section A3 of spec):
  1. `data.isAmountMatched === true` AND `|amountInSlip - expectedAmount| < 0.01`
  2. Receiver bank id matches snapshot `bankCode`
  3. Receiver account number tail matches snapshot tail (EasySlip masks middle digits as `xxx-x-x1234-5`; compare last 4-5 visible digits)
  4. `data.isDuplicate === false`
  5. `rawSlip.date >= payment.createdAt - 5min` (Section 4 rule 6 — gate stale slips)
- DB transaction:
  - SELECT existing payment WHERE `easyslip_trans_ref = data.rawSlip.transRef` FOR UPDATE — abort if found.
  - UPDATE payment SET `status:"completed"`, `paidAt: rawSlip.date`, `easyslipTransRef: rawSlip.transRef`.
  - INSERT subscription (same rules as AnyPay webhook: lifetime if `plan.durationDays >= 36500`, else `endDate = now + duration`). `paymentRef` = `rawSlip.transRef`.
- On unique constraint violation (race): return 409 "สลิปนี้ถูกใช้แล้ว".

**B.6.3 `GET /api/payments/[ref]/status`**
- Already exists. No change — works for both providers because both write to `payments.status`.

### B.7 EasySlip error mapping

Defined in `packages/easyslip/src/errors.ts`, mirroring map in Section 4 of brainstorm. Generic fallback: "ไม่สามารถตรวจสอบสลิปได้ กรุณาลองใหม่".

### B.8 Account number tail matching

EasySlip masks like `xxx-x-x1234-5`. Algorithm:

```ts
function tail(s: string): string {
  return s.replace(/[^0-9]/g, ""); // digits only
}
function tailMatches(slipAcc: string, ourAcc: string): boolean {
  const slipDigits = slipAcc.replace(/[^0-9]/g, ""); // visible digits in slip
  const ourDigits = ourAcc.replace(/[^0-9]/g, "");   // full account
  if (slipDigits.length < 4) return false; // too short to verify
  return ourDigits.endsWith(slipDigits) || slipDigits.endsWith(ourDigits);
}
```

The bidirectional `endsWith` covers both directions of masking. Bank id strict-equal is required as a second check, so collisions on tail alone don't pass.

---

## Implementation Order

1. **WS-B (DB schema migration + indexes + thumbnail switch + bulk expiry)** — foundation
2. **In parallel after WS-B starts but before E:**
   - **WS-A** Critical security
   - **WS-C** Next 15 compat + error pages
   - **WS-D** UX/A11y
   - **WS-F** Code quality
3. **WS-E (EasySlip)** — depends on WS-B columns being present, runs after B finishes migration; can overlap with A/C/D/F.
4. **Phase 3:** Final re-audit using fresh agent.

WS-A through WS-F edit non-overlapping files. Conflict surface:
- All touch `apps/web/src/app/(main)/payment/page.tsx`: WS-C (polling guards on AnyPay branch) + WS-E (split into AnyPay/EasySlip). Resolve by WS-E doing the split, then WS-C applying polling guards inside the AnyPayForm sub-component → sequence WS-C after WS-E for this file specifically. Cleanest path: WS-E first owns the split, WS-C runs after.

Revised order (final):
1. WS-B (schema + perf foundation, blocking)
2. Parallel: WS-A, WS-D, WS-F
3. WS-E (EasySlip — large, owns payment page split)
4. WS-C (Next 15 + error pages + payment polling — picks up split file from WS-E)
5. Final re-audit

---

## Testing & Verification

- After each WS, run `npx tsc --noEmit -p apps/web/tsconfig.json` and same for backoffice.
- Smoke test EasySlip flow with the sandbox API key (admin to provide).
- Verify migration applies cleanly via `pnpm db:migrate`.
- Re-run the 4-agent audit at the end and address any new findings before claiming done.

## Risks

- **EasySlip account number masking format may vary.** Tail-matching algorithm is permissive intentionally; bank-code strict equality is the second gate.
- **Migration adds UNIQUE constraints** on `subscriptions.paymentRef`, `payments.anypayRef`, `withdrawals.anypayRef`. If existing rows violate, migration fails. Need to inspect current data and either dedupe or use a partial unique index.
- **`apps/web/.env` audit false alarm:** verified the file is on disk but **not** tracked in git. No action needed.
- **ESLint cannot run on Windows** due to FlatCompat + ESLint 9.39 issue. Out of scope for this work; CI on Linux should be tested separately.
