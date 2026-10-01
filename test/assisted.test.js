/* Übungen mit Gegengewicht (4.7, Prüfung H1): Die kg sind Unterstützung, weniger ist schwerer.
   Keine kg-Steigerung, kein Deload, kein kg-Rekord, kein bewegtes Gewicht. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/data/exercises.js';
import { isAssisted, exerciseTonnage, findExercise } from '../js/domain/library.js';
import { suggest } from '../js/domain/progression.js';
import { personalRecords, setRecords, sessionRecords, bestSummary, exerciseStats, mergeRecords } from '../js/domain/prs.js';
import { totalTonnage, firstRecordAt } from '../js/domain/badges.js';
import { suggestions } from '../js/coach/training.js';
import { defaultState } from '../js/store/migrate.js';

const NOW = new Date('2026-09-30T12:00').getTime();
const at = d => new Date(`${d}T18:00`).getTime();
const sets = (n, w, r) => Array.from({ length: n }, () => ({ w, r, rir: 2 }));
const sess = (date, name, exId, s, extra = {}) => ({
  id: date + name, planId: 'p', dayId: 'a', name: 'Tag A', color: 'red', startedAt: at(date), endedAt: at(date) + 36e5,
  ex: [{ exId, name, unit: 'reps', sets: s, ...extra }],
});

test('Daten: genau Dips und Klimmzüge mit Unterstützung tragen assisted, beide an der Maschine mit Gegengewicht', () => {
  const ids = EXERCISES.filter(e => e.assisted).map(e => e.id).sort();
  assert.deepEqual(ids, ['dips-assistiert', 'klimmzuege-assistiert']);
  EXERCISES.forEach(e => assert.equal(typeof e.assisted, 'boolean', e.id));
  EXERCISES.filter(e => e.assisted).forEach(e => {
    assert.deepEqual(e.equipment, ['assist-maschine'], e.id);
    assert.equal(e.autoLoad, null, e.id);
    assert.equal(e.unit, 'reps', e.id);
  });
});

test('isAssisted: über Bibliothek, id, Namen und Alias; eine eigene Übung gleichen Namens ist es nicht', () => {
  assert.equal(isAssisted(findExercise('Klimmzüge mit Unterstützung')), true);
  assert.equal(isAssisted({ exId: 'dips-assistiert', name: 'egal' }), true);
  assert.equal(isAssisted({ id: 'x', names: ['Assisted Pull-ups'] }), true);
  assert.equal(isAssisted({ exId: 'p9', name: 'Dips mit Unterstützung' }), true);
  assert.equal(isAssisted({ exId: 'latzug', name: 'Klimmzüge' }), false);
  assert.equal(isAssisted(findExercise('Klimmzüge')), false);
  assert.equal(isAssisted({ id: 'c1', name: 'Assisted Dips', custom: true }), false);
  assert.equal(isAssisted({ exId: 'c1', name: 'Assisted Dips' }, [{ id: 'c1', name: 'Assisted Dips', custom: true }]), false);
  assert.equal(isAssisted(null), false);
});

test('Progression: weniger Unterstützung statt mehr Gewicht, gemessen am schwersten Satz', () => {
  const e = { id: 'klimmzuege-assistiert', sets: 3, repMin: 6, repMax: 10, inc: 5, unit: 'reps' };
  const lib = findExercise('klimmzuege-assistiert');
  const name = 'Klimmzüge mit Unterstützung';
  assert.equal(suggest([], e, name, lib).kind, 'new');
  assert.match(suggest([], e, name, lib).sub, /Unterstützung/);
  /* Nicht alle oben: gleiche Unterstützung, die kleinste vom letzten Mal */
  const hold = suggest([sess('2026-09-28', name, e.id, [{ w: 30, r: 10, rir: 2 }, { w: 30, r: 8, rir: 1 }, { w: 35, r: 9, rir: 1 }])], e, name, lib);
  assert.equal(hold.kind, 'hold');
  assert.equal(hold.weight, 30);
  assert.equal(hold.text, 'Gleiche Unterstützung: 30 kg');
  assert.match(hold.sub, /Weniger Unterstützung, sobald alle Sätze oben sind\./);
  assert.ok(!/Mehr Gewicht|mehr Gewicht/.test(hold.text + hold.sub));
  /* Alle oben: Gegengewicht um die Steigerung kleiner */
  const up = suggest([sess('2026-09-28', name, e.id, sets(3, 30, 10))], e, name, lib);
  assert.equal(up.kind, 'up');
  assert.equal(up.weight, 25);
  assert.equal(up.text, 'Weniger Unterstützung: 25 kg');
  /* Ohne Steigerung im Plan: 2,5 kg; am Ende ohne Unterstützung */
  assert.equal(suggest([sess('2026-09-28', name, e.id, sets(3, 30, 10))], { ...e, inc: 0 }, name, lib).weight, 27.5);
  const zero = suggest([sess('2026-09-28', name, e.id, sets(3, 5, 10))], e, name, lib);
  assert.equal(zero.weight, 0);
  assert.equal(zero.text, 'Ohne Unterstützung versuchen');
  /* Ohne Bibliothekseintrag zählt das Feld am Eintrag */
  assert.equal(suggest([sess('2026-09-28', name, e.id, sets(3, 30, 10))], { ...e, assisted: true }, name).weight, 25);
  /* Normale Übung unverändert */
  const n = suggest([sess('2026-09-28', 'Latzug', 'latzug', sets(3, 60, 10))], { id: 'latzug', sets: 3, repMin: 6, repMax: 10, inc: 2.5, unit: 'reps' }, 'Latzug', findExercise('Latzug'));
  assert.equal(n.weight, 62.5);
});

