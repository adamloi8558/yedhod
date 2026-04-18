"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@kodhom/ui/components/button";
import { Input } from "@kodhom/ui/components/input";
import { Label } from "@kodhom/ui/components/label";
import { Badge } from "@kodhom/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@kodhom/ui/components/dialog";
import { Pencil, Trash2, Upload } from "lucide-react";
import { nanoid } from "@/lib/nanoid";

interface Banner {
  id: string;
  imageR2Key: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
  previewUrl?: string;
}

export function BannerList({ initialBanners }: { initialBanners: Banner[] }) {
  const router = useRouter();
  const [banners, setBanners] = useState<Banner[]>(initialBanners);
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<Banner | null>(null);
  const [form, setForm] = useState({
    imageR2Key: "",
    linkUrl: "",
    sortOrder: 0,
    isActive: true,
  });
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    setUploading(true);
    try {
      const presignRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, folder: "banners" }),
      });
      const { url, key } = await presignRes.json();
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      setForm((f) => ({ ...f, imageR2Key: key }));
      setPreviewUrl(URL.createObjectURL(file));
    } catch {
      alert("อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  function openCreate() {
    setEditItem(null);
    setForm({ imageR2Key: "", linkUrl: "", sortOrder: 0, isActive: true });
    setPreviewUrl(undefined);
    setShowDialog(true);
  }

  function openEdit(b: Banner) {
    setEditItem(b);
    setForm({
      imageR2Key: b.imageR2Key,
      linkUrl: b.linkUrl,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
    });
    setPreviewUrl(b.previewUrl);
    setShowDialog(true);
  }

  async function persist(next: Banner[]) {
    const stripped = next.map(({ previewUrl: _omit, ...rest }) => rest);
    const res = await fetch("/api/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stripped),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error?.formErrors?.join(", ") ?? "บันทึกไม่สำเร็จ");
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!form.imageR2Key) {
      alert("กรุณาอัปโหลดรูป");
      return;
    }
    if (!form.linkUrl) {
      alert("กรุณากรอกลิงก์");
      return;
    }
    setSaving(true);
    try {
      const next: Banner[] = editItem
        ? banners.map((b) =>
            b.id === editItem.id ? { ...b, ...form, previewUrl } : b
          )
        : [
            ...banners,
            { id: nanoid(), ...form, previewUrl },
          ];
      const ok = await persist(next);
      if (!ok) return;
      setBanners(next);
      setShowDialog(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("ยืนยันการลบ?")) return;
    const res = await fetch(`/api/banners/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("ลบไม่สำเร็จ");
      return;
    }
    setBanners((prev) => prev.filter((b) => b.id !== id));
    router.refresh();
  }

  return (
    <>
      <div className="mb-4">
        <Button
          onClick={openCreate}
          className="gap-2 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20"
        >
          เพิ่ม Banner
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ภาพ
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ลิงก์
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                  ลำดับ
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  สถานะ
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody>
              {banners.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    ยังไม่มีแบนเนอร์
                  </td>
                </tr>
              )}
              {banners.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-border/40 transition-colors duration-150 hover:bg-accent/50"
                >
                  <td className="px-4 py-3">
                    {b.previewUrl ? (
                      <img
                        src={b.previewUrl}
                        alt="banner"
                        className="h-12 w-24 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-12 w-24 rounded-md bg-muted/40" />
                    )}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-muted-foreground">
                    {b.linkUrl}
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums text-muted-foreground sm:table-cell">
                    {b.sortOrder}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={b.isActive ? "default" : "secondary"}
                      className={
                        b.isActive
                          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20"
                          : ""
                      }
                    >
                      {b.isActive ? "เปิด" : "ปิด"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground transition-colors hover:text-primary"
                        onClick={() => openEdit(b)}
                        title="แก้ไข"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground transition-colors hover:text-destructive"
                        onClick={() => handleDelete(b.id)}
                        title="ลบ"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="border-border/60 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {editItem ? "แก้ไข Banner" : "เพิ่ม Banner"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">รูปภาพ</Label>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="preview"
                  className="h-32 w-full rounded-lg object-cover"
                />
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => document.getElementById("banner-upload")?.click()}
                  className="gap-2 border-dashed transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "กำลังอัปโหลด..." : previewUrl ? "เปลี่ยนรูป" : "เลือกรูป"}
                </Button>
                <input
                  id="banner-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">ลิงก์ปลายทาง (URL)</Label>
              <Input
                placeholder="https://..."
                value={form.linkUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm({ ...form, linkUrl: e.target.value })
                }
                className="bg-input/50 transition-colors focus:bg-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">ลำดับ</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })
                }
                className="w-24 bg-input/50 tabular-nums transition-colors focus:bg-input"
              />
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
                id="bannerActive"
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="bannerActive" className="text-sm">
                เปิดใช้งาน
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              className="transition-colors"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="transition-all duration-200"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
