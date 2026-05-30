import Link from "next/link";
import { db, adminAuditLogs, users } from "@kodhom/db";
import { eq, and, gte, lte, ilike, desc, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-server";
import { Button } from "@kodhom/ui/components/button";
import { formatThaiDate } from "@kodhom/ui/lib/utils";

const PAGE_SIZE = 50;

function parseDate(s: string | undefined, endOfDay = false): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; target?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const action = sp.action?.trim() ?? "";
  const target = sp.target?.trim() ?? "";
  const from = parseDate(sp.from);
  const to = parseDate(sp.to, true);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const conds = [] as ReturnType<typeof eq>[];
  if (action) conds.push(ilike(adminAuditLogs.action, `%${action}%`));
  if (target) conds.push(ilike(adminAuditLogs.targetId, `%${target}%`));
  if (from) conds.push(gte(adminAuditLogs.createdAt, from));
  if (to) conds.push(lte(adminAuditLogs.createdAt, to));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: adminAuditLogs.id,
        adminId: adminAuditLogs.adminId,
        adminName: users.name,
        action: adminAuditLogs.action,
        targetType: adminAuditLogs.targetType,
        targetId: adminAuditLogs.targetId,
        metadata: adminAuditLogs.metadata,
        createdAt: adminAuditLogs.createdAt,
      })
      .from(adminAuditLogs)
      .leftJoin(users, eq(adminAuditLogs.adminId, users.id))
      .where(where)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(adminAuditLogs).where(where),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseParams = new URLSearchParams();
  if (action) baseParams.set("action", action);
  if (target) baseParams.set("target", target);
  if (sp.from) baseParams.set("from", sp.from);
  if (sp.to) baseParams.set("to", sp.to);
  const pagerHref = (p: number) => {
    const q = new URLSearchParams(baseParams);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/dashboard/audit-logs?${qs}` : "/dashboard/audit-logs";
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">ประวัติการดำเนินการของแอดมิน</h1>
        <p className="mt-1 text-sm text-muted-foreground">Audit Logs · {total.toLocaleString()} รายการ</p>
      </div>

      <form className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border/50 bg-card/50 p-3 sm:grid-cols-5">
        <input name="action" defaultValue={action} placeholder="action (เช่น user.ban)" className="h-9 rounded-md border border-border bg-input/50 px-3 text-sm" />
        <input name="target" defaultValue={target} placeholder="target id" className="h-9 rounded-md border border-border bg-input/50 px-3 text-sm" />
        <input name="from" type="date" defaultValue={sp.from ?? ""} className="h-9 rounded-md border border-border bg-input/50 px-3 text-sm" />
        <input name="to" type="date" defaultValue={sp.to ?? ""} className="h-9 rounded-md border border-border bg-input/50 px-3 text-sm" />
        <Button type="submit" className="h-9">กรอง</Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">เวลา</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">แอดมิน</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">ไม่พบรายการ</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 hover:bg-accent/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{formatThaiDate(new Date(r.createdAt))}</td>
                  <td className="px-4 py-3 text-sm">{r.adminName ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.targetType && r.targetId ? (
                      r.targetType === "user" ? (
                        <Link href={`/dashboard/users/${r.targetId}`} className="text-primary hover:underline">{r.targetType}/{r.targetId.slice(0, 8)}…</Link>
                      ) : (
                        <span className="text-muted-foreground">{r.targetType}/{r.targetId.slice(0, 8)}…</span>
                      )
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-[11px] text-muted-foreground md:table-cell">
                    {r.metadata ? JSON.stringify(r.metadata).slice(0, 80) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" asChild disabled={page <= 1}>
            <Link href={pagerHref(page - 1)}>ก่อนหน้า</Link>
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
            <Link href={pagerHref(page + 1)}>ถัดไป</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
