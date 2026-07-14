"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@kodhom/ui/components/button";
import { Input } from "@kodhom/ui/components/input";
import { Label } from "@kodhom/ui/components/label";

type VerificationMeta = { name: string; content: string };

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
  googleAnalyticsId: string | null;
  verificationMetas: VerificationMeta[];
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
  networkZoneId: string | null;
  networkWidth: number | null;
  networkHeight: number | null;
  sortOrder: number;
  isActive: boolean;
};

// Ad slots — each object explains where the slot renders on the tenant
// site so admins don't have to open the site to guess. Keep this list in
// sync with the <AdSlot slot=…/> usages in apps/tenant.
type AdType = "embed" | "banner" | "galaksion" | "aads";

type AdSlotDef = {
  key: string;
  label: string;
  group: "หัวเว็บ" | "กลางเว็บ" | "หน้าคลิป" | "แถบข้าง" | "ท้ายเว็บ" | "พิเศษ";
  where: string;
  // Ad types that make sense in this slot. popunder needs the network's
  // popunder script (a static banner can't "pop"); sticky_bottom needs a
  // small fixed-size unit so Galaksion's auto-size banner tag can't fit.
  allowed: AdType[];
  // Recommended size hint shown to admins so they pick sane Galaksion/A-Ads
  // zones (leaderboard vs. rectangle vs. mobile banner). Free-text.
  sizeHint: string;
};

