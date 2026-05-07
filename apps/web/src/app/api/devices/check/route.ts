import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { checkDeviceLimit } from "@/lib/access-control";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkDeviceLimit(session.user.id);
  return NextResponse.json(result);
}
