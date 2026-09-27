/* Offline-Betrieb: Die App-Dateien liegen im Cache. Beim Start kommt die gespeicherte Version,
   im Hintergrund lädt der Service Worker die neue. Nach einem Update CACHE hochzählen. */
const CACHE = 'split-v2.1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/base.css',
  'css/components.css',
  'css/views.css',
  'js/app.js',
  'js/util.js',
  'js/plans.js',
  'js/state.js',
  'js/render.js',
  'js/timer.js',
  'js/store/migrate.js',
  'js/store/backup.js',
  'js/domain/progression.js',
  'js/domain/body.js',
  'js/domain/energy.js',
  'js/domain/streaks.js',
  'js/domain/profile-options.js',
  'js/ui/toast.js',
  'js/ui/sheet.js',
  'js/ui/plate.js',
  'js/ui/icons.js',
  'js/ui/chart.js',
  'js/ui/cards.js',
  'js/views/today.js',
  'js/views/training.js',
  'js/views/workout.js',
  'js/views/history.js',
  'js/views/planedit.js',
  'js/views/body.js',
  'js/views/nutrition.js',
  'js/views/profile.js',
  'js/views/profile-fields.js',
  'js/views/onboarding.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('split-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  const url = new URL(req.url);
  /* Fremde Adressen (später Open Food Facts) gehen am Cache vorbei */
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  ev.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
