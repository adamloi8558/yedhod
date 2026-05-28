import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { desc, ilike, count } from "drizzle-orm";
import { ClipList } from "@/components/clip-list";
import { ListControls } from "@/components/list-controls";

const PAGE_SIZE = 30;

export default async function ClipsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const where = q ? ilike(clips.title, `%${q}%`) : undefined;

  const [allClips, [{ total }], allCategories] = await Promise.all([
    db
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
      .where(where)
      .orderBy(desc(clips.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(clips).where(where),
    db.select({ id: categories.id, name: categories.name }).from(categories),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">จัดการคลิป</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clips Management · {total.toLocaleString()} คลิป
        </p>
      </div>
      <ListControls
        basePath="/dashboard/clips"
        query={q}
        page={page}
        totalPages={totalPages}
        placeholder="ค้นหาชื่อคลิป..."
      />
      <ClipList clips={allClips} categories={allCategories} />
      <ListControls
        basePath="/dashboard/clips"
        query={q}
        page={page}
        totalPages={totalPages}
        placeholder="ค้นหาชื่อคลิป..."
        pagerOnly
      />
    </div>
  );
}
