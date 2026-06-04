# Spec: ปรับหน้าเว็บให้ดึงดูดลูกค้า (คงสี/ธีมเดิม)

**โจทย์:** ทำให้คนเข้ามาเว็บแล้วรู้สึก "น่าสมัครสมาชิก" — แต่ไม่แตะ palette/tokens/components เดิม ปรับด้วย layout + content + funnel + teaser

---

## ขอบเขต

**ทำ:**
- จัดเรียงหน้า + เพิ่ม section ใหม่
- ปรับ copy (CTA, label, microcopy)
- ปลดล็อก teaser ให้ guest/non-VIP ดูได้ทุกคลิป (10s หรือ 20-30% ของคลิป — แล้วแต่อันไหนสั้นกว่า)
- หน้า `/clips` ใหม่ — "ดูทั้งหมด" รวม member + VIP
- Funnel: post-signup/post-payment กลับไปคลิปเดิม

**ไม่ทำ:**
- ไม่แตะสี/palette/tokens (`globals.css`, `@kodhom/ui`)
- ไม่ใส่ view count / รีวิวปลอม / countdown ปลอม
- ไม่เพิ่ม dependency ใหม่
- ไม่ทำ DRM — teaser = trust client, ยอมรับว่า URL leak ได้

---

## สถาปัตยกรรม

### 1. Teaser (หัวใจของ conversion)

**เปลี่ยน `apps/web/src/components/clip-card.tsx`:**
- `beginPreview()` ทำงานเสมอ (ไม่ check `hasAccess`)
- คำนวณ teaser duration จาก clip:
  ```ts
  const teaserDuration = Math.min(10, (clip.duration ?? 0) * 0.3) || 10;
  ```
- ส่ง `teaserDuration` ลงไปใน `<ClipPreviewVideo />` แทน 8000ms hardcode
- เพิ่ม badge มุมขวาล่าง (เหนือ duration pill): **"ตัวอย่างฟรี"** สำหรับ VIP clip เมื่อ guest/non-VIP (อยากให้รู้ว่ากดค้างได้)
- คง overlay "VIP เท่านั้น" ไว้แต่ปรับ message: "กดค้างเพื่อดูตัวอย่าง"

**สร้าง API ใหม่: `apps/web/src/app/api/clips/[id]/preview/route.ts`**
- ไม่บังคับ login, ไม่ check subscription
- คืน presigned URL ของ `clip.r2Key` (ไฟล์เต็ม — client เป็นคนหยุด)
- TTL สั้น (60s) เพื่อจำกัดการแชร์
- Return: `{ url, teaserDuration }` (teaserDuration = วินาทีที่ client ต้องหยุด)

**แก้ `ClipPreviewVideo`:**
- เรียก `/api/clips/${id}/preview` แทน `/stream` ถ้า `!hasAccess`
- ใช้ `teaserDuration` จาก response ตั้ง `setTimeout` แทน 8000

### 2. หน้าแรก (`apps/web/src/app/(main)/page.tsx`)

โครงสร้างใหม่ (เรียงจากบนลงล่าง):

```
Hero (เดิม — ปรับ copy เท่านั้น)
  ↓
"หมวดหมู่ยอดนิยม" (ใหม่) — 4-8 หมวด pinned/sortOrder ต้น แสดงเป็น horizontal pill
  ↓
"คลิปอัปเดตล่าสุด" (เดิม — เปลี่ยนชื่อ + เพิ่มปุ่ม "ดูทั้งหมด →")
  ↓
"คลิป VIP ล่าสุด" (ใหม่) — 8 อันแรกที่ accessLevel=vip, sort createdAt
```

**Hero copy ใหม่:**
- Badge: "ดูตัวอย่างฟรีก่อนตัดสินใจ" (แทน "อัปเดตคลิปใหม่ทุกวัน")
- Stats เพิ่มอันใหม่: "เพิ่มใหม่ N คลิปใน 7 วัน" (compute จาก `where createdAt > now()-7d`)

**Section "ดูทั้งหมด" link:**
```tsx
<Link href="/clips" className="text-sm font-medium text-primary hover:underline">
  ดูทั้งหมด →
</Link>
```

### 3. หน้า `/clips` (ใหม่)

`apps/web/src/app/(main)/clips/page.tsx` — server component
- Pagination 60/หน้า (query `?page=`)
- Sort by `createdAt desc`
- ไม่กรอง accessLevel — แสดง member + VIP ปนกัน
- ใช้ `<ClipCard />` เดิม
- ใช้ pagination component แบบเดียวกับหน้า category (`apps/web/src/app/(main)/category/[slug]/page.tsx` — มี pagination อยู่แล้ว)

