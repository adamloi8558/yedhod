"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Banknote,
  UserPlus,
  CreditCard,
  Users as UsersIcon,
  Crown,
  Receipt,
  AlertTriangle,
  Clock,
  RefreshCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@kodhom/ui/components/card";
import { Badge } from "@kodhom/ui/components/badge";
import { formatCurrency } from "@kodhom/ui/lib/utils";
import { DateRangePicker, buildPreset, type DateRange } from "./date-range-picker";
import { RevenueChart, UsersVsPayersChart } from "./charts";

interface DashboardData {
  summary: {
    revenue: number;
    bills: number;
    newPayingCustomers: number;
    newSubs: number;
    newUsers: number;
    activeVip: number;
  };
  series: {
    dailyRevenue: { day: string; total: number; bills: number }[];
    usersVsPayers: { day: string; new_users: number; new_payers: number }[];
  };
  breakdowns: {
    paymentStatus: { status: string; count: number }[];
    revenueByPlan: { planName: string | null; total: number; bills: number }[];
  };
  attention: {
    pendingSlips: { id: string; amount: number; createdAt: string; userName: string | null; planName: string | null }[];
    paidNoVip: { userId: string; userName: string | null; email: string | null; lastPaidAt: string | null }[];
    expiringVip: { id: string; endDate: string | null; userName: string | null; email: string | null }[];
    sync: { syncFailed: number; lastSyncAt: string | null; postFailed: number };
  };
  catalog: {
    activeClips: number;
    vipClips: number;
    inactiveClips: number;
    emptyCategories: number;
  };
}

const STATUS_LABEL: Record<string, string> = {
  completed: "สำเร็จ",
  pending: "รอตรวจ",
  failed: "ล้มเหลว",
  expired: "หมดเวลา",
};

