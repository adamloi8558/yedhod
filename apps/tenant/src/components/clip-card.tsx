import Link from "next/link";
import { getPresignedDownloadUrl } from "@kodhom/r2";
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

export async function ClipCard({
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
  const thumb = clip.thumbnailR2Key
    ? await getPresignedDownloadUrl(clip.thumbnailR2Key, 7200)
    : null;

  const title = prettyTitle({
    rawTitle: clip.title,
    categoryName: clip.categoryName ?? "",
    createdAt: clip.createdAt ?? null,
    index,
  });

  return (
    <Link href={`/clip/${clip.id}`} className="thumb-card group block" title={title}>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-white/5">
        {thumb ? (
          <img
            src={thumb}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/30">
            no thumb
          </div>
        )}

        {/* Bottom gradient for badges */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 to-transparent" />

        {clip.duration ? (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/85 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
            {fmtDur(clip.duration)}
          </span>
        ) : null}

        {/* HD badge */}
        <span
          className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-black shadow-sm"
          style={{ background: "var(--tenant-primary)" }}
        >
          HD
        </span>
      </div>

      <div className="mt-2.5 space-y-1 px-0.5">
        <h3 className="clamp-2 text-[13px] font-semibold leading-snug text-white/90 transition-colors group-hover:text-white">
          {title}
        </h3>
        {clip.categoryName && (
          <p className="truncate text-xs text-white/45">{clip.categoryName}</p>
        )}
      </div>
    </Link>
  );
}
