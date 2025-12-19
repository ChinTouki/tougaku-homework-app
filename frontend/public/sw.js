// frontend/public/sw.js

self.addEventListener("install", (event) => {
  // 立即激活新的 SW
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // 将来可以在这里清理旧缓存
  clients.claim();
});

self.addEventListener("fetch", (event) => {
  // 现在先不做缓存，全部放行给网络
  return;
});
