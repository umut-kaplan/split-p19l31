/* Aktivität außerhalb des Krafttrainings: Cardio, Schritte, Schlaf, Ruhepuls, gemessener Verbrauch.
   Reine Funktionen, per node --test geprüft. Datumswerte sind Kalendertage 'YYYY-MM-DD'. */
import { dayNumber, dateFromDayNumber } from './body.js';

/* ---------- Cardio ---------- */
/* MET-Werte nach dem Compendium of Physical Activities (Ainsworth u. a. 2011; Codes in Klammern).
   kcal = MET × Körpergewicht in kg × Stunden. Laufen richtet sich nach dem Tempo, wenn eine Distanz da ist. */
export const CARDIO = {
  walk: { label: 'Gehen', met: 3.5, walking: true },            // 17190, 4,5–5 km/h
  brisk: { label: 'Zügiges Gehen', met: 4.3, walking: true },   // 17200, 5,6 km/h
  hike: { label: 'Wandern', met: 6.0, walking: true },          // 17080
  run: { label: 'Laufen', met: 9.8, pace: true },               // 12050, 9,7 km/h, ohne Distanz
  bike: { label: 'Radfahren', met: 7.5 },                        // 01015, allgemein
  ergometer: { label: 'Ergometer', met: 6.8 },                   // 02011, mäßig
  swim: { label: 'Schwimmen', met: 6.0 },                        // 18310, Bahnen, mäßig
  rowing: { label: 'Rudergerät', met: 7.0 },                     // 02070, mäßig
  elliptical: { label: 'Crosstrainer', met: 5.0 },               // 02048, mäßig
  rope: { label: 'Seilspringen', met: 11.8 },                    // 15552, mäßiges Tempo
  hiit: { label: 'HIIT', met: 8.0 },                             // 02040, Zirkeltraining intensiv
  other: { label: 'Sonstiges', met: 5.0 },                       // mittlere Annahme
};

/* Laufen nach Tempo (Compendium 12020–12140), Untergrenze in km/h */
export const RUN_PACE = [
  { kmh: 0, met: 6.0 },       // langsames Joggen
  { kmh: 6.4, met: 6.0 },
  { kmh: 8.0, met: 8.3 },
  { kmh: 8.4, met: 9.0 },
  { kmh: 9.7, met: 9.8 },
  { kmh: 10.8, met: 10.5 },
  { kmh: 11.3, met: 11.0 },
  { kmh: 12.1, met: 11.5 },
  { kmh: 12.9, met: 11.8 },
  { kmh: 13.8, met: 12.3 },
  { kmh: 14.5, met: 12.8 },
  { kmh: 16.1, met: 14.5 },
  { kmh: 17.7, met: 16.0 },
];

export function runMet(kmh) {
  let met = RUN_PACE[0].met;
  for (const step of RUN_PACE) if (kmh >= step.kmh) met = step.met;
  return met;
}

/* MET einer Einheit. Liefert { met, kmh } (kmh nur, wenn Distanz und Dauer da sind) */
export function cardioMet(type, minutes, km) {
  const t = CARDIO[type] || CARDIO.other;
  const kmh = km > 0 && minutes > 0 ? km / (minutes / 60) : null;
  if (t.pace && kmh) return { met: runMet(kmh), kmh };
  return { met: t.met, kmh };
}

/* Geschätzte kcal einer Einheit, ganzzahlig. Ohne Gewicht keine Schätzung. */
export function cardioKcal({ type, minutes, km }, kg) {
  if (!(kg > 0 && minutes > 0)) return null;
  const { met } = cardioMet(type, minutes, km);
  return Math.round(met * kg * minutes / 60);
}

/* ---------- Fenster über Kalendertage ---------- */
/* Einträge mit today - days < Datum <= today (letzte 7 Tage inklusive heute) */
export function inWindow(list, today, days = 7, includeToday = true) {
  const t = dayNumber(today) - (includeToday ? 0 : 1);
  return (list || []).filter(e => { const n = dayNumber(e.date); return n <= t && n > t - days; });
}

/* Cardio der letzten 7 Tage, auf einen Tag umgelegt */
export function cardioKcalPerDay(cardio, today, days = 7) {
  const list = inWindow(cardio, today, days);
  const kcal = list.reduce((a, c) => a + (c.kcal > 0 ? c.kcal : 0), 0);
  const minutes = list.reduce((a, c) => a + (c.minutes > 0 ? c.minutes : 0), 0);
  return { count: list.length, minutes, kcal, kcalPerDay: kcal / days };
}

