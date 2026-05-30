import Link from "next/link";
import { Pin } from "lucide-react";

export interface CategoryCardData {
  id: string;
  name: string;
  slug: string;
  coverImage: string | null;
  isPinned?: boolean;
  thumbnailUrl?: string | null;
  clipCount?: number;
}

export function CategoryCard({
  category,
  href,
  countLabel = "คลิป",
}: {
  category: CategoryCardData;
  href?: string;
  countLabel?: string;
}) {
  const imageUrl = category.coverImage ?? category.thumbnailUrl ?? null;
  const fallbackLetter = category.name.trim().charAt(0).toUpperCase();
  const linkHref = href ?? `/category/${category.slug}`;

  return (
    <Link
      href={linkHref}
      aria-label={`ดูหมวดหมู่ ${category.name}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-card/60 transition-smooth hover:-translate-y-0.5 hover:bg-card hover:shadow-lg hover:shadow-primary/10"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-smooth group-hover:scale-105"
          />
        ) : (
          <div className="gradient-primary flex h-full w-full items-center justify-center">
            <span className="text-4xl font-bold text-white md:text-5xl">
              {fallbackLetter}
            </span>
          </div>
        )}

        {/* readability scrim under the title */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

        {category.isPinned && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-primary/30">
            <Pin className="h-3 w-3" fill="currentColor" />
            แนะนำ
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3 md:p-3.5">
          <h3 className="line-clamp-1 text-[13px] font-semibold leading-snug text-white transition-smooth md:text-sm">
            {category.name}
          </h3>
          {typeof category.clipCount === "number" && category.clipCount > 0 && (
            <p className="mt-0.5 text-[11px] font-medium text-white/80">
              {category.clipCount.toLocaleString("th-TH")} {countLabel}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
