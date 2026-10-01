import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  weekDays, reportWeekStart, reportKey, nextWeekStart, weeklyReport, weekWeight, weekNutrition, weekRecords, reportHeadline, groupRecords,
} from '../js/domain/report.js';

const at = (d, h = 18) => new Date(`${d}T${String(h).padStart(2, '0')}:00`).getTime();
const monday = at('2026-09-21', 0);
const bench = (w, r, n = 3) => ({ exId: 'bank', name: 'Bankdrücken', unit: 'reps', sets: Array.from({ length: n }, () => ({ w, r })) });
const sess = (d, ex, h = 18) => ({ dayId: 'push', name: 'Push', color: 'red', startedAt: at(d, h), endedAt: at(d, h) + 60 * 6e4, ex });
const food = (kcal, protein) => ({ grams: 100, per100: { kcal, protein, fat: 0, carbs: 0 } });

test('Wochengrenzen: Montag bis Sonntag, Bericht über die Vorwoche', () => {
  assert.deepEqual(weekDays(monday), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
  assert.equal(reportWeekStart(at('2026-09-28', 8)), monday);
  assert.equal(reportWeekStart(at('2026-10-04', 22)), monday);   // Sonntag der Folgewoche: immer noch die Vorwoche
  assert.equal(reportKey(monday), '2026-W39');
  assert.equal(nextWeekStart(monday), at('2026-09-28', 0));
});

test('Einheiten zählen nur innerhalb der Woche, auch am Sonntagabend', () => {
  const S = {
    profile: { daysPerWeek: 3 },
    sessions: [sess('2026-09-20', [bench(80, 8)], 23), sess('2026-09-21', [bench(80, 8)], 7), sess('2026-09-27', [bench(80, 8)], 23), sess('2026-09-28', [bench(80, 8)], 0)],
    body: { weights: [] }, nutrition: { log: {} },
  };
  const r = weeklyReport(S, monday);
  assert.equal(r.training.count, 2);
  assert.equal(r.training.target, 3);
  assert.equal(r.training.met, false);
  assert.equal(r.training.sets, 6);
  assert.equal(r.training.tonnage, 2 * 3 * 80 * 8);
  assert.equal(r.training.minutes, 120);
});

test('Essen: Schnitt nur über Tage mit Einträgen', () => {
  const log = { '2026-09-21': [food(2000, 150)], '2026-09-23': [food(2600, 170), food(400, 10)], '2026-09-28': [food(9999, 999)] };
  const n = weekNutrition(log, weekDays(monday));
  assert.equal(n.days, 2);
  assert.equal(n.avgKcal, 2500);
  assert.equal(n.avgProtein, 165);
  assert.deepEqual(weekNutrition({}, weekDays(monday)), { days: 0, avgKcal: null, avgProtein: null });
});

test('Gewicht: 7-Tage-Schnitt am Ende gegen den vor der Woche', () => {
  const weights = [
    { date: '2026-09-18', kg: 85 }, { date: '2026-09-20', kg: 85 },
    { date: '2026-09-22', kg: 84.6 }, { date: '2026-09-25', kg: 84.4 }, { date: '2026-09-27', kg: 84.2 },
  ];
  const w = weekWeight(weights, weekDays(monday));
  assert.equal(w.ok, true);
  assert.equal(w.start, 85);                        // Schnitt am 20.9.
  assert.equal(Math.round(w.end * 100) / 100, 84.4); // Schnitt am 27.9. über 22., 25., 27.
  assert.equal(w.entries, 3);
  assert.equal(weekWeight([{ date: '2026-09-23', kg: 84 }], weekDays(monday)).ok, false);
  assert.match(weekWeight([], weekDays(monday)).reason, /keinen Gewichtseintrag/);
});

test('Rekorde der Woche gegen alle früheren Einheiten', () => {
  const sessions = [
    sess('2026-09-14', [bench(80, 8)]),
    sess('2026-09-22', [bench(82.5, 8)]),   // neuer Rekord: Gewicht, 1RM, Volumen
    sess('2026-09-25', [bench(80, 6)]),     // kein Rekord
    sess('2026-09-29', [bench(90, 5)]),     // nächste Woche, zählt nicht
  ];
  const rec = weekRecords(sessions, monday, nextWeekStart(monday));
  assert.deepEqual(rec.map(r => r.kind).sort(), ['e1rm', 'volume', 'weight']);
  assert.ok(rec.every(r => r.name === 'Bankdrücken'));
  assert.equal(rec.find(r => r.kind === 'weight').value, 82.5);
  /* Erstes Training einer Übung ist kein Rekord */
  assert.deepEqual(weekRecords([sess('2026-09-22', [bench(82.5, 8)])], monday, nextWeekStart(monday)), []);
});

test('Rekorde pro Übung zusammengefasst, je Art der beste Wert', () => {
  const g = groupRecords([
    { name: 'Bankdrücken', kind: 'weight', value: 80 }, { name: 'Kniebeugen', kind: 'weight', value: 100 },
    { name: 'Bankdrücken', kind: 'weight', value: 82.5 }, { name: 'Bankdrücken', kind: 'e1rm', value: 99 },
  ]);
  assert.deepEqual(g, [
    { name: 'Bankdrücken', items: [{ kind: 'weight', value: 82.5 }, { kind: 'e1rm', value: 99 }] },
    { name: 'Kniebeugen', items: [{ kind: 'weight', value: 100 }] },
  ]);
});

test('Muskeln und Überschrift, leere Woche ohne Daten', () => {
  const resolve = n => (n === 'Bankdrücken' ? { muscles: { primary: ['chest'], secondary: ['triceps', 'shoulders'] } } : null);
  const S = {
    profile: { daysPerWeek: 3 },
    sessions: [sess('2026-09-14', [bench(80, 8, 4)]), sess('2026-09-22', [bench(82.5, 8, 4)]), sess('2026-09-24', [bench(80, 8, 4), { name: 'Unbekannt', exId: 'x', unit: 'reps', sets: [{ w: 1, r: 1 }] }])],
    body: { weights: [{ date: '2026-09-20', kg: 85 }, { date: '2026-09-26', kg: 84.5 }] },
    nutrition: { log: { '2026-09-22': [food(2400, 160)] } },
  };
  const r = weeklyReport(S, monday, { resolve, targets: { kcal: 2800, protein: 170 } });
  assert.equal(r.muscles[0].key, 'chest');
  assert.equal(r.muscles[0].sets, 8);
  assert.equal(r.muscles[0].rating, 'low');
  assert.deepEqual(r.unknown, ['Unbekannt']);
  assert.equal(r.hasData, true);
  /* Schnitt am 26.9. über 20. und 26.9.: 84,75 kg, also −0,25, gerundet −0,2 */
  assert.equal(reportHeadline(r), '2 von 3 Einheiten, 1 Übung mit neuem Rekord, Gewicht −0,2 kg und Essen an 1 Tag erfasst.');
  assert.deepEqual(r.recordGroups.map(g => g.name), ['Bankdrücken']);
  assert.deepEqual(r.recordGroups[0].items.map(i => i.kind), ['weight', 'e1rm', 'volume']);
  const empty = weeklyReport({ profile: {}, sessions: [], body: { weights: [] }, nutrition: { log: {} } }, monday);
  assert.equal(empty.hasData, false);
  assert.equal(reportHeadline(empty), '0 von 3 Einheiten.');
  /* Einzahl (4.6): Wochenziel eine Einheit */
  assert.equal(reportHeadline(weeklyReport({ profile: { daysPerWeek: 1 }, sessions: [], body: { weights: [] }, nutrition: { log: {} } }, monday)), '0 von 1 Einheit.');
});
