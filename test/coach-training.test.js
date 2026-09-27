import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestions, missedTarget, deloadWeight } from '../js/coach/training.js';
import { pendingSuggestions, decide } from '../js/coach/index.js';
import { defaultState } from '../js/store/migrate.js';
import { findExercise } from '../js/domain/library.js';

/* Eigene Testübungen, damit die Tests nicht von der Bibliothek abhängen */
const CUSTOM = [
  { id: 'tst-press', name: 'Testdrücken', custom: true, type: 'compound', unit: 'reps', muscles: { primary: ['chest'], secondary: ['triceps'] }, equipment: [], stresses: ['Schulter'], alternatives: ['tst-machine'] },
  { id: 'tst-machine', name: 'Testmaschine', custom: true, type: 'compound', unit: 'reps', muscles: { primary: ['chest'], secondary: [] }, equipment: [], stresses: [], alternatives: [] },
  { id: 'tst-row', name: 'Testrudern', custom: true, type: 'compound', unit: 'reps', muscles: { primary: ['back'], secondary: ['biceps'] }, equipment: [], stresses: [], alternatives: [] },
  { id: 'tst-pull', name: 'Testzug', custom: true, type: 'compound', unit: 'reps', muscles: { primary: ['back'], secondary: [] }, equipment: [], stresses: [], alternatives: [] },
];
const NOW = new Date('2026-09-30T12:00').getTime();   // Mittwoch, Kalenderwoche 40
const at = d => new Date(`${d}T18:00`).getTime();

function state() {
  const S = defaultState();
  S.exercisesCustom = JSON.parse(JSON.stringify(CUSTOM));
  S.plans = [{
    id: 't', name: 'Test', order: ['a'], days: {
      a: { id: 'a', name: 'Tag A', muscles: '', color: 'red', exercises: [
        { id: 'p1', names: ['Testdrücken'], sets: 4, repMin: 6, repMax: 8, rest: 150, inc: 2.5, unit: 'reps' },
        { id: 'r1', names: ['Testrudern'], sets: 3, repMin: 8, repMax: 12, rest: 120, inc: 2.5, unit: 'reps' },
      ] },
    },
  }];
  S.activePlanId = 't';
  return S;
}
const sets = (n, w, r) => Array.from({ length: n }, () => ({ w, r, rir: 2 }));
/* Wie workout.js speichert: mit dem Ziel, das beim Training galt */
const session = (date, press, row) => ({
  id: date, planId: 't', dayId: 'a', name: 'Tag A', color: 'red', startedAt: at(date), endedAt: at(date) + 36e5,
  ex: [
    ...(press ? [{ exId: 'p1', name: 'Testdrücken', unit: 'reps', sets: press, target: { sets: 4, repMin: 6, repMax: 8 } }] : []),
    ...(row ? [{ exId: 'r1', name: 'Testrudern', unit: 'reps', sets: row, target: { sets: 3, repMin: 8, repMax: 12 } }] : []),
  ],
});
const kinds = list => list.map(s => s.id.split(':')[0]);

test('Hilfsregeln', () => {
  assert.equal(missedTarget(sets(4, 80, 6), { sets: 4, repMin: 6 }), false);
  assert.equal(missedTarget(sets(3, 80, 8), { sets: 4, repMin: 6 }), true);
  assert.equal(missedTarget([...sets(3, 80, 6), { w: 80, r: 5 }], { sets: 4, repMin: 6 }), true);
  assert.equal(deloadWeight(80, 2.5), 72.5);
  assert.equal(deloadWeight(20, 1), 18);
  assert.equal(deloadWeight(10, 0), 9);
});

test('Zu wenige Daten: keine Vorschläge', () => {
  assert.deepEqual(suggestions(state(), NOW), []);
});

test('Deload nach zwei verfehlten Einheiten hintereinander', () => {
  const S = state();
  const miss = [...sets(3, 80, 6), { w: 80, r: 4, rir: 0 }];
  S.sessions = [session('2026-09-21', sets(4, 80, 6)), session('2026-09-24', miss)];
  assert.deepEqual(kinds(suggestions(S, NOW)), [], 'nur einmal verfehlt');
  S.sessions.push(session('2026-09-28', miss));
  const list = suggestions(S, NOW);
  assert.deepEqual(kinds(list), ['deload']);
  const d = list[0];
  assert.equal(d.id, 'deload:p1|Testdrücken:2026-W40');
  assert.match(d.reason, /72,5 statt 80 kg/);
  assert.doesNotMatch(d.reason, /[.!?]\s+[A-ZÄÖÜ]/, 'genau ein Satz');
  assert.match(d.reason, /\.$/);
  decide(S, d, 'accepted', NOW);
  assert.deepEqual(S.trainingOverrides['p1|Testdrücken'], { weight: 72.5, createdAt: NOW });
  assert.deepEqual(pendingSuggestions(S, NOW, 'training'), [], 'nach dem Annehmen kein zweites Mal');
});

