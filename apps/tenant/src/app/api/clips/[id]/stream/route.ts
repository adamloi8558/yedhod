import { NextRequest, NextResponse } from "next/server";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantClipInScope } from "@/lib/tenant-queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const clip = await getTenantClipInScope(tenant.id, id);
  if (!clip)
    return NextResponse.json({ error: "ไม่พบคลิป" }, { status: 404 });
  const url = await getPresignedDownloadUrl(clip.r2Key, 7200);
  return NextResponse.json({ url });
}
