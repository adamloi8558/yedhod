import { absoluteUrl } from "@/lib/seo/metadata";
import {
  getActiveClipCount,
  getSitemapCategories,
  getSitemapClips,
} from "@/lib/sitemap-data";

const CHUNK_SIZE = 5000;

function xmlHeaders() {
  return {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control":
      "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function urlEntry(
  loc: string,
  lastmod: Date | string,
  changefreq: string,
  priority: number
): string {
  const lm =
    typeof lastmod === "string" ? lastmod : new Date(lastmod).toISOString();
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lm}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

export async function GET(request: Request) {
  const clipCount = await getActiveClipCount();
  const clipChunks = Math.max(1, Math.ceil(clipCount / CHUNK_SIZE));
  const now = new Date().toISOString();

  // Index
  const children: string[] = ["pages", "categories"];
  for (let i = 0; i < clipChunks; i++) children.push(`clips-${i}`);

  // /sitemap.xml → index
  const url = new URL(request.url);
  if (url.pathname === "/sitemap.xml") {
    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      children
        .map(
          (id) =>
            `  <sitemap><loc>${absoluteUrl(`/sitemaps/${id}.xml`)}</loc><lastmod>${now}</lastmod></sitemap>`
        )
        .join("\n") +
      `\n</sitemapindex>\n`;
    return new Response(body, { status: 200, headers: xmlHeaders() });
  }

  return new Response("not found", { status: 404 });
}
