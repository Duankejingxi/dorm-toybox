/* 宿舍玩具盒 · 离线缓存
   核心文件：先用缓存秒开，同时后台去网络拉新版（下次打开就是新的）。
   奶蛙图片包等大文件：第一次用到时再缓存。跨域请求（汇率、翻译接口）不经过缓存。 */
const VERSION = "toybox-v4.3-1";
const CORE = ["./", "./index.html", "./styles.css", "./data.js", "./toys.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-64.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 汇率、翻译等外部接口直接走网络
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = req.mode === "navigate" ? "./index.html" : req;
    const cached = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => {
      if (res && res.ok && res.type === "basic") cache.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(fresh); return cached; }
    const res = await fresh;
    return res || new Response("离线了，这个文件还没缓存过。", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  })());
});
