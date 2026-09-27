import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize, searchFoods, mapOffProduct, mapOffSearch, portionsFor, entryFromFood, pushRecent,
  isValidBarcode, parseAmount, customFoodFromDraft, recipeError, labelHasAmount,
} from '../js/domain/foods.js';
import { entryNutrients, recipeNutrients } from '../js/domain/nutrition.js';

test('Normalisierung: Umlaute, ß, Akzente, Satzzeichen', () => {
  assert.equal(normalize('Müsli'), normalize('Muesli'));
  assert.equal(normalize('Hähnchenbrust'), normalize('haehnchenbrust'));
  assert.equal(normalize('Weißbrot'), 'weissbrot');
  assert.equal(normalize('Crème fraîche'), 'creme fraiche');
  assert.equal(normalize('  Milch, 1,5 %  '), 'milch 1 5 %');
});

const foods = [
  { key: 'a', name: 'Haferflocken', per100: { kcal: 372 } },
  { key: 'b', name: 'Haferdrink', per100: { kcal: 46 }, aliases: ['Hafermilch'] },
  { key: 'c', name: 'Müsli ohne Zuckerzusatz', per100: { kcal: 357 } },
  { key: 'd', name: 'Knuspermüsli', per100: { kcal: 449 }, aliases: ['Granola'] },
  { key: 'e', name: 'Milch 1,5 %', brand: 'Weihenstephan', per100: { kcal: 46 } },
];

test('Suche: alle Wörter müssen passen, Namensanfang gewinnt', () => {
  assert.deepEqual(searchFoods(foods, 'hafer').map(f => f.key), ['b', 'a']); // gleich gut, kürzerer Name zuerst
  assert.deepEqual(searchFoods(foods, 'muesli').map(f => f.key), ['c', 'd']);
  assert.deepEqual(searchFoods(foods, 'hafermilch').map(f => f.key), ['b']);
  assert.deepEqual(searchFoods(foods, 'milch weihen').map(f => f.key), ['e']);
  assert.deepEqual(searchFoods(foods, 'granola').map(f => f.key), ['d']);
  assert.deepEqual(searchFoods(foods, ''), []);
  assert.deepEqual(searchFoods(foods, 'pizza'), []);
});

test('Open Food Facts: kcal direkt', () => {
  const f = mapOffProduct({
    code: '4000417025005', product_name: 'Chocolate', product_name_de: 'Schokolade Nuss', brands: 'Ritter Sport, Alfred Ritter',
    nutriments: { 'energy-kcal_100g': 496, proteins_100g: 6.3, fat_100g: 27, carbohydrates_100g: 52 },
    serving_quantity: 16.7, serving_size: '1 Rippe (16,7 g)',
  });
  assert.equal(f.name, 'Schokolade Nuss');
  assert.equal(f.brand, 'Ritter Sport');
  assert.deepEqual(f.per100, { kcal: 496, protein: 6.3, fat: 27, carbs: 52 });
  assert.deepEqual(f.portion, { label: '1 Rippe (16,7 g)', grams: 16.7 });
  assert.equal(f.key, 'off:4000417025005');
  assert.deepEqual(f.missing, []);
});

test('Open Food Facts: kJ umrechnen, fehlende Werte als 0 und markiert', () => {
  const f = mapOffProduct({ code: '1', product_name: 'Haferflocken', brands: ['Rinatura'], nutriments: { 'energy-kj_100g': 1565, proteins_100g: 13 } });
  assert.equal(f.per100.kcal, Math.round(1565 / 4.184)); // 374
  assert.equal(f.per100.fat, 0);
  assert.deepEqual(f.missing, ['fat', 'carbs']);
  assert.equal(f.brand, 'Rinatura');
});

test('Open Food Facts: ohne Energie aus Makros geschätzt, ohne Name oder Werte verworfen', () => {
  const f = mapOffProduct({ code: '2', product_name: 'Quark', nutriments: { proteins_100g: '12', fat_100g: '0,2', carbs_100g: 4, carbohydrates_100g: 4 } });
  assert.equal(f.per100.kcal, Math.round(4 * 12 + 4 * 4 + 9 * 0.2));
  assert.equal(f.estimated, true);
  assert.equal(mapOffProduct({ code: '3', nutriments: { 'energy-kcal_100g': 100 } }), null);
  assert.equal(mapOffProduct({ code: '4', product_name: 'Leer', nutriments: {} }), null);
  assert.equal(mapOffProduct(null), null);
});

test('Suchantwort alter und neuer API, Doppelte entfernt', () => {
  const p = code => ({ code, product_name: 'X' + code, nutriments: { 'energy-kcal_100g': 100 } });
  assert.equal(mapOffSearch({ products: [p('1'), p('1'), p('2'), { code: '3' }] }).length, 2);
  assert.equal(mapOffSearch({ hits: [p('5')] }).length, 1);
  assert.deepEqual(mapOffSearch(null), []);
});

