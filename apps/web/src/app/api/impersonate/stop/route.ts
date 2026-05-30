import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@kodhom/auth";

/**
 * POST /api/impersonate/stop — exit impersonation, restoring the admin's
 * own session via Better Auth's stopImpersonating. Lives on the web app
 * because that's where the banner is shown.
 */
export async function POST() {
  try {
    const res = await auth.api.stopImpersonating({
      headers: await headers(),
      asResponse: true,
    });
    const out = NextResponse.json({ ok: true });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) out.headers.set("set-cookie", setCookie);
    return out;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "stop impersonating ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
