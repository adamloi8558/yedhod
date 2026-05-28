"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// Theme-token colors (resolved at runtime so we never hardcode hex/palette).
const AXIS = "rgba(255,255,255,0.45)";
const GRID = "rgba(255,255,255,0.08)";
const PRIMARY = "oklch(0.62 0.19 280)"; // matches the violet primary family
const VIP = "oklch(0.78 0.14 75)";

const tooltipStyle = {
  background: "rgba(20,20,28,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
  color: "#fff",
};

function fmtTHB(n: number) {
  return "฿" + n.toLocaleString("th-TH");
}

export function RevenueChart({
  data,
}: {
  data: { day: string; total: number; bills: number }[];
}) {
  if (data.length === 0) {
    return <EmptyChart label="ยังไม่มีรายได้ในช่วงนี้" />;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tick={{ fill: AXIS, fontSize: 11 }} tickFormatter={shortDay} minTickGap={20} />
        <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)} width={44} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [fmtTHB(v), "รายได้"]}
          labelFormatter={(l) => `วันที่ ${l}`}
        />
        <Bar dataKey="total" fill={PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function UsersVsPayersChart({
  data,
}: {
  data: { day: string; new_users: number; new_payers: number }[];
}) {
  if (data.length === 0) {
    return <EmptyChart label="ยังไม่มีข้อมูลในช่วงนี้" />;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tick={{ fill: AXIS, fontSize: 11 }} tickFormatter={shortDay} minTickGap={20} />
        <YAxis tick={{ fill: AXIS, fontSize: 11 }} allowDecimals={false} width={32} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `วันที่ ${l}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="new_users" name="สมัครใหม่" stroke={AXIS} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="new_payers" name="จ่ายเงินใหม่" stroke={VIP} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function shortDay(d: string) {
  // YYYY-MM-DD → DD/MM
  const parts = d?.split("-");
  return parts && parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
