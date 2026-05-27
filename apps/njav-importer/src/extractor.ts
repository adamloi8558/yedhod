import { CONFIG } from "./config.js";

export interface Stream {
  /** Absolute HLS m3u8 URL with token. */
  hlsUrl: string;
  /** Origin to use as Referer / Origin headers. */
  playerOrigin: string;
  /** Best-effort poster image URL on the upload host. */
  posterUrl: string | null;
  /** The /play/index URL (used as Referer). */
  refererUrl: string;
}

async function fetchText(
  url: string,
  init: { headers?: Record<string, string>; redirect?: RequestRedirect } = {}
): Promise<{ url: string; body: string }> {
  const res = await fetch(url, {
    redirect: init.redirect ?? "follow",
    headers: {
      "User-Agent": CONFIG.userAgent,
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return { url: res.url, body: await res.text() };
}

/** Resolve njav slug to the upload host's player page (e.g. https://upload18.org/play/index/<slug>). */
async function resolvePlayerPage(
  slug: string
): Promise<{ jmPath: string; redirectUrl: string }> {
  const vv = await fetchText(`${CONFIG.baseUrl}/vv/${slug}`);
  const jm = vv.body.match(/\/jm\/[A-Za-z0-9+/=]+/);
  if (!jm) throw new Error(`no /jm path in /vv/${slug}`);
  // The /jm endpoint 302-redirects to the real player page. Capture the Location.
  const res = await fetch(`${CONFIG.baseUrl}${jm[0]}`, {
    redirect: "manual",
    headers: {
      "User-Agent": CONFIG.userAgent,
      Referer: `${CONFIG.baseUrl}/`,
    },
  });
  const loc = res.headers.get("location");
  if (!loc) throw new Error(`/jm did not redirect (status ${res.status})`);
  return { jmPath: jm[0], redirectUrl: loc };
}

export async function extractStream(slug: string): Promise<Stream> {
  const { redirectUrl } = await resolvePlayerPage(slug);
  const playerOrigin = new URL(redirectUrl).origin;

  const player = await fetchText(redirectUrl, {
    headers: { Referer: `${CONFIG.baseUrl}/` },
  });

  // Find token_hash playlist URL (relative path in HTML).
  const tokenMatch = player.body.match(/\/play\/token_hash\?[^"'\s<>]+/);
  if (!tokenMatch)
    throw new Error(`no token_hash URL on player page for ${slug}`);

  let hlsUrl = new URL(tokenMatch[0], playerOrigin).href;

  // The token URL on .com 301-redirects to .org with a *fresh* one-shot token.
  // We must follow the redirect with HEAD (no body) so the new token isn't consumed,
  // then hand the resolved URL to ffmpeg with a Referer matching its final origin.
  for (let i = 0; i < 4; i++) {
    let res: Response;
    try {
      res = await fetch(hlsUrl, {
        method: "HEAD",
        redirect: "manual",
        headers: {
          "User-Agent": CONFIG.userAgent,
          Referer: redirectUrl,
        },
      });
    } catch {
      break;
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) break;
      hlsUrl = new URL(next, hlsUrl).href;
      continue;
    }
    break;
  }
  const finalOrigin = new URL(hlsUrl).origin;

  // Poster on the upload host.
  const posterMatch =
    player.body.match(
      /image:\s*["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp))["']/i
    ) ?? player.body.match(/poster\s*=\s*["'](https?:\/\/[^"']+)["']/i);

  return {
    hlsUrl,
    playerOrigin: finalOrigin,
    posterUrl: posterMatch?.[1] ?? null,
    refererUrl: redirectUrl,
  };
}
