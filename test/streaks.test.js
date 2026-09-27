import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekStart, weekStreak, weekHistory } from '../js/domain/streaks.js';

const at = s => new Date(s).getTime();
const sess = (...days) => days.map(d => ({ startedAt: at(d + 'T18:00') }));

test('Woche beginnt am Montag', () => {
  // 27.09.2026 ist ein Sonntag
  assert.equal(new Date(weekStart(at('2026-09-27T20:00'))).getDate(), 21);
  assert.equal(new Date(weekStart(at('2026-09-21T00:30'))).getDate(), 21);
  assert.equal(new Date(weekStart(at('2026-09-28T09:00'))).getDate(), 28);
});

test('Serie zählt erfüllte Wochen am Stück', () => {
  const s = sess(
    '2026-09-07', '2026-09-09', '2026-09-11',   // erfüllt
    '2026-09-14', '2026-09-16', '2026-09-18',   // erfüllt
    '2026-09-21', '2026-09-23',                 // laufende Woche, 2 von 3
  );
  const r = weekStreak(s, 3, at('2026-09-24T12:00'));
  assert.deepEqual(r, { weeks: 2, thisWeek: 2, target: 3 });
});

test('Laufende Woche zählt mit, sobald erfüllt', () => {
  const s = sess('2026-09-14', '2026-09-16', '2026-09-18', '2026-09-21', '2026-09-22', '2026-09-23');
  assert.equal(weekStreak(s, 3, at('2026-09-24T12:00')).weeks, 2);
});

test('Eine verpasste Woche beendet die Serie', () => {
  const s = sess('2026-09-01', '2026-09-02', '2026-09-03', '2026-09-14', '2026-09-16', '2026-09-18');
  assert.equal(weekStreak(s, 3, at('2026-09-24T12:00')).weeks, 1);
  assert.equal(weekStreak([], 3, at('2026-09-24T12:00')).weeks, 0);
});

test('Wochenverlauf, älteste zuerst', () => {
  const h = weekHistory(sess('2026-09-14', '2026-09-16', '2026-09-18', '2026-09-22'), 3, at('2026-09-24T12:00'), 3);
  assert.equal(h.length, 3);
  assert.deepEqual(h.map(w => [w.count, w.met, w.current]), [[0, false, false], [3, true, false], [1, false, true]]);
});
