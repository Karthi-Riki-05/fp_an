/* Neutered. Original drawio service-worker.js aggressively cached every
 * vendored asset, which made iterating on fp-embed.js / over-ride.js
 * impossible — even Cmd-Shift-R + ?v= cache busters were intercepted
 * by the previous SW install on the operator's browser.
 *
 * This replacement self-unregisters on activate, then exits. Any client
 * still controlled by the old SW will fall off after one page load. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
      self.registration.unregister(),
      self.clients.claim(),
    ]),
  );
});
