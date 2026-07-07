// Service Worker — cache leve para HTML (NetworkFirst) e assets estáticos hasheados (CacheFirst).
// + recebimento de web push.
// Registro só ocorre em produção via src/lib/pwa-register.ts (preview do Lovable proibido).

const VERSION = "v1";
const HTML_CACHE = `html-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== HTML_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Nunca cachear rotas de API, OAuth, webhook, SSR de dados
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_serverFn") ||
    url.pathname.startsWith("/~oauth") ||
    url.pathname.startsWith("/auth")
  ) return;

  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req);
          const cache = await caches.open(HTML_CACHE);
          cache.put(req, net.clone());
          return net;
        } catch {
          const cache = await caches.open(HTML_CACHE);
          const cached = await cache.match(req);
          return cached || new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // Assets hasheados: cache-first
  if (
    url.pathname.startsWith("/assets/") ||
    /\.(js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const net = await fetch(req);
          if (net.ok) cache.put(req, net.clone());
          return net;
        } catch {
          return cached || new Response("Offline", { status: 503 });
        }
      })(),
    );
  }
});

// Web Push
self.addEventListener("push", (event) => {
  let payload = { title: "Robô de Lucro", body: "", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch { /* ignore */ }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window" });
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })(),
  );
});
