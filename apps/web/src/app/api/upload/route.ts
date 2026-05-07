import { NextRequest, NextResponse } from "next/server";
import { getPresignedUploadUrl } from "@kodhom/r2";
import { nanoid } from "@/lib/nanoid";
import { getSession } from "@/lib/auth-server";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contentType, folder } = await req.json();
  if (!contentType) {
    return NextResponse.json({ error: "contentType required" }, { status: 400 });
  }

  if (folder !== "avatars") {
    return NextResponse.json({ error: "โฟลเดอร์ไม่ถูกต้อง" }, { status: 400 });
  }

  if (!ALLOWED_MIME.includes(contentType)) {
    return NextResponse.json({ error: "ประเภทไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }

  const ext = contentType.split("/")[1] ?? "bin";
  const key = `avatars/${nanoid()}.${ext}`;
  const url = await getPresignedUploadUrl(key, contentType);

  return NextResponse.json({ url, key });
}
