"use client";

import { useState, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kodhom/ui/components/select";
import { Pencil, Trash2, Upload } from "lucide-react";

interface Clip {
  id: string;
  title: string;
  accessLevel: "member" | "vip";
  categoryId: string;
  r2Key: string;
  duration: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
}

interface Category {
  id: string;
  name: string;
}

export function ClipList({
  clips,
  categories,
}: {
  clips: Clip[];
  categories: Category[];
}) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<Clip | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    categoryId: "",
    accessLevel: "member" as "member" | "vip",
    r2Key: "",
    duration: 0,
    isActive: true,
    sortOrder: 0,
  });
  const [loading, setLoading] = useState(false);

  function openCreate() {
    setEditItem(null);
    setForm({
      title: "",
      categoryId: categories[0]?.id ?? "",
      accessLevel: "member",
      r2Key: "",
      duration: 0,
      isActive: true,
      sortOrder: 0,
    });
    setShowDialog(true);
  }

  function openEdit(clip: Clip) {
    setEditItem(clip);
    setForm({
      title: clip.title,
      categoryId: clip.categoryId,
      accessLevel: clip.accessLevel,
      r2Key: clip.r2Key,
      duration: clip.duration ?? 0,
      isActive: clip.isActive,
      sortOrder: clip.sortOrder,
    });
    setShowDialog(true);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Get presigned upload URL
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, folder: "clips" }),
      });
      const { url, key } = await res.json();

      // Upload directly to R2
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      setForm((f) => ({ ...f, r2Key: key }));
    } catch {
      alert("อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setLoading(true);
    try {
      const url = editItem ? `/api/clips/${editItem.id}` : "/api/clips";
      const method = editItem ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setShowDialog(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("ยืนยันการลบ?")) return;
    const res = await fetch(`/api/clips/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "ลบไม่สำเร็จ");
      return;
    }
    router.refresh();
  }

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <>
      <div className="mb-4">
        <Button onClick={openCreate} className="gap-2 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20">
          เพิ่มคลิป
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ชื่อ</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">หมวดหมู่</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ระดับ</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">สถานะ</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {clips.map((clip) => (
                <tr key={clip.id} className="border-b border-border/40 transition-colors duration-150 hover:bg-accent/50">
                  <td className="px-4 py-3 font-medium text-foreground">{clip.title}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {categoryMap.get(clip.categoryId) ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={clip.accessLevel === "vip" ? "vip" : "secondary"}
                      className={
                        clip.accessLevel === "vip"
                          ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/20"
                          : "bg-blue-500/15 text-blue-400 hover:bg-blue-500/20"
                      }
                    >
                      {clip.accessLevel.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <Badge variant={clip.isActive ? "default" : "secondary"} className={clip.isActive ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20" : ""}>
                      {clip.isActive ? "เปิด" : "ปิด"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground transition-colors hover:text-primary" onClick={() => openEdit(clip)} title="แก้ไข">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground transition-colors hover:text-destructive" onClick={() => handleDelete(clip.id)} title="ลบ">
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
            <DialogTitle className="text-lg font-semibold">{editItem ? "แก้ไขคลิป" : "เพิ่มคลิป"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">ชื่อคลิป</Label>
              <Input
                value={form.title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, title: e.target.value })}
                className="bg-input/50 transition-colors focus:bg-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">หมวดหมู่</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm({ ...form, categoryId: v })}
              >
                <SelectTrigger className="bg-input/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">ระดับการเข้าถึง</Label>
              <Select
                value={form.accessLevel}
                onValueChange={(v) =>
                  setForm({ ...form, accessLevel: v as "member" | "vip" })
                }
              >
                <SelectTrigger className="bg-input/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">ไฟล์วิดีโอ</Label>
              <div className="flex gap-2">
                <Input
                  value={form.r2Key}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, r2Key: e.target.value })}
                  placeholder="R2 key"
                  className="flex-1 bg-input/50 font-mono text-xs transition-colors focus:bg-input"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-1.5 border-dashed transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "กำลังอัปโหลด..." : "อัปโหลด"}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">ความยาว (วินาที)</Label>
                <Input
                  type="number"
                  value={form.duration}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm({ ...form, duration: parseFloat(e.target.value) || 0 })
                  }
                  className="bg-input/50 tabular-nums transition-colors focus:bg-input"
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
                  className="bg-input/50 tabular-nums transition-colors focus:bg-input"
                />
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, isActive: e.target.checked })}
                id="clipActive"
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="clipActive" className="text-sm">เปิดใช้งาน</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)} className="transition-colors">
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={loading} className="transition-all duration-200">
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
