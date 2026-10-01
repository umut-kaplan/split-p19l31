/* 4.7: Coach prüft Schlaf und Schichten vor dem Deload, Nachtschichtwochen sind keine Volumenlücke (Q32) */
process.env.TZ = 'Europe/Berlin';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestions, strainOf, nightsInWeek, NIGHT_WEEK } from '../js/coach/training.js';
import { defaultState } from '../js/store/migrate.js';
import { defaultShifts } from '../js/domain/shifts.js';
import { weekStart } from '../js/domain/streaks.js';

const CUSTOM = [
  { id: 'tst-press', name: 'Testdrücken', custom: true, type: 'compound', unit: 'reps', muscles: { primary: ['chest'], secondary: ['triceps'] }, equipment: [], stresses: [], alternatives: [] },
  { id: 'tst-row', name: 'Testrudern', custom: true, type: 'compound', unit: 'reps', muscles: { primary: ['back'], secondary: [] }, equipment: [], stresses: [], alternatives: [] },
  { id: 'tst-calf', name: 'Testwaden', custom: true, type: 'isolation', unit: 'reps', muscles: { primary: ['calves'], secondary: [] }, equipment: [], stresses: [], alternatives: [] },
];
const NOW = new Date('2026-09-30T12:00').getTime();   // Mittwoch, KW 40
const at = d => new Date(`${d}T18:00`).getTime();
const sets = (n, w, r) => Array.from({ length: n }, () => ({ w, r, rir: 2 }));

function state(shifts = null) {
  const S = defaultState();
  S.exercisesCustom = JSON.parse(JSON.stringify(CUSTOM));
  S.plans = [{ id: 't', name: 'Test', order: ['a'], days: { a: { id: 'a', name: 'Tag A', muscles: '', color: 'red', exercises: [
    { id: 'p1', names: ['Testdrücken'], sets: 4, repMin: 6, repMax: 8, rest: 150, inc: 2.5, unit: 'reps' },
    { id: 'r1', names: ['Testrudern'], sets: 3, repMin: 8, repMax: 12, rest: 120, inc: 2.5, unit: 'reps' },
    { id: 'c1', names: ['Testwaden'], sets: 5, repMin: 10, repMax: 15, rest: 60, inc: 2.5, unit: 'reps' },
  ] } } }];
  S.activePlanId = 't';
  if (shifts) {
    S.shifts = defaultShifts();
    S.shifts.pattern = { start: '2026-08-31', days: [...shifts.pattern], template: null };
    S.shifts.overrides = shifts.overrides || {};
  }
  return S;
}
const session = (date, press, row, calf = sets(5, 40, 12)) => ({
  id: date, planId: 't', dayId: 'a', name: 'Tag A', color: 'red', startedAt: at(date), endedAt: at(date) + 36e5,
  ex: [
    { exId: 'p1', name: 'Testdrücken', unit: 'reps', sets: press, target: { sets: 4, repMin: 6, repMax: 8 } },
    ...(row ? [{ exId: 'r1', name: 'Testrudern', unit: 'reps', sets: row, target: { sets: 3, repMin: 8, repMax: 12 } }] : []),
    { exId: 'c1', name: 'Testwaden', unit: 'reps', sets: calf, target: { sets: 5, repMin: 10, repMax: 15 } },
  ],
});
const miss = [...sets(3, 80, 6), { w: 80, r: 4, rir: 0 }];
const twoMisses = S => { S.sessions = [session('2026-09-24', miss), session('2026-09-28', miss)]; return S; };
const ids = list => list.map(s => s.id.split(':')[0]);

test('Ohne Erklärung bleibt es beim Deload', () => {
  const S = twoMisses(state());
  S.checkins = { '2026-09-28': { sleepH: 7, feeling: 3 } };
  assert.deepEqual(ids(suggestions(S, NOW)), ['deload']);
});

test('Wenig Schlaf vor der Einheit: Gewicht halten statt Deload', () => {
  const S = twoMisses(state());
  S.checkins = { '2026-09-28': { sleepH: 5, feeling: 3 } };
  const list = suggestions(S, NOW);
  assert.deepEqual(ids(list), ['deload-hold']);
  const h = list[0];
  assert.equal(h.id, 'deload-hold:p1|Testdrücken:2026-W40');
  assert.equal(h.title, 'Testdrücken: Gewicht halten');
  assert.equal(h.apply, undefined, 'nichts ändert sich');
  assert.match(h.reason, /vor der Einheit am 28\.9\. hast du nur 5 Stunden geschlafen/);
  assert.match(h.reason, /keinen Deload vor und du bleibst bei 80 kg\.$/);
  /* Auch der eingetragene Schlaf (z. B. aus Apple Health) zählt, und auch die ältere der beiden Einheiten */
  const T = twoMisses(state());
  T.activity.sleep = [{ date: '2026-09-24', hours: 4.5, source: 'apple-health' }];
  assert.deepEqual(ids(suggestions(T, NOW)), ['deload-hold']);
});

