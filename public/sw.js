// Minimal service worker for the prototype: enables installability. Offline caching comes in Prompt 1.10.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
