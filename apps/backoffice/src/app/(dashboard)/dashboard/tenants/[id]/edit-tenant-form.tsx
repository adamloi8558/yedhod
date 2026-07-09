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
  networkZoneId: string | null;
  networkWidth: number | null;
  networkHeight: number | null;
  sortOrder: number;
  isActive: boolean;
};

const AD_SLOT_OPTIONS = [
  "header_top",
  "header_bottom",
  "sidebar_top",
  "sidebar_mid",
  "sidebar_bot",
  "in_feed_1",
  "in_feed_2",
  "in_feed_3",
  "before_video",
  "after_video",
  "under_title",
  "popunder",
  "footer_top",
  "footer_bottom",
  "sticky_bottom",
];

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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">เลือกได้เฉพาะหมวดหมู่ระดับ member (คลิปฟรี)</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
        {memberCategories.map((c) => (
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

  function preview(a: Ad): string {
    if (a.type === "embed") return (a.embedCode ?? "").slice(0, 60) + "...";
    if (a.type === "banner") return a.imageR2Key ?? "";
    return `zone ${a.networkZoneId ?? ""} ${a.networkWidth ?? ""}x${a.networkHeight ?? ""}`;
  }

  const grouped: Record<string, Ad[]> = {};
  for (const a of ads) (grouped[a.slot] ??= []).push(a);

  return (
    <div className="space-y-6">
      <div className="rounded border p-4">
        <h3 className="mb-3 font-medium">โฆษณาทั้งหมด (จัดกลุ่มตาม Slot)</h3>
        {AD_SLOT_OPTIONS.map((slot) => (
          <div key={slot} className="mb-4">
            <h4 className="mb-1 font-mono text-xs text-muted-foreground">{slot}</h4>
            <table className="w-full text-sm">
              <tbody>
                {(grouped[slot] ?? []).map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="py-2 w-20 text-xs">{a.type}</td>
                    <td className="py-2 text-xs text-muted-foreground">{preview(a)}</td>
                    <td className="py-2 w-24 text-right">
                      <label className="mr-2 inline-flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={a.isActive}
                          onChange={(e) => toggle(a.id, e.target.checked)}
                        />
                        on
                      </label>
                    </td>
                    <td className="py-2 w-16 text-right">
                      <Button variant="outline" size="sm" onClick={() => del(a.id)}>
                        ลบ
                      </Button>
                    </td>
                  </tr>
                ))}
                {(grouped[slot] ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-1 text-xs text-muted-foreground">
                      —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
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
              {AD_SLOT_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Type</Label>
            <select
              className="w-full rounded border bg-background p-2"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
            >
              <option value="galaksion">Galaksion (zone id)</option>
              <option value="aads">A-Ads (unit id)</option>
              <option value="banner">Banner รูปของตัวเอง</option>
              <option value="embed">Embed HTML/JS อื่นๆ</option>
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
