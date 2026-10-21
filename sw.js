const CACHE = "safeher-ai-v4";
const ASSETS = ["./", "./index.html", "./style.css", "./manifest.webmanifest", "./js/config.js", "./js/utils.js", "./js/storage.js", "./js/contacts.js", "./js/voice.js", "./js/ai.js", "./js/journey.js", "./js/guardian.js", "./js/sos.js", "./js/tips.js", "./js/history.js", "./js/statistics.js", "./js/mobile.js", "./js/script.js"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html"))));
});
