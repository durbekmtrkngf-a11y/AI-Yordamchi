// Oddiy xizmat ishchisi: avval internetdan oladi, internet bo‘lmasa saqlangan nusxani ko‘rsatadi.
// (Ma‘lumotlarni offline saqlash 8-bosqichda qo‘shiladi.)
const CACHE = "seh-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).hostname.endsWith("supabase.co")) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