export function DashboardClient() {
  const [range, setRange] = useState<DateRange>(() => buildPreset("month"));
  const [activeKey, setActiveKey] = useState("month");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: DateRange) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: r.from.toISOString(),
        to: r.to.toISOString(),
      });
      const res = await fetch(`/api/dashboard?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  function handleChange(r: DateRange, key: string) {
    setActiveKey(key);
    setRange(r);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">แดชบอร์ด</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ภาพรวมธุรกิจ — {range.label}
            {loading && <span className="ml-2 animate-pulse">กำลังโหลด…</span>}
          </p>
        </div>
      </div>

      <DateRangePicker value={range} activeKey={activeKey} onChange={handleChange} />

      {/* A. Business Pulse */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="รายได้" icon={Banknote} color="text-emerald-400" bg="bg-emerald-500/10"
          value={data ? formatCurrency(data.summary.revenue) : "—"}
          sub={data ? `${data.summary.bills.toLocaleString()} รายการ` : undefined} />
        <StatCard label="ลูกค้าจ่ายเงินใหม่" icon={UserPlus} color="text-blue-400" bg="bg-blue-500/10"
          value={data ? data.summary.newPayingCustomers.toLocaleString() : "—"} />
        <StatCard label="สมัครสมาชิก (ใหม่)" icon={CreditCard} color="text-violet-400" bg="bg-violet-500/10"
          value={data ? data.summary.newSubs.toLocaleString() : "—"} />
        <StatCard label="ผู้ใช้สมัครใหม่" icon={UsersIcon} color="text-sky-400" bg="bg-sky-500/10"
          value={data ? data.summary.newUsers.toLocaleString() : "—"} />
        <StatCard label="VIP ใช้งานอยู่" icon={Crown} color="text-amber-400" bg="bg-amber-500/10"
          value={data ? data.summary.activeVip.toLocaleString() : "—"} sub="ปัจจุบัน" />
        <StatCard label="คลิป (เปิด)" icon={Receipt} color="text-rose-400" bg="bg-rose-500/10"
          value={data ? data.catalog.activeClips.toLocaleString() : "—"}
          sub={data ? `VIP ${data.catalog.vipClips}` : undefined} />
      </div>

      {/* B. Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="รายได้รายวัน">
          {data && <RevenueChart data={data.series.dailyRevenue} />}
        </Panel>
        <Panel title="ผู้ใช้ใหม่ vs จ่ายเงินใหม่">
          {data && <UsersVsPayersChart data={data.series.usersVsPayers} />}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="สถานะการชำระเงิน">
          <div className="flex flex-wrap gap-2">
            {data?.breakdowns.paymentStatus.length ? (
              data.breakdowns.paymentStatus.map((p) => (
                <div key={p.status} className="flex items-center gap-2 rounded-lg bg-card/60 px-3 py-2">
                  <Badge variant="secondary" className={statusClass(p.status)}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </Badge>
                  <span className="font-semibold tabular-nums">{p.count.toLocaleString()}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>
            )}
          </div>
        </Panel>
        <Panel title="รายได้แยกตามแพ็กเกจ">
          {data?.breakdowns.revenueByPlan.length ? (
            <div className="space-y-2">
              {data.breakdowns.revenueByPlan.map((p) => (
                <div key={p.planName ?? "?"} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{p.planName ?? "—"}</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(p.total)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">({p.bills})</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>
          )}
        </Panel>
      </div>

      {/* C. Needs attention (current) */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          รอจัดการ
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title={`สลิปรอตรวจ (${data?.attention.pendingSlips.length ?? 0})`}
            action={<Link href="/dashboard/payments" className="text-xs text-primary hover:underline">ดูทั้งหมด →</Link>}
          >
            {data?.attention.pendingSlips.length ? (
              <ul className="space-y-2">
                {data.attention.pendingSlips.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {s.userName ?? "—"} · <span className="text-muted-foreground">{s.planName ?? "—"}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{formatCurrency(s.amount)}</span>
                    <AgeBadge date={s.createdAt} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState label="ไม่มีสลิปรอตรวจ" />
            )}
          </Panel>

          <Panel title={`จ่ายแล้วแต่ไม่มี VIP (${data?.attention.paidNoVip.length ?? 0})`}>
            {data?.attention.paidNoVip.length ? (
              <ul className="space-y-2">
                {data.attention.paidNoVip.map((u) => (
                  <li key={u.userId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {u.userName ?? "—"} <span className="text-muted-foreground">{u.email ?? ""}</span>
                    </span>
                    <Badge variant="secondary" className="bg-rose-500/15 text-rose-400">ตรวจสอบ</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState label="ไม่มีรายการผิดปกติ" />
            )}
          </Panel>

          <Panel title={`VIP ใกล้หมดอายุ (${data?.attention.expiringVip.length ?? 0})`}>
            {data?.attention.expiringVip.length ? (
              <ul className="space-y-2">
                {data.attention.expiringVip.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {s.userName ?? "—"} <span className="text-muted-foreground">{s.email ?? ""}</span>
                    </span>
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <Clock className="h-3.5 w-3.5" />
                      {s.endDate ? new Date(s.endDate).toLocaleDateString("th-TH") : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState label="ไม่มี VIP ใกล้หมดอายุ" />
            )}
          </Panel>

          <Panel title="สถานะ Content Sync">
            <div className="space-y-2 text-sm">
              <Row label="ซิงค์ล้มเหลว" value={data?.attention.sync.syncFailed ?? 0} warn={(data?.attention.sync.syncFailed ?? 0) > 0} />
              <Row label="โพสต์ล้มเหลว" value={data?.attention.sync.postFailed ?? 0} warn={(data?.attention.sync.postFailed ?? 0) > 0} />
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5"><RefreshCcw className="h-3.5 w-3.5" /> ซิงค์ล่าสุด</span>
                <span>{data?.attention.sync.lastSyncAt ? new Date(data.attention.sync.lastSyncAt).toLocaleString("th-TH") : "—"}</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* D. Catalog health */}
      <Panel title="สถานะคลังคลิป">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="คลิปเปิด" value={data?.catalog.activeClips ?? 0} />
          <MiniStat label="คลิป VIP" value={data?.catalog.vipClips ?? 0} />
          <MiniStat label="คลิปปิด" value={data?.catalog.inactiveClips ?? 0} />
          <MiniStat label="หมวดไม่มีคลิป" value={data?.catalog.emptyCategories ?? 0} warn={(data?.catalog.emptyCategories ?? 0) > 0} />
        </div>
      </Panel>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>; color: string; bg: string;
}) {
  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={warn ? "font-semibold text-rose-400" : "font-semibold tabular-nums"}>{value.toLocaleString()}</span>
    </div>
  );
}

function MiniStat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-card/60 p-3 text-center">
      <p className={`text-xl font-bold tabular-nums ${warn ? "text-rose-400" : "text-foreground"}`}>{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{label}</p>;
}

function AgeBadge({ date }: { date: string }) {
  const ageMs = Date.now() - new Date(date).getTime();
  const hours = ageMs / 3_600_000;
  let cls = "bg-muted text-muted-foreground";
  let label = "ใหม่";
  if (hours >= 24) { cls = "bg-rose-500/15 text-rose-400"; label = ">24ชม"; }
  else if (hours >= 1) { cls = "bg-amber-500/15 text-amber-400"; label = `>${Math.floor(hours)}ชม`; }
  else if (ageMs >= 15 * 60_000) { cls = "bg-amber-500/10 text-amber-300"; label = ">15น"; }
  return <Badge variant="secondary" className={`flex-shrink-0 ${cls}`}>{label}</Badge>;
}

function statusClass(status: string) {
  switch (status) {
    case "completed": return "bg-emerald-500/15 text-emerald-400";
    case "pending": return "bg-amber-500/15 text-amber-400";
    case "failed": return "bg-rose-500/15 text-rose-400";
    case "expired": return "bg-muted text-muted-foreground";
    default: return "";
  }
}
