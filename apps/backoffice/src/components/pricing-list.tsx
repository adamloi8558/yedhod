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
import { Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@kodhom/ui/lib/utils";

interface Plan {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  durationDays: number;
  priceThb: string;
  maxDevices: number;
  isActive: boolean;
  sortOrder: number;
}

interface Category {
  id: string;
  name: string;
}

export function PricingList({
  plans,
  categories,
}: {
  plans: Plan[];
  categories: Category[];
}) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<Plan | null>(null);
  const [form, setForm] = useState({
    categoryId: "",
    name: "",
    slug: "",
    durationDays: 30,
    priceThb: "0",
    maxDevices: 1,
    isActive: true,
    sortOrder: 0,
  });
  const [loading, setLoading] = useState(false);

  function openCreate() {
    setEditItem(null);
    setForm({
      categoryId: categories[0]?.id ?? "",
      name: "",
      slug: "",
      durationDays: 30,
      priceThb: "0",
      maxDevices: 1,
      isActive: true,
      sortOrder: 0,
    });
    setShowDialog(true);
  }

  function openEdit(plan: Plan) {
    setEditItem(plan);
    setForm({
      categoryId: plan.categoryId,
      name: plan.name,
      slug: plan.slug,
      durationDays: plan.durationDays,
      priceThb: plan.priceThb,
      maxDevices: plan.maxDevices,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
    });
    setShowDialog(true);
  }

  async function handleSave() {
    setLoading(true);
    try {
      const url = editItem ? `/api/pricing/${editItem.id}` : "/api/pricing";
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
    const res = await fetch(`/api/pricing/${id}`, { method: "DELETE" });
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
          เพิ่มแพ็กเกจ
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ชื่อ</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">หมวดหมู่</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ราคา</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">ระยะเวลา</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">อุปกรณ์</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">สถานะ</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b border-border/40 transition-colors duration-150 hover:bg-accent/50">
                  <td className="px-4 py-3 font-medium text-foreground">{plan.name}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {categoryMap.get(plan.categoryId) ?? "-"}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-foreground">{formatCurrency(plan.priceThb)}</td>
                  <td className="hidden px-4 py-3 tabular-nums text-muted-foreground sm:table-cell">{plan.durationDays} วัน</td>
                  <td className="hidden px-4 py-3 tabular-nums text-muted-foreground lg:table-cell">{plan.maxDevices}</td>
                  <td className="px-4 py-3">
                    <Badge variant={plan.isActive ? "default" : "secondary"} className={plan.isActive ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20" : ""}>
                      {plan.isActive ? "เปิด" : "ปิด"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground transition-colors hover:text-primary" onClick={() => openEdit(plan)} title="แก้ไข">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground transition-colors hover:text-destructive" onClick={() => handleDelete(plan.id)} title="ลบ">
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
        <DialogContent className="border-border/60 bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{editItem ? "แก้ไขแพ็กเกจ" : "เพิ่มแพ็กเกจ"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">ราคา (บาท)</Label>
                <Input
                  value={form.priceThb}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, priceThb: e.target.value })}
                  className="bg-input/50 tabular-nums transition-colors focus:bg-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">ระยะเวลา (วัน)</Label>
                <Input
                  type="number"
                  value={form.durationDays}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm({ ...form, durationDays: parseInt(e.target.value) || 0 })
                  }
                  className="bg-input/50 tabular-nums transition-colors focus:bg-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">อุปกรณ์สูงสุด</Label>
                <Input
                  type="number"
                  value={form.maxDevices}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm({ ...form, maxDevices: parseInt(e.target.value) || 1 })
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
                id="planActive"
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="planActive" className="text-sm">เปิดใช้งาน</Label>
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
