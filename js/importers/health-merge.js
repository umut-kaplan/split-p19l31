/* Importierte Tageswerte in den Zustand übernehmen. Reine Funktionen, darum per node --test prüfbar. */

export const HEALTH_SOURCE = 'apple-health';
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

const LISTS = [
  { key: 'weights', get: S => S.body.weights, set: (S, l) => { S.body.weights = l; }, make: (v, source) => ({ date: v.date, kg: v.kg, source, method: 'scale' }) },
  { key: 'steps', get: S => S.activity.steps, set: (S, l) => { S.activity.steps = l; }, make: (v, source) => ({ date: v.date, steps: v.steps, source }) },
  { key: 'restingHr', get: S => S.activity.restingHr, set: (S, l) => { S.activity.restingHr = l; }, make: (v, source) => ({ date: v.date, bpm: v.bpm, source }) },
  { key: 'sleep', get: S => S.activity.sleep, set: (S, l) => { S.activity.sleep = l; }, make: (v, source) => ({ date: v.date, hours: v.hours, source }) },
];

function ensure(S) {
  S.body = S.body || {};
  S.body.weights = S.body.weights || [];
  S.activity = S.activity || {};
  ['steps', 'restingHr', 'sleep'].forEach(k => { S.activity[k] = S.activity[k] || []; });
  S.settings = S.settings || {};
}

/* Wie viele Tage kämen dazu, wie viele blieben wegen eigener Einträge unverändert? Ändert nichts. */
export function previewHealthImport(S, data, { since = null, source = HEALTH_SOURCE } = {}) {
  ensure(S);
  const out = {};
  for (const L of LISTS) {
    const own = new Set(L.get(S).filter(x => x.source !== source).map(x => x.date));
    const incoming = (data[L.key] || []).filter(v => !since || v.date >= since);
    const blocked = incoming.filter(v => own.has(v.date)).length;
    out[L.key] = {
      days: incoming.length, added: incoming.length - blocked, kept: blocked,
      from: incoming.length ? incoming[0].date : null, to: incoming.length ? incoming[incoming.length - 1].date : null,
    };
  }
  return out;
}

/* Übernimmt importierte Werte. Eigene Einträge (jede andere Quelle, z. B. 'manual') gewinnen.
   Werte eines früheren Imports aus derselben Quelle werden vollständig ersetzt. since: 'YYYY-MM-DD' oder null. */
export function mergeHealthImport(S, data, { since = null, source = HEALTH_SOURCE, at = Date.now() } = {}) {
  ensure(S);
  const counts = {};
  for (const L of LISTS) {
    const kept = L.get(S).filter(x => x.source !== source);
    const own = new Set(kept.map(x => x.date));
    let added = 0, blocked = 0;
    for (const v of data[L.key] || []) {
      if (since && v.date < since) continue;
      if (own.has(v.date)) { blocked++; continue; }
      kept.push(L.make(v, source));
      added++;
    }
    kept.sort(byDate);
    L.set(S, kept);
    counts[L.key] = { added, kept: blocked };
  }
  const w = S.body.weights;
  if (w.length && S.profile) S.profile.weightKg = w[w.length - 1].kg;
  S.settings.healthImport = { at, since, counts };
  return counts;
}

/* Entfernt alle importierten Werte wieder. Eigene Einträge bleiben. */
export function removeHealthImport(S, { source = HEALTH_SOURCE } = {}) {
  ensure(S);
  let removed = 0;
  for (const L of LISTS) {
    const list = L.get(S);
    const kept = list.filter(x => x.source !== source);
    removed += list.length - kept.length;
    L.set(S, kept);
  }
  const w = S.body.weights;
  if (w.length && S.profile) S.profile.weightKg = w[w.length - 1].kg;
  delete S.settings.healthImport;
  return removed;
}
