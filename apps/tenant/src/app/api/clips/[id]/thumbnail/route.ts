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
  if (!clip?.thumbnailR2Key)
    return new NextResponse(null, { status: 404 });
  const url = await getPresignedDownloadUrl(clip.thumbnailR2Key, 3600);
  return NextResponse.redirect(url, 302);
}
