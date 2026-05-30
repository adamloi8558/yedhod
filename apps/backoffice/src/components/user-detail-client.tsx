"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  Ban,
  Trash2,
  KeyRound,
  Crown,
  LogOut,
  UserCog,
  Sparkles,
} from "lucide-react";
import { Button } from "@kodhom/ui/components/button";
import { Input } from "@kodhom/ui/components/input";
import { Label } from "@kodhom/ui/components/label";
import { Badge } from "@kodhom/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kodhom/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kodhom/ui/components/select";
import { formatCurrency, formatThaiDate } from "@kodhom/ui/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
  role: "member" | "vip" | "admin";
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  createdAt: string;
}
interface Subscription {
  id: string;
  status: "active" | "expired" | "cancelled";
  startDate: string;
  endDate: string | null;
  amountPaid: string | null;
  planName: string | null;
}
interface SessionItem {
  id: string;
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
  createdAt: string;
}
interface PricingPlan {
  id: string;
  name: string;
  durationDays: number;
  priceThb: string;
}
interface AuditEntry {
  id: string;
  action: string;
  metadata: unknown;
  createdAt: string;
}

export function UserDetailClient({
  user,
  subs,
  sessions,
  plans,
  audit,
  currentAdminId,
}: {
  user: User;
  subs: Subscription[];
  sessions: SessionItem[];
  plans: PricingPlan[];
  audit: AuditEntry[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  // Dialogs
  const [grantOpen, setGrantOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  const isSelf = user.id === currentAdminId;

  async function api(path: string, init?: RequestInit) {
    setBusy(true);
    try {
      const res = await fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } finally {
      setBusy(false);
    }
  }

  function reload() {
    startTransition(() => router.refresh());
  }

  async function extendSub(subId: string, days: number) {
    try {
      await api(`/api/subscriptions/${subId}`, {
        method: "PUT",
        body: JSON.stringify({ extendDays: days }),
      });
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  async function cancelSub(subId: string) {
    if (!confirm("ยกเลิก subscription นี้?")) return;
    try {
      await api(`/api/subscriptions/${subId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "cancelled" }),
      });
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  async function revokeSession(token: string) {
    if (!confirm("เตะ session นี้?")) return;
    try {
      await api(`/api/users/${user.id}/sessions/${encodeURIComponent(token)}`, { method: "DELETE" });
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  async function revokeAllSessions() {
    if (!confirm("เตะทุก session ของผู้ใช้นี้?")) return;
    try {
      await api(`/api/users/${user.id}/sessions`, { method: "DELETE" });
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  async function unban() {
    try {
      await api(`/api/users/${user.id}/unban`, { method: "POST" });
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  async function impersonate() {
    if (!confirm("Login เป็นผู้ใช้นี้? (admin session จะถูกแทน — ใช้ปุ่ม Stop impersonating ที่หน้าเว็บเพื่อกลับ)")) return;
    try {
      const data = await api(`/api/users/${user.id}/impersonate`, { method: "POST" });
      if (data.redirect) window.location.href = data.redirect;
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {user.name}
            </h1>
            {user.banned && (
              <Badge variant="secondary" className="bg-rose-500/15 text-rose-400">
                🚫 BANNED
              </Badge>
            )}
            <Badge
              variant="secondary"
              className={
                user.role === "admin"
                  ? "bg-red-500/15 text-red-400"
                  : user.role === "vip"
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-blue-500/15 text-blue-400"
              }
            >
              {user.role.toUpperCase()}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.email} · สมัครเมื่อ {formatThaiDate(new Date(user.createdAt))}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/users")}>
          ← กลับ
        </Button>
      </div>

      {/* 1. Profile */}
      <Section title="โปรไฟล์" icon={UserCog}>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditProfileOpen(true)}>
            แก้ไขชื่อ / อีเมล
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPwdOpen(true)}>
            <KeyRound className="mr-1.5 h-3.5 w-3.5" />
            รีเซ็ตรหัสผ่าน
          </Button>
          {!isSelf && (
            <Button size="sm" variant="outline" onClick={impersonate} disabled={busy}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Login เป็นผู้ใช้นี้
            </Button>
          )}
        </div>
      </Section>

      {/* 2. VIP / Subscriptions */}
      <Section
        title="VIP / Subscription"
        icon={Crown}
        action={
          <Button size="sm" onClick={() => setGrantOpen(true)}>
            + ให้ VIP
          </Button>
        }
      >
        {subs.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มี subscription</p>
        ) : (
          <div className="space-y-2">
            {subs.map((s) => {
              const isActive =
                s.status === "active" &&
                (!s.endDate || new Date(s.endDate) > new Date());
              return (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/40 p-3 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {s.planName ?? "—"}
                      <span className="ml-2 text-xs text-muted-foreground">({s.status})</span>
                      {isActive && (
                        <Badge variant="secondary" className="ml-2 bg-emerald-500/15 text-emerald-400">
                          active
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatThaiDate(new Date(s.startDate))} → {s.endDate ? formatThaiDate(new Date(s.endDate)) : "ตลอดชีพ"}
                      {s.amountPaid && ` · ${formatCurrency(s.amountPaid)}`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => extendSub(s.id, 30)} disabled={busy}>
                      +30 วัน
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => extendSub(s.id, 7)} disabled={busy}>
                      +7 วัน
                    </Button>
                    {s.status !== "cancelled" && (
                      <Button size="sm" variant="outline" className="h-8 text-rose-400 hover:text-rose-300" onClick={() => cancelSub(s.id)} disabled={busy}>
                        ยกเลิก
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* 3. Sessions */}
      <Section
        title={`อุปกรณ์ที่ล็อกอินอยู่ (${sessions.length})`}
        icon={LogOut}
        action={
          sessions.length > 0 ? (
            <Button size="sm" variant="outline" onClick={revokeAllSessions} disabled={busy}>
              เตะทุกเครื่อง
            </Button>
          ) : undefined
        }
      >
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มี session ที่ active</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/40 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted-foreground">{s.userAgent ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.ipAddress ?? "—"} · หมดอายุ {formatThaiDate(new Date(s.expiresAt))}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-8" onClick={() => revokeSession(s.token)} disabled={busy}>
                  เตะ
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 4. Danger zone */}
      <Section title="Danger zone" icon={ShieldAlert} tone="danger">
        <div className="flex flex-wrap gap-2">
          {user.banned ? (
            <Button size="sm" variant="outline" onClick={unban} disabled={busy}>
              ยกเลิกแบน
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="text-amber-400 hover:text-amber-300" onClick={() => setBanOpen(true)} disabled={isSelf}>
              <Ban className="mr-1.5 h-3.5 w-3.5" />
              แบนผู้ใช้
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-rose-400 hover:text-rose-300" onClick={() => setDeleteOpen(true)} disabled={isSelf}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            ลบผู้ใช้
          </Button>
          {isSelf && (
            <p className="w-full text-xs text-muted-foreground">⚠ บัญชีของคุณเอง — แบน/ลบไม่ได้</p>
          )}
        </div>
      </Section>

      {/* 5. Recent audit for this user */}
      {audit.length > 0 && (
        <Section title="ประวัติการดำเนินการล่าสุด" icon={UserCog}>
          <ul className="space-y-1.5 text-sm">
            {audit.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-md bg-card/40 px-3 py-2 text-xs">
                <span className="font-mono text-muted-foreground">{a.action}</span>
                <span className="text-muted-foreground">{formatThaiDate(new Date(a.createdAt))}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Dialogs */}
      <EditProfileDialog open={editProfileOpen} onClose={() => setEditProfileOpen(false)} user={user} api={api} reload={reload} />
      <GrantVipDialog open={grantOpen} onClose={() => setGrantOpen(false)} userId={user.id} plans={plans} api={api} reload={reload} />
      <BanDialog open={banOpen} onClose={() => setBanOpen(false)} userId={user.id} api={api} reload={reload} />
      <PasswordDialog open={pwdOpen} onClose={() => setPwdOpen(false)} userId={user.id} api={api} />
      <DeleteUserDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} userId={user.id} userName={user.name} api={api} router={router} />
    </div>
  );
}

function Section({ title, icon: Icon, action, children, tone }: { title: string; icon: React.ComponentType<{ className?: string }>; action?: React.ReactNode; children: React.ReactNode; tone?: "danger" }) {
  return (
    <div className={`rounded-2xl border ${tone === "danger" ? "border-rose-500/30 bg-rose-500/5" : "border-border/50 bg-card/50"} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className={`h-4 w-4 ${tone === "danger" ? "text-rose-400" : "text-primary"}`} />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function EditProfileDialog({ open, onClose, user, api, reload }: { open: boolean; onClose: () => void; user: User; api: (p: string, i?: RequestInit) => Promise<unknown>; reload: () => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [loading, setLoading] = useState(false);
  async function save() {
    setLoading(true);
    try {
      await api(`/api/users/${user.id}`, { method: "PUT", body: JSON.stringify({ name, email }) });
      onClose();
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-border/60 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>แก้ไขโปรไฟล์</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">ชื่อ</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">อีเมล</Label>
            <Input value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} type="email" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save} disabled={loading}>{loading ? "กำลังบันทึก..." : "บันทึก"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GrantVipDialog({ open, onClose, userId, plans, api, reload }: { open: boolean; onClose: () => void; userId: string; plans: PricingPlan[]; api: (p: string, i?: RequestInit) => Promise<unknown>; reload: () => void }) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [customDays, setCustomDays] = useState("");
  const [loading, setLoading] = useState(false);
  async function save() {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (customDays && parseInt(customDays) > 0) {
        body.durationDays = parseInt(customDays);
      } else if (planId) {
        body.pricingPlanId = planId;
      } else {
        throw new Error("เลือกแพ็กเกจหรือกรอกจำนวนวัน");
      }
      await api(`/api/users/${userId}/subscription`, { method: "POST", body: JSON.stringify(body) });
      onClose();
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-border/60 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ให้ VIP</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">เลือกแพ็กเกจ</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="เลือกแพ็กเกจ" /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — {p.durationDays} วัน · {formatCurrency(p.priceThb)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">หรือกรอกจำนวนวันเอง (override)</Label>
            <Input type="number" value={customDays} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomDays(e.target.value)} placeholder="เช่น 30" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save} disabled={loading}>{loading ? "กำลังให้..." : "ให้ VIP"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BanDialog({ open, onClose, userId, api, reload }: { open: boolean; onClose: () => void; userId: string; api: (p: string, i?: RequestInit) => Promise<unknown>; reload: () => void }) {
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("");
  const [loading, setLoading] = useState(false);
  async function save() {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (reason) body.reason = reason;
      if (days && parseInt(days) > 0) body.banExpiresIn = parseInt(days) * 24 * 60 * 60;
      await api(`/api/users/${userId}/ban`, { method: "POST", body: JSON.stringify(body) });
      onClose();
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-border/60 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>แบนผู้ใช้</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">เหตุผล (ผู้ใช้จะเห็น)</Label>
            <Input value={reason} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value)} placeholder="เช่น ละเมิดเงื่อนไข" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ระยะเวลา (วัน) — ว่าง = ถาวร</Label>
            <Input type="number" value={days} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDays(e.target.value)} placeholder="ว่าง = ถาวร" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save} disabled={loading} className="bg-amber-500 hover:bg-amber-600">{loading ? "..." : "แบน"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ open, onClose, userId, api }: { open: boolean; onClose: () => void; userId: string; api: (p: string, i?: RequestInit) => Promise<unknown> }) {
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  async function save() {
    if (pwd.length < 8) { alert("รหัสผ่านอย่างน้อย 8 ตัวอักษร"); return; }
    setLoading(true);
    try {
      await api(`/api/users/${userId}/password`, { method: "POST", body: JSON.stringify({ newPassword: pwd }) });
      alert("เปลี่ยนรหัสผ่านสำเร็จ");
      setPwd("");
      onClose();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-border/60 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>รีเซ็ตรหัสผ่าน</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</Label>
            <Input type="text" value={pwd} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPwd(e.target.value)} placeholder="พิมพ์รหัสใหม่" />
            <p className="text-[11px] text-muted-foreground">เก็บไว้ส่งให้ผู้ใช้เอง — ระบบไม่ส่งอีเมล</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save} disabled={loading}>{loading ? "..." : "ตั้งรหัสใหม่"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({ open, onClose, userId, userName, api, router }: { open: boolean; onClose: () => void; userId: string; userName: string; api: (p: string, i?: RequestInit) => Promise<unknown>; router: ReturnType<typeof useRouter> }) {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  async function go() {
    if (confirm !== "DELETE") return;
    setLoading(true);
    try {
      await api(`/api/users/${userId}`, { method: "DELETE" });
      router.push("/dashboard/users");
    } catch (e) {
      alert((e as Error).message);
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-rose-500/40 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-rose-400">ลบผู้ใช้</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <p>กำลังจะลบ <span className="font-semibold">{userName}</span> ถาวร — ข้อมูล subscription / payments จะลบตามด้วย ทำต่อไหม?</p>
          <div className="space-y-1.5">
            <Label className="text-xs">พิมพ์ <span className="font-mono">DELETE</span> เพื่อยืนยัน</Label>
            <Input value={confirm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)} placeholder="DELETE" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={go} disabled={loading || confirm !== "DELETE"} className="bg-rose-500 text-white hover:bg-rose-600">
            {loading ? "..." : "ลบถาวร"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
