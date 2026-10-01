/* Gemeinsamer Zustand der Eintragen-Ansichten: Ansichtsstapel, lokale Lebensmittel, Einträge speichern. */
import { S, V, save } from '../state.js';
import { ymd } from '../util.js';
import { render } from '../render.js';
import { FOODS_BASIC } from '../data/foods-basic.js';
import { recipeNutrients } from '../domain/nutrition.js';
import { pushRecent, pickNutrients } from '../domain/foods.js';
import { mealForTime } from '../domain/food-quick.js';
import { hasShiftPlan, dayShift, addDays } from '../domain/shifts.js';

/* Ältere Stände haben einzelne Listen noch nicht */
export function nut() {
  if (!S.nutrition) S.nutrition = {};
  const n = S.nutrition;
  ['customFoods', 'savedMeals', 'recipes', 'recent'].forEach(k => { if (!Array.isArray(n[k])) n[k] = []; });
  if (!n.log || typeof n.log !== 'object') n.log = {};
  return n;
}

/* Mahlzeit, die jetzt passt: nach der Uhr, mit Schichtplan auch nach der Schicht von heute und gestern (domain/food-quick.js) */
export function mealNow(now = new Date()) {
  const min = now.getHours() * 60 + now.getMinutes();
  if (!hasShiftPlan(S.shifts)) return mealForTime(min);
  const today = ymd(now);
  return mealForTime(min, { today: dayShift(S.shifts, today), yesterday: dayShift(S.shifts, addDays(today, -1)) });
}

/* ---------- Ansichtsstapel: Suche, Scanner, Formulare liegen übereinander ---------- */
export const stack = () => (V.foodStack || (V.foodStack = []));
export const topView = () => { const s = stack(); return s.length ? s[s.length - 1] : null; };
const go = () => { render(); window.scrollTo(0, 0); };
/* Eine Ansicht mit from (z. B. 'today' für „+ Essen“ auf Heute) führt nach dem letzten Schließen dorthin zurück */
const back = v => { if (v && v.from && !stack().length) V.tab = v.from; };
export function openView(v) { stack().push(v); go(); }
export function closeView() { const v = stack().pop(); back(v); go(); }
export function replaceView(v) { stack().pop(); stack().push(v); go(); }
export function closeAllViews() { const first = stack()[0]; V.foodStack = []; back(first); go(); }
/* Oberste Ansichten schließen, bis eine der gesuchten Art oben liegt */
export function popTo(kind) {
  const s = stack();
  while (s.length && s[s.length - 1].kind !== kind) s.pop();
  go();
}
/* Suchfeld fokussieren. Direkt im Tipp aufgerufen, öffnet iOS dabei die Tastatur. */
export function focusSearch() {
  const el = document.getElementById('food-q');
  if (!el) return;
  try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
}

/* ---------- Lebensmittel aus allen lokalen Quellen im selben Format ---------- */
export const basicFood = b => ({
  key: 'b:' + b.id, name: b.name, brand: '', per100: pickNutrients(b.per100), portion: b.portion,
  aliases: b.aliases, source: 'basic', ref: 'b:' + b.id,
});
export const customFood = c => ({
  key: 'c:' + c.id, id: c.id, name: c.name, brand: c.brand || '', per100: pickNutrients(c.per100),
  portion: c.portion || null, source: 'custom', ref: 'c:' + c.id, code: c.code || '',
});
export const recipeFood = r => {
  const n = recipeNutrients(r);
  return {
    key: 'r:' + r.id, id: r.id, name: r.name, brand: '', per100: pickNutrients(n.per100),
    portion: n.portionGrams > 0 ? { label: '1 Portion', grams: Math.round(n.portionGrams) } : null,
    source: 'recipe', ref: 'r:' + r.id,
  };
};

/* Eigene, Rezepte und Grundnahrungsmittel zuerst; aus „zuletzt benutzt“ nur, was es sonst nicht gibt (Open Food Facts) */
export function localFoods() {
  const n = nut();
  const list = [...n.customFoods.map(customFood), ...n.recipes.map(recipeFood), ...FOODS_BASIC.map(basicFood), ...n.recent];
  const seen = new Set();
  return list.filter(f => {
    const k = f.key || f.ref;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* Zuletzt benutzte mit aktuellen Werten, falls es das Lebensmittel lokal noch gibt */
export function recentFoods(limit = 10) {
  const byKey = new Map(localFoods().map(f => [f.key || f.ref, f]));
  return nut().recent.slice(0, limit).map(r => byKey.get(r.key || r.ref) || r);
}

/* ---------- Auswahl aus Ergebnislisten ---------- */
const index = new Map();
export function remember(list) { list.forEach(f => index.set(f.key || f.ref, f)); return list; }
export const foodByKey = key => index.get(key) || localFoods().find(f => (f.key || f.ref) === key) || null;

/* ---------- Speichern ---------- */
export function addEntries(date, entries) {
  const n = nut();
  if (!Array.isArray(n.log[date])) n.log[date] = [];
  n.log[date].push(...entries);
  save();
}
export function markUsed(food) {
  const n = nut();
  n.recent = pushRecent(n.recent, food);
  save();
}
export function findEntry(date, id) {
  const list = nut().log[date] || [];
  return list.find(e => e.id === id) || null;
}
