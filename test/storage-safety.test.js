import { test } from 'node:test';
import assert from 'node:assert/strict';

/* localStorage mit Grenze nachbauen, bevor state.js geladen wird */
function makeStore(limit = Infinity) {
  const m = new Map();
  return {
    m, limit,
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem(k, v) {
      const size = [...m].reduce((a, [kk, vv]) => a + (kk === k ? 0 : vv.length), 0) + String(v).length;
      if (size > this.limit) { const e = new Error('voll'); e.name = 'QuotaExceededError'; throw e; }
      m.set(k, String(v));
    },
    removeItem: k => m.delete(k),
  };
}
globalThis.localStorage = makeStore();
const state = await import('../js/state.js');
const { S, V, KEY, LEGACY_KEY, load, save, replaceState } = state;
const { defaultState } = await import('../js/store/migrate.js');

const fresh = (limit = Infinity) => {
  globalThis.localStorage = makeStore(limit);
  Object.keys(S).forEach(k => delete S[k]);
  V.storageFull = false; V.recover = null;
};

test('#31: save() meldet Erfolg und Misserfolg, Banner-Flag folgt', () => {
  fresh(60000);
  Object.assign(S, defaultState());
  assert.equal(save(), true);
  assert.equal(V.storageFull, false);
  S.sessions = Array.from({ length: 3000 }, (_, i) => ({ id: 's' + i, ex: [], name: 'Push', startedAt: i }));
  assert.equal(save(), false);
  assert.equal(V.storageFull, true);
  S.sessions = [];
  assert.equal(save(), true);
  assert.equal(V.storageFull, false, 'Flag verschwindet, sobald wieder gespeichert werden kann');
});

test('#31: replaceState liefert das Ergebnis des Speicherns', () => {
  fresh(60000);
  Object.assign(S, defaultState());
  assert.equal(replaceState(defaultState()), true);
  const big = defaultState();
  big.sessions = Array.from({ length: 3000 }, (_, i) => ({ id: 's' + i, ex: [], name: 'Push', startedAt: i }));
  assert.equal(replaceState(big), false);
});

test('#33: abgeschnittener Stand wird gesichert, nicht überschrieben und nicht durch split.v1 ersetzt', () => {
  fresh();
  const good = JSON.stringify(defaultState());
  const broken = good.slice(0, good.length - 20);
  localStorage.setItem(KEY, broken);
  localStorage.setItem(LEGACY_KEY, JSON.stringify({ plan: null, sessions: [{ id: 'alt' }] }));
  const migrated = load();
  assert.equal(migrated, false, 'keine stille Migration aus dem alten Schlüssel');
  assert.ok(V.recover, 'Wiederherstellung angefordert');
  assert.equal(V.recover.raw, broken);
  assert.ok(V.recover.key && localStorage.getItem(V.recover.key) === broken, 'Kopie unter eigenem Schlüssel');
  assert.equal(save(), false, 'Speichern gesperrt');
  assert.equal(localStorage.getItem(KEY), broken, 'Original unverändert');
});

test('#33: gültiges JSON, das normalize ablehnt, wird ebenso geschützt', () => {
  fresh();
  const raw = JSON.stringify({ ...defaultState(), plans: [] });
  localStorage.setItem(KEY, raw);
  load();
  assert.ok(V.recover);
  S.sessions.push({ id: 'neu' });
  save();
  assert.equal(localStorage.getItem(KEY), raw);
});

test('Ohne neuen Stand wird split.v1 weiterhin übernommen', () => {
  fresh();
  localStorage.setItem(LEGACY_KEY, JSON.stringify({ sessions: [] }));
  let threw = false;
  try { load(); } catch (e) { threw = true; }
  assert.equal(threw, false);
  assert.equal(V.recover, null);
});
