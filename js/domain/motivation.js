/* Wochenziele und Ziele (Stufe 5). Reine Funktionen. */
import { fmt, fmt1, ymd } from '../util.js';
import { weekStart, trainingWeeks } from './streaks.js';
import { dayTotals } from './nutrition.js';
import { goalProgress, firstWeight, currentWeight } from './body.js';
import { personalRecords } from './prs.js';

/* Die Kalendertage der Woche von `now`, Montag bis Sonntag, als 'YYYY-MM-DD' */
export function weekDays(now = Date.now()) {
  const start = new Date(weekStart(now));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return ymd(d.getTime());
  });
}

/* Stand der Wochenziele für die laufende Woche.
   training: Tage mit mindestens einer Einheit; protein: Tage mit Protein ≥ Ziel; water: Tage mit Wasser ≥ Ziel.
   Ohne Proteinziel (Profil unvollständig) ist protein.available false. */
export function weeklyGoals({ sessions = [], log = {}, water = {}, proteinTarget = null, waterTarget = 2500, daysPerWeek = 3, weekly = {}, now = Date.now() }) {
  const days = weekDays(now);
  const inWeek = new Set(days);
  const trainingDays = new Set(sessions.map(s => ymd(s.startedAt)).filter(d => inWeek.has(d)));
  const proteinDays = proteinTarget > 0 ? days.filter(d => dayTotals(log, d).protein >= proteinTarget).length : 0;
  const waterDays = days.filter(d => (water[d] || 0) >= waterTarget).length;
  const today = ymd(now);
  const daysLeft = days.filter(d => d >= today).length;
  return {
    training: { done: trainingDays.size, target: daysPerWeek },
    protein: { done: proteinDays, target: weekly.proteinDays || 5, available: proteinTarget > 0, perDay: proteinTarget },
    water: { done: waterDays, target: weekly.waterDays || 5, perDay: waterTarget },
    daysLeft,
  };
}

/* ---------- Ziele und Meilensteine ---------- */
export const GOAL_KINDS = {
  weight: 'Zielgewicht',
  lift: 'Kraftziel',
  weeks: 'Dabeibleiben',
  custom: 'Eigenes Ziel',
};

/* Bestes Gewicht einer Übung über alle Einheiten, egal unter welcher id sie lief */
export function bestWeight(sessions, name, records = personalRecords(sessions)) {
  let best = 0;
  records.forEach(r => { if (r.name === name && r.weight) best = Math.max(best, r.weight.value); });
  return best;
}

/* Fortschritt eines gespeicherten Ziels. Liefert { pct (0–1), text, reached } */
export function evaluateGoal(goal, { sessions = [], records = null } = {}) {
  if (goal.kind === 'lift') {
    const best = bestWeight(sessions, goal.ref, records || personalRecords(sessions));
    const pct = goal.target > 0 ? Math.min(1, best / goal.target) : 0;
    return {
      pct,
      reached: best > 0 && best >= goal.target,
      text: best > 0 ? `Bestwert ${fmt(best)} kg von ${fmt(goal.target)} kg` : `Noch kein Satz ${goal.ref} eingetragen`,
    };
  }
  if (goal.kind === 'weeks') {
    const n = trainingWeeks(sessions);
    return {
      pct: goal.target > 0 ? Math.min(1, n / goal.target) : 0,
      reached: n >= goal.target,
      text: n > goal.target ? `${n} Wochen mit Training, Ziel waren ${goal.target}` : `${n} von ${goal.target} Wochen mit Training`,
    };
  }
  const done = !!goal.doneAt;
  return { pct: done ? 1 : 0, reached: done, text: done ? 'Abgehakt' : 'Hakst du selbst ab, wenn es geschafft ist' };
}

/* Zielgewicht aus dem Profil, Fortschritt vom ersten Eintrag bis zum Ziel. null, wenn kein Ziel gesetzt ist. */
export function weightGoalStatus(profile, weights) {
  const target = profile.targetWeightKg;
  if (!(target > 0)) return null;
  const start = firstWeight(weights);
  const now = currentWeight(profile, weights);
  if (!start || !now) return { target, pct: 0, reached: false, text: 'Trag dein Gewicht unter Körper ein, dann zeigt sich der Fortschritt.' };
  const g = goalProgress(start.kg, now, target);
  if (!g) return { target, pct: 0, reached: false, text: '' };
  return {
    target, pct: g.pct, reached: g.reached,
    text: g.reached ? `Erreicht: ${fmt1(now)} kg` : `Jetzt ${fmt1(now)} kg, noch ${fmt1(Math.abs(g.remaining))} kg bis zum Ziel`,
  };
}

/* Setzt doneAt bei Kraft- und Dabeibleiben-Zielen, sobald sie erreicht sind. Einmal erreicht bleibt erreicht.
   Liefert die neu erreichten Ziele. */
export function syncGoals(S, now = Date.now()) {
  const goals = (S.motivation && S.motivation.goals) || [];
  const open = goals.filter(g => !g.doneAt && (g.kind === 'lift' || g.kind === 'weeks'));
  if (!open.length) return [];
  const records = personalRecords(S.sessions);
  const out = [];
  open.forEach(g => {
    if (evaluateGoal(g, { sessions: S.sessions, records }).reached) { g.doneAt = now; out.push(g); }
  });
  return out;
}