const AD_SLOT_DEFS: AdSlotDef[] = [
  // Header — ทุกหน้า, บนสุด
  { key: "header_top",      label: "1. บนสุดของหน้า (เหนือ logo)",      group: "หัวเว็บ",   where: "แถบเต็มความกว้าง เหนือ logo — เห็นทันทีที่โหลดหน้า ทุกหน้า",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "728x90 (leaderboard) หรือ 970x90 · มือถือ 320x50" },
  { key: "header_bottom",   label: "2. ใต้ header (เหนือ category strip)", group: "หัวเว็บ",   where: "อยู่ใต้แถบ navigation หลัก เหนือแถบหมวดหมู่ ทุกหน้า",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "728x90 หรือ 970x250" },
  { key: "catbar_below",    label: "3. ใต้แถบหมวดหมู่",                 group: "หัวเว็บ",   where: "ใต้แถบเลือกหมวด (แนะนำ/หนัง/…) เหนือเนื้อหา ทุกหน้า",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "728x90" },
  { key: "hero_below",      label: "4. ใต้ banner หลัก",                group: "หัวเว็บ",   where: "ใต้ banner slider (ถ้ามี) — เหนือ grid คลิป",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "970x250 หรือ 728x90" },
  // Sidebar — เห็นข้างเนื้อหาบน desktop, ล้างลงล่างบนมือถือ
  { key: "sidebar_top",     label: "1. Sidebar — บน (sticky)",          group: "แถบข้าง",  where: "แนวตั้งขวาของเนื้อหาบน desktop (lg+) แบบ sticky · มือถือจะไปโผล่ท้ายเนื้อหา",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "300x250 (rectangle) หรือ 300x600 (half-page)" },
  { key: "sidebar_mid",     label: "2. Sidebar — กลาง",                 group: "แถบข้าง",  where: "ใต้ sidebar top ในคอลัมน์ขวา",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "300x250 หรือ 300x600" },
  { key: "sidebar_bot",     label: "3. Sidebar — ล่าง",                 group: "แถบข้าง",  where: "ใต้สุดของคอลัมน์ขวา",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "300x250" },
  // กลางเว็บ / feed
  { key: "in_feed_1",       label: "1. แทรกในฟีด — ช่วงที่ 1",          group: "กลางเว็บ", where: "แทรกเป็นแถบเต็มระหว่าง grid ทุก 60 คลิป (ช่วง 1 · เห็นบ่อยสุด)",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "728x90 หรือ 300x250" },
  { key: "in_feed_2",       label: "2. แทรกในฟีด — ช่วงที่ 2",          group: "กลางเว็บ", where: "แทรกในฟีด ช่วง 2 (rotate หลัง ช่วง 1)",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "728x90 หรือ 300x250" },
  { key: "in_feed_3",       label: "3. แทรกในฟีด — ช่วงที่ 3",          group: "กลางเว็บ", where: "แทรกในฟีด ช่วง 3 (rotate หลัง ช่วง 2)",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "728x90 หรือ 300x250" },
  { key: "native_row",      label: "4. Native card ในกริด (ทุก 20 clip)", group: "กลางเว็บ", where: "แทรกเป็น cell ในกริดฟีด (aspect-video เหมือน thumbnail) ทุก 20 คลิป — ควรใช้รูปที่ดูเหมือน thumbnail คลิป",
    allowed: ["banner", "embed"], sizeHint: "16:9 เช่น 480x270, 640x360 (แนะนำอัปโหลด banner เป็นรูปที่ดูเหมือน thumbnail จะได้ CTR สูง)" },
  { key: "between_sections", label: "5. ระหว่าง section",               group: "กลางเว็บ", where: "ใต้ฟีดหลัก เหนือปุ่ม 'ดูทั้งหมด' — แถบเต็มความกว้าง content",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "728x90 หรือ 970x250" },
  // Clip page only
  { key: "before_video",    label: "1. เหนือ video player",             group: "หน้าคลิป", where: "เฉพาะหน้าดูคลิป — เหนือกรอบ video (เห็นก่อนกด play)",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "728x90 หรือ 468x60" },
  { key: "after_video",     label: "2. ใต้ video player",               group: "หน้าคลิป", where: "เฉพาะหน้าดูคลิป — ใต้ video, เหนือ title",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "728x90 หรือ 300x250" },
  { key: "under_title",     label: "3. ใต้ title/คำอธิบายคลิป",         group: "หน้าคลิป", where: "เฉพาะหน้าดูคลิป — ใต้ชื่อคลิป เหนือ 'คลิปที่เกี่ยวข้อง'",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "300x250 หรือ 336x280" },
  { key: "related_below",   label: "4. ใต้ 'คลิปที่เกี่ยวข้อง'",         group: "หน้าคลิป", where: "เฉพาะหน้าดูคลิป — ล่างสุดของหน้าคลิป ใต้แถวคลิปที่เกี่ยวข้อง",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "728x90" },
  // Footer — ทุกหน้า
  { key: "above_footer",    label: "1. เหนือ footer (เต็ม banner)",     group: "ท้ายเว็บ", where: "แถบเต็มความกว้างเนื้อหา ก่อนแถบ 'เหนือ footer'",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "970x250 หรือ 728x90" },
  { key: "footer_top",      label: "2. เหนือ footer copyright",         group: "ท้ายเว็บ", where: "อยู่ก่อนแถบ copyright ทุกหน้า",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "728x90" },
  { key: "footer_bottom",   label: "3. ใต้ footer copyright",           group: "ท้ายเว็บ", where: "อยู่ใต้แถบ copyright ทุกหน้า (จุดสุดท้ายก่อน user ปิดแทบ)",
    allowed: ["galaksion", "aads", "banner", "embed"], sizeHint: "728x90" },
  // พิเศษ
  { key: "popunder",        label: "Pop-under (เด้งเบื้องหลัง)",        group: "พิเศษ",    where: "เปิด window ใหม่เมื่อ user คลิกที่ไหนก็ได้ในเว็บ ทุกหน้า — ห้ามใส่หลายอัน",
    allowed: ["galaksion", "embed"], sizeHint: "ต้องใช้ Galaksion popunder zone (คนละ zone กับ banner) หรือ embed script ที่รองรับ popunder" },
  { key: "sticky_bottom",   label: "แถบล่าง sticky (มือถือ)",           group: "พิเศษ",    where: "แถบตรึงล่างจอบนมือถือ (md-) · ถ้าไม่ตั้งค่าจะไม่โผล่แถบดำ",
    allowed: ["aads", "banner", "embed"], sizeHint: "320x50 (mobile banner) — ห้ามใช้ Galaksion banner ปกติเพราะขนาดจะล้นแถบ" },
];

const AD_TYPE_LABEL: Record<AdType, string> = {
  galaksion: "Galaksion (zone id)",
  aads: "A-Ads (unit id)",
  banner: "Banner รูปของตัวเอง",
  embed: "Embed HTML/JS อื่นๆ",
};

// Short label used in inline lists ("ใส่ได้:") to keep the chip row compact.
const AD_TYPE_SHORT: Record<AdType, string> = {
  galaksion: "Galaksion",
  aads: "A-Ads",
  banner: "Banner",
  embed: "Embed",
};

