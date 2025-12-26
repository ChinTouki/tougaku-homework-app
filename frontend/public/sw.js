// frontend/public/sw.js
// 安全版本：不拦截页面路由，不拦截 API

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ⚠️ 不要拦截 fetch（让浏览器自己处理路由）
