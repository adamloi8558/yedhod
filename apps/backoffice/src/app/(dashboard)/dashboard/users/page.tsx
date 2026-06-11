"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Badge } from "@kodhom/ui/components/badge";
import { Input } from "@kodhom/ui/components/input";
import { Button } from "@kodhom/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kodhom/ui/components/select";
import { Search, ChevronLeft, ChevronRight, Crown, Ban, LogOut, Trash2, X } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "member" | "vip" | "admin";
  banned: boolean;
  createdAt: string;
  vipUntil: string | null;
  vipLifetime: boolean;
  isVipActive: boolean;
}

function UsersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(q);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (page > 1) params.set("page", String(page));
      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setSelected(new Set()); // reset on reload
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => {
    load();
  }, [load]);

  function go(nextPage: number, nextQuery: string) {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    router.push(qs ? `/dashboard/users?${qs}` : "/dashboard/users");
  }

  async function changeRole(userId: string, role: string) {
    const res = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, role }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "เปลี่ยนสถานะไม่สำเร็จ");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: role as User["role"] } : u))
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === users.length) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.id)));
  }

  async function bulk(action: "ban" | "unban" | "delete" | "revoke_sessions" | "grant_vip") {
    const ids = [...selected];
    if (ids.length === 0) return;
    const labels: Record<typeof action, string> = {
      ban: "แบน", unban: "ยกเลิกแบน", delete: "ลบ",
      revoke_sessions: "เตะ session", grant_vip: "ให้ VIP",
    };
    let params: Record<string, unknown> | undefined;
    if (action === "ban") {
      const reason = prompt(`เหตุผลในการแบน ${ids.length} คน (ปล่อยว่างได้)`) ?? "";
      params = { reason };
    }
    if (action === "grant_vip") {
      const days = prompt("ให้ VIP กี่วัน? (ใช้แพ็กเกจ default ถ้าว่าง)");
      if (days) params = { durationDays: parseInt(days) || 30 };
    }
    if (!confirm(`ยืนยัน ${labels[action]} ${ids.length} คน?`)) return;

    setBulkBusy(true);
    try {
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids, params }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "bulk ไม่สำเร็จ");
      alert(`เสร็จ: สำเร็จ ${data.success} / ล้มเหลว ${data.fail}`);
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">จัดการผู้ใช้</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Users Management · {total.toLocaleString()} คน
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          onSubmit={(e) => { e.preventDefault(); go(1, search.trim()); }}
          className="relative w-full sm:max-w-xs"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / อีเมล..."
            className="h-9 bg-input/50 pl-9"
          />
        </form>
        {totalPages > 1 && (
          <Pager page={page} totalPages={totalPages} onGo={(p) => go(p, q)} />
        )}
      </div>

      {/* Bulk action toolbar — visible when something is selected */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
          <span className="font-medium">เลือก {selected.size} คน:</span>
          <Button size="sm" variant="outline" className="h-8" onClick={() => bulk("grant_vip")} disabled={bulkBusy}>
            <Crown className="mr-1.5 h-3.5 w-3.5" />ให้ VIP
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => bulk("revoke_sessions")} disabled={bulkBusy}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" />เตะ session
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-amber-400 hover:text-amber-300" onClick={() => bulk("ban")} disabled={bulkBusy}>
            <Ban className="mr-1.5 h-3.5 w-3.5" />แบน
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => bulk("unban")} disabled={bulkBusy}>
            ยกเลิกแบน
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-rose-400 hover:text-rose-300" onClick={() => bulk("delete")} disabled={bulkBusy}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />ลบ
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto h-8" onClick={() => setSelected(new Set())}>
            <X className="mr-1 h-3.5 w-3.5" />ยกเลิกเลือก
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          กำลังโหลด...
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="w-8 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={users.length > 0 && selected.size === users.length}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ชื่อ</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">อีเมล</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">VIP จริง</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">บทบาท</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">วันที่สมัคร</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={`border-b border-border/40 transition-colors duration-150 hover:bg-accent/50 ${selected.has(user.id) ? "bg-primary/5" : ""}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(user.id)}
                        onChange={() => toggle(user.id)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/users/${user.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {user.name}
                      </Link>
                      <p className="text-xs text-muted-foreground md:hidden">{user.email}</p>
                      {user.banned && (
                        <Badge variant="secondary" className="ml-2 bg-rose-500/15 text-rose-400">🚫 BANNED</Badge>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">{user.email}</td>
                    <td className="px-4 py-3">
                      <VipCell user={user} />
                    </td>
                    <td className="px-4 py-3">
                      <Select value={user.role} onValueChange={(v) => changeRole(user.id, v)}>
                        <SelectTrigger className="h-8 w-28 bg-input/50 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="vip">VIP</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="hidden px-4 py-3 text-sm tabular-nums text-muted-foreground sm:table-cell">
                      {new Date(user.createdAt).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      ไม่พบผู้ใช้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <Pager page={page} totalPages={totalPages} onGo={(p) => go(p, q)} />
        </div>
      )}
    </div>
  );
}

function VipCell({ user }: { user: User }) {
  if (user.isVipActive) {
    return (
      <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-400">
        <Crown className="h-3 w-3" />
        {user.vipLifetime
          ? "VIP ตลอดชีพ"
          : `ถึง ${user.vipUntil ? new Date(user.vipUntil).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) : "-"}`}
      </Badge>
    );
  }
  if (user.role === "vip") {
    return <Badge variant="secondary" className="bg-rose-500/15 text-rose-400">หมดอายุ</Badge>;
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

function Pager({ page, totalPages, onGo }: { page: number; totalPages: number; onGo: (p: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="h-9 gap-1 px-3" disabled={page <= 1} onClick={() => onGo(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
        ก่อนหน้า
      </Button>
      <span className="text-sm tabular-nums text-muted-foreground">{page} / {totalPages}</span>
      <Button variant="outline" size="sm" className="h-9 gap-1 px-3" disabled={page >= totalPages} onClick={() => onGo(page + 1)}>
        ถัดไป
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">กำลังโหลด...</div>}>
      <UsersInner />
    </Suspense>
  );
}
