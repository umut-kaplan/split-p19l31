import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWeight, referenceFor, CHECK_FACTOR } from '../js/domain/weight-check.js';
import { personalRecords } from '../js/domain/prs.js';

const set = (w, r, done = false, t) => (t ? { w, r, rir: 2, done, t } : { w, r, rir: 2, done });

test('Mehr als 50 % über dem Bestwert: nachfragen', () => {
  assert.equal(CHECK_FACTOR, 1.5);
  assert.deepEqual(checkWeight(950, { best: 100 }), { ask: true, ref: 100, basis: 'best' });
  assert.deepEqual(checkWeight('950', { best: 100 }), { ask: true, ref: 100, basis: 'best' });
  assert.equal(checkWeight(150, { best: 100 }).ask, false);       // genau 50 % darüber: noch kein Tippfehler
  assert.equal(checkWeight('150,5', { best: 100 }).ask, true);
  assert.equal(checkWeight(105, { best: 100 }).ask, false);
  assert.equal(checkWeight(9.5, { best: 100 }).ask, false);        // zu wenig fragt die App nicht
});

test('Ohne Bestwert zählt das letzte Arbeitsgewicht, ohne Vorwert keine Rückfrage', () => {
  assert.deepEqual(checkWeight(200, { best: null, last: 80 }), { ask: true, ref: 80, basis: 'last' });
  assert.equal(checkWeight(110, { best: null, last: 80 }).ask, false);
  /* Der Bestwert geht vor, auch wenn das letzte Mal leichter war */
  assert.deepEqual(checkWeight(140, { best: 100, last: 60 }), { ask: false, ref: 100, basis: 'best' });
  assert.deepEqual(checkWeight(950, {}), { ask: false, ref: null, basis: null });
  assert.deepEqual(checkWeight(950, { best: 0, last: 0 }), { ask: false, ref: null, basis: null });
  assert.equal(checkWeight('', { best: 100 }).ask, false);
  assert.equal(checkWeight('abc', { best: 100 }).ask, false);
});

test('Vorwerte: Bestwert aus früheren Einheiten und dieser Einheit, ohne den Satz selbst', () => {
  const sessions = [{ startedAt: 1, ex: [{ exId: 'squat', name: 'Kniebeugen', unit: 'reps', sets: [{ w: 100, r: 8 }, { w: 105, r: 5 }] }] }];
  const prior = personalRecords(sessions).get('squat|Kniebeugen');
  const last = { date: 1, sets: sessions[0].ex[0].sets };
  assert.deepEqual(referenceFor({ prior, last, log: [set('', '', false)], j: 0 }), { best: 105, last: 105 });
  /* In dieser Einheit schon schwerer abgehakt: das zählt als Bestwert */
  assert.deepEqual(referenceFor({ prior, last, log: [set('110', '5', true), set('950', '5')], j: 1 }).best, 110);
  /* Der Satz selbst zählt nicht mit, auch wenn er schon abgehakt war */
  assert.deepEqual(referenceFor({ prior, last, log: [set('950', '5', true)], j: 0 }).best, 105);
  /* Aufwärm- und Dropsätze sind kein Bestwert */
  assert.equal(referenceFor({ prior: null, last: null, log: [set('140', '5', true, 'w'), set('90', '10', true, 'd'), set('300', '5')], j: 2 }).best, null);
});

test('Vorwerte ohne Bestwert: letzter Arbeitssatz dieser Einheit, sonst schwerster Arbeitssatz vom letzten Mal', () => {
  /* Nur Dropsätze beim letzten Mal: kein Bestwert, aber ein Arbeitsgewicht */
  const last = { date: 1, sets: [{ w: 60, r: 12, t: 'd' }, { w: 50, r: 12, t: 'd' }] };
  assert.deepEqual(referenceFor({ prior: null, last, log: [set('', '')], j: 0 }), { best: null, last: 60 });
  assert.deepEqual(referenceFor({ prior: null, last, log: [set('70', '10', true, 'd'), set('65', '10', true, 'd'), set('')], j: 2 }), { best: null, last: 65 });
  /* Aufwärmsätze sind kein Arbeitsgewicht */
  assert.deepEqual(referenceFor({ prior: null, last: { date: 1, sets: [{ w: 40, r: 10, t: 'w' }] }, log: [set('')], j: 0 }), { best: null, last: null });
  /* Ganz neue Übung */
  assert.deepEqual(referenceFor({ log: [set('950', '5')], j: 0 }), { best: null, last: null });
  assert.deepEqual(referenceFor(), { best: null, last: null });
});

test('Ablauf wie beim Abhaken: Tippfehler bei Kniebeugen wird erkannt', () => {
  const sessions = [{ startedAt: 1, ex: [{ exId: 'squat', name: 'Kniebeugen', unit: 'reps', sets: [{ w: 95, r: 8 }] }] }];
  const prior = personalRecords(sessions).get('squat|Kniebeugen');
  const log = [set('950', '8')];
  assert.equal(checkWeight(log[0].w, referenceFor({ prior, last: null, log, j: 0 })).ask, true);
  log[0].w = '97,5';
  assert.equal(checkWeight(log[0].w, referenceFor({ prior, last: null, log, j: 0 })).ask, false);
});
