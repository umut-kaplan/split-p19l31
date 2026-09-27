import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryNutrients, sumNutrients, dayTotals, mealTotals, recipeNutrients } from '../js/domain/nutrition.js';

const oats = { kcal: 372, protein: 13.5, fat: 7, carbs: 58.7 };
const milk = { kcal: 64, protein: 3.4, fat: 3.5, carbs: 4.8 };

test('Nährwerte eines Eintrags', () => {
  const n = entryNutrients({ grams: 50, per100: oats });
  assert.equal(n.kcal, 186);
  assert.equal(n.protein, 6.75);
});

test('Summen pro Tag und Mahlzeit', () => {
  const log = { '2026-09-27': [
    { meal: 'breakfast', grams: 50, per100: oats },
    { meal: 'breakfast', grams: 200, per100: milk },
    { meal: 'snack', grams: 100, per100: milk },
  ] };
  assert.equal(Math.round(dayTotals(log, '2026-09-27').kcal), 186 + 128 + 64);
  assert.equal(dayTotals(log, '2026-09-28').kcal, 0);
  const m = mealTotals(log, '2026-09-27');
  assert.equal(Math.round(m.breakfast.kcal), 314);
  assert.equal(m.lunch.kcal, 0);
  assert.equal(sumNutrients([]).kcal, 0);
});

test('Rezept pro 100 g und pro Portion', () => {
  const r = recipeNutrients({ portions: 2, items: [{ grams: 100, per100: oats }, { grams: 300, per100: milk }] });
  assert.equal(r.grams, 400);
  assert.equal(Math.round(r.total.kcal), 372 + 192);
  assert.equal(Math.round(r.perPortion.kcal), 282);
  assert.equal(Math.round(r.per100.kcal), 141);
  assert.equal(r.portionGrams, 200);
});
