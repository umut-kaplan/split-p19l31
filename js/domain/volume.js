/* Trainingsvolumen pro Muskelgruppe und Woche (Montag bis Sonntag). Reine Funktionen.
   Ein Satz zählt für jeden primär beanspruchten Muskel voll, für mitbeanspruchte zur Hälfte. */
import { SECONDARY_WEIGHT, weeklyTarget } from './muscles.js';
import { weekStart } from './streaks.js';
import { workSets } from './settypes.js';

/* ISO-Kalenderwoche als 'JJJJ-Www', z. B. 2026-W39 */
export function isoWeekKey(t) {
  const d = new Date(t);
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  const week = 1 + Math.round(((thursday - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/* Beginn der Vorwoche */
export function prevWeekStart(start) {
  const d = new Date(start);
  d.setDate(d.getDate() - 7);
  return weekStart(d.getTime());
}

/* Sätze pro Muskelgruppe in der Woche ab weekStartMs.
   resolve(name) liefert den Bibliotheks-Eintrag mit muscles oder null. Unbekannte Übungen zählen nicht und werden genannt.
   Aufwärmsätze zählen nicht, Dropsätze schon. */
export function weekMuscleSets(sessions, weekStartMs, resolve) {
  const sets = {};
  const unknown = new Set();
  let total = 0;
  sessions.forEach(s => {
    if (weekStart(s.startedAt) !== weekStartMs) return;
    s.ex.forEach(x => {
      const n = workSets(x.sets).length;
      if (!n) return;
      const e = resolve(x.name);
      if (!e || !e.muscles || !(e.muscles.primary || []).length) { unknown.add(x.name); return; }
      total += n;
      const primary = e.muscles.primary || [];
      primary.forEach(m => { sets[m] = (sets[m] || 0) + n; });
      (e.muscles.secondary || []).forEach(m => {
        if (!primary.includes(m)) sets[m] = (sets[m] || 0) + n * SECONDARY_WEIGHT;
      });
    });
  });
  return { start: weekStartMs, sets, unknown: [...unknown], total };
}

/* Die letzten n Wochen bis einschließlich der Woche von now, älteste zuerst */
export function muscleWeeks(sessions, now, n, resolve) {
  const out = [];
  let k = weekStart(now);
  for (let i = 0; i < n; i++) {
    out.unshift(weekMuscleSets(sessions, k, resolve));
    k = prevWeekStart(k);
  }
  return out;
}

/* Einordnung gegen den Zielbereich des Muskels (domain/muscles.js); ohne Muskel der Standardbereich */
export function volumeRating(v, muscle = null) {
  const t = weeklyTarget(muscle);
  /* Nacken/Trapez und unterer Rücken: ohne Zielbereich, keine Ampel (domain/muscles.js) */
  if (!t) return 'none';
  const [lo, hi] = t;
  return v < lo ? 'low' : v > hi ? 'high' : 'ok';
}
