"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
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
import { Search, ChevronLeft, ChevronRight, Crown } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "member" | "vip" | "admin";
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ชื่อ</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">อีเมล</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">VIP จริง</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">บทบาท</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">วันที่สมัคร</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border/40 transition-colors duration-150 hover:bg-accent/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{user.email}</p>
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
                      {new Date(user.createdAt).toLocaleDateString("th-TH")}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
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
          : `ถึง ${user.vipUntil ? new Date(user.vipUntil).toLocaleDateString("th-TH") : "-"}`}
      </Badge>
    );
  }
  // role says vip but no active subscription → expired/label-only
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
