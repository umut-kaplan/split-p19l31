import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoWeekKey, weekMuscleSets, muscleWeeks, prevWeekStart, volumeRating } from '../js/domain/volume.js';
import { weekStart } from '../js/domain/streaks.js';

const at = (d, h = 18) => new Date(`${d}T${String(h).padStart(2, '0')}:00`).getTime();
const LIB = {
  Bank: { muscles: { primary: ['chest'], secondary: ['triceps', 'shoulders'] } },
  Rudern: { muscles: { primary: ['back'], secondary: ['biceps'] } },
  Seitheben: { muscles: { primary: ['shoulders'], secondary: [] } },
};
const resolve = n => LIB[n] || null;
const x = (name, n) => ({ exId: name, name, unit: 'reps', sets: Array.from({ length: n }, () => ({ w: 50, r: 10 })) });

test('ISO-Kalenderwoche', () => {
  assert.equal(isoWeekKey(at('2026-09-27')), '2026-W39');   // Sonntag
  assert.equal(isoWeekKey(at('2026-09-28')), '2026-W40');   // Montag
  assert.equal(isoWeekKey(at('2026-01-01')), '2026-W01');
  assert.equal(isoWeekKey(at('2027-01-01')), '2026-W53');   // 2026 hat 53 Wochen
});

test('Sätze pro Muskel: primär voll, sekundär halb, unbekannte genannt', () => {
  const sessions = [
    { startedAt: at('2026-09-21'), ex: [x('Bank', 4), x('Rudern', 3), x('Wunderübung', 5)] },
    { startedAt: at('2026-09-24'), ex: [x('Bank', 3), x('Seitheben', 3)] },
    { startedAt: at('2026-09-28'), ex: [x('Bank', 10)] },   // nächste Woche
  ];
  const w = weekMuscleSets(sessions, weekStart(at('2026-09-23')), resolve);
  assert.equal(w.sets.chest, 7);
  assert.equal(w.sets.triceps, 3.5);
  assert.equal(w.sets.shoulders, 3.5 + 3);
  assert.equal(w.sets.back, 3);
  assert.equal(w.sets.biceps, 1.5);
  assert.deepEqual(w.unknown, ['Wunderübung']);
  assert.equal(w.total, 13);
});

test('Wochen nacheinander, älteste zuerst', () => {
  const sessions = [{ startedAt: at('2026-09-14'), ex: [x('Bank', 2)] }, { startedAt: at('2026-09-22'), ex: [x('Bank', 5)] }];
  const weeks = muscleWeeks(sessions, at('2026-09-23'), 3, resolve);
  assert.deepEqual(weeks.map(w => w.sets.chest || 0), [0, 2, 5]);
  assert.equal(prevWeekStart(weekStart(at('2026-09-23'))), weekStart(at('2026-09-16')));
});

test('Einordnung gegen 10 bis 20 Sätze', () => {
  assert.equal(volumeRating(9.5), 'low');
  assert.equal(volumeRating(10), 'ok');
  assert.equal(volumeRating(20), 'ok');
  assert.equal(volumeRating(21), 'high');
});
