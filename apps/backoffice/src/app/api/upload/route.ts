import { NextRequest, NextResponse } from "next/server";
import { getPresignedUploadUrl } from "@kodhom/r2";
import { nanoid } from "@/lib/nanoid";
import { getAdminSession } from "@/lib/auth-server";

const ALLOWED_FOLDERS = ["clips", "thumbnails", "banners", "slips"] as const;

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { contentType, folder } = await req.json();

  if (!contentType) {
    return NextResponse.json({ error: "contentType required" }, { status: 400 });
  }

  const folderName = folder ?? "clips";
  if (!ALLOWED_FOLDERS.includes(folderName)) {
    return NextResponse.json({ error: "โฟลเดอร์ไม่ถูกต้อง" }, { status: 400 });
  }

  const ext = contentType.split("/")[1] ?? "bin";
  const key = `${folderName}/${nanoid()}.${ext}`;
  const url = await getPresignedUploadUrl(key, contentType);

  return NextResponse.json({ url, key });
}
