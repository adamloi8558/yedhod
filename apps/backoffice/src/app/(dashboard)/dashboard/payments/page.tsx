import { db } from "@kodhom/db";
import { payments, users } from "@kodhom/db/schema";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@kodhom/ui/components/badge";
import { formatCurrency, formatThaiDate } from "@kodhom/ui/lib/utils";

export default async function PaymentsPage() {
  const allPayments = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      status: payments.status,
      anypayRef: payments.anypayRef,
      createdAt: payments.createdAt,
      paidAt: payments.paidAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(payments)
    .innerJoin(users, eq(payments.userId, users.id))
    .orderBy(desc(payments.createdAt))
    .limit(100);

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
      case "completed":
        return "สำเร็จ";
      case "pending":
        return "รอชำระ";
      case "expired":
        return "หมดอายุ";
      case "failed":
        return "ล้มเหลว";
      default:
        return status;
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">การชำระเงิน</h1>
        <p className="mt-1 text-sm text-muted-foreground">Payments</p>
      </div>
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
              </tr>
            </thead>
            <tbody>
              {allPayments.map((p: typeof allPayments[number]) => (
                <tr key={p.id} className="border-b border-border/40 transition-colors duration-150 hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{p.userName}</p>
                      <p className="text-xs text-muted-foreground">{p.userEmail}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-foreground">{formatCurrency(p.amount)}</td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground md:table-cell">
                    {p.anypayRef ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusColor(p.status)} className={statusBadgeClass(p.status)}>{statusLabel(p.status)}</Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-sm tabular-nums text-muted-foreground sm:table-cell">
                    {formatThaiDate(new Date(p.createdAt))}
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
