// Minimal service worker — just enough to make Chrome treat the site as an
// installable PWA. We do NOT cache HTML/streams (presigned URLs expire),
// only stable static assets so install/offline behavior stays predictable.

const CACHE = "kodhom-v1";
const PRECACHE = [
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Same-origin static assets only — let everything else hit the network.
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (!/\.(png|ico|svg|webp|jpg|jpeg|css|woff2?)$/i.test(url.pathname)) return;

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request)
          .then((res) => {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((c) => c.put(event.request, copy))
              .catch(() => {});
            return res;
          })
          .catch(() => cached as Response)
    )
  );
});
