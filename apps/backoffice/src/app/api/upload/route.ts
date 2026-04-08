import { NextRequest, NextResponse } from "next/server";
import { getPresignedUploadUrl } from "@kodhom/r2";
import { nanoid } from "@/lib/nanoid";
import { getAdminSession } from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { contentType, folder } = await req.json();

  if (!contentType) {
    return NextResponse.json({ error: "contentType required" }, { status: 400 });
  }

  const ext = contentType.split("/")[1] ?? "bin";
  const key = `${folder ?? "clips"}/${nanoid()}.${ext}`;
  const url = await getPresignedUploadUrl(key, contentType);

  return NextResponse.json({ url, key });
}
