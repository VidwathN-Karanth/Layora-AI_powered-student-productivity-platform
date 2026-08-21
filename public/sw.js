/*
 * Layora's service worker — notifications only.
 *
 * This exists because `new Notification(...)` is not how phones work. Android
 * Chrome throws "Illegal constructor" for it outright, and iOS Safari has no
 * Notification API at all unless the site has been added to the Home Screen.
 * Both of them deliver notifications through a service worker's
 * showNotification() instead, which is what this file is for.
 *
 * It deliberately does not cache anything. Layora is a live dashboard; a stale
 * cached shell would be worse than a slow one, and offline support was never
 * asked for.
 */

self.addEventListener('install', () => {
  // Take over straight away rather than waiting for every old tab to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const isExternal = (url) => typeof url === 'string' && /^https?:\/\//i.test(url);

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data && event.notification.data.url;

  event.waitUntil((async () => {
    // A course's own site belongs in its own tab.
    if (isExternal(url)) {
      await self.clients.openWindow(url);
      return;
    }

    const target = url || '/dashboard/';
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    // Reuse an open Layora window if there is one; opening a second copy of a
    // dashboard the student already has open is not helpful.
    for (const client of windows) {
      if (!client.url.includes(self.location.origin)) continue;
      await client.focus();
      if (client.navigate && !client.url.endsWith(target)) {
        await client.navigate(target).catch(() => {});
      }
      return;
    }

    await self.clients.openWindow(target);
  })());
});
