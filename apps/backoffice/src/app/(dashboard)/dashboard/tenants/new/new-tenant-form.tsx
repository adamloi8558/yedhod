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
