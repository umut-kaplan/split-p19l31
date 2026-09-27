import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOODS_BASIC } from '../js/data/foods-basic.js';
import { normalize } from '../js/domain/foods.js';

test('Liste hat etwa 150 Einträge mit eindeutigen ids und Namen', () => {
  assert.ok(FOODS_BASIC.length >= 140, 'nur ' + FOODS_BASIC.length);
  const ids = FOODS_BASIC.map(f => f.id);
  assert.equal(new Set(ids).size, ids.length, 'doppelte id');
  const names = FOODS_BASIC.map(f => normalize(f.name));
  assert.equal(new Set(names).size, names.length, 'doppelter Name');
});

test('Pflichtfelder und plausible Wertebereiche', () => {
  FOODS_BASIC.forEach(f => {
    assert.match(f.id, /^[a-z0-9-]+$/, f.id);
    assert.ok(f.name && f.name.length > 1, f.id);
    const p = f.per100;
    ['kcal', 'protein', 'fat', 'carbs', 'fiber', 'alcohol'].forEach(k => assert.ok(Number.isFinite(p[k]) && p[k] >= 0, `${f.id}.${k}`));
    assert.ok(p.kcal <= 900, f.id);
    assert.ok(p.protein + p.fat + p.carbs + p.fiber + p.alcohol <= 100.5, `${f.id}: mehr als 100 g Nährstoffe`);
    if (f.portion) assert.ok(f.portion.label && f.portion.grams > 0 && f.portion.grams <= 1000, f.id);
  });
});

/* Energie wie auf deutschen Etiketten: 4 kcal je g Protein und Kohlenhydrate, 9 je g Fett,
   2 je g Ballaststoffe, 7 je g Alkohol. Toleranz 8 kcal oder 10 %, damit Rundungen durchgehen. */
test('kcal passen zu den Nährstoffen', () => {
  const off = FOODS_BASIC.map(f => {
    const p = f.per100;
    const expected = 4 * p.protein + 4 * p.carbs + 9 * p.fat + 2 * p.fiber + 7 * p.alcohol;
    return { id: f.id, kcal: p.kcal, expected: Math.round(expected), ok: Math.abs(p.kcal - expected) <= Math.max(8, p.kcal * 0.1) };
  }).filter(x => !x.ok);
  assert.deepEqual(off, []);
});