test('Rekorde: kein Gewicht, kein 1RM, kein Volumen; Wiederholungen nur bei gleicher oder weniger Unterstützung', () => {
  const name = 'Dips mit Unterstützung';
  const id = 'dips-assistiert';
  const hist = [
    sess('2026-09-21', name, id, [{ w: 30, r: 8, rir: 2 }, { w: 30, r: 7, rir: 2 }]),
    /* Mehr Wiederholungen, aber mit mehr Unterstützung: kein Bestwert */
    sess('2026-09-23', name, id, [{ w: 40, r: 12, rir: 2 }]),
  ];
  const rec = personalRecords(hist).get(`${id}|${name}`);
  assert.equal(rec.assisted, true);
  assert.equal(rec.weight, null);
  assert.equal(rec.e1rm, null);
  assert.equal(rec.volume, null);
  assert.equal(rec.reps.value, 8);
  assert.equal(rec.reps.assist, 30);
  assert.equal(bestSummary(rec).text, '8 Wdh. bei 30 kg Unterstützung');
  /* Gleich viele Wiederholungen mit weniger Unterstützung ersetzen den Bestwert, ohne Rekord zu heißen */
  const rec2 = personalRecords([...hist, sess('2026-09-25', name, id, [{ w: 25, r: 8, rir: 2 }])]).get(`${id}|${name}`);
  assert.deepEqual([rec2.reps.value, rec2.reps.assist], [8, 25]);

  /* Satz im Training */
  assert.deepEqual(setRecords(rec, [], { w: 35, r: 10, rir: 2 }), [], 'mehr Unterstützung zählt nicht');
  assert.deepEqual(setRecords(rec, [], { w: 30, r: 9, rir: 2 }), [{ kind: 'reps', value: 9, assist: 30 }]);
  assert.deepEqual(setRecords(rec, [], { w: 20, r: 9, rir: 2 }), [{ kind: 'reps', value: 9, assist: 20 }]);
  assert.deepEqual(setRecords(rec, [{ w: 20, r: 10, rir: 2 }], { w: 30, r: 9, rir: 2 }), [], 'früherer Satz mit weniger Unterstützung war besser');
  assert.deepEqual(setRecords(rec, [{ w: 40, r: 12, rir: 2 }], { w: 30, r: 9, rir: 2 }).length, 1, 'früherer Satz mit mehr Unterstützung zählt nicht');
  /* Aufwärmen nie */
  assert.deepEqual(setRecords(rec, [], { w: 30, r: 12, rir: 2, t: 'w' }), []);

  /* Zusammenfassung nach der Einheit */
  assert.deepEqual(sessionRecords(hist, [{ exId: id, name, unit: 'reps', sets: [{ w: 45, r: 15, rir: 2 }] }]), []);
  assert.deepEqual(sessionRecords(hist, [{ exId: id, name, unit: 'reps', sets: [{ w: 30, r: 10, rir: 2 }, { w: 25, r: 10, rir: 2 }] }]),
    [{ name, items: [{ kind: 'reps', value: 10, assist: 25 }] }]);

  /* Zusammenführen über zwei Pläne */
  const other = personalRecords([sess('2026-09-24', name, 'x2', [{ w: 20, r: 8, rir: 2 }])]).get(`x2|${name}`);
  assert.deepEqual([mergeRecords([rec, other]).reps.value, mergeRecords([rec, other]).reps.assist], [8, 20]);
  /* Kennzahlen je Einheit */
  const st = exerciseStats([{ w: 30, r: 8 }, { w: 20, r: 8 }, { w: 40, r: 6 }], 'reps', true);
  assert.deepEqual([st.weight, st.e1rm, st.volume, st.reps, st.assist], [null, null, null, 8, 20]);
});

