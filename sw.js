/* Offline-Betrieb: Die App-Dateien liegen im Cache. Beim Start kommt die gespeicherte Version,
   im Hintergrund lädt der Service Worker die neue. Nach einem Update CACHE hochzählen.
   Jede neue Datei gehört in eine der Listen unten; test/sw-assets.test.js prüft das. */
const CACHE = 'split-v4.5';

const CORE = [
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
  'js/store/db.js',
  'js/domain/progression.js',
  'js/domain/body.js',
  'js/domain/energy.js',
  'js/domain/streaks.js',
  'js/domain/profile-options.js',
  'js/domain/muscles.js',
  'js/domain/nutrition.js',
  'js/domain/library.js',
  'js/coach/index.js',
  'js/coach/training.js',
  'js/coach/nutrition.js',
  'js/ui/toast.js',
  'js/ui/sheet.js',
  'js/ui/plate.js',
  'js/ui/icons.js',
  'js/ui/chart.js',
  'js/ui/cards.js',
  'js/ui/image.js',
  'js/ui/suggestion.js',
  'js/views/today.js',
  'js/views/training.js',
  'js/views/workout.js',
  'js/views/history.js',
  'js/views/planedit.js',
  'js/views/library.js',
  'js/views/body.js',
  'js/views/nutrition.js',
  'js/views/nutrition-log.js',
  'js/views/profile.js',
  'js/views/profile-fields.js',
  'js/views/onboarding.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

/* Stufe 2: Übungsdaten und Bilder */
const TRAINING_DATA = [
  'js/data/exercises.js',
  'data/img/exercises/abduktoren.jpg',
  'data/img/exercises/adduktoren.jpg',
  'data/img/exercises/ausfallschritte.jpg',
  'data/img/exercises/bankdruecken.jpg',
  'data/img/exercises/barren-dips.jpg',
  'data/img/exercises/beinbeuger-sitzend.jpg',
  'data/img/exercises/beinbeuger.jpg',
  'data/img/exercises/beinpresse.jpg',
  'data/img/exercises/beinstrecker.jpg',
  'data/img/exercises/brustgestuetztes-rudern.jpg',
  'data/img/exercises/brustpresse.jpg',
  'data/img/exercises/bulgarian-split-squat.jpg',
  'data/img/exercises/butterfly.jpg',
  'data/img/exercises/enger-latzug.jpg',
  'data/img/exercises/goblet-squat.jpg',
  'data/img/exercises/hackenschmidt.jpg',
  'data/img/exercises/hammercurls.jpg',
  'data/img/exercises/hip-thrust.jpg',
  'data/img/exercises/kabel-flys-unten.jpg',
  'data/img/exercises/kabel-flys.jpg',
  'data/img/exercises/kh-bankdruecken.jpg',
  'data/img/exercises/kh-curls.jpg',
  'data/img/exercises/kh-rudern.jpg',
  'data/img/exercises/kh-schraegbankdruecken.jpg',
  'data/img/exercises/kh-schulterdruecken.jpg',
  'data/img/exercises/klimmzuege.jpg',
  'data/img/exercises/kniebeugen.jpg',
  'data/img/exercises/kreuzheben.jpg',
  'data/img/exercises/langhantel-curls.jpg',
  'data/img/exercises/langhantelrudern.jpg',
  'data/img/exercises/latzug.jpg',
  'data/img/exercises/liegestuetze.jpg',
  'data/img/exercises/plank.jpg',
  'data/img/exercises/reverse-flys.jpg',
  'data/img/exercises/rudern-sitzend.jpg',
  'data/img/exercises/rumaenisches-kreuzheben.jpg',
  'data/img/exercises/schraegbankdruecken.jpg',
  'data/img/exercises/schulterdruecken.jpg',
  'data/img/exercises/schulterpresse-maschine.jpg',
  'data/img/exercises/seitheben.jpg',
  'data/img/exercises/sz-curls.jpg',
  'data/img/exercises/trizepsdruecken-kabel.jpg',
  'data/img/exercises/wadendruecken-beinpresse.jpg',
  'data/img/exercises/wadenheben.jpg',
];

/* Stufe 2: Trainingsfunktionen */
const TRAINING = [
  'css/training.css',
  'js/data/plan-templates.js',
  'js/domain/prs.js',
  'js/domain/volume.js',
];

/* Stufe 3: Körper */
const BODY = [
  'css/body.css',
  'js/views/body-measures.js',
  'js/views/body-photos.js',
  'js/ui/silhouette.js',
  'js/ui/chart-weight.js',
];

/* Stufe 4: Lebensmittel, Suche, Barcode */
const NUTRITION_LOG = [
  'js/domain/foods.js',
  'js/data/foods-basic.js',
  'js/store/off.js',
  'js/views/food-state.js',
  'js/views/food-search.js',
  'js/views/food-scan.js',
  'js/views/food-forms.js',
  'js/vendor/zxing.min.js',
  'js/vendor/zxing.LICENSE.txt',
];

/* Stufe 4: Ziele und Übersicht */
const NUTRITION = [
  'css/nutrition.css',
];

/* Stufe 5: Serie, Wochenziele, Ziele, Abzeichen */
const MOTIVATION = [
  'css/motivation.css',
  'js/views/goals.js',
  'js/domain/motivation.js',
  'js/domain/badges.js',
  'js/ui/badge.js',
];

/* Stufe 5: Wochenbericht, Erholung, Tagesvorschlag */
const REPORT = [
  'css/report.css',
  'js/views/report.js',
  'js/views/recovery.js',
  'js/domain/recovery.js',
  'js/domain/report.js',
  'js/domain/today-plan.js',
  'js/ui/report-image.js',
];

/* Stufe 6: Aktivität von Hand */
const ACTIVITY = [
  'css/activity.css',
  'js/views/activity.js',
  'js/domain/activity.js',
];

/* Stufe 6: Import aus Apple Health */
const IMPORT = [
  'css/import.css',
  'js/views/health-import.js',
  'js/importers/index.js',
  'js/importers/apple-health.js',
  'js/importers/apple-health.worker.js',
  'js/importers/health-merge.js',
  'js/vendor/fflate.js',
  'js/vendor/fflate.LICENSE.txt',
];

/* Ergänzungen: Scheibenrechner, Aufwärmen */
const GYM = [
  'css/gym.css',
  'js/views/plates.js',
  'js/views/warmup.js',
  'js/domain/plates.js',
  'js/domain/warmup.js',
];

/* Ergänzungen: Notizen pro Übung, Bewertung nach der Einheit */
const NOTES = [
  'css/notes.css',
  'js/views/exercise-notes.js',
  'js/views/session-rating.js',
  'js/domain/notes.js',
  'js/domain/rating.js',
];

/* Ergänzungen: Planwahl in der Einrichtung, Fototafel */
const ONB = [
  'js/domain/plan-choice.js',
  'js/ui/photo-board.js',
];

/* Was ist neu */
const CHANGELOG = [
  'js/data/changelog.js',
  'js/domain/whatsnew.js',
  'js/views/whatsnew.js',
  'js/views/settings.js',
  'js/views/storage.js',
];

/* Backup-Erinnerung und Trainings als CSV */
const BACKUPCSV = [
  'js/domain/backup-reminder.js',
  'js/store/csv.js',
  'js/ui/share-file.js',
  'js/views/backup-reminder.js',
];

/* Satztypen und Supersätze */
const SETTYPES = [
  'css/settypes.css',
  'js/domain/settypes.js',
  'js/domain/superset.js',
];

/* Vergleich per QR-Code */
const COMPARE = [
  'css/compare.css',
  'js/domain/compare.js',
  'js/views/compare.js',
  'js/views/compare-scan.js',
  'js/ui/qr.js',
  'js/ui/zxing.js',
];

/* Schichtplan: Kalender, Import, Planung, Kalender-Datei */
const SHIFTS = [
  'css/shifts.css',
  'js/domain/shifts.js',
  'js/domain/shift-plan.js',
  'js/domain/ics-parse.js',
  'js/domain/ics-write.js',
  'js/views/shifts.js',
  'js/views/shift-today.js',
];

/* Schichtmodelle: Vorlagen, Einstieg „heute“, eigene Schichtarten */
const SHIFTMODELS = [
  'js/domain/shift-templates.js',
  'js/domain/shift-entry.js',
  'js/views/shift-setup.js',
  'js/views/shift-types.js',
  'js/views/shift-import.js',
];

/* Eigene Stangen und Scheiben */
const PLATES2 = [
  'js/views/plate-settings.js',
];

/* Geburtsdatum statt Alter */
const BIRTH = [
  'js/domain/birthdate.js',
  'js/views/birthdate.js',
];

/* Wissen-Karten mit Quellen */
const KNOWLEDGE = [
  'js/data/knowledge.js',
  'js/views/knowledge.js',
];

const ASSETS = [...CORE, ...TRAINING_DATA, ...TRAINING, ...BODY, ...NUTRITION_LOG, ...NUTRITION, ...MOTIVATION, ...REPORT, ...ACTIVITY, ...IMPORT, ...GYM, ...NOTES, ...ONB, ...CHANGELOG, ...BACKUPCSV, ...SETTYPES, ...COMPARE, ...SHIFTS, ...SHIFTMODELS, ...PLATES2, ...BIRTH, ...KNOWLEDGE];

self.addEventListener('install', ev => {
  /* Am Browser-Cache vorbei laden, sonst landen kurz vor einem Update geladene alte Dateien im neuen Cache */
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
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
  /* Fremde Adressen (Open Food Facts) gehen am Cache vorbei */
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
