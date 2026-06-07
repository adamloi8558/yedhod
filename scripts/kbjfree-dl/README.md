# kbjfree-dl

ดาวน์โหลดคลิปจาก kbjfree.com แล้ว stream upload ขึ้น Cloudflare R2 อัตโนมัติ

## ขั้นตอนติดตั้ง

```bash
cd scripts/kbjfree-dl
cp .env.example .env
# แก้ .env ใส่ KBJ_EMAIL / KBJ_PASSWORD และ R2_* (copy จาก ../../.env ของ kodhom)

# ใช้ npm/pnpm อะไรก็ได้ — package นี้ไม่อยู่ใน workspace
npm install
npx playwright install chromium
```

## รัน

```bash
npm start
```

จะ:
1. เปิด Chromium headless, login (เก็บ session ใน `state.json` + `browser-data/`) — รันครั้งถัดไปไม่ต้อง login ใหม่
2. Crawl `/videos` (หรือ `/model/<slug>` ถ้าตั้ง `DISCOVER=model:jekcy`) เอา video IDs มา `MAX_PAGES` หน้า
3. แต่ละคลิป: เปิด `/watch/<id>` → อ่าน `<video>.currentSrc` (signed mp4 URL) → stream-download → multipart upload ขึ้น R2 ที่ key `kbjfree/<id>_<slug>.mp4`

ไฟล์ stream ตรงจาก CDN → R2 (ไม่ลง disk, ไม่บวมใน RAM) ใช้ `@aws-sdk/lib-storage` multipart 8MB/part

## ตัวแปร `.env`

| ตัวแปร | ความหมาย |
|---|---|
| `KBJ_EMAIL` / `KBJ_PASSWORD` | บัญชี kbjfree.com |
| `R2_*` | credentials เดียวกับ kodhom — `R2_BUCKET_NAME` ใช้ bucket เดียวกันหรือแยกก็ได้ |
| `R2_KEY_PREFIX` | path prefix ใน bucket (default `kbjfree/`) |
| `DISCOVER` | `videos` หรือ `model:<slug>` |
| `MAX_PAGES` | จำนวนหน้าที่ crawl (1 หน้า ≈ 24 คลิป) |
| `SKIP_EXISTING` | `true` = ข้ามถ้า key มีใน R2 แล้ว |

## หมายเหตุ

- Signed mp4 URL ของ kbjfree หมดอายุ ~1 ชม. — สคริปต์ resolve ใหม่ทุกคลิป จึงไม่มีปัญหา
- ถ้า login form ของเว็บเปลี่ยน selector → ปรับใน `ensureLoggedIn()` ของ `index.ts`
- ถ้าอยากดาวน์โหลด **เฉพาะคลิปเดียว** ตาม id ที่รู้แล้ว: แก้ `discoverIds()` ให้ return `["<id>"]` ตรงๆ