/* ---------- Schritte ---------- */
/* Typische Schrittzahl, die in der Alltagsstufe schon steckt */
export const STEP_BASELINE = { sedentary: 4000, light: 6000, moderate: 8000, active: 10000, extreme: 12000 };
export const KCAL_PER_STEP_KG = 0.0005;     // etwa 0,04 kcal pro Schritt bei 80 kg
export const STEP_MIN_DAYS = 4;
export const STEP_EXTRA_CAP = 12000;        // mehr zusätzliche Schritte pro Tag zählen nicht weiter
export const STEPS_PER_WALK_MINUTE = 100;   // Gehen aus dem Cardio steckt auch in den Schritten

/* Zuschlag für Schritte über der Grundlinie der Alltagsstufe. Nur mit Schritten an mindestens 4 der
   letzten 7 vollständigen Tage (heute zählt nicht, der Tag läuft noch). Gehen, Wandern und zügiges Gehen
   aus dem Cardio an diesen Tagen werden abgezogen, weil sie schon als Cardio zählen. */
export function stepsKcalPerDay(steps, activityKey, kg, today, cardio = [], days = 7) {
  const list = inWindow(steps, today, days, false).filter(s => s.steps >= 0);
  const baseline = STEP_BASELINE[activityKey] || STEP_BASELINE.light;
  const out = { days: list.length, enough: list.length >= STEP_MIN_DAYS, baseline, avgSteps: 0, walkSteps: 0, extra: 0, capped: false, kcalPerDay: 0 };
  if (!list.length) return out;
  out.avgSteps = list.reduce((a, s) => a + s.steps, 0) / list.length;
  const stepDays = new Set(list.map(s => s.date));
  const walkMinutes = (cardio || []).filter(c => stepDays.has(c.date) && (CARDIO[c.type] || {}).walking)
    .reduce((a, c) => a + (c.minutes || 0), 0);
  out.walkSteps = walkMinutes * STEPS_PER_WALK_MINUTE / list.length;
  const extra = Math.max(0, out.avgSteps - out.walkSteps - baseline);
  out.capped = extra > STEP_EXTRA_CAP;
  out.extra = Math.min(extra, STEP_EXTRA_CAP);
  if (out.enough && kg > 0) out.kcalPerDay = out.extra * KCAL_PER_STEP_KG * kg;
  return out;
}

/* ---------- Gemessener Verbrauch ---------- */
/* Schnitt der letzten 7 vollständigen Tage, nur mit mindestens 4 Werten */
export function burnAverage(burn, today, days = 7) {
  const list = inWindow(burn, today, days, false).filter(b => b.kcal > 0);
  const avg = list.length ? list.reduce((a, b) => a + b.kcal, 0) / list.length : 0;
  return { days: list.length, enough: list.length >= STEP_MIN_DAYS, avg };
}

/* ---------- Einträge ---------- */
/* Ein Wert pro Tag: ersetzt den Eintrag am selben Datum. Liefert die neue Liste und den ersetzten Eintrag. */
export function upsertByDate(list, entry) {
  const prev = (list || []).find(e => e.date === entry.date) || null;
  const next = (list || []).filter(e => e.date !== entry.date).concat(entry)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { list: next, replaced: prev };
}

/* Werte der letzten n Tage bis einschließlich today, älteste zuerst; fehlende Tage sind null */
export function lastDays(list, key, today, n = 14) {
  const t = dayNumber(today);
  const byDate = new Map();
  (list || []).forEach(e => { byDate.set(e.date, (byDate.get(e.date) || 0) + (Number(e[key]) || 0)); });
  return Array.from({ length: n }, (_, i) => {
    const date = dateFromDayNumber(t - (n - 1 - i));
    return { date, value: byDate.has(date) ? byDate.get(date) : null };
  });
}

/* Schlafdauer aus „7,5“, „7.5“ oder „7:30“ in Stunden */
export function parseHours(text) {
  const s = String(text || '').trim();
  const hm = s.match(/^(\d{1,2})\s*[:h]\s*(\d{1,2})$/);
  if (hm) return Number(hm[1]) + Number(hm[2]) / 60;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/* Stunden als „7:30 h“ */
export function hoursLabel(h) {
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} h`;
}