test('Bewegtes Gewicht und Abzeichen: Gegengewicht zählt nicht', () => {
  const x = { exId: 'klimmzuege-assistiert', name: 'Klimmzüge mit Unterstützung', unit: 'reps', sets: sets(3, 40, 10) };
  assert.equal(exerciseTonnage(x), 0);
  assert.equal(exerciseTonnage({ exId: 'latzug', name: 'Latzug', unit: 'reps', sets: sets(3, 40, 10) }), 1200);
  assert.equal(exerciseTonnage({ exId: 'plank', name: 'Plank', unit: 'sec', sets: sets(3, 0, 60) }), 0);
  assert.equal(totalTonnage([{ ex: [x, { exId: 'latzug', name: 'Latzug', unit: 'reps', sets: sets(1, 50, 10) }] }]), 500);
  /* Mehr Wiederholungen mit mehr Unterstützung sind kein Rekord-Abzeichen, mit weniger schon */
  const name = 'Klimmzüge mit Unterstützung';
  const a = sess('2026-09-21', name, 'klimmzuege-assistiert', sets(3, 30, 8));
  assert.equal(firstRecordAt([a, sess('2026-09-23', name, 'klimmzuege-assistiert', sets(3, 40, 12))]), null);
  assert.ok(firstRecordAt([a, sess('2026-09-23', name, 'klimmzuege-assistiert', sets(3, 30, 9))]) > 0);
});

test('Coach: kein Deload für Übungen mit Gegengewicht', () => {
  const S = defaultState();
  S.plans = [{ id: 'p', name: 'Test', order: ['a'], days: { a: { id: 'a', name: 'Tag A', muscles: '', color: 'red', exercises: [
    { id: 'klimmzuege-assistiert', names: ['Klimmzüge mit Unterstützung'], sets: 3, repMin: 8, repMax: 12, rest: 120, inc: 5, unit: 'reps' },
    { id: 'latzug', names: ['Latzug'], sets: 3, repMin: 8, repMax: 12, rest: 120, inc: 2.5, unit: 'reps' },
  ] } } }];
  S.activePlanId = 'p';
  const miss = (date, name, id) => sess(date, name, id, sets(3, 40, 5), { target: { sets: 3, repMin: 8, repMax: 12 } });
  S.sessions = [
    miss('2026-09-21', 'Klimmzüge mit Unterstützung', 'klimmzuege-assistiert'), miss('2026-09-21', 'Latzug', 'latzug'),
    miss('2026-09-24', 'Klimmzüge mit Unterstützung', 'klimmzuege-assistiert'), miss('2026-09-24', 'Latzug', 'latzug'),
  ];
  const ids = suggestions(S, NOW).map(s => s.id);
  assert.ok(ids.some(i => i.startsWith('deload:latzug|Latzug')), ids.join(' '));
  assert.ok(!ids.some(i => /Unterstützung/.test(i)), ids.join(' '));
});
