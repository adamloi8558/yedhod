import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { ClipCard } from "@/components/clip-card";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { getActiveSubscription, hasClipAccess } from "@/lib/access-control";
import { notFound } from "next/navigation";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
    .limit(1);

  if (!category) notFound();

  const session = await getSession();

  const categoryClips = await db
    .select({
      id: clips.id,
      title: clips.title,
      description: clips.description,
      thumbnailR2Key: clips.thumbnailR2Key,
      duration: clips.duration,
      accessLevel: clips.accessLevel,
      categoryId: clips.categoryId,
      createdAt: clips.createdAt,
    })
    .from(clips)
    .where(and(eq(clips.categoryId, category.id), eq(clips.isActive, true)))
    .orderBy(desc(clips.createdAt));

  let hasSubscription = false;
  let userRole = "member";
  if (session?.user) {
    userRole = (session.user as Record<string, unknown>).role as string ?? "member";
    const sub = await getActiveSubscription(session.user.id, category.id);
    hasSubscription = !!sub;
  }

  const clipsWithAccess = await Promise.all(
    categoryClips.map(async (clip) => {
      let thumbnailUrl: string | undefined;
      if (clip.thumbnailR2Key) {
        try {
          thumbnailUrl = await getPresignedDownloadUrl(clip.thumbnailR2Key, 3600);
        } catch {
          // ignore
        }
      }

      const access = session?.user
        ? hasClipAccess(userRole, clip.accessLevel, hasSubscription)
        : false;

      return { clip, thumbnailUrl, hasAccess: access };
    })
  );

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 animate-fade-in">
      {/* Category header */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-primary/10 via-accent/50 to-transparent p-6 md:p-8 border border-border/30">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-bold gradient-text">{category.name}</h1>
          {hasSubscription && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400 border border-green-500/20">
              สมัครแล้ว
            </span>
          )}
        </div>
        {category.description && (
          <p className="mt-2 text-sm text-muted-foreground">{category.description}</p>
        )}
      </div>

      {clipsWithAccess.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-slide-up">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 mb-4">
            <span className="text-3xl opacity-40">📂</span>
          </div>
          <p className="text-muted-foreground font-medium">ยังไม่มีคลิปในหมวดหมู่นี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {clipsWithAccess.map(({ clip, thumbnailUrl, hasAccess }) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              thumbnailUrl={thumbnailUrl}
              hasAccess={hasAccess}
            />
          ))}
        </div>
      )}
    </div>
  );
}
