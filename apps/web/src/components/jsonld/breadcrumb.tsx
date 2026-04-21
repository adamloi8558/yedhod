import { absoluteUrl } from "@/lib/seo/metadata";

export interface BreadcrumbJsonLdItem {
  name: string;
  path: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbJsonLdItem[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
