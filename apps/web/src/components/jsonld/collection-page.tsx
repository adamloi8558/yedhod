import { absoluteUrl, categoryDescription, clipDisplayTitle } from "@/lib/seo/metadata";

interface ClipItem {
  id: string;
  duration?: number | null;
  createdAt: Date | string;
}

export function CollectionPageJsonLd({
  category,
  clipCount,
  clips,
}: {
  category: { name: string; slug: string; description?: string | null };
  clipCount: number;
  clips: ClipItem[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `หมวด${category.name}`,
    description: categoryDescription(category, clipCount),
    url: absoluteUrl(`/category/${category.slug}`),
    inLanguage: "th-TH",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: clipCount,
      itemListElement: clips.slice(0, 20).map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: clipDisplayTitle(c, category),
        url: absoluteUrl(`/clip/${c.id}`),
      })),
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
