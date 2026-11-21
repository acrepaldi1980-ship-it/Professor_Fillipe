// Service worker (RNF-07, offline mode). It caches:
//  - the app shell (pages and static files): stale-while-revalidate;
//  - the data the student needs without internet: the main Bible text (/api/v1/bible/...), the notebook and the cards of the day
//    (/api/v1/notebook, /api/v1/review/due) and the visual catalog: network first, falling back to the last answer saved.
// Private data is dropped when the student signs out (message "clear"). Nothing else under /api is cached.
const SHELL = "pf-shell-v3"; // v3: pages are fetched from the network first, so a new deploy never meets an old cached page
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

// Pages (navigation): network first, the saved copy only when offline. An old page would point at script files that no longer exist after a deploy.
async function networkFirstPage(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || new Response("Sem internet.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
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
  if (req.mode === "navigate") return e.respondWith(networkFirstPage(req));
  if (/^\/(_next\/static|avatar|icons|maps)\//.test(url.pathname) || /\.(webmanifest|css|js|woff2?)$/.test(url.pathname)) return e.respondWith(staleWhileRevalidate(req));
});

// ---- Notifications (spec 8.15): a short reminder that opens the right screen ----
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { /* plain text push */ }
  e.waitUntil(self.registration.showNotification(data.title || "Professor Filipe", { body: data.body || "", tag: data.tag || "pf", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: data.url || "/inicio" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/inicio";
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) { await c.focus(); if ("navigate" in c) await c.navigate(url).catch(() => undefined); return; } }
    await self.clients.openWindow(url);
  })());
});
