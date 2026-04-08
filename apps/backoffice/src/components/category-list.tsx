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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kodhom/ui/components/select";
import { Pencil, Trash2, Upload } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  accessLevel: "member" | "vip";
  sortOrder: number;
  isActive: boolean;
}

export function CategoryList({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<Category | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    accessLevel: "member" as "member" | "vip",
    sortOrder: 0,
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    setUploadingCover(true);
    try {
      const presignRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, folder: "covers" }),
      });
      const { url, key } = await presignRes.json();
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      setCoverImage(key);
    } catch {
      alert("อัปโหลดไม่สำเร็จ");
    } finally {
      setUploadingCover(false);
    }
  }

  function openCreate() {
    setEditItem(null);
    setForm({ name: "", slug: "", description: "", accessLevel: "member" as const, sortOrder: 0, isActive: true });
    setCoverImage(null);
    setShowDialog(true);
  }

  function openEdit(cat: Category) {
    setEditItem(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      accessLevel: cat.accessLevel,
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
    });
    setCoverImage(cat.coverImage);
    setShowDialog(true);
  }

  async function handleSave() {
    setLoading(true);
    try {
      const url = editItem
        ? `/api/categories/${editItem.id}`
        : "/api/categories";
      const method = editItem ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, coverImage }),
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
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "ลบไม่สำเร็จ");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="mb-4">
        <Button onClick={openCreate} className="gap-2 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20">
          เพิ่มหมวดหมู่
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ชื่อ</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Slug</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">ระดับ</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">ลำดับ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">สถานะ</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-border/40 transition-colors duration-150 hover:bg-accent/50">
                  <td className="px-4 py-3 font-medium text-foreground">{cat.name}</td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground md:table-cell">{cat.slug}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <Badge variant="secondary" className={cat.accessLevel === "vip" ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/20" : "bg-blue-500/15 text-blue-400 hover:bg-blue-500/20"}>
                      {cat.accessLevel === "vip" ? "VIP" : "Member"}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums text-muted-foreground sm:table-cell">{cat.sortOrder}</td>
                  <td className="px-4 py-3">
                    <Badge variant={cat.isActive ? "default" : "secondary"} className={cat.isActive ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20" : ""}>
                      {cat.isActive ? "เปิด" : "ปิด"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground transition-colors hover:text-primary" onClick={() => openEdit(cat)} title="แก้ไข">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground transition-colors hover:text-destructive" onClick={() => handleDelete(cat.id)} title="ลบ">
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
              {editItem ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">ชื่อ</Label>
              <Input
                value={form.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })}
                className="bg-input/50 transition-colors focus:bg-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Slug</Label>
              <Input
                value={form.slug}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, slug: e.target.value })}
                className="bg-input/50 font-mono text-sm transition-colors focus:bg-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">คำอธิบาย</Label>
              <Input
                value={form.description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, description: e.target.value })}
                className="bg-input/50 transition-colors focus:bg-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">ภาพหน้าปก</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingCover}
                  onClick={() => document.getElementById("cover-upload")?.click()}
                  className="gap-2 border-dashed transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingCover ? "กำลังอัปโหลด..." : "เลือกรูป"}
                </Button>
                {coverImage && (
                  <span className="max-w-[200px] truncate font-mono text-xs text-muted-foreground">
                    {coverImage}
                  </span>
                )}
                <input
                  id="cover-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">ระดับการเข้าถึง</Label>
              <Select
                value={form.accessLevel}
                onValueChange={(v) => setForm({ ...form, accessLevel: v as "member" | "vip" })}
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, isActive: e.target.checked })}
                id="isActive"
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="isActive" className="text-sm">เปิดใช้งาน</Label>
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
