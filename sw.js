// Xizmat ishchisi: avval internetdan oladi, internet bo'lmasa saqlangan nusxani ko'rsatadi.
// Supabase so'rovlari bu yerda saqlanmaydi (ma'lumotni store.js telefon xotirasida saqlaydi).
const CACHE = "seh-v3";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).hostname.endsWith("supabase.co")) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
