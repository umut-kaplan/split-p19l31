/* Lebensmittel: Suche, Umrechnung von Open-Food-Facts-Daten, Portionen, Barcodes. Reine Funktionen.
   Ein Lebensmittel sieht so aus:
   { key, name, brand, per100: { kcal, protein, fat, carbs }, portion: { label, grams } | null,
     source: 'basic' | 'custom' | 'off' | 'recipe', ref, code } */
import { NUTRIENTS } from './nutrition.js';
import { toNum } from '../util.js';

/* Kleinbuchstaben, ohne Akzente, ß als ss, ä/ae gleich behandelt. Gilt für Suchbegriff und Namen gleichermaßen. */
export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

/* Alle Wörter der Suche müssen vorkommen. Treffer am Namensanfang zählen mehr, kurze Namen gewinnen bei Gleichstand. */
export function searchFoods(foods, query, limit = 30) {
  const q = normalize(query);
  if (!q) return [];
  const words = q.split(' ');
  const scored = [];
  foods.forEach(f => {
    const name = normalize(f.name);
    const hay = [name, normalize(f.brand), ...(f.aliases || []).map(normalize)].join(' | ');
    if (!words.every(w => hay.includes(w))) return;
    let score = 0;
    if (name === q) score += 100;
    if (name.startsWith(q)) score += 50;
    if (name.split(' ').some(t => t.startsWith(words[0]))) score += 20;
    /* Das erste Wort ist genau das Suchwort, auch im Plural: „Reis“ findet Reis vor Reiswaffeln,
       „Ei“ das Hühnerei vor Eiklar, „Kartoffel“ die Kartoffeln vor Kartoffelchips */
    const first = name.split(' ')[0];
    if (['', 'n', 'en', 'e', 's'].some(end => first === words[0] + end)) score += 30;
    if ((f.aliases || []).some(a => normalize(a) === q)) score += 40;
    score -= name.length / 10;
    scored.push({ f, score });
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.f);
}

const num = v => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const round1 = n => Math.round(n * 10) / 10;

/* Ein Produkt aus der Open-Food-Facts-API auf das eigene Format bringen.
   Energie bevorzugt in kcal, sonst aus kJ umgerechnet, sonst aus den Makros geschätzt. Ohne Name oder ohne Energie: null. */
export function mapOffProduct(p) {
  if (!p) return null;
  const name = String(p.product_name_de || p.product_name || p.generic_name_de || p.generic_name || '').trim();
  const code = String(p.code || p._id || '').trim();
  if (!name) return null;
  const n = p.nutriments || {};
  const protein = num(n.proteins_100g), fat = num(n.fat_100g), carbs = num(n.carbohydrates_100g);
  let kcal = num(n['energy-kcal_100g']);
  let estimated = false;
  if (kcal == null) {
    const kj = num(n['energy-kj_100g']) ?? num(n.energy_100g);
    if (kj != null) kcal = kj / 4.184;
  }
  if (kcal == null && protein != null && fat != null && carbs != null) {
    kcal = 4 * protein + 4 * carbs + 9 * fat;
    estimated = true;
  }
  if (kcal == null) return null;
  const brandRaw = Array.isArray(p.brands) ? p.brands[0] : String(p.brands || '').split(',')[0];
  const serving = num(p.serving_quantity);
  return {
    key: 'off:' + code,
    name,
    brand: String(brandRaw || '').trim(),
    per100: { kcal: Math.round(kcal), protein: round1(protein || 0), fat: round1(fat || 0), carbs: round1(carbs || 0) },
    portion: serving && serving > 0 && serving < 2000 ? { label: p.serving_size ? String(p.serving_size).replace(/(\d)\.(\d)/g, '$1,$2') : '1 Portion', grams: serving } : null,
    missing: ['protein', 'fat', 'carbs'].filter((k, i) => [protein, fat, carbs][i] == null),
    estimated,
    source: 'off',
    ref: 'off:' + code,
    code,
  };
}

/* Suchantwort: alte API liefert { products }, die neue { hits }. Doppelte Barcodes fallen weg. */
export function mapOffSearch(json) {
  const list = (json && (json.products || json.hits)) || [];
  const seen = new Set();
  return list.map(mapOffProduct).filter(f => {
    if (!f || (f.code && seen.has(f.code))) return false;
    if (f.code) seen.add(f.code);
    return true;
  });
}

/* Nennt die Portionsbezeichnung die Menge schon, z. B. „1 Glas (200 ml)“ oder „40 gram“? */
export const labelHasAmount = label => /\d\s*(g|gr|gram|gramm|ml|kg|l|cl)\b/i.test(String(label || ''));

/* Auswahl für die Mengeneingabe: bekannte Portion, dazu 100 g */
export function portionsFor(food) {
  const out = [];
  if (food.portion && food.portion.grams > 0) out.push({ label: food.portion.label, grams: food.portion.grams });
  if (!out.some(p => p.grams === 100)) out.push({ label: '100 g', grams: 100 });
  return out;
}

export function entryFromFood(food, grams, meal, id) {
  return {
    id, meal, name: food.brand ? `${food.name} (${food.brand})` : food.name, grams: round1(grams),
    per100: pickNutrients(food.per100), source: food.source, ref: food.ref || food.key,
  };
}

export function pickNutrients(per100) {
  const out = {};
  NUTRIENTS.forEach(k => { out[k] = Number((per100 && per100[k]) || 0); });
  return out;
}

/* Zuletzt benutzt: vorne einfügen, Doppelte entfernen, höchstens max Einträge */
export function pushRecent(recent, food, max = 25) {
  const key = food.key || food.ref;
  const slim = { key, name: food.name, brand: food.brand || '', per100: pickNutrients(food.per100), portion: food.portion || null, source: food.source, ref: food.ref || key, code: food.code || '' };
  return [slim, ...(recent || []).filter(r => (r.key || r.ref) !== key)].slice(0, max);
}

/* EAN-8, EAN-13, UPC-A: nur Ziffern in passender Länge mit gültiger Prüfziffer */
export function isValidBarcode(code) {
  const s = String(code || '').trim();
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(s)) return false;
  const digits = s.split('').map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/* Gramm aus einer Eingabe wie „150“, „150 g“ oder „1,5“ */
export function parseAmount(v) {
  const n = toNum(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ---------- Eingaben prüfen ---------- */
const field = (d, k) => {
  const v = String(d[k] == null ? '' : d[k]).trim();
  if (!v) return null;
  const x = parseFloat(v.replace(',', '.'));
  return Number.isFinite(x) && x >= 0 ? x : NaN;
};

/* Formular „Eigenes Lebensmittel“ in ein Lebensmittel verwandeln. Liefert { food } oder { error }. */
export function customFoodFromDraft(d) {
  const name = String(d.name || '').trim();
  if (!name) return { error: 'Gib dem Lebensmittel einen Namen.' };
  const protein = field(d, 'protein'), fat = field(d, 'fat'), carbs = field(d, 'carbs');
  let kcal = field(d, 'kcal');
  if ([kcal, protein, fat, carbs].some(Number.isNaN)) return { error: 'Nährwerte als Zahl eintragen, z. B. 12,5.' };
  if (kcal == null) {
    if (protein == null && fat == null && carbs == null) return { error: 'Trag mindestens die kcal pro 100 g ein.' };
    kcal = 4 * (protein || 0) + 4 * (carbs || 0) + 9 * (fat || 0);
  }
  if (kcal > 900 || (protein || 0) + (fat || 0) + (carbs || 0) > 100.5) return { error: 'Die Werte pro 100 g sind zu hoch. Prüfe die Eingabe.' };
  const pg = field(d, 'portionGrams');
  if (Number.isNaN(pg)) return { error: 'Portionsgröße als Zahl in Gramm eintragen.' };
  const code = String(d.code || '').trim();
  if (code && !/^\d{8,14}$/.test(code)) return { error: 'Ein Barcode besteht aus 8 bis 14 Ziffern.' };
  return {
    food: {
      name, brand: String(d.brand || '').trim(),
      per100: { kcal: Math.round(kcal), protein: protein || 0, fat: fat || 0, carbs: carbs || 0 },
      portion: pg > 0 ? { label: String(d.portionLabel || '').trim() || '1 Portion', grams: pg } : null,
      code,
    },
  };
}

/* Rezept vor dem Speichern prüfen. Liefert null oder eine Fehlermeldung. */
export function recipeError(r) {
  if (!String(r.name || '').trim()) return 'Gib dem Rezept einen Namen.';
  if (!(r.items || []).length) return 'Füge mindestens eine Zutat hinzu.';
  if (r.items.some(i => !(i.grams > 0))) return 'Jede Zutat braucht eine Menge in Gramm.';
  if (!(r.portions >= 1)) return 'Ein Rezept hat mindestens eine Portion.';
  return null;
}
