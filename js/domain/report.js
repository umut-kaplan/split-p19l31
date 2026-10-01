/* Wochenbericht: alle Zahlen einer Woche (Montag bis Sonntag). Reine Funktionen.
   Durchschnitte beim Essen zählen nur Tage mit Einträgen, damit leere Tage den Schnitt nicht verfälschen. */
import { weekStart } from './streaks.js';
import { plural } from '../util.js';
import { isoWeekKey, prevWeekStart, weekMuscleSets, volumeRating } from './volume.js';
import { sessionRecords } from './prs.js';
import { movingAverage } from './body.js';
import { dayTotals } from './nutrition.js';
import { MUSCLES } from './muscles.js';
import { workSets, tonnage } from './settypes.js';

const localDay = t => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* Die sieben Kalendertage einer Woche als 'YYYY-MM-DD' */
export function weekDays(start) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return localDay(d.getTime());
  });
}

export function nextWeekStart(start) {
  const d = new Date(start);
  d.setDate(d.getDate() + 7);
  return weekStart(d.getTime());
}

/* Woche, über die montags berichtet wird: die Vorwoche von now */
export const reportWeekStart = now => prevWeekStart(weekStart(now));
export const reportKey = start => isoWeekKey(start);

/* Gewicht: gleitender 7-Tage-Schnitt am letzten Eintrag der Woche gegen den am letzten Eintrag davor
   (höchstens 7 Tage vor Wochenbeginn), sonst gegen den ersten Eintrag der Woche. */
export function weekWeight(weights, days) {
  const first = days[0], last = days[6];
  const ma = movingAverage(weights || [], 7);
  const inWeek = ma.filter(p => p.date >= first && p.date <= last);
  if (!inWeek.length) return { ok: false, reason: 'In dieser Woche gibt es keinen Gewichtseintrag.' };
  const end = inWeek[inWeek.length - 1];
  const limit = localDay(new Date(first + 'T12:00').getTime() - 7 * 864e5);
  const before = ma.filter(p => p.date < first && p.date >= limit);
  const start = before.length ? before[before.length - 1] : inWeek[0];
  if (start.date === end.date) return { ok: false, reason: 'Für einen Trend fehlt ein zweiter Gewichtseintrag.' };
  return { ok: true, start: start.avg, end: end.avg, delta: end.avg - start.avg, from: start.date, to: end.date, entries: inWeek.length };
}

/* Essen: Schnitt über Tage mit Einträgen */
export function weekNutrition(log, days) {
  const filled = days.filter(d => (log[d] || []).length);
  if (!filled.length) return { days: 0, avgKcal: null, avgProtein: null };
  const tot = filled.map(d => dayTotals(log, d));
  return {
    days: filled.length,
    avgKcal: tot.reduce((a, t) => a + t.kcal, 0) / filled.length,
    avgProtein: tot.reduce((a, t) => a + t.protein, 0) / filled.length,
  };
}

/* Rekorde, die in dieser Woche aufgestellt wurden, jeweils gegen alle früheren Einheiten */
export function weekRecords(sessions, start, end) {
  const sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const out = [];
  sorted.forEach((s, i) => {
    if (s.startedAt < start || s.startedAt >= end) return;
    sessionRecords(sorted.slice(0, i), (s.ex || []).filter(x => x.sets && x.sets.length))
      .forEach(r => r.items.forEach(it => out.push({ name: r.name, kind: it.kind, value: it.value, date: s.startedAt })));
  });
  return out;
}

/* Rekorde pro Übung zusammenfassen, je Art nur der beste Wert der Woche.
   Liefert [{ name, items: [{ kind, value }] }] in der Reihenfolge, in der die Übungen zuerst einen Rekord hatten. */
const KIND_ORDER = ['weight', 'e1rm', 'volume', 'reps', 'time'];
export function groupRecords(records) {
  const map = new Map();
  records.forEach(r => {
    let g = map.get(r.name);
    if (!g) map.set(r.name, (g = { name: r.name, best: {} }));
    if (!(g.best[r.kind] >= r.value)) g.best[r.kind] = r.value;
  });
  return [...map.values()].map(g => ({
    name: g.name,
    items: KIND_ORDER.filter(k => g.best[k] != null).map(k => ({ kind: k, value: g.best[k] })),
  }));
}

/* Der ganze Bericht. ctx: { resolve, targets: { kcal, protein } | null, target: Einheiten pro Woche } */
export function weeklyReport(S, start, ctx = {}) {
  const end = nextWeekStart(start);
  const days = weekDays(start);
  const sessions = (S.sessions || []).filter(s => s.startedAt >= start && s.startedAt < end);
  const target = ctx.target || (S.profile && S.profile.daysPerWeek) || 3;
  const resolve = ctx.resolve || (() => null);
  const vol = weekMuscleSets(S.sessions || [], start, resolve);
  const muscles = Object.keys(vol.sets)
    .filter(m => vol.sets[m] > 0)
    .map(m => ({ key: m, label: MUSCLES[m] || m, sets: vol.sets[m], rating: volumeRating(vol.sets[m]) }))
    .sort((a, b) => b.sets - a.sets);
  /* Harte Sätze und bewegtes Gewicht ohne Aufwärmsätze, Dropsätze zählen mit */
  const setsTotal = sessions.reduce((a, s) => a + (s.ex || []).reduce((b, x) => b + workSets(x.sets).length, 0), 0);
  const moved = sessions.reduce((a, s) => a + (s.ex || []).reduce((b, x) =>
    b + (x.unit === 'sec' ? 0 : tonnage(x.sets)), 0), 0);
  const minutes = sessions.reduce((a, s) => a + (s.endedAt && s.endedAt > s.startedAt ? Math.min(180, (s.endedAt - s.startedAt) / 6e4) : 0), 0);
  const weight = weekWeight(S.body && S.body.weights, days);
  const nutrition = weekNutrition((S.nutrition && S.nutrition.log) || {}, days);
  const records = weekRecords(S.sessions || [], start, end);
  const weightsInWeek = ((S.body && S.body.weights) || []).filter(w => w.date >= days[0] && w.date <= days[6]).length;
  return {
    key: reportKey(start), start, end, days,
    training: {
      count: sessions.length, target, met: sessions.length >= target, sets: setsTotal, tonnage: moved, minutes,
      sessions: sessions.map(s => ({ name: s.name, color: s.color, date: s.startedAt })),
    },
    muscles, unknown: vol.unknown,
    musclesOk: muscles.filter(m => m.rating === 'ok').length,
    records, recordGroups: groupRecords(records), weight, nutrition,
    targets: ctx.targets || null,
    hasData: sessions.length > 0 || weightsInWeek > 0 || nutrition.days > 0,
  };
}

/* Kurzfassung für die Karte auf der Startseite, ein Satz */
export function reportHeadline(r) {
  const parts = [`${r.training.count} von ${r.training.target} ${plural(r.training.target, 'Einheit', 'Einheiten')}`];
  const n = r.recordGroups.length;
  if (n) parts.push(`${n} ${n === 1 ? 'Übung' : 'Übungen'} mit neuem Rekord`);
  if (r.weight.ok) {
    const d = Math.round(r.weight.delta * 10) / 10;
    parts.push(`Gewicht ${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toLocaleString('de-DE')} kg`);
  }
  if (r.nutrition.days) parts.push(`Essen an ${r.nutrition.days} ${r.nutrition.days === 1 ? 'Tag' : 'Tagen'} erfasst`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} und ${parts[parts.length - 1]}.` : `${parts[0]}.`;
}