test('Abgelehnter Deload bleibt weg', () => {
  const S = state();
  const miss = sets(2, 80, 6);
  S.sessions = [session('2026-09-24', miss), session('2026-09-28', miss)];
  const [d] = suggestions(S, NOW);
  decide(S, d, 'declined', NOW);
  assert.deepEqual(pendingSuggestions(S, NOW, 'training'), []);
  assert.equal(S.trainingOverrides, undefined);
});

test('Volumenlücke: ein Satz mehr, dann die nächste Muskelgruppe', () => {
  const S = state();
  // Drei abgeschlossene Wochen mit je 3 Sätzen Rudern und 4 Sätzen Drücken
  S.sessions = ['2026-09-08', '2026-09-15', '2026-09-22'].map(d => session(d, sets(4, 80, 7), sets(3, 60, 10)));
  const list = suggestions(S, NOW);
  assert.deepEqual(kinds(list), ['volume']);
  const v = list[0];
  assert.equal(v.id, 'volume:back:2026-W40');         // Rücken vor Brust
  assert.match(v.reason, /Rücken kam in den letzten drei Wochen auf 3, 3, 3 Sätze/);
  assert.match(v.reason, /Testrudern einen Satz mehr vor \(4 statt 3\)/);
  decide(S, v, 'accepted', NOW);
  assert.equal(S.plans[0].days.a.exercises[1].sets, 4);
  // Entschieden: jetzt rückt die Brust nach
  const next = suggestions(S, NOW);
  assert.equal(next.length, 1);
  assert.equal(next[0].id, 'volume:chest:2026-W40');
});

test('Volumenlücke ohne passende Übung im Plan: neue Übung aus der Bibliothek', () => {
  const S = state();
  S.plans[0].days.a.exercises[1].sets = 6;             // Rudern ist schon voll
  S.sessions = ['2026-09-08', '2026-09-15', '2026-09-22'].map(d => session(d, sets(4, 80, 7), sets(3, 60, 10)));
  const [v] = suggestions(S, NOW);
  assert.equal(v.id, 'volume:back:2026-W40');
  assert.equal(v.acceptLabel, 'Übung hinzufügen');
  decide(S, v, 'accepted', NOW);
  const added = S.plans[0].days.a.exercises[2];
  assert.equal(added.sets, 3);
  assert.ok(findExercise(added.names[0], S.exercisesCustom).muscles.primary.includes('back'));
});

test('Volumenlücke nur mit drei abgeschlossenen Trainingswochen', () => {
  const S = state();
  S.sessions = ['2026-09-15', '2026-09-22'].map(d => session(d, sets(4, 80, 7), sets(3, 60, 10)));
  assert.deepEqual(suggestions(S, NOW), []);
});

test('Einschränkung: Übung gegen schonende Alternative tauschen', () => {
  const S = state();
  S.profile.limitations.tags = ['Schulter'];
  const list = suggestions(S, NOW);
  assert.deepEqual(kinds(list), ['limit']);
  const l = list[0];
  assert.equal(l.id, 'limit:p1|Testdrücken:Schulter');
  assert.match(l.reason, /Testdrücken belastet deinen eingetragenen Bereich Schulter, Testmaschine/);
  decide(S, l, 'accepted', NOW);
  assert.deepEqual(S.plans[0].days.a.exercises[0].names, ['Testmaschine']);
  assert.equal(S.plans[0].days.a.exercises[0].sets, 4);
  assert.deepEqual(pendingSuggestions(S, NOW, 'training'), []);
});

test('Keine Alternative ohne Belastung: kein Vorschlag', () => {
  const S = state();
  S.exercisesCustom[1].stresses = ['Schulter'];
  S.profile.limitations.tags = ['Schulter'];
  assert.deepEqual(suggestions(S, NOW), []);
});

test('Keine doppelten Vorschläge, auch wenn eine Übung zweimal im Plan steht', () => {
  const S = state();
  S.profile.limitations.tags = ['Schulter'];
  S.plans[0].order.push('b');
  S.plans[0].days.b = { id: 'b', name: 'Tag B', muscles: '', color: 'blue', exercises: [
    { id: 'p1', names: ['Testdrücken'], sets: 3, repMin: 6, repMax: 8, rest: 150, inc: 2.5, unit: 'reps' },
  ] };
  const miss = sets(2, 80, 6);
  S.sessions = [session('2026-09-24', miss), session('2026-09-28', miss)];
  const ids = suggestions(S, NOW).map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids.map(i => i.split(':')[0]).sort(), ['deload', 'limit']);
});
