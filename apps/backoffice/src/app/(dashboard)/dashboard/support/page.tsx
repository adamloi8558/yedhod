import Link from "next/link";
import { db } from "@kodhom/db";
import { supportTickets, users } from "@kodhom/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { formatThaiDate } from "@kodhom/ui/lib/utils";

export default async function SupportListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "open";

  const tickets = await db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      category: supportTickets.category,
      status: supportTickets.status,
      adminHasUnread: supportTickets.adminHasUnread,
      updatedAt: supportTickets.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(supportTickets)
    .leftJoin(users, eq(users.id, supportTickets.userId))
    .where(
      status === "all"
        ? sql`true`
        : eq(supportTickets.status, status as "open")
    )
    .orderBy(desc(supportTickets.adminHasUnread), desc(supportTickets.updatedAt))
    .limit(200);

  const filters = [
    { value: "open", label: "รอตอบ" },
    { value: "in_progress", label: "กำลังดำเนินการ" },
    { value: "resolved", label: "แก้ไขแล้ว" },
    { value: "closed", label: "ปิด" },
    { value: "all", label: "ทั้งหมด" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">ติดต่อลูกค้า</h1>
      <p className="text-sm text-muted-foreground mb-4">
        ระบบ ticket จากลูกค้า — รวมปัญหาการชำระเงิน, VIP, การรับชม ฯลฯ
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {filters.map((f) => (
          <Link
            key={f.value}
            href={`?status=${f.value}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              status === f.value
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border/40 bg-card/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
        {tickets.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            ไม่มี ticket ในสถานะนี้
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/dashboard/support/${t.id}`}
                  className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground line-clamp-1">
                      {t.adminHasUnread && (
                        <span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-2 align-middle" />
                      )}
                      {t.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.userName ?? t.userEmail ?? "-"} · {t.category} ·{" "}
                      {formatThaiDate(new Date(t.updatedAt))}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{t.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
