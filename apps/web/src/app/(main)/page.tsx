import { db } from "@kodhom/db";
import { clips } from "@kodhom/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { ClipCard } from "@/components/clip-card";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { getActiveSubscriptionCategories, hasClipAccess } from "@/lib/access-control";

export default async function HomePage() {
  const session = await getSession();

  const allClips = await db
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
    .where(eq(clips.isActive, true))
    .orderBy(desc(clips.createdAt))
    .limit(50);

  let subscribedCategories = new Set<string>();
  let userRole = "member";
  if (session?.user) {
    userRole = (session.user as Record<string, unknown>).role as string ?? "member";
    subscribedCategories = await getActiveSubscriptionCategories(session.user.id);
  }

  const clipsWithAccess = await Promise.all(
    allClips.map(async (clip: typeof allClips[number]) => {
      let thumbnailUrl: string | undefined;
      if (clip.thumbnailR2Key) {
        try {
          thumbnailUrl = await getPresignedDownloadUrl(clip.thumbnailR2Key, 3600);
        } catch {
          // ignore
        }
      }

      const hasSub = subscribedCategories.has(clip.categoryId);
      const access = session?.user
        ? hasClipAccess(userRole, clip.accessLevel, hasSub)
        : false;

      return { clip, thumbnailUrl, hasAccess: access };
    })
  );

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 animate-fade-in">
      {/* Hero welcome area */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-primary/10 via-accent/50 to-transparent p-6 md:p-8 border border-border/30">
        <h1 className="text-2xl md:text-3xl font-bold gradient-text">คลิปล่าสุด</h1>
        <p className="mt-2 text-sm text-muted-foreground">รวมคลิปวิดีโอคุณภาพ อัปเดตใหม่ทุกวัน</p>
      </div>

      {clipsWithAccess.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-slide-up">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 mb-4">
            <span className="text-3xl opacity-40">🎬</span>
          </div>
          <p className="text-muted-foreground font-medium">ยังไม่มีคลิป</p>
          <p className="text-sm text-muted-foreground/60 mt-1">คลิปใหม่กำลังจะมาเร็วๆ นี้</p>
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