test('Nach einer Nachtschicht oder bei kurzer Ruhe: Gewicht halten', () => {
  const night = twoMisses(state({ pattern: '-------', overrides: { '2026-09-27': 'N' } }));
  const [h] = suggestions(night, NOW);
  assert.equal(h.id.split(':')[0], 'deload-hold');
  assert.match(h.reason, /die Einheit am 28\.9\. lag nach einer Nachtschicht/);
  assert.equal(strainOf(night, at('2026-09-28')).kind, 'night');
  /* Spät am Vortag, Früh am Tag: weniger als 11 Stunden Ruhe */
  const quick = twoMisses(state({ pattern: '-------', overrides: { '2026-09-27': 'S', '2026-09-28': 'F' } }));
  assert.equal(strainOf(quick, at('2026-09-28')).kind, 'shortRest');
  assert.equal(suggestions(quick, NOW)[0].id.split(':')[0], 'deload-hold');
  /* Vor der ersten Nacht ist man meist ausgeschlafen: kein Grund */
  const first = twoMisses(state({ pattern: '-------', overrides: { '2026-09-28': 'N' } }));
  assert.equal(strainOf(first, at('2026-09-28')), null);
  assert.deepEqual(ids(suggestions(first, NOW)), ['deload']);
});

/* Drei Wochen mit wenig Rücken: 3 Sätze pro Woche. Waden mit 5 Sätzen liegen im Zielbereich 4 bis 10. */
const lowWeeks = S => { S.sessions = ['2026-09-08', '2026-09-15', '2026-09-22'].map(d => session(d, sets(4, 80, 7), sets(3, 60, 10))); return S; };

test('Volumenlücke nach Wochenzielen je Muskel: Waden mit 5 Sätzen sind genug', () => {
  const S = lowWeeks(state());
  const list = suggestions(S, NOW);
  assert.equal(list[0].id, 'volume:back:2026-W40');
  S.suggestions['volume:back:2026-W40'] = { status: 'declined', date: NOW };
  assert.equal(suggestions(S, NOW)[0].id, 'volume:chest:2026-W40');
  S.suggestions['volume:chest:2026-W40'] = { status: 'declined', date: NOW };
  assert.deepEqual(suggestions(S, NOW), [], 'Waden (5) und Trizeps-Rest: keine Lücke bei Waden');
});

test('Wochen mit vielen Nachtschichten sind keine Volumenlücke', () => {
  /* Muster ab Montag 31.08.: Woche 14.–20.09. mit drei Nächten */
  const pattern = [...'-------', ...'-------', ...'NNN----', ...'-------', ...'-------'];
  const one = lowWeeks(state({ pattern: pattern.join('') }));
  assert.equal(nightsInWeek(one, weekStart(at('2026-09-15'))), 3);
  assert.equal(NIGHT_WEEK, 3);
  const [v] = suggestions(one, NOW);
  assert.equal(v.id, 'volume:back:2026-W40');
  assert.match(v.reason, /Rücken kam in den letzten drei Wochen ohne die Woche mit vielen Nachtschichten \(dort reicht Halten\) auf 3, 3 Sätze/);
  /* Zwei solche Wochen: zu wenig Vergleich, kein Vorschlag */
  const two = lowWeeks(state({ pattern: [...'-------', ...'NNN----', ...'NNN----', ...'-------', ...'-------'].join('') }));
  assert.deepEqual(suggestions(two, NOW), []);
  /* Diese Woche selbst mit drei Nächten: Halten reicht, kein Vorschlag für mehr */
  const now = lowWeeks(state({ pattern: [...'-------', ...'-------', ...'-------', ...'-------', ...'NNN----'].join('') }));
  assert.deepEqual(suggestions(now, NOW), []);
  /* Eine Nachtschichtwoche ohne Training zählt nicht als fehlende Woche */
  const gap = state({ pattern: [...'-------', ...'-------', ...'NNN----', ...'-------', ...'-------'].join('') });
  gap.sessions = ['2026-09-08', '2026-09-22'].map(d => session(d, sets(4, 80, 7), sets(3, 60, 10)));
  assert.equal(suggestions(gap, NOW)[0].id, 'volume:back:2026-W40');
});
