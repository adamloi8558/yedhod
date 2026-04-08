import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { ClipPlayer } from "@/components/clip-player";
import { Badge } from "@kodhom/ui/components/badge";
import { Crown } from "lucide-react";
import { formatDuration, formatThaiDate } from "@kodhom/ui/lib/utils";
import { notFound } from "next/navigation";
import { getActiveSubscription, hasClipAccess } from "@/lib/access-control";

export default async function ClipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [clip] = await db
    .select()
    .from(clips)
    .where(and(eq(clips.id, id), eq(clips.isActive, true)))
    .limit(1);

  if (!clip) notFound();

  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, clip.categoryId))
    .limit(1);

  const session = await getSession();
  let hasAccess = false;
  const isVip = clip.accessLevel === "vip";

  if (session?.user) {
    const userRole = (session.user as Record<string, unknown>).role as string ?? "member";
    if (userRole === "admin") {
      hasAccess = true;
    } else {
      const sub = await getActiveSubscription(session.user.id, clip.categoryId);
      hasAccess = hasClipAccess(userRole, clip.accessLevel, !!sub);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6 animate-fade-in">
      <ClipPlayer clipId={clip.id} hasAccess={hasAccess} isVip={isVip} />

      <div className="mt-5 space-y-3 animate-slide-up">
        <div className="flex items-start gap-3">
          <h1 className="text-xl font-bold leading-tight">{clip.title}</h1>
          {isVip && (
            <Badge variant="vip" className="gap-1 flex-shrink-0 mt-0.5 animate-pulse-glow">
              <Crown className="h-3 w-3" />
              VIP
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          {category && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary border border-primary/20 transition-smooth hover:bg-primary/15">
              {category.name}
            </span>
          )}
          {clip.duration && (
            <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {formatDuration(clip.duration)}
            </span>
          )}
          <span className="text-xs text-muted-foreground/70">
            {formatThaiDate(new Date(clip.createdAt))}
          </span>
        </div>

        {clip.description && (
          <p className="text-sm text-muted-foreground leading-relaxed pt-1 border-t border-border/30 mt-3">
            {clip.description}
          </p>
        )}
      </div>
    </div>
  );
}
