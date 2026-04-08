import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { desc, eq } from "drizzle-orm";
import { ClipList } from "@/components/clip-list";

export default async function ClipsPage() {
  const allClips = await db
    .select({
      id: clips.id,
      title: clips.title,
      accessLevel: clips.accessLevel,
      categoryId: clips.categoryId,
      r2Key: clips.r2Key,
      duration: clips.duration,
      isActive: clips.isActive,
      sortOrder: clips.sortOrder,
      createdAt: clips.createdAt,
    })
    .from(clips)
    .orderBy(desc(clips.createdAt));

  const allCategories = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">จัดการคลิป</h1>
        <p className="mt-1 text-sm text-muted-foreground">Clips Management</p>
      </div>
      <ClipList clips={allClips} categories={allCategories} />
    </div>
  );
}
