import { NextRequest, NextResponse } from "next/server";
import { auth } from "@kodhom/auth";
import { getPresignedUploadUrl } from "@kodhom/r2";
import { headers } from "next/headers";
import { nanoid } from "@/lib/nanoid";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contentType, folder } = await req.json();
  if (!contentType) {
    return NextResponse.json({ error: "contentType required" }, { status: 400 });
  }

  const ext = contentType.split("/")[1] ?? "bin";
  const key = `${folder ?? "uploads"}/${nanoid()}.${ext}`;
  const url = await getPresignedUploadUrl(key, contentType);

  return NextResponse.json({ url, key });
}
