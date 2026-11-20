// Service worker (RNF-07, offline mode). It caches:
//  - the app shell (pages and static files): stale-while-revalidate;
//  - the data the student needs without internet: the main Bible text (/api/v1/bible/...), the notebook and the cards of the day
//    (/api/v1/notebook, /api/v1/review/due) and the visual catalog: network first, falling back to the last answer saved.
// Private data is dropped when the student signs out (message "clear"). Nothing else under /api is cached.
const SHELL = "pf-shell-v2";
const DATA = "pf-data-v2";
const DATA_PATHS = [/^\/api\/v1\/me$/, /^\/api\/v1\/preferences$/, /^\/api\/v1\/bible\//, /^\/api\/v1\/notebook(\?|$)/, /^\/api\/v1\/review\/due/, /^\/api\/v1\/visuals\//, /^\/api\/v1\/sessions\?/];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== SHELL && k !== DATA) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("message", (e) => {
  if (e.data === "clear") e.waitUntil(caches.delete(DATA));
});

// Requests with an Authorization header are keyed by URL only (one signed-in student per device cache).
async function networkFirst(req) {
  const cache = await caches.open(DATA);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req.url, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req.url);
    if (hit) return hit;
    return new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "Content-Type": "application/json" } });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res.ok && res.type === "basic") cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (DATA_PATHS.some((re) => re.test(url.pathname + url.search))) return e.respondWith(networkFirst(req));
  if (url.pathname.startsWith("/api/")) return; // everything else in the API is never cached
  if (req.mode === "navigate" || /^\/(_next\/static|avatar|icons|maps)\//.test(url.pathname) || /\.(webmanifest|css|js|woff2?)$/.test(url.pathname)) return e.respondWith(staleWhileRevalidate(req));
});
