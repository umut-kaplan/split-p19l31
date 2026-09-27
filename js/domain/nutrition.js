/* Nährwerte. Lebensmittel tragen Werte pro 100 g: { kcal, protein, fat, carbs }, optional fiber, sugar, salt. */

export const MEALS = { breakfast: 'Frühstück', lunch: 'Mittagessen', dinner: 'Abendessen', snack: 'Snacks' };
export const NUTRIENTS = ['kcal', 'protein', 'fat', 'carbs'];

const zero = () => ({ kcal: 0, protein: 0, fat: 0, carbs: 0 });

export function entryNutrients(e) {
  const f = (e.grams || 0) / 100;
  const out = zero();
  NUTRIENTS.forEach(k => { out[k] = ((e.per100 && e.per100[k]) || 0) * f; });
  return out;
}

export function sumNutrients(entries) {
  const out = zero();
  (entries || []).forEach(e => { const n = entryNutrients(e); NUTRIENTS.forEach(k => { out[k] += n[k]; }); });
  return out;
}

export const dayTotals = (log, date) => sumNutrients(log[date]);

export function mealTotals(log, date) {
  const out = {};
  Object.keys(MEALS).forEach(m => { out[m] = sumNutrients((log[date] || []).filter(e => e.meal === m)); });
  return out;
}

/* Rezept: Zutaten mit Gramm und Werten pro 100 g. Liefert Gesamtgewicht, Werte pro 100 g und pro Portion. */
export function recipeNutrients(recipe) {
  const total = sumNutrients(recipe.items);
  const grams = (recipe.items || []).reduce((a, i) => a + (i.grams || 0), 0);
  const per100 = zero(), perPortion = zero();
  const portions = recipe.portions > 0 ? recipe.portions : 1;
  NUTRIENTS.forEach(k => {
    per100[k] = grams > 0 ? total[k] / grams * 100 : 0;
    perPortion[k] = total[k] / portions;
  });
  return { grams, total, per100, perPortion, portionGrams: grams / portions };
}
