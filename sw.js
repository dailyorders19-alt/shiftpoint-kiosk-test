const CACHE_NAME = "shiftpoint-v1246";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./scan.html",
  "./kiosk.html",
  "./style.css",
  "./lucide.min.js",
  "./flatpickr.min.css",
  "./flatpickr.min.js",
  "./flatpickr-hu.js",
  "./flatpickr-ro.js",
  "./language.js",
  "./supabase-config.js",
  "./storage.js",
  "./scanner.js",
  "./export.js",
  "./app.js",
  "./manifest.json",
  "./scan-manifest.json",
  "./kiosk-manifest.json",
  "./icon-192.svg",
  "./icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    const requestUrl = new URL(event.request.url);
    const fallbackPage = requestUrl.pathname.endsWith("/kiosk.html")
      ? "./kiosk.html"
      : requestUrl.pathname.endsWith("/scan.html")
        ? "./scan.html"
        : "./index.html";

    event.respondWith(
      fetch(event.request).catch(() => caches.match(fallbackPage))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
