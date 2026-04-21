import { SITE_URL, absoluteUrl, clipDisplayTitle, clipDescription } from "@/lib/seo/metadata";
import { formatIsoDuration } from "@/lib/format-iso-duration";

interface ClipData {
  id: string;
  duration?: number | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  thumbnailR2Key?: string | null;
}
interface CategoryData {
  name: string;
  slug: string;
}

export function VideoObjectJsonLd({
  clip,
  category,
}: {
  clip: ClipData;
  category: CategoryData;
}) {
  const name = clipDisplayTitle(clip, category);
  const description = clipDescription(clip, category);
  const uploadDate =
    typeof clip.createdAt === "string"
      ? clip.createdAt
      : clip.createdAt.toISOString();

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name,
    description,
    uploadDate,
    duration: formatIsoDuration(clip.duration ?? null),
    thumbnailUrl: [absoluteUrl(`/api/thumbnail/${clip.id}`)],
    embedUrl: absoluteUrl(`/clip/${clip.id}`),
    inLanguage: "th-TH",
    isFamilyFriendly: false,
    contentRating: "adult",
    publisher: { "@id": `${SITE_URL}/#org` },
    potentialAction: {
      "@type": "WatchAction",
      target: absoluteUrl(`/clip/${clip.id}`),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
