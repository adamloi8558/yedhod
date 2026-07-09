import Link from "next/link";
import { getPresignedDownloadUrl } from "@kodhom/r2";

function fmtDur(d: number | null): string {
  if (!d) return "";
  const m = Math.floor(d / 60);
  const s = Math.floor(d % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
    <Link href={`/clip/${clip.id}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-md bg-white/5">
        {thumb ? (
          <img
            src={thumb}
            alt={clip.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/40">
            no thumb
          </div>
        )}
        {clip.duration && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs">
            {fmtDur(clip.duration)}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium">{clip.title}</p>
    </Link>
  );
}
