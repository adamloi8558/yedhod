import { NextRequest } from "next/server";
import { absoluteUrl } from "@/lib/seo/metadata";
import {
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
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await ctx.params;
  const id = rawId.replace(/\.xml$/i, "");
  const now = new Date().toISOString();
  const entries: string[] = [];

  if (id === "pages") {
    entries.push(urlEntry(absoluteUrl("/"), now, "hourly", 1.0));
    entries.push(urlEntry(absoluteUrl("/pricing"), now, "weekly", 0.8));
    entries.push(urlEntry(absoluteUrl("/about"), now, "monthly", 0.5));
  } else if (id === "categories") {
    const cats = await getSitemapCategories();
    for (const c of cats as Array<{ slug: string; updatedAt: Date }>) {
      entries.push(
        urlEntry(absoluteUrl(`/category/${c.slug}`), c.updatedAt, "daily", 0.7)
      );
    }
  } else {
    const m = /^clips-(\d+)$/.exec(id);
    if (!m) return new Response("not found", { status: 404 });
    const page = parseInt(m[1], 10);
    const rows = await getSitemapClips(page * CHUNK_SIZE, CHUNK_SIZE);
    for (const r of rows as Array<{ id: string; updatedAt: Date }>) {
      entries.push(
        urlEntry(absoluteUrl(`/clip/${r.id}`), r.updatedAt, "weekly", 0.6)
      );
    }
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join("\n") +
    `\n</urlset>\n`;

  return new Response(body, { status: 200, headers: xmlHeaders() });
}
