import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWakeLock, wakeOn } from '../js/wake-lock.js';
import { defaultState, normalize } from '../js/store/migrate.js';

/* Attrappe für navigator.wakeLock und document.visibilityState */
function fake({ fail = false } = {}) {
  const calls = { request: 0, release: 0 };
  const sentinels = [];
  const nav = {
    wakeLock: {
      request(type) {
        calls.request++;
        assert.equal(type, 'screen');
        if (fail) return Promise.reject(new Error('NotAllowedError'));
        const listeners = [];
        const s = {
          released: false,
          addEventListener: (ev, fn) => { if (ev === 'release') listeners.push(fn); },
          release() { if (!s.released) { s.released = true; calls.release++; listeners.forEach(f => f()); } return Promise.resolve(); },
          /* So gibt das System die Sperre frei, wenn die App in den Hintergrund geht */
          drop() { s.released = true; listeners.forEach(f => f()); },
        };
        sentinels.push(s);
        return Promise.resolve(s);
      },
    },
  };
  const doc = { visibilityState: 'visible' };
  return { nav, doc, calls, sentinels };
}
const tick = () => new Promise(r => setTimeout(r, 0));

test('Training läuft: Sperre anfordern, nur einmal', async () => {
  const f = fake();
  const wl = createWakeLock({ nav: f.nav, doc: f.doc, want: () => true });
  assert.equal(await wl.sync(), true);
  assert.equal(await wl.sync(), true);
  assert.equal(f.calls.request, 1);
  assert.equal(wl.held(), true);
});

test('Gleichzeitige Aufrufe teilen sich eine Anfrage', async () => {
  const f = fake();
  const wl = createWakeLock({ nav: f.nav, doc: f.doc });
  const [a, b] = await Promise.all([wl.sync(), wl.sync()]);
  assert.deepEqual([a, b], [true, true]);
  assert.equal(f.calls.request, 1);
});

test('Hintergrund und zurück: das System gibt frei, sync fordert neu an', async () => {
  const f = fake();
  const wl = createWakeLock({ nav: f.nav, doc: f.doc });
  await wl.sync();
  f.doc.visibilityState = 'hidden';
  f.sentinels[0].drop();
  assert.equal(wl.held(), false);
  assert.equal(await wl.sync(), false);           // im Hintergrund nicht anfordern
  assert.equal(f.calls.request, 1);
  f.doc.visibilityState = 'visible';
  assert.equal(await wl.sync(), true);
  assert.equal(f.calls.request, 2);
});

test('Training beendet oder Schalter aus: freigeben', async () => {
  const f = fake();
  let active = true;
  const settings = { wakeLock: true };
  const wl = createWakeLock({ nav: f.nav, doc: f.doc, want: () => active && wakeOn(settings) });
  await wl.sync();
  settings.wakeLock = false;
  assert.equal(await wl.sync(), false);
  await tick();
  assert.equal(f.calls.release, 1);
  settings.wakeLock = true;
  await wl.sync();
  assert.equal(f.calls.request, 2);
  active = false;
  wl.release();
  await tick();
  assert.equal(f.calls.release, 2);
  assert.equal(await wl.sync(), false);
  assert.equal(f.calls.request, 2);
});

test('Während der Anfrage beendet: die Sperre wird sofort wieder freigegeben', async () => {
  const f = fake();
  let active = true;
  const wl = createWakeLock({ nav: f.nav, doc: f.doc, want: () => active });
  const p = wl.sync();
  active = false;
  assert.equal(await p, false);
  await tick();
  assert.equal(f.calls.release, 1);
  assert.equal(wl.held(), false);
});

test('Ohne Wake Lock (ältere Browser) oder bei Ablehnung: nichts passiert, kein Fehler', async () => {
  const wl = createWakeLock({ nav: {}, doc: { visibilityState: 'visible' } });
  assert.equal(wl.supported(), false);
  assert.equal(await wl.sync(), false);
  const f = fake({ fail: true });
  const wl2 = createWakeLock({ nav: f.nav, doc: f.doc });
  assert.equal(await wl2.sync(), false);
  assert.equal(wl2.held(), false);
  assert.equal(await wl2.sync(), false);
  assert.equal(f.calls.request, 2);               // beim nächsten Mal neuer Versuch
});

test('Einstellung: Standard an, alte Stände bekommen sie dazu, nur false schaltet ab', () => {
  assert.equal(defaultState().settings.wakeLock, true);
  assert.equal(wakeOn(defaultState().settings), true);
  assert.equal(wakeOn({}), true);
  assert.equal(wakeOn(null), true);
  assert.equal(wakeOn({ wakeLock: false }), false);
  const old = { plans: defaultState().plans, sessions: [], settings: { onboardingDone: true } };
  assert.equal(normalize(old).settings.wakeLock, true);
  assert.equal(normalize({ ...old, settings: { wakeLock: false } }).settings.wakeLock, false);
  assert.equal(normalize({ ...old, settings: { wakeLock: 'nein' } }).settings.wakeLock, true);
});
