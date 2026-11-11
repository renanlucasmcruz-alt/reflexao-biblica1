/* Service worker: abre o app sem internet e mantém os arquivos principais em cache. */
const V = "rb-v32";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/privacidade.html", "/termos.html"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.pathname.startsWith("/api/") || u.hostname.endsWith("supabase.co")) return;
  if (e.request.mode === "navigate") { e.respondWith(fetch(e.request).then((r) => { caches.open(V).then((c) => c.put("/index.html", r.clone())); return r; }).catch(() => caches.match("/index.html"))); return; }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok && (u.origin === location.origin || /esm\.sh|fonts\.(googleapis|gstatic)\.com/.test(u.hostname))) { const cp = r.clone(); caches.open(V).then((c) => c.put(e.request, cp)); } return r; })));
});
/* Lembrete diário: o servidor só "cutuca"; o texto do aviso fica aqui. */
self.addEventListener("push", (e) => {
  const h = new Date().getHours(); const t = h < 12 ? "Bom dia ☕" : h < 18 ? "Boa tarde ☕" : "Boa noite 🌙";
  e.waitUntil(self.registration.showNotification(`${t} Sua reflexão de hoje está pronta`, { body: "Dois minutos com a Palavra: um texto, uma reflexão e uma pergunta para levar com você.", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "daily", renotify: false, data: { url: "/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => { const c = cs.find((x) => x.url.startsWith(self.location.origin)); return c ? c.focus() : self.clients.openWindow("/"); }));
});
