import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@kodhom/db";
import { supportTickets, supportTicketMessages, users } from "@kodhom/db/schema";
import { asc, eq } from "drizzle-orm";
import { AdminReplyForm } from "./admin-reply-form";
import { TicketStatusControls } from "./status-controls";
import { ArrowLeft } from "lucide-react";

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id))
    .limit(1);
  if (!ticket) notFound();

  const [user] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, ticket.userId))
    .limit(1);

  const messages = await db
    .select({
      id: supportTicketMessages.id,
      body: supportTicketMessages.body,
      imageR2Key: supportTicketMessages.imageR2Key,
      fromAdmin: supportTicketMessages.fromAdmin,
      createdAt: supportTicketMessages.createdAt,
      authorName: users.name,
    })
    .from(supportTicketMessages)
    .leftJoin(users, eq(users.id, supportTicketMessages.authorId))
    .where(eq(supportTicketMessages.ticketId, id))
    .orderBy(asc(supportTicketMessages.createdAt));

  // Clear the admin-unread flag on view.
  if (ticket.adminHasUnread) {
    await db
      .update(supportTickets)
      .set({ adminHasUnread: false })
      .where(eq(supportTickets.id, id));
  }

  return (
    <div>
      <Link
        href="/dashboard/support"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ArrowLeft className="h-3 w-3" />
        กลับ
      </Link>
      <div className="mb-4 rounded-xl border border-border/50 bg-card/50 p-4">
        <h1 className="text-xl font-bold tracking-tight">{ticket.subject}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          จาก: {user?.name ?? "-"} · {user?.email ?? "-"} · หมวด:{" "}
          {ticket.category}
        </p>
        {ticket.paymentId && (
          <Link
            href={`/dashboard/payments?q=${ticket.paymentId}`}
            className="mt-2 inline-block text-xs text-primary hover:underline"
          >
            ดูรายการชำระเงิน → {ticket.paymentId}
          </Link>
        )}
      </div>

      <TicketStatusControls ticketId={ticket.id} status={ticket.status} />

      <ul className="space-y-3 my-4">
        {messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-xl border p-4 ${
              m.fromAdmin
                ? "border-primary/30 bg-primary/[0.06]"
                : "border-border/40 bg-card/30"
            }`}
          >
            <p className="text-xs text-muted-foreground mb-1">
              {m.fromAdmin ? `แอดมิน (${m.authorName ?? "-"})` : `ลูกค้า`} ·{" "}
              {new Date(m.createdAt).toLocaleString("th-TH")}
            </p>
            {m.body && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
            )}
            {m.imageR2Key && (
              // eslint-disable-next-line @next/next/no-img-element
              <a
                href={`/api/support/messages/${m.id}/image`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block"
              >
                <img
                  src={`/api/support/messages/${m.id}/image`}
                  alt="แนบรูป"
                  className="max-h-64 rounded-lg border border-border/50"
                />
              </a>
            )}
          </li>
        ))}
      </ul>

      {ticket.status !== "closed" && <AdminReplyForm ticketId={ticket.id} />}
    </div>
  );
}
