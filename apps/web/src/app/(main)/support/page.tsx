import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@kodhom/db";
import { supportTickets } from "@kodhom/db/schema";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { NewTicketForm } from "./new-ticket-form";
import { canonical, pageTitle } from "@/lib/seo/metadata";
import { formatThaiDate } from "@kodhom/ui/lib/utils";
import { MessageCircle, Plus } from "lucide-react";

export const metadata = {
  title: pageTitle("ติดต่อแอดมิน"),
  description: "ติดต่อสอบถามแอดมินผ่านระบบ ticket",
  alternates: canonical("/support"),
  robots: { index: false, follow: false },
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentId?: string; subject?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?redirect=" + encodeURIComponent("/support"));
  }

  const sp = await searchParams;
  const myTickets = await db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      status: supportTickets.status,
      category: supportTickets.category,
      updatedAt: supportTickets.updatedAt,
    })
    .from(supportTickets)
    .where(eq(supportTickets.userId, session.user.id))
    .orderBy(desc(supportTickets.updatedAt))
    .limit(50);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          <span className="gradient-text">ติดต่อแอดมิน</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          แจ้งปัญหาเกี่ยวกับการชำระเงิน, VIP, หรือสอบถามทั่วไป — แอดมินจะตอบกลับเร็วที่สุด
        </p>
      </div>

      <section className="mb-8 rounded-2xl border border-primary/20 bg-card/40 p-5 md:p-6">
        <h2 className="text-lg font-semibold tracking-tight mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          เปิด ticket ใหม่
        </h2>
        <NewTicketForm
          defaultPaymentId={sp.paymentId ?? ""}
          defaultSubject={sp.subject ?? ""}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-3 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          ticket ของฉัน
        </h2>
        {myTickets.length === 0 ? (
          <p className="rounded-2xl border border-border/40 bg-card/30 px-5 py-8 text-center text-sm text-muted-foreground">
            ยังไม่มี ticket — เปิด ticket ใหม่ด้านบนเพื่อเริ่มต้น
          </p>
        ) : (
          <div className="space-y-2">
            {myTickets.map((t) => (
              <Link
                key={t.id}
                href={`/support/${t.id}`}
                className="block rounded-xl border border-border/40 bg-card/30 px-4 py-3 transition-smooth hover:border-primary/40 hover:bg-card/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground line-clamp-1">
                      {t.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatThaiDate(new Date(t.updatedAt))}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    open: { label: "รอตอบ", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    in_progress: { label: "กำลังดำเนินการ", className: "bg-primary/15 text-primary border-primary/30" },
    resolved: { label: "แก้ไขแล้ว", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    closed: { label: "ปิด", className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  };
  const m = map[status] ?? map.open;
  return (
    <span className={`flex-shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${m.className}`}>
      {m.label}
    </span>
  );
}
