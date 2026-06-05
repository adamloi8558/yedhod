import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@kodhom/db";
import { supportTickets, supportTicketMessages, users } from "@kodhom/db/schema";
import { asc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { ReplyForm } from "./reply-form";
import { ArrowLeft } from "lucide-react";

export const metadata = { robots: { index: false, follow: false } };

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?redirect=" + encodeURIComponent(`/support/${id}`));
  }
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id))
    .limit(1);
  if (!ticket) notFound();
  if (ticket.userId !== session.user.id) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-sm text-muted-foreground">
        คุณไม่มีสิทธิ์ดู ticket นี้
      </div>
    );
  }

  const messages = await db
    .select({
      id: supportTicketMessages.id,
      body: supportTicketMessages.body,
      fromAdmin: supportTicketMessages.fromAdmin,
      createdAt: supportTicketMessages.createdAt,
      authorName: users.name,
    })
    .from(supportTicketMessages)
    .leftJoin(users, eq(users.id, supportTicketMessages.authorId))
    .where(eq(supportTicketMessages.ticketId, id))
    .orderBy(asc(supportTicketMessages.createdAt));

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6 animate-fade-in">
      <Link
        href="/support"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ArrowLeft className="h-3 w-3" />
        กลับไปรายการ ticket
      </Link>
      <div className="mb-4 rounded-2xl border border-border/40 bg-card/40 p-4">
        <h1 className="text-lg md:text-xl font-bold tracking-tight">
          {ticket.subject}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          หมวด: {ticket.category} · สถานะ: {ticket.status}
        </p>
      </div>

      <ul className="space-y-3 mb-4">
        {messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-2xl border p-4 ${
              m.fromAdmin
                ? "border-primary/30 bg-primary/[0.06]"
                : "border-border/40 bg-card/30"
            }`}
          >
            <p className="text-xs text-muted-foreground mb-1">
              {m.fromAdmin ? "แอดมิน" : "คุณ"} ·{" "}
              {new Date(m.createdAt).toLocaleString("th-TH")}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {m.body}
            </p>
          </li>
        ))}
      </ul>

      {ticket.status !== "closed" && <ReplyForm ticketId={ticket.id} />}
    </div>
  );
}