### 4. หน้า clip detail (`apps/web/src/app/(main)/clip/[id]/page.tsx`)

**สำหรับ guest / non-VIP / clip VIP:**
- เล่น teaser อัตโนมัติเมื่อโหลด (ไม่ต้องกดค้าง)
- ตอน video ใกล้จบ (1 วินาทีก่อน): overlay fade-in
  - ปุ่ม primary: "สมัคร VIP เพื่อดูต่อ" → `/pricing?redirect=/clip/[id]`
  - ลิงก์รอง: ถ้ายังไม่ login → "เข้าสู่ระบบ"

**สำหรับ free user ที่ดูคลิป member:** ปกติ ไม่เปลี่ยน

**ใต้ player (เฉพาะคนที่ดูไม่ได้):** Pricing strip compact
- 3 card แนวนอน (15วัน, 30วัน, 3เดือน) — ไม่ต้องเด้งไป `/pricing`
- ปุ่มแต่ละ card ส่งไปหน้า payment พร้อม `?planId=...&redirect=/clip/[id]`

### 5. Pricing page (`apps/web/src/app/(main)/pricing/page.tsx` + `pricing-card.tsx`)

**`pricing-card.tsx`:**
- เพิ่ม "ประมาณ X บาท/วัน" ใต้ราคาเต็ม:
  ```ts
  const pricePerDay = Math.round(plan.price / plan.duration);
  ```
- Label ใต้ชื่อ plan (จาก duration):
  - duration ≤ 15 → "ลองใช้งาน"
  - duration ≤ 31 → "ยอดนิยม"
  - duration ≤ 92 → "คุ้มกว่า"
  - duration > 92 → "ประหยัดสุด"

**หน้า pricing:** เพิ่ม section ล่าง card — checklist เปรียบเทียบ
- "ไม่สมัคร" vs "VIP" — เช็คลิสต์สั้นๆ 5-6 ข้อ
- "ดูคลิป VIP เต็มเรื่อง" / "ไม่จำกัดเวลา" / "อัปเดตต่อเนื่อง" / ...

### 6. Funnel redirect

**Login/Register:** มี `?redirect=` อยู่แล้ว — ตรวจให้ครบ
- หลัง login สำเร็จ → redirect param (sanitized relative path)
- หลัง register สำเร็จ → redirect param

**Payment success:** ต้องเพิ่ม
- หน้า `payment/success` — รับ `?redirect=` ถ้ามี ก็พาไป
- ถ้าไม่มี → ไปหน้าแรก (ไม่ใช่ dashboard)

**Pricing card:** เพิ่ม `redirect` query string ถ้ามี
- `/pricing?redirect=/clip/abc` → กด plan → `/payment?planId=...&redirect=/clip/abc`

### 7. CTA cleanup (Hero ของหน้าแรก)

ปัจจุบัน guest hero มี 2 CTA แข่งกัน: "สมัครสมาชิกฟรี" + "ดูแพ็กเกจ VIP"
**ใหม่:** primary เดียวเด่น
- Guest: "สมัครฟรี — ดูตัวอย่างทุกคลิป" (primary, gradient)
- Secondary text-link ขนาดเล็ก: "ดูแพ็กเกจ VIP"

---

## ลำดับ implement (commit ย่อย)

1. **Teaser ปลดล็อก** — `/api/clips/[id]/preview` route + แก้ `ClipCard` + `ClipPreviewVideo`
2. **หน้าแรก** — ปรับ copy hero, เพิ่ม "ดูทั้งหมด" link, เพิ่ม "หมวดหมู่ยอดนิยม" + "คลิป VIP ล่าสุด"
3. **หน้า /clips** — server component + pagination
4. **หน้า clip detail** — auto-teaser + overlay CTA + compact pricing strip
5. **Pricing card** — บาท/วัน + plan label + comparison checklist
6. **Funnel redirect** — payment success page + pricing card forward redirect
7. **Verify** — tsc 2 apps, dev server screenshot ทุก breakpoint

---

## Verify

- `npx tsc --noEmit -p apps/web/tsconfig.json` ผ่าน
- `pnpm --filter @kodhom/web build` (อนุญาต EPERM symlink บน Windows)
- Manual: guest mode (incognito) เปิดหน้าแรก → กดค้าง VIP clip → teaser เล่น 10s → จบ → overlay CTA ขึ้น
- Manual: หน้า `/clips` มี clip ครบ + pagination
- Manual: หน้าแรกบน mobile (375) + desktop (1280) ภาพไม่พัง
