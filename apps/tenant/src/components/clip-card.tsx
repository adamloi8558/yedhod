import Link from "next/link";
import { prettyTitle } from "@/lib/pretty-title";

function fmtDur(d: number | null): string {
  if (!d || d <= 0) return "";
  const h = Math.floor(d / 3600);
  const m = Math.floor((d % 3600) / 60);
  const s = Math.floor(d % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return h > 0
    ? `${h}:${mm}:${String(s).padStart(2, "0")}`
    : `${mm}:${String(s).padStart(2, "0")}`;
}

// Deterministic pseudo-random from clip id — for fake "views" & rating that
// stay stable across renders. It's fluff to make the grid feel populated
// like a mature tube site while we have no analytics yet.
function seed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function fakeViews(id: string): string {
  const n = 5_000 + (seed(id) % 900_000);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fakeRating(id: string): number {
  return 70 + (seed(id) % 30); // 70–99%
}

export function ClipCard({
  clip,
  index,
}: {
  clip: {
    id: string;
    title: string;
    thumbnailR2Key: string | null;
    duration: number | null;
    categoryName?: string | null;
    createdAt?: Date | string | null;
  };
  index?: number;
}) {
  // Thumbnail comes from the tenant-scoped proxy route so <img src> stays
  // on the tenant's own domain. The route returns 404 when there's no key.
  const thumb = clip.thumbnailR2Key ? `/api/clips/${clip.id}/thumbnail` : null;

  const title = prettyTitle({
    rawTitle: clip.title,
    categoryName: clip.categoryName ?? "",
    createdAt: clip.createdAt ?? null,
    index,
  });

  const views = fakeViews(clip.id);
  const rating = fakeRating(clip.id);

  return (
    <Link
      href={`/clip/${clip.id}`}
      className="thumb-card group block"
      title={title}
    >
      <div className="thumb-media relative aspect-video overflow-hidden rounded-md bg-white/5">
        {thumb ? (
          <img
            src={thumb}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/30">
            no thumb
          </div>
        )}

        {/* Bottom gradient for readable badges */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/85 to-transparent" />

        {clip.duration ? (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/90 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
            {fmtDur(clip.duration)}
          </span>
        ) : null}

        <span
          className="absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-black"
          style={{ background: "var(--tenant-primary)" }}
        >
          HD
        </span>

        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">
          {views}
        </span>
      </div>

      <h3 className="mt-1.5 clamp-2 text-[13px] font-semibold leading-snug text-white/90 transition-colors group-hover:text-[color:var(--tenant-primary)]">
        {title}
      </h3>

      <div className="mt-1 flex items-center justify-between text-[11px] text-white/45">
        <span className="truncate">{clip.categoryName ?? ""}</span>
        <span className="shrink-0 tabular-nums" style={{ color: "var(--tenant-primary)" }}>
          {rating}%
        </span>
      </div>
    </Link>
  );
}
