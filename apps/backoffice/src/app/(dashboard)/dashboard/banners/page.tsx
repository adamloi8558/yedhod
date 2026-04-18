import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { BannerList } from "@/components/banner-list";

interface BannerRecord {
  id: string;
  imageR2Key: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
}

export default async function BannersPage() {
  const [row] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, "banners"))
    .limit(1);

  const banners: BannerRecord[] =
    row && Array.isArray(row.value) ? (row.value as BannerRecord[]) : [];

  const withPreview = await Promise.all(
    banners.map(async (b) => {
      let previewUrl: string | undefined;
      try {
        previewUrl = await getPresignedDownloadUrl(b.imageR2Key, 3600);
      } catch {
        // ignore
      }
      return { ...b, previewUrl };
    })
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Banner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          จัดการแบนเนอร์โฆษณา (slider แสดงทุกหน้า)
        </p>
      </div>
      <BannerList initialBanners={withPreview} />
    </div>
  );
}
