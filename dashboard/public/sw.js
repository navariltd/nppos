// NPPOS Service Worker (dev, served at /sw.js by the Vite dev server)
// Served from the site root so it controls the /nppos app scope for full
// offline loading of the app shell + caches of built assets.
// Cache Strategy: Cache First for assets, Network ONLY for API calls
// (offline API calls are blocked + return 503 so the app never serves stale data).

const CACHE_NAME = "nppos-v1";
const STATIC_ASSETS = [
  "/nppos",
  "/nppos/",
  "/assets/nppos/nppos/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls - Network ONLY. When offline, block + return a 503 offline
  // payload. These are never cached so no stale business data leaks through.
  if (url.pathname.includes("/api/method/") || url.pathname.includes("/api/resource/")) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() =>
          new Response(
            JSON.stringify({ offline: true, message: "You are offline" }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          )
        )
    );
    return;
  }

  // Built app assets (JS, CSS, fonts, images) - Cache First
  if (url.pathname.includes("/assets/nppos/nppos/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Static app assets (pwa icons etc.) - Cache First
  if (
    url.pathname.startsWith("/assets/nppos/") &&
    (request.destination === "script" ||
      request.destination === "style" ||
      request.destination === "font" ||
      request.destination === "image")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigations - Network First with offline fallback (app shell)
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // Default - Network only
  event.respondWith(
    fetch(request).catch(() => new Response("Offline", { status: 503 }))
  );
});

// Cache First strategy
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response(
      JSON.stringify({ offline: true, message: "You are offline" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Network First with offline fallback strategy (app shell only)
async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/nppos");
      if (offlinePage) {
        return offlinePage;
      }
    }
    return new Response(
      JSON.stringify({ offline: true, message: "You are offline" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Background sync - notify clients to trigger a push of pending redemptions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-nppos") {
    event.waitUntil(notifyClients());
  }
});

async function notifyClients() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({ type: "SYNC_TRIGGER" });
    });
  } catch (error) {
    console.error("Background sync failed:", error);
  }
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});