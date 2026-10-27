/* Notificaciones push del descanso (las manda la Edge Function "rest-push").
   Se carga dentro del service worker que genera Workbox (vite.config.ts › importScripts). */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* sin datos */ }
  event.waitUntil(self.registration.showNotification(data.title || '¡Se acabó el descanso!', {
    body: data.body || 'Toca la siguiente serie.',
    tag: 'rest',
    renotify: true,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    vibrate: [200, 100, 200],
    data: { url: '/' }
  }));
});

// Al tocar la notificación se vuelve a la app (o se abre)
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => 'focus' in c);
    return open ? open.focus() : self.clients.openWindow('/');
  }));
});