test('Portionen und Einträge', () => {
  const egg = { key: 'b:ei', name: 'Ei', per100: { kcal: 139, protein: 12.6, fat: 9.5, carbs: 0.7 }, portion: { label: '1 Ei', grams: 60 }, source: 'basic', ref: 'b:ei' };
  assert.deepEqual(portionsFor(egg), [{ label: '1 Ei', grams: 60 }, { label: '100 g', grams: 100 }]);
  assert.deepEqual(portionsFor({ portion: null }), [{ label: '100 g', grams: 100 }]);
  const e = entryFromFood(egg, 120, 'breakfast', 'x1');
  assert.deepEqual(e, { id: 'x1', meal: 'breakfast', name: 'Ei', grams: 120, per100: { kcal: 139, protein: 12.6, fat: 9.5, carbs: 0.7 }, source: 'basic', ref: 'b:ei' });
  assert.equal(Math.round(entryNutrients(e).kcal), 167);
  assert.equal(entryFromFood({ ...egg, brand: 'Bio' }, 60, 'lunch', 'x2').name, 'Ei (Bio)');
});

test('Zuletzt benutzt: vorne, ohne Doppelte, begrenzt', () => {
  const f = k => ({ key: k, name: k, per100: { kcal: 1 }, source: 'basic' });
  let r = [];
  ['a', 'b', 'c', 'a'].forEach(k => { r = pushRecent(r, f(k), 3); });
  assert.deepEqual(r.map(x => x.key), ['a', 'c', 'b']);
  r = pushRecent(r, f('d'), 3);
  assert.deepEqual(r.map(x => x.key), ['d', 'a', 'c']);
});

test('Barcodes mit Prüfziffer', () => {
  assert.equal(isValidBarcode('4000417025005'), true);  // EAN-13
  assert.equal(isValidBarcode('4000417025006'), false);
  assert.equal(isValidBarcode('29084302'), true);       // EAN-8
  assert.equal(isValidBarcode('036000291452'), true);   // UPC-A
  assert.equal(isValidBarcode('12345'), false);
  assert.equal(isValidBarcode('abc'), false);
});

test('Portionsbezeichnung mit Mengenangabe erkennen', () => {
  assert.equal(labelHasAmount('1 Glas (200 ml)'), true);
  assert.equal(labelHasAmount('40 gram'), true);
  assert.equal(labelHasAmount('1 Cube (6.52 g)'), true);
  assert.equal(labelHasAmount('1 Scheibe'), false);
  assert.equal(labelHasAmount('2 Stück'), false);
});

test('Mengen', () => {
  assert.equal(parseAmount('150'), 150);
  assert.equal(parseAmount('1,5'), 1.5);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount(''), null);
});

test('Eigenes Lebensmittel aus dem Formular', () => {
  const ok = customFoodFromDraft({ name: ' Proteinpudding ', kcal: '72', protein: '10', fat: '1,5', carbs: '5', portionLabel: '1 Becher', portionGrams: '200', code: '4001234567890' });
  assert.deepEqual(ok.food, { name: 'Proteinpudding', brand: '', per100: { kcal: 72, protein: 10, fat: 1.5, carbs: 5 }, portion: { label: '1 Becher', grams: 200 }, code: '4001234567890' });
  assert.equal(customFoodFromDraft({ name: 'X', protein: '10', fat: '2', carbs: '5' }).food.per100.kcal, 78); // aus Makros
  assert.match(customFoodFromDraft({ name: '' }).error, /Namen/);
  assert.match(customFoodFromDraft({ name: 'X' }).error, /kcal/);
  assert.match(customFoodFromDraft({ name: 'X', kcal: 'viel' }).error, /Zahl/);
  assert.match(customFoodFromDraft({ name: 'X', kcal: '100', protein: '60', carbs: '60' }).error, /zu hoch/);
  assert.match(customFoodFromDraft({ name: 'X', kcal: '100', code: '12ab' }).error, /Barcode/);
  assert.equal(customFoodFromDraft({ name: 'X', kcal: '100', portionGrams: '' }).food.portion, null);
});

test('Rezept prüfen und rechnen', () => {
  const oats = { kcal: 372, protein: 13.5, fat: 7, carbs: 58.7 };
  const milk = { kcal: 46, protein: 3.4, fat: 1.5, carbs: 4.8 };
  assert.match(recipeError({ name: '', items: [], portions: 1 }), /Namen/);
  assert.match(recipeError({ name: 'Oats', items: [], portions: 1 }), /Zutat/);
  assert.match(recipeError({ name: 'Oats', items: [{ grams: 0, per100: oats }], portions: 1 }), /Menge/);
  const r = { name: 'Overnight Oats', portions: 2, items: [{ grams: 80, per100: oats }, { grams: 250, per100: milk }] };
  assert.equal(recipeError(r), null);
  const n = recipeNutrients(r);
  assert.equal(Math.round(n.total.kcal), Math.round(297.6 + 115));
  assert.equal(n.portionGrams, 165);
  assert.equal(Math.round(n.perPortion.protein * 10) / 10, Math.round((10.8 + 8.5) / 2 * 10) / 10);
});
