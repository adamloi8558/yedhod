import Link from "next/link";
import { getPresignedDownloadUrl } from "@kodhom/r2";

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
}: {
  clip: {
    id: string;
    title: string;
    thumbnailR2Key: string | null;
    duration: number | null;
  };
}) {
  const thumb = clip.thumbnailR2Key
    ? await getPresignedDownloadUrl(clip.thumbnailR2Key, 7200)
    : null;

  return (
    <Link href={`/clip/${clip.id}`} className="thumb-card group block">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-white/5">
        {thumb ? (
          <img
            src={thumb}
            alt={clip.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/30">
            no thumb
          </div>
        )}

        {/* Bottom gradient for better badge contrast */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />

        {clip.duration ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {fmtDur(clip.duration)}
          </span>
        ) : null}

        {/* HD badge (fake, tube-site convention) */}
        <span
          className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-black"
          style={{ background: "var(--tenant-primary)" }}
        >
          HD
        </span>
      </div>

      <h3 className="clamp-2 mt-2 text-sm font-medium leading-snug text-white/90 group-hover:text-white">
        {clip.title}
      </h3>
    </Link>
  );
}
