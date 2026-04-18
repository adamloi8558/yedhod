import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { eq, and, ilike, desc, or } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { ClipCard } from "@/components/clip-card";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { hasActiveSubscription, hasCategoryAccess } from "@/lib/access-control";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  if (!query) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-6 animate-fade-in">
        <h1 className="mb-6 text-2xl font-bold gradient-text">ค้นหา</h1>
        <div className="flex flex-col items-center justify-center py-20 text-center animate-slide-up">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 mb-4">
            <span className="text-3xl opacity-40">🔍</span>
          </div>
          <p className="text-muted-foreground font-medium">พิมพ์คำค้นหาเพื่อค้นหาคลิป</p>
        </div>
      </div>
    );
  }

  const pattern = `%${query}%`;

  const results = await db
    .select({
      id: clips.id,
      title: clips.title,
      description: clips.description,
      thumbnailR2Key: clips.thumbnailR2Key,
      duration: clips.duration,
      accessLevel: categories.accessLevel,
      categoryId: clips.categoryId,
      createdAt: clips.createdAt,
    })
    .from(clips)
    .innerJoin(categories, eq(clips.categoryId, categories.id))
    .where(
      and(
        eq(clips.isActive, true),
        eq(categories.isActive, true),
        or(
          ilike(clips.title, pattern),
          ilike(clips.description, pattern),
          ilike(categories.name, pattern)
        )
      )
    )
    .orderBy(desc(clips.createdAt))
    .limit(30);

  const session = await getSession();
  let hasSub = false;
  let userRole = "member";
  if (session?.user) {
    userRole = (session.user as Record<string, unknown>).role as string ?? "member";
    hasSub = await hasActiveSubscription(session.user.id);
  }

  const clipsWithAccess = await Promise.all(
    results.map(async (clip: typeof results[number]) => {
      let thumbnailUrl: string | undefined;
      if (clip.thumbnailR2Key) {
        try {
          thumbnailUrl = await getPresignedDownloadUrl(clip.thumbnailR2Key, 3600);
        } catch {
          // ignore
        }
      }
      const access = session?.user
        ? hasCategoryAccess(userRole, clip.accessLevel, hasSub)
        : false;
      return { clip, thumbnailUrl, hasAccess: access };
    })
  );

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 animate-fade-in">
      <h1 className="mb-2 text-2xl font-bold gradient-text">ผลการค้นหา</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        &quot;{query}&quot; — พบ {clipsWithAccess.length} คลิป
      </p>
      {clipsWithAccess.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-slide-up">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 mb-4">
            <span className="text-3xl opacity-40">🔍</span>
          </div>
          <p className="text-muted-foreground font-medium">ไม่พบคลิปที่ตรงกับคำค้นหา</p>
          <p className="text-sm text-muted-foreground/60 mt-1">ลองใช้คำค้นหาอื่น</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {clipsWithAccess.map(({ clip, thumbnailUrl, hasAccess }: typeof clipsWithAccess[number]) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              thumbnailUrl={thumbnailUrl}
              hasAccess={hasAccess}
              isLoggedIn={!!session?.user}
            />
          ))}
        </div>
      )}
    </div>
  );
}
