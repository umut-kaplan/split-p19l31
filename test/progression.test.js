import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggest, lastLog, nextDay } from '../js/domain/progression.js';

const bank = { id: 'bank', sets: 4, repMin: 6, repMax: 8, inc: 2.5, unit: 'reps' };
const session = (sets, name = 'Bankdrücken', dayId = 'push') => ({ dayId, startedAt: 1, ex: [{ exId: 'bank', name, unit: 'reps', sets }] });
const four = (w, r, rir = 2) => Array.from({ length: 4 }, () => ({ w, r, rir }));

test('Erstes Mal ohne Vorschlag', () => {
  assert.equal(suggest([], bank, 'Bankdrücken').kind, 'new');
});

test('Alle Sätze am oberen Ende: mehr Gewicht', () => {
  const s = suggest([session(four(80, 8))], bank, 'Bankdrücken');
  assert.equal(s.kind, 'up');
  assert.equal(s.weight, 82.5);
  assert.equal(s.text, 'Mehr Gewicht: 82,5 kg');
});

test('Ein Satz darunter: Gewicht halten', () => {
  const sets = four(80, 8); sets[3] = { w: 80, r: 7, rir: 2 };
  assert.equal(suggest([session(sets)], bank, 'Bankdrücken').kind, 'hold');
});

test('Am oberen Ende, aber RIR 0: Gewicht halten', () => {
  assert.equal(suggest([session(four(80, 8, 0))], bank, 'Bankdrücken').kind, 'hold');
});

test('Varianten werden getrennt bewertet', () => {
  assert.equal(suggest([session(four(80, 8), 'Klimmzüge')], bank, 'Bankdrücken').kind, 'new');
  assert.ok(lastLog([session(four(80, 8), 'Klimmzüge')], 'bank', 'Klimmzüge'));
});

test('Nächste Einheit in der Reihenfolge', () => {
  const order = ['push', 'pull', 'legs'];
  assert.equal(nextDay(order, [], 'split'), 'push');
  assert.equal(nextDay(order, [session([], 'x', 'push')], 'split'), 'pull');
  assert.equal(nextDay(order, [session([], 'x', 'legs')], 'split'), 'push');
});
