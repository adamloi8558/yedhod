import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@kodhom/auth";
import { getAdminSession } from "@/lib/auth-server";
import { logAdminAction } from "@/lib/audit";

/**
 * POST /api/users/[id]/impersonate
 * Returns a redirect URL to the web app. Better Auth's impersonateUser
 * swaps the session cookie via Set-Cookie on the response — so after this
 * call the browser is logged in AS the target user. Admin can return to
 * their own session with the "stop impersonating" button on the web.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "ไม่ต้อง impersonate ตัวเอง" }, { status: 400 });
  }
  try {
    // Better Auth issues an impersonation session cookie via the response
    // headers attached to this request. asResponse: true makes that explicit.
    const res = await auth.api.impersonateUser({
      headers: await headers(),
      body: { userId: id },
      asResponse: true,
    });
    await logAdminAction({
      adminId: session.user.id,
      action: "user.impersonate.start",
      targetType: "user",
      targetId: id,
    });
    // The Set-Cookie from res must be forwarded to the browser.
    const setCookie = res.headers.get("set-cookie");
    const out = NextResponse.json({
      ok: true,
      // where the admin's browser should land — the public web, logged in as user
      redirect: process.env.NEXT_PUBLIC_APP_URL || "/",
    });
    if (setCookie) out.headers.set("set-cookie", setCookie);
    return out;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "impersonate ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
