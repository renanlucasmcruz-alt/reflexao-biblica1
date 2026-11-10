/* Service worker: abre o app sem internet e mantém os arquivos principais em cache. */
const V = "rb-v8";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/privacidade.html", "/termos.html"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.pathname.startsWith("/api/") || u.hostname.endsWith("supabase.co")) return;
  if (e.request.mode === "navigate") { e.respondWith(fetch(e.request).then((r) => { caches.open(V).then((c) => c.put("/index.html", r.clone())); return r; }).catch(() => caches.match("/index.html"))); return; }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok && (u.origin === location.origin || /esm\.sh|fonts\.(googleapis|gstatic)\.com/.test(u.hostname))) { const cp = r.clone(); caches.open(V).then((c) => c.put(e.request, cp)); } return r; })));
});
