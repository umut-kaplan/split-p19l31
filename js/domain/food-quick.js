/* Schnell eintragen: Mahlzeit nach Uhrzeit (mit Schichtplan) und Vorschläge für einen Tipp. Reine Funktionen, per node --test geprüft. */
import { toMin, isTimedCat } from './shifts.js';

/* Ab wann welche Mahlzeit gilt, Minuten seit Mitternacht. Vor 05:00 gilt noch der letzte Eintrag, also Snacks. */
export const MEAL_CLOCK = [
  [5 * 60, 'breakfast'],
  [10 * 60 + 30, 'lunch'],
  [15 * 60, 'snack'],
  [17 * 60 + 30, 'dinner'],
  [22 * 60, 'snack'],
];

export function clockMeal(min) {
  let meal = 'snack';
  MEAL_CLOCK.forEach(([from, m]) => { if (min >= from) meal = m; });
  return meal;
}

/* Eine Schicht mit Uhrzeit, wie sie domain/shifts.js mit dayShift liefert: { cat, times: ['22:00', '06:00'] } */
const timed = s => !!s && isTimedCat(s.cat) && Array.isArray(s.times) && s.times.length === 2;
const overnight = s => timed(s) && toMin(s.times[1]) <= toMin(s.times[0]);

/* Läuft gerade eine Schicht über Mitternacht (Nacht, 24-h-Dienst, lange Spätschicht)? Die von gestern bis zu ihrem Ende,
   die von heute ab ihrem Beginn. */
export function inOvernightShift(min, { today = null, yesterday = null } = {}) {
  if (overnight(yesterday) && min < toMin(yesterday.times[1])) return true;
  return overnight(today) && min >= toMin(today.times[0]);
}

/* Welche Mahlzeit passt jetzt? min: Minuten seit Mitternacht, shifts: { today, yesterday } aus dem Schichtplan oder leer.
   - Nachts in einer Schicht über Mitternacht: Snacks. Nachts eher kleine, leichte Mahlzeiten (DGE, Wissen-Karte
     „Essen in der Nachtschicht“), und um 05:30 in der Nachtschicht ist es kein Frühstück.
   - Vor einer frühen Schicht (Beginn vor 08:00): Frühstück schon ab drei Stunden vor Beginn, also auch um 04:00.
   - Sonst nach der Uhr: Frühstück ab 05:00, Mittagessen ab 10:30, Snacks ab 15:00, Abendessen ab 17:30, Snacks ab 22:00.
   Nach der Nachtschicht zählt das Essen vor dem Tagschlaf wie sonst morgens als Frühstück. */
export function mealForTime(min, shifts = {}) {
  const { today = null, yesterday = null } = shifts || {};
  const night = min >= 22 * 60 || min < 10 * 60;
  if (night && inOvernightShift(min, { today, yesterday })) return 'snack';
  if (timed(today) && !overnight(today)) {
    const start = toMin(today.times[0]);
    if (start < 8 * 60 && min < 5 * 60 && min >= start - 180) return 'breakfast';
  }
  return clockMeal(min);
}

/* ---------- Vorschläge für einen Tipp ---------- */
const datesBefore = (log, date) => Object.keys(log || {}).filter(d => d < date).sort();

/* Jüngste Menge je Lebensmittel aus dem Tagebuch: Map ref → Gramm */
export function lastAmounts(log) {
  const out = new Map();
  Object.keys(log || {}).sort().forEach(d => (log[d] || []).forEach(e => { if (e && e.ref && e.grams > 0) out.set(e.ref, e.grams); }));
  return out;
}

/* Zuletzt benutzte Lebensmittel mit der Menge vom letzten Mal, ohne solche ohne Tagebuch-Eintrag (nur als Zutat benutzt) */
export function quickFoods(recent, log, limit = 6) {
  const last = lastAmounts(log);
  return (recent || [])
    .map(food => ({ food, grams: last.get(food.ref || food.key) || 0 }))
    .filter(x => x.grams > 0)
    .slice(0, limit);
}

/* Dieselbe Mahlzeit vom letzten Tag davor, an dem sie eingetragen ist, höchstens maxBack Tage zurück.
   Liefert { date, entries } oder null. date: 'YYYY-MM-DD' des Tages, für den eingetragen wird. */
export function lastMeal(log, date, meal, maxBack = 7) {
  const limit = new Date(date + 'T12:00');
  limit.setDate(limit.getDate() - maxBack);
  const from = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`;
  const days = datesBefore(log, date).filter(d => d >= from).reverse();
  for (const d of days) {
    const entries = (log[d] || []).filter(e => e.meal === meal);
    if (entries.length) return { date: d, entries };
  }
  return null;
}
