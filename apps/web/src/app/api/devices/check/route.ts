import { NextResponse } from "next/server";
import { auth } from "@kodhom/auth";
import { headers } from "next/headers";
import { checkDeviceLimit } from "@/lib/access-control";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkDeviceLimit(session.user.id);
  return NextResponse.json(result);
}
