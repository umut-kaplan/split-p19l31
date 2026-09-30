/* Importierte Tageswerte in den Zustand übernehmen. Reine Funktionen, darum per node --test prüfbar. */
import { birthDateProblem, birthDateDe, cleanBirthDate, yearsText } from '../domain/birthdate.js';
import { SEX } from '../domain/profile-options.js';

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

/* ---------- Profil ---------- */
const PROFILE_KEYS = ['birthDate', 'sex', 'heightCm'];
const sexText = k => (SEX[k] ? SEX[k].toLowerCase() : null);
const cmText = v => `${(Math.round(v * 10) / 10).toLocaleString('de-DE')} cm`;

/* Geburtsdatum, Geschlecht und Größe aus dem Export (result.profile), aber nur, was im Profil fehlt oder davon abweicht.
   Unbekannte oder unplausible Werte fallen weg. Ändert nichts.
   Liefert [{ key, value, label, text, before }]; before ist der bisherige Wert als Text oder null, wenn er fehlt. */
export function profileProposals(profile, fromHealth, now = Date.now()) {
  const p = profile || {};
  const h = fromHealth || {};
  const out = [];
  const bd = cleanBirthDate(h.birthDate);
  const cur = cleanBirthDate(p.birthDate);
  if (bd && !birthDateProblem(bd, now) && bd !== cur) {
    out.push({
      key: 'birthDate', value: bd, label: 'Geburtsdatum', text: birthDateDe(bd),
      before: cur ? birthDateDe(cur) : p.age > 0 ? `${yearsText(p.age)} alt, ohne Geburtsdatum` : null,
    });
  }
  if (sexText(h.sex) && h.sex !== p.sex) {
    out.push({ key: 'sex', value: h.sex, label: 'Geschlecht', text: sexText(h.sex), before: sexText(p.sex) });
  }
  const cm = Math.round(h.heightCm);
  if (cm >= 120 && cm <= 230 && !(p.heightCm > 0 && Math.round(p.heightCm) === cm)) {
    out.push({ key: 'heightCm', value: cm, label: 'Größe', text: cmText(cm), before: p.heightCm > 0 ? cmText(p.heightCm) : null });
  }
  return out;
}

/* Übernimmt die bestätigten Vorschläge ins Profil. Liefert die übernommenen Schlüssel. */
export function applyProfileProposals(S, proposals) {
  S.profile = S.profile || {};
  const done = [];
  for (const x of proposals || []) {
    if (!PROFILE_KEYS.includes(x.key)) continue;
    S.profile[x.key] = x.value;
    done.push(x.key);
  }
  return done;
}