// Distinct color per type so admins can scan the slot list at a glance:
// green = own banner, orange = Galaksion, cyan = A-Ads, purple = embed.
const AD_TYPE_CHIP: Record<AdType, string> = {
  galaksion: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  aads:      "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  banner:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  embed:     "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

const AD_SLOT_OPTIONS = AD_SLOT_DEFS.map((s) => s.key);
const AD_SLOT_BY_KEY = new Map(AD_SLOT_DEFS.map((s) => [s.key, s]));

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
            className={`px-4 py-2 text-sm ${
              tab === t ? "border-b-2 border-primary font-medium" : "text-muted-foreground"
            }`}
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
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
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
    setMsg("บันทึกแล้ว");
    onSaved();
  }

  async function del() {
    if (!confirm("ลบเว็บนี้ถาวร?")) return;
    const res = await fetch(`/api/tenants/${tenant.id}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/dashboard/tenants";
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <Label>ชื่อเว็บ</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <Label>Slug</Label>
        <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
      </div>
      <div>
        <Label>โดเมน</Label>
        <Input
          value={form.primaryDomain}
          onChange={(e) => setForm({ ...form, primaryDomain: e.target.value })}
        />
      </div>
      <div>
        <Label>Tagline</Label>
        <Input value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
      </div>
      <div>
        <Label>Footer text</Label>
        <Input value={form.footerText ?? ""} onChange={(e) => setForm({ ...form, footerText: e.target.value })} />
      </div>
      <div>
        <Label>Meta title</Label>
        <Input value={form.metaTitle ?? ""} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })} />
      </div>
      <div>
        <Label>Meta description</Label>
        <Input
          value={form.metaDescription ?? ""}
          onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
        />
      </div>
      <div>
        <Label>Google Analytics 4 ID</Label>
        <Input
          placeholder="G-XXXXXXXXXX"
          value={form.googleAnalyticsId ?? ""}
          onChange={(e) => setForm({ ...form, googleAnalyticsId: e.target.value })}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          ใส่ Measurement ID จาก GA4 (ขึ้นต้นด้วย G-) เว้นว่างเพื่อปิด analytics
        </p>
      </div>
      <div>
        <Label>Verification meta tags</Label>
        <VerificationMetasField
          value={form.verificationMetas ?? []}
          onChange={(next) => setForm({ ...form, verificationMetas: next })}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          ใช้ verify domain กับ ad network เช่น Galaksion, A-Ads, Google Search Console
          — copy จากหน้า verify ของแต่ละเจ้ามาแค่ค่า name กับ content
          (ไม่ต้อง paste tag เต็ม). ตัวอย่าง Galaksion: name = <code>profiton-domain-verification</code>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Primary</Label>
          <Input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
        </div>
        <div>
          <Label>Accent</Label>
          <Input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} />
        </div>
        <div>
          <Label>Background</Label>
          <Input type="color" value={form.backgroundColor} onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })} />
        </div>
        <div>
          <Label>Foreground</Label>
          <Input type="color" value={form.fgColor} onChange={(e) => setForm({ ...form, fgColor: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Logo</Label>
        <UploadField
          folder="tenant-logos"
          value={form.logoR2Key}
          onChange={(k) => setForm({ ...form, logoR2Key: k })}
        />
      </div>
      <div>
        <Label>Favicon</Label>
        <UploadField
          folder="tenant-favicons"
          value={form.faviconR2Key}
          onChange={(k) => setForm({ ...form, faviconR2Key: k })}
        />
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
      {msg && <p className="text-sm text-green-500">{msg}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึก"}</Button>
        <Button variant="destructive" onClick={del}>ลบเว็บนี้</Button>
      </div>

      <SyncCoolifyBox tenantId={tenant.id} domain={form.primaryDomain} />
    </div>
  );
}

function SyncCoolifyBox({ tenantId, domain }: { tenantId: string; domain: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/sync-coolify`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error ?? "sync failed");
      } else if (json.alreadyPresent) {
        setMsg(`โดเมน ${domain} แนบกับ Coolify อยู่แล้ว — ไม่ต้อง redeploy`);
      } else if (json.attached) {
        setMsg(
          `แนบ ${domain} เข้า Coolify แล้ว + trigger redeploy (deployment ${json.deploymentUuid?.slice(0, 8) ?? "?"})`
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded border border-dashed border-primary/40 p-4">
      <h3 className="mb-2 font-medium">Sync to Coolify</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        แนบโดเมนเข้า container Yedhod-Tenant ใน Coolify + สั่ง redeploy (ออก SSL cert อัตโนมัติ).<br />
        ก่อนกด ต้องตั้ง DNS A record ของ <code className="font-mono">{domain}</code> ชี้ IP{" "}
        <code className="font-mono">168.144.46.120</code> และปิด Cloudflare proxy (grey cloud) ให้เรียบร้อยก่อน.
      </p>
      {err && <p className="mb-2 text-sm text-red-500">{err}</p>}
      {msg && <p className="mb-2 text-sm text-green-500">{msg}</p>}
      <Button onClick={sync} disabled={busy} variant="secondary">
        {busy ? "กำลัง sync..." : "🔗 Sync to Coolify"}
      </Button>
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
      await fetch(url, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
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

function VerificationMetasField({
  value,
  onChange,
}: {
  value: VerificationMeta[];
  onChange: (next: VerificationMeta[]) => void;
}) {
  function update(i: number, patch: Partial<VerificationMeta>) {
    onChange(value.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...value, { name: "", content: "" }]);
  }
  return (
    <div className="space-y-2">
      {value.map((m, i) => (
        <div key={i} className="flex flex-wrap gap-2">
          <Input
            className="w-56"
            placeholder="name (เช่น profiton-domain-verification)"
            value={m.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <Input
            className="min-w-[16rem] flex-1"
            placeholder="content (จากหน้า verify)"
            value={m.content}
            onChange={(e) => update(i, { content: e.target.value })}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
            ลบ
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        + เพิ่ม meta
      </Button>
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
  const [msg, setMsg] = useState<string | null>(null);
  const chosenSet = new Set(items.map((i) => i.categoryId));

  function toggle(id: string) {
    if (chosenSet.has(id)) setItems(items.filter((i) => i.categoryId !== id));
    else setItems([...items, { categoryId: id, sortOrder: items.length }]);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    await fetch(`/api/tenants/${tenantId}/categories`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setBusy(false);
    setMsg("บันทึกแล้ว");
    onSaved();
  }

  function selectAll() {
    setItems(memberCategories.map((c, i) => ({ categoryId: c.id, sortOrder: i })));
  }
  function clearAll() {
    setItems([]);
  }
  function invert() {
    const chosen = new Set(items.map((i) => i.categoryId));
    const next = memberCategories
      .filter((c) => !chosen.has(c.id))
      .map((c, i) => ({ categoryId: c.id, sortOrder: i }));
    setItems(next);
  }

  const [filter, setFilter] = useState("");
  const visible = filter
    ? memberCategories.filter((c) =>
        (c.name + " " + c.slug).toLowerCase().includes(filter.toLowerCase())
      )
    : memberCategories;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        เลือกได้เฉพาะหมวดหมู่ระดับ member (คลิปฟรี) — เลือกลูกที่ไหน parent ของลูกนั้นจะโชว์บนเว็บ
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="ค้นหาหมวด..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={selectAll}>
          เลือกทั้งหมด ({memberCategories.length})
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clearAll}>
          ล้าง
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={invert}>
          กลับด้าน
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          เลือกอยู่: {items.length} / {memberCategories.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
        {visible.map((c) => (
          <label key={c.id} className="flex items-center gap-2 rounded border p-2 text-sm">
            <input type="checkbox" checked={chosenSet.has(c.id)} onChange={() => toggle(c.id)} />
            {c.name}
          </label>
        ))}
      </div>

      {msg && <p className="text-sm text-green-500">{msg}</p>}
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
    slot: "header_top",
    type: "galaksion" as "embed" | "banner" | "galaksion" | "aads",
    embedCode: "",
    imageR2Key: "",
    linkUrl: "",
    altText: "",
    networkZoneId: "",
    networkWidth: "",
    networkHeight: "",
  });
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    let body: Record<string, unknown> = { type: form.type, slot: form.slot };
    if (form.type === "embed") body.embedCode = form.embedCode;
    else if (form.type === "banner")
      body = {
        ...body,
        imageR2Key: form.imageR2Key,
        linkUrl: form.linkUrl || undefined,
        altText: form.altText || undefined,
      };
    else
      body = {
        ...body,
        networkZoneId: form.networkZoneId,
        networkWidth: form.networkWidth ? Number(form.networkWidth) : undefined,
        networkHeight: form.networkHeight ? Number(form.networkHeight) : undefined,
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

  async function toggle(id: string, next: boolean) {
    await fetch(`/api/tenants/${tenantId}/ads/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    setAds(ads.map((a) => (a.id === id ? { ...a, isActive: next } : a)));
    onSaved();
  }

  async function del(id: string) {
    if (!confirm("ลบโฆษณานี้?")) return;
    await fetch(`/api/tenants/${tenantId}/ads/${id}`, { method: "DELETE" });
    setAds(ads.filter((a) => a.id !== id));
    onSaved();
  }

  const [editing, setEditing] = useState<Ad | null>(null);
  function afterEdit(updated: Ad) {
    setAds(ads.map((a) => (a.id === updated.id ? updated : a)));
    setEditing(null);
    onSaved();
  }

  function preview(a: Ad): string {
    if (a.type === "embed") return (a.embedCode ?? "").slice(0, 60) + "...";
    if (a.type === "banner")
      return `${a.imageR2Key ?? "—"}${a.linkUrl ? ` → ${a.linkUrl}` : ""}`;
    return `zone ${a.networkZoneId ?? ""} ${a.networkWidth ?? ""}x${a.networkHeight ?? ""}`;
  }

  const grouped: Record<string, Ad[]> = {};
  for (const a of ads) (grouped[a.slot] ??= []).push(a);

  const totals = {
    all: ads.length,
    active: ads.filter((a) => a.isActive).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/10 px-4 py-3 text-sm">
        <span className="font-medium">โฆษณาทั้งหมด</span>
        <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {totals.all} รายการ · เปิด {totals.active}
        </span>
        <span className="text-xs text-muted-foreground">
          Slot ทั้งหมด {AD_SLOT_DEFS.length} จุด — ยิ่งเติมเยอะยิ่งได้รายได้เยอะ
        </span>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-1 font-semibold">รายการโฆษณาตามตำแหน่ง</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          จัดกลุ่มตามพื้นที่บนหน้าเว็บ — สีของ chip บอกว่าโฆษณาเป็นชนิดไหน
        </p>
        {(["หัวเว็บ", "กลางเว็บ", "หน้าคลิป", "แถบข้าง", "ท้ายเว็บ", "พิเศษ"] as const).map((group) => {
          const defs = AD_SLOT_DEFS.filter((s) => s.group === group);
          const groupCount = defs.reduce((n, d) => n + (grouped[d.key]?.length ?? 0), 0);
          return (
            <section key={group} className="mb-6">
              <header className="mb-3 flex items-center gap-2 border-b pb-2">
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/80">
                  {group}
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  {defs.length} slot
                </span>
                {groupCount > 0 && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    ตั้งอยู่ {groupCount}
                  </span>
                )}
              </header>
              <div className="space-y-2">
                {defs.map((def) => {
                  const list = grouped[def.key] ?? [];
                  const hasAds = list.length > 0;
                  return (
                    <div
                      key={def.key}
                      className={`rounded-lg border p-3 transition ${
                        hasAds
                          ? "border-emerald-500/30 bg-emerald-500/[0.02]"
                          : "border-border/60 bg-muted/10"
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-semibold">{def.label}</span>
                            <span className="font-mono text-[10px] text-muted-foreground/60">
                              {def.key}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{def.where}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              รองรับ:
                            </span>
                            {def.allowed.map((t) => (
                              <span
                                key={t}
                                className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${AD_TYPE_CHIP[t]}`}
                              >
                                {AD_TYPE_SHORT[t]}
                              </span>
                            ))}
                            <span className="ml-1 text-[10px] italic text-muted-foreground/70">
                              · ขนาดแนะนำ: {def.sizeHint}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setForm({ ...form, slot: def.key, type: def.allowed[0]! })}
                          className="shrink-0"
                        >
                          + ใส่ที่นี่
                        </Button>
                      </div>
                      {hasAds ? (
                        <ul className="divide-y divide-border/60 border-t border-border/60">
                          {list.map((a) => (
                            <li key={a.id} className="flex items-center gap-3 py-2">
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${AD_TYPE_CHIP[a.type as AdType] ?? ""}`}
                              >
                                {AD_TYPE_SHORT[a.type as AdType] ?? a.type}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                {preview(a)}
                              </span>
                              <label className="flex shrink-0 items-center gap-1 text-xs">
                                <input
                                  type="checkbox"
                                  checked={a.isActive}
                                  onChange={(e) => toggle(a.id, e.target.checked)}
                                />
                                <span className={a.isActive ? "text-emerald-400" : "text-muted-foreground"}>
                                  {a.isActive ? "on" : "off"}
                                </span>
                              </label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditing(a)}
                                className="shrink-0"
                              >
                                แก้ไข
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => del(a.id)} className="shrink-0">
                                ลบ
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="border-t border-border/60 py-2 text-center text-[11px] text-muted-foreground/60">
                          ยังไม่มีโฆษณาในตำแหน่งนี้
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {editing && (
        <EditAdModal
          tenantId={tenantId}
          ad={editing}
          onClose={() => setEditing(null)}
          onSaved={afterEdit}
        />
      )}

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 font-semibold">เพิ่มโฆษณาใหม่</h3>
        <div className="space-y-3">
          <div>
            <Label>Slot (ตำแหน่งบนเว็บ)</Label>
            <select
              className="w-full rounded border bg-background p-2"
              value={form.slot}
              onChange={(e) => {
                const nextSlot = e.target.value;
                const def = AD_SLOT_BY_KEY.get(nextSlot);
                const allowed = def?.allowed ?? ["galaksion", "aads", "banner", "embed"];
                const nextType = allowed.includes(form.type) ? form.type : allowed[0];
                setForm({ ...form, slot: nextSlot, type: nextType });
              }}
            >
              {(["หัวเว็บ", "กลางเว็บ", "หน้าคลิป", "แถบข้าง", "ท้ายเว็บ", "พิเศษ"] as const).map((group) => (
                <optgroup key={group} label={group}>
                  {AD_SLOT_DEFS.filter((d) => d.group === group).map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {(() => {
              const def = AD_SLOT_BY_KEY.get(form.slot);
              return def ? (
                <div className="mt-2 rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <p className="mb-1.5 flex items-center gap-2 font-medium text-foreground/80">
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      {def.key}
                    </span>
                    <span>{def.where}</span>
                  </p>
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider">
                      รองรับ:
                    </span>
                    {def.allowed.map((t) => (
                      <span
                        key={t}
                        className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${AD_TYPE_CHIP[t]}`}
                      >
                        {AD_TYPE_SHORT[t]}
                      </span>
                    ))}
                  </div>
                  <p className="italic">ขนาดแนะนำ: {def.sizeHint}</p>
                </div>
              ) : null;
            })()}
          </div>
          <div>
            <Label>Type</Label>
            <select
              className="w-full rounded border bg-background p-2"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
            >
              {(AD_SLOT_BY_KEY.get(form.slot)?.allowed ?? ["galaksion", "aads", "banner", "embed"]).map((t) => (
                <option key={t} value={t}>
                  {AD_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          {form.type === "embed" && (
            <div>
              <Label>Embed HTML/JS</Label>
              <textarea
                className="w-full rounded border bg-background p-2 font-mono text-xs"
                rows={6}
                value={form.embedCode}
                onChange={(e) => setForm({ ...form, embedCode: e.target.value })}
              />
            </div>
          )}
          {form.type === "banner" && (
            <>
              <div>
                <Label>รูปโฆษณา</Label>
                <UploadField
                  folder="tenant-ads"
                  value={form.imageR2Key || null}
                  onChange={(k) => setForm({ ...form, imageR2Key: k ?? "" })}
                />
              </div>
              <div>
                <Label>ลิงก์ (optional)</Label>
                <Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} />
              </div>
              <div>
                <Label>Alt text</Label>
                <Input value={form.altText} onChange={(e) => setForm({ ...form, altText: e.target.value })} />
              </div>
            </>
          )}
          {(form.type === "galaksion" || form.type === "aads") && (
            <>
              <div>
                <Label>{form.type === "galaksion" ? "Galaksion zone id" : "A-Ads unit id"}</Label>
                <Input
                  value={form.networkZoneId}
                  onChange={(e) => setForm({ ...form, networkZoneId: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Width (px, optional)</Label>
                  <Input
                    value={form.networkWidth}
                    onChange={(e) => setForm({ ...form, networkWidth: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Height (px, optional)</Label>
                  <Input
                    value={form.networkHeight}
                    onChange={(e) => setForm({ ...form, networkHeight: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {form.type === "galaksion"
                  ? "แค่ zone id ระบบจะ inject Galaksion tag ให้อัตโนมัติ (banner + popunder ใช้คนละ zone)"
                  : "A-Ads default 468x60 ถ้าไม่ระบุ"}
              </p>
            </>
          )}
          {err && <p className="text-sm text-red-500">{err}</p>}
          <Button onClick={create}>เพิ่มโฆษณา</Button>
        </div>
      </div>
    </div>
  );
}

function EditAdModal({
  tenantId,
  ad,
  onClose,
  onSaved,
}: {
  tenantId: string;
  ad: Ad;
  onClose: () => void;
  onSaved: (updated: Ad) => void;
}) {
  // Only fields our validator's PATCH schema accepts are editable — slot
  // and type stay locked (change those by deleting and re-adding).
  const [form, setForm] = useState({
    embedCode: ad.embedCode ?? "",
    imageR2Key: ad.imageR2Key ?? "",
    linkUrl: ad.linkUrl ?? "",
    altText: ad.altText ?? "",
    networkZoneId: ad.networkZoneId ?? "",
    networkWidth: ad.networkWidth?.toString() ?? "",
    networkHeight: ad.networkHeight?.toString() ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    const body: Record<string, unknown> = {};
    if (ad.type === "embed") body.embedCode = form.embedCode;
    else if (ad.type === "banner") {
      body.imageR2Key = form.imageR2Key;
      body.linkUrl = form.linkUrl ? form.linkUrl : null;
      body.altText = form.altText ? form.altText : null;
    } else {
      body.networkZoneId = form.networkZoneId;
      body.networkWidth = form.networkWidth ? Number(form.networkWidth) : null;
      body.networkHeight = form.networkHeight ? Number(form.networkHeight) : null;
    }
    const res = await fetch(`/api/tenants/${tenantId}/ads/${ad.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(json.error ?? "error");
      return;
    }
    onSaved(json.ad);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-background p-5 shadow-2xl">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-base font-semibold">
            แก้ไขโฆษณา — <span className="text-muted-foreground">{ad.slot}</span>
          </h3>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${AD_TYPE_CHIP[ad.type as AdType] ?? ""}`}
          >
            {AD_TYPE_SHORT[ad.type as AdType] ?? ad.type}
          </span>
        </div>

        <div className="space-y-3">
          {ad.type === "embed" && (
            <div>
              <Label>Embed HTML/JS</Label>
              <textarea
                className="w-full rounded border bg-background p-2 font-mono text-xs"
                rows={8}
                value={form.embedCode}
                onChange={(e) => setForm({ ...form, embedCode: e.target.value })}
              />
            </div>
          )}
          {ad.type === "banner" && (
            <>
              <div>
                <Label>รูปโฆษณา</Label>
                <UploadField
                  folder="tenant-ads"
                  value={form.imageR2Key || null}
                  onChange={(k) => setForm({ ...form, imageR2Key: k ?? "" })}
                />
              </div>
              <div>
                <Label>ลิงก์ (กดที่รูปแล้วเปิด)</Label>
                <Input
                  placeholder="https://example.com"
                  value={form.linkUrl}
                  onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  ต้องเป็นลิงก์เต็ม (http:// หรือ https://) — เว้นว่างถ้าไม่อยากให้กดได้
                </p>
              </div>
              <div>
                <Label>Alt text</Label>
                <Input
                  value={form.altText}
                  onChange={(e) => setForm({ ...form, altText: e.target.value })}
                />
              </div>
            </>
          )}
          {(ad.type === "galaksion" || ad.type === "aads") && (
            <>
              <div>
                <Label>{ad.type === "galaksion" ? "Galaksion zone id" : "A-Ads unit id"}</Label>
                <Input
                  value={form.networkZoneId}
                  onChange={(e) => setForm({ ...form, networkZoneId: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Width (px, optional)</Label>
                  <Input
                    value={form.networkWidth}
                    onChange={(e) => setForm({ ...form, networkWidth: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Height (px, optional)</Label>
                  <Input
                    value={form.networkHeight}
                    onChange={(e) => setForm({ ...form, networkHeight: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}
          {err && <p className="text-sm text-red-500">{err}</p>}
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
