import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@kodhom/r2";

interface BannerRecord {
  id: string;
  imageR2Key: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ActiveBanner {
  id: string;
  imageUrl: string;
  linkUrl: string;
}

export async function getActiveBanners(): Promise<ActiveBanner[]> {
  const [row] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, "banners"))
    .limit(1);

  if (!row || !Array.isArray(row.value)) return [];

  const banners = (row.value as BannerRecord[])
    .filter((b) => b && b.isActive && b.imageR2Key && b.linkUrl)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const resolved = await Promise.all(
    banners.map(async (b) => {
      try {
        const imageUrl = await getPresignedDownloadUrl(b.imageR2Key, 7200);
        return { id: b.id, imageUrl, linkUrl: b.linkUrl };
      } catch {
        return null;
      }
    })
  );

  return resolved.filter((b): b is ActiveBanner => b !== null);
}
