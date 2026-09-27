import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchFoods } from '../js/domain/foods.js';
import { FOODS_BASIC } from '../js/data/foods-basic.js';

const top = q => searchFoods(FOODS_BASIC, q, 3).map(f => f.name);

test('Ganzes erstes Wort schlägt längere Wörter mit gleichem Anfang', () => {
  assert.match(top('Reis')[0], /^Reis, weiß/);
  assert.ok(top('Reis').indexOf('Reiswaffeln') > 0);
  assert.equal(top('Ei')[0], 'Ei (Hühnerei)');
  assert.deepEqual(top('Kartoffel').slice(0, 2).every(n => /^Kartoffeln/.test(n)), true);
});

test('Ein Suchwort mitten im Namen rutscht nicht nach vorn', () => {
  assert.notEqual(top('Brot')[0], 'Döner im Brot');
  assert.match(top('Milch')[0], /^Milch/);
});
