import { CONFIG } from "./config.js";

export interface ListItem {
  slug: string;
  pageUrl: string;
  title: string;
  thumbnailUrl: string | null;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": CONFIG.userAgent,
      "Accept-Language": "th,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return await res.text();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

export function parseListPage(html: string): ListItem[] {
  const items: ListItem[] = [];
  const seen = new Set<string>();

  // Each card looks like: <a href="xvideos/<slug>" ...><img ... data-src=... alt=... ...></a>
  // We grab anchors that link to xvideos/<slug> and the nearby img / title.
  const re =
    /<a[^>]+href="(?:https?:\/\/[^"]*?)?(?:\/th)?\/?xvideos\/([a-z0-9][a-z0-9\-]*?)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const slug = m[1];
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const inner = m[2] ?? "";
    const imgMatch =
      inner.match(/data-src="([^"]+)"/i) ??
      inner.match(/data-original="([^"]+)"/i) ??
      inner.match(/<img[^>]+src="([^"]+)"/i);
    const altMatch = inner.match(/alt="([^"]+)"/i);
    const titleAttrMatch = inner.match(/title="([^"]+)"/i);

    items.push({
      slug,
      pageUrl: `${CONFIG.baseUrl}/th/xvideos/${slug}`,
      title: decodeEntities(altMatch?.[1] ?? titleAttrMatch?.[1] ?? slug),
      thumbnailUrl: imgMatch?.[1] ?? null,
    });
  }
  return items;
}

export async function scrapeAllPages(njavPath: string): Promise<ListItem[]> {
  const all = new Map<string, ListItem>();
  let page = 1;
  while (true) {
    const url =
      page === 1
        ? `${CONFIG.baseUrl}${njavPath}`
        : `${CONFIG.baseUrl}${njavPath}${njavPath.includes("?") ? "&" : "?"}page=${page}`;
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      console.error(`[scraper] page ${page} failed:`, err);
      break;
    }
    const items = parseListPage(html);
    if (items.length === 0) {
      console.log(`[scraper] page ${page} empty, stopping`);
      break;
    }
    let added = 0;
    for (const it of items) {
      if (!all.has(it.slug)) {
        all.set(it.slug, it);
        added++;
      }
    }
    console.log(
      `[scraper] page ${page}: ${items.length} items (${added} new, total ${all.size})`
    );
    if (added === 0) {
      // pagination wraps / no new — stop.
      break;
    }
    page++;
  }
  return [...all.values()];
}

interface DetailInfo {
  title: string;
  description: string | null;
  posterUrl: string | null;
  vvUrl: string;
}

export async function fetchDetail(slug: string): Promise<DetailInfo> {
  const pageUrl = `${CONFIG.baseUrl}/th/xvideos/${slug}`;
  const html = await fetchHtml(pageUrl);

  const titleMatch =
    html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ??
    html.match(/<title>([^<]+)<\/title>/i);
  const descMatch = html.match(
    /<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i
  );
  const posterMatch =
    html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ??
    html.match(/poster=(?:"|%22|')([^"'%]+\.(?:jpg|jpeg|png|webp))/i);
  const vvMatch = html.match(
    /<iframe[^>]+src="(https?:\/\/[^"]*\/vv\/[^"]+)"/i
  );

  let title = decodeEntities(titleMatch?.[1] ?? slug).trim();
  // strip site suffix patterns like " - nJAV.com" / "nJAV.com : ..."
  title = title
    .replace(/^nJAV\.com\s*[:|\-–]\s*/i, "")
    .replace(/\s*[\-–|]\s*nJAV\.com.*$/i, "")
    .replace(/\s*ดู JAV ออนไลน์ฟรี.*$/i, "")
    .trim();

  return {
    title: title || slug,
    description: descMatch ? decodeEntities(descMatch[1]).trim() : null,
    posterUrl: posterMatch?.[1] ?? null,
    vvUrl: vvMatch?.[1] ?? `${CONFIG.baseUrl}/vv/${slug}`,
  };
}
