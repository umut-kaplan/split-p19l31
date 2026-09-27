import { test } from 'node:test';
import assert from 'node:assert/strict';
import { warmupRamp, warmupTargets, rampText, roundToStep } from '../js/domain/warmup.js';
import { nearestLoadable, DEFAULT_PLATES } from '../js/domain/plates.js';
import { findExercise } from '../js/domain/library.js';

const bar = (kg = 20) => ({ barKg: kg, round: v => nearestLoadable(v, kg, DEFAULT_PLATES.available) });

test('Rampe für Bankdrücken 82,5 kg an der Langhantel', () => {
  const r = warmupRamp(82.5, bar());
  /* 40 % = 33 -> 32,5; 60 % = 49,5 -> 50; 80 % = 66 -> 65; leere Stange davor, weil 33 - 20 >= 10 */
  assert.deepEqual(r.map(s => [s.kg, s.reps]), [[20, 10], [32.5, 10], [50, 5], [65, 3]]);
  assert.equal(rampText(r), '20 kg × 10, 32,5 × 10, 50 × 5, 65 × 3');
});

test('Ohne eigene Stangen-Stufe, wenn 40 % kaum schwerer als die Stange sind', () => {
  const r = warmupRamp(60, bar());
  /* 40 % = 24 -> 25 (nur 5 kg über der Stange) */
  assert.deepEqual(r.map(s => s.kg), [25, 35, 47.5]);
});

test('Doppelte Stufen werden zusammengefasst, nie leichter als die Stange', () => {
  const r = warmupRamp(35, bar());
  /* 40 % = 14 -> Stange 20; 60 % = 21 -> 20 (doppelt); 80 % = 28 -> 27,5 */
  assert.deepEqual(r.map(s => [s.kg, s.reps]), [[20, 10], [27.5, 3]]);
});

test('Leichtes Arbeitsgewicht: höchstens zwei Stufen', () => {
  const r = warmupRamp(25, { round: roundToStep(2.5) });
  assert.ok(r.length >= 1 && r.length <= 2);
  assert.deepEqual(r.map(s => s.kg), [12.5, 20]);
  const sz = warmupRamp(25, bar(10));
  assert.ok(sz.length <= 2);
  assert.ok(sz.every(s => s.kg >= 10 && s.kg < 25));
});

test('Maschine: auf die Steigerung gerundet, keine Stufe ab Arbeitsgewicht', () => {
  const r = warmupRamp(70, { round: roundToStep(5) });
  assert.deepEqual(r.map(s => s.kg), [30, 40, 55]);
  assert.deepEqual(warmupRamp(0, bar()), []);
  assert.deepEqual(warmupRamp(20, bar()), []);
});

const lib = n => findExercise(n);

test('Push: Bankdrücken und Schulterdrücken bekommen eine Rampe, sonst keine', () => {
  const push = ['Bankdrücken', 'Schrägbankdrücken', 'Schulterdrücken', 'Seitheben', 'Dip-Maschine', 'Kabel-Flys', 'Trizepsdrücken am Kabel']
    .map(n => ({ lib: lib(n), workKg: 50 }));
  assert.deepEqual(warmupTargets(push), [0, 2]);
});

test('Legs und Pull: nur die erste Grundübung', () => {
  const legs = ['Kniebeugen', 'Beinpresse', 'Beinbeuger', 'Beinstrecker', 'Wadenheben'].map(n => ({ lib: lib(n), workKg: 80 }));
  assert.deepEqual(warmupTargets(legs), [0]);
  const pull = ['Latzug', 'Rudern sitzend', 'Brustgestütztes Rudern', 'Face Pulls', 'SZ-Curls'].map(n => ({ lib: lib(n), workKg: 50 }));
  assert.deepEqual(warmupTargets(pull), [0]);
});

test('Ohne Arbeitsgewicht keine Rampe, die nächste Grundübung derselben Gruppe rückt nach', () => {
  const items = [{ lib: lib('Bankdrücken'), workKg: 0 }, { lib: lib('Schrägbankdrücken'), workKg: 60 }];
  /* Bankdrücken ohne Gewicht zählt als erwärmt: die Brust ist schon dran */
  assert.deepEqual(warmupTargets(items), []);
  const iso = [{ lib: lib('Seitheben'), workKg: 10 }, { lib: null, workKg: 40 }, { lib: lib('Plank'), workKg: 0 }];
  assert.deepEqual(warmupTargets(iso), []);
});
