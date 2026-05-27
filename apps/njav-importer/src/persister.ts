import { db, clips } from "@kodhom/db";
import { eq } from "drizzle-orm";
import { nanoid } from "./nanoid.js";
import { CONFIG } from "./config.js";

export interface NewClipRow {
  title: string;
  description: string | null;
  categoryId: string;
  accessLevel: "member" | "vip";
  r2Key: string;
  thumbnailR2Key: string | null;
  duration: number | null;
  fileSize: number;
  mimeType: string;
  sourceUrl: string;
}

export async function clipExists(sourceUrl: string): Promise<boolean> {
  const rows = await db
    .select({ id: clips.id })
    .from(clips)
    .where(eq(clips.sourceUrl, sourceUrl))
    .limit(1);
  return rows.length > 0;
}

export async function insertClip(row: NewClipRow): Promise<string | null> {
  const id = nanoid();
  const inserted = await db
    .insert(clips)
    .values({
      id,
      title: row.title.slice(0, 500),
      description: row.description?.slice(0, 5000) ?? null,
      categoryId: row.categoryId,
      accessLevel: row.accessLevel,
      r2Key: row.r2Key,
      thumbnailR2Key: row.thumbnailR2Key,
      duration: row.duration,
      fileSize: row.fileSize,
      mimeType: row.mimeType,
      isActive: true,
      uploadedBy: CONFIG.uploadedBy,
      sourceUrl: row.sourceUrl,
    })
    .onConflictDoNothing({ target: clips.sourceUrl })
    .returning({ id: clips.id });
  return inserted[0]?.id ?? null;
}
