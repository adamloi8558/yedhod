import { SITE_URL, absoluteUrl, BRAND } from "@/lib/seo/metadata";

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceThb: string | number;
  durationDays: number;
  maxDevices: number;
}

export function ProductJsonLd({ plans }: { plans: Plan[] }) {
  const data = {
    "@context": "https://schema.org",
    "@graph": plans.map((plan) => ({
      "@type": "Product",
      "@id": `${SITE_URL}/pricing#${plan.slug}`,
      name: `${plan.name} - ${BRAND}`,
      description: `สมาชิก ${plan.name} ระยะเวลา ${plan.durationDays} วัน รองรับ ${plan.maxDevices} อุปกรณ์ ดูคลิปคุณภาพ HD ไม่มีโฆษณา`,
      brand: { "@type": "Brand", name: BRAND },
      offers: {
        "@type": "Offer",
        price: String(plan.priceThb),
        priceCurrency: "THB",
        availability: "https://schema.org/InStock",
        url: absoluteUrl("/pricing"),
      },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
