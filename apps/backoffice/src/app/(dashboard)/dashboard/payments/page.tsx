import { db } from "@kodhom/db";
import { payments, users } from "@kodhom/db/schema";
import { and, or, eq, gte, lte, ilike, desc, count, sql } from "drizzle-orm";
import { Badge } from "@kodhom/ui/components/badge";
import { formatCurrency, formatThaiDate } from "@kodhom/ui/lib/utils";
import { PaymentsFilters } from "@/components/payments-filters";
import { PaymentActions } from "@/components/payment-actions";

const PAGE_SIZE = 50;
const VALID_STATUSES = ["pending", "completed", "expired", "failed"] as const;

function isValidStatus(s: string): s is (typeof VALID_STATUSES)[number] {
  return (VALID_STATUSES as readonly string[]).includes(s);
}

function parseDate(s: string | undefined, endOfDay = false): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const statusParam = sp.status?.trim() ?? "";
  const from = parseDate(sp.from);
  const to = parseDate(sp.to, true);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const conds = [] as ReturnType<typeof eq>[];
  if (q) {
    const like = `%${q}%`;
    conds.push(
      or(
        ilike(users.name, like),
        ilike(users.email, like),
        ilike(payments.anypayRef, like),
        ilike(payments.easyslipTransRef, like)
      )!
    );
  }
  if (statusParam && isValidStatus(statusParam)) {
    conds.push(eq(payments.status, statusParam));
  }
  if (from) conds.push(gte(payments.createdAt, from));
  if (to) conds.push(lte(payments.createdAt, to));

  const where = conds.length > 0 ? and(...conds) : undefined;

  const [rows, [{ total }], [{ revenue }]] = await Promise.all([
    db
      .select({
        id: payments.id,
        amount: payments.amount,
        status: payments.status,
        anypayRef: payments.anypayRef,
        easyslipRef: payments.easyslipTransRef,
        slipKey: payments.slipImageR2Key,
        createdAt: payments.createdAt,
        paidAt: payments.paidAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(payments)
      .innerJoin(users, eq(payments.userId, users.id))
      .where(where)
      .orderBy(desc(payments.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ total: count() })
      .from(payments)
      .innerJoin(users, eq(payments.userId, users.id))
      .where(where),
    // Total revenue in the filtered set (status=completed only).
    db
      .select({
        revenue: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'completed'), 0)`,
      })
      .from(payments)
      .innerJoin(users, eq(payments.userId, users.id))
      .where(where),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function statusColor(status: string) {
    switch (status) {
      case "completed":
        return "default" as const;
      case "pending":
        return "secondary" as const;
      default:
        return "destructive" as const;
    }
  }
  function statusBadgeClass(status: string) {
    switch (status) {
      case "completed":
        return "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20";
      case "pending":
        return "bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/20";
      case "failed":
        return "bg-red-500/15 text-red-400 hover:bg-red-500/20";
      case "expired":
        return "bg-zinc-500/15 text-zinc-400 hover:bg-zinc-500/20";
      default:
        return "";
    }
  }
  function statusLabel(status: string) {
    switch (status) {
      case "completed": return "สำเร็จ";
      case "pending": return "รอชำระ";
      case "expired": return "หมดอายุ";
      case "failed": return "ล้มเหลว";
      default: return status;
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">การชำระเงิน</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            รวมรายได้ในผลที่กรอง:{" "}
            <span className="font-semibold text-emerald-400">{formatCurrency(revenue)}</span>
          </p>
        </div>
      </div>

      <PaymentsFilters
        query={q}
        status={statusParam}
        from={sp.from ?? ""}
        to={sp.to ?? ""}
        page={page}
        totalPages={totalPages}
        total={total}
      />

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ผู้ใช้</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">จำนวน</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">อ้างอิง</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">สถานะ</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">วันที่</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    ไม่พบรายการตามเงื่อนไข
                  </td>
                </tr>
              )}
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-border/40 transition-colors duration-150 hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{p.userName}</p>
                    <p className="text-xs text-muted-foreground">{p.userEmail}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-foreground">{formatCurrency(p.amount)}</td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground md:table-cell">
                    {p.easyslipRef ?? p.anypayRef ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusColor(p.status)} className={statusBadgeClass(p.status)}>
                      {statusLabel(p.status)}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-sm tabular-nums text-muted-foreground sm:table-cell">
                    {formatThaiDate(new Date(p.createdAt))}
                  </td>
                  <td className="px-4 py-3">
                    <PaymentActions
                      paymentId={p.id}
                      status={p.status}
                      hasSlip={!!p.slipKey}
                      slipUrl={p.slipKey ? `/api/payments/${p.id}/slip` : null}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
