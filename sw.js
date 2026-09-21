/* Service worker: keeps a copy of the app's own files so it opens instantly
 * and still works if the tablet has no signal.
 *
 * STALE-WHILE-REVALIDATE: the cached copy is shown immediately (so the app
 * doesn't wait on a network round trip just to show its own UI), while a
 * fresh copy is fetched in the background and saved for the NEXT open. This
 * replaced an earlier network-first version, whose deliberate tradeoff was
 * the opposite: always wait on the network first, so a published fix reaches
 * every tablet on its very next open without clearing each one by hand. With
 * this version, a fix instead shows up on a tablet's SECOND open after being
 * published (the first open after a publish still shows the old cached
 * version while quietly fetching the new one). Google Sheet traffic is never
 * touched, so data is always live either way.
 */

const CACHE = "kolors-app-v7";
const ASSETS = [
  "index.html",
  "style.css",
  "i18n.js",
  "sheet.js",
  "app.js",
  "vendor/xlsx.mini.min.js",
  "kolors.png",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
];

// A response that arrived through a redirect (the host may redirect e.g.
// /index.html to /) must never be handed to a page navigation — the browser
// rejects it with "Response served by service worker has redirections". So
// anything that was redirected is re-wrapped as a plain response first, both
// when storing it and when serving it.
function clean(res) {
  if (!res || !res.redirected) return Promise.resolve(res);
  return res.blob().then((b) => new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers }));
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // Individually, so one missing file can't fail the whole install. Each
      // is fetched fresh from the network (never the browser's HTTP cache).
      .then((c) => Promise.all(ASSETS.map((a) =>
        fetch(new Request(a, { cache: "reload" }))
          .then((res) => (res.ok ? clean(res).then((r) => c.put(a, r)) : null))
          .catch(() => {})
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never intercept Apps Script calls — entries and lists must always be live.
  if (url.hostname.indexOf("script.google") !== -1) return;
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      // A page navigation is passed through as-is (its redirect mode can't be
      // rebuilt); everything else is revalidated with the server so a new
      // release is picked up.
      const req = e.request.mode === "navigate" ? e.request : new Request(e.request.url, { cache: "no-cache" });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const forCache = res.clone();
            clean(forCache)
              .then((r) => caches.open(CACHE).then((c) => c.put(e.request, r)))
              .catch(() => {});
          }
          return clean(res);
        })
        .catch(() => cached); // offline and nothing cached yet — genuine failure
      // Instant if we already have a copy; otherwise wait on the network.
      return cached ? clean(cached) : network;
    })
  );
});
