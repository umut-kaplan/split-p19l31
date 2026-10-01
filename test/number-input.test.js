import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toNum, fmtIn, plural } from '../js/util.js';
import { parseAmount } from '../js/domain/foods.js';

test('toNum liest Tausenderpunkte, wie die App sie selbst anzeigt', () => {
  assert.equal(toNum('1.000'), 1000);
  assert.equal(toNum('2.500'), 2500);
  assert.equal(toNum('12.500'), 12500);
  assert.equal(toNum('1.000.000'), 1000000);
  assert.equal(toNum('2.500,5'), 2500.5);
  assert.equal(toNum('1 000'), 1000);
  assert.equal(toNum('8.500 Schritte'), 8500);
});

test('toNum liest Dezimalzahlen mit Komma oder Punkt wie bisher', () => {
  assert.equal(toNum('2,5'), 2.5);
  assert.equal(toNum('2.5'), 2.5);
  assert.equal(toNum('1.25'), 1.25);
  assert.equal(toNum('0,5'), 0.5);
  assert.equal(toNum('80'), 80);
  assert.equal(toNum(' 72,4 '), 72.4);
  assert.ok(Number.isNaN(toNum('')));
  assert.ok(Number.isNaN(toNum(null)));
  assert.ok(Number.isNaN(toNum('abc')));
});

test('fmtIn schreibt Eingabewerte ohne Tausenderpunkt, und toNum liest sie zurück', () => {
  assert.equal(fmtIn(2500), '2500');
  assert.equal(fmtIn(1000), '1000');
  assert.equal(fmtIn(1234.5), '1234,5');
  assert.equal(fmtIn(0.25), '0,25');
  for (const n of [1, 999, 1000, 2500, 1234.5, 12.75, 3000]) assert.equal(toNum(fmtIn(n)), n);
});

test('parseAmount: 1000 g bleibt 1000 g, auch mit Tausenderpunkt und Einheit', () => {
  assert.equal(parseAmount('1.000'), 1000);
  assert.equal(parseAmount('1.000 g'), 1000);
  assert.equal(parseAmount('1000'), 1000);
  assert.equal(parseAmount('150 g'), 150);
  assert.equal(parseAmount('1,5'), 1.5);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount(''), null);
});

test('Einzahl oder Mehrzahl nach der Zahl, auch formatiert (4.6)', () => {
  assert.equal(plural(1, 'Satz', 'Sätze'), 'Satz');
  assert.equal(plural('1', 'Tag', 'Tage'), 'Tag');
  assert.equal(plural('1,0', 'Stunde', 'Stunden'), 'Stunde');
  for (const n of [0, 2, 0.5, '1,5', 12]) assert.equal(plural(n, 'Satz', 'Sätze'), 'Sätze', String(n));
});
