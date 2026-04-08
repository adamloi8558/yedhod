import { NextRequest, NextResponse } from "next/server";
import { auth } from "@kodhom/auth";
import { db } from "@kodhom/db";
import { payments } from "@kodhom/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(eq(payments.anypayRef, ref), eq(payments.userId, session.user.id))
    )
    .limit(1);

  if (!payment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ status: payment.status });
}
