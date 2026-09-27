/* Abzeichen (Stufe 5). Jedes Abzeichen hat eine Bedingung als Satz und eine reine Prüffunktion.
   Verdient bleibt verdient: S.motivation.badges merkt den Zeitpunkt des ersten Verdienens. */
import { longestStreak, trainingWeeks, weekStart } from './streaks.js';
import { exerciseStats, recordKey, RECORD_KINDS } from './prs.js';
import { dayTotals } from './nutrition.js';
import { goalProgress, firstWeight, currentWeight, dayNumber } from './body.js';
import { waterGoal, targetsFromState } from './energy.js';
import { ymd } from '../util.js';

const bySession = sessions => [...sessions].sort((a, b) => a.startedAt - b.startedAt);
const sessionAt = s => s.endedAt || s.startedAt;
const dayMs = d => new Date(d + 'T12:00').getTime();
const earliestDay = list => (list && list.length ? Math.min(...list.map(x => dayMs(x.date))) : null);

/* Zeitpunkt der ersten Einheit, die einen Bestwert aus einer früheren Einheit übertroffen hat, sonst null */
export function firstRecordAt(sessions) {
  const best = new Map();
  for (const s of bySession(sessions)) {
    const updates = [];
    for (const x of s.ex || []) {
      if (!x.sets || !x.sets.length) continue;
      const key = recordKey(x);
      const st = exerciseStats(x.sets, x.unit);
      const prev = best.get(key);
      if (prev && RECORD_KINDS.some(k => st[k] > 0 && prev[k] > 0 && st[k] > prev[k])) return sessionAt(s);
      updates.push([key, st, prev]);
    }
    updates.forEach(([key, st, prev]) => {
      const next = { ...(prev || {}) };
      RECORD_KINDS.forEach(k => { if (st[k] > 0 && !(next[k] >= st[k])) next[k] = st[k]; });
      best.set(key, next);
    });
  }
  return null;
}

/* Gab es je eine Einheit, die einen Bestwert aus einer früheren Einheit übertroffen hat? */
export const hadRecord = sessions => firstRecordAt(sessions) != null;

/* Zeitpunkt der n-ten Einheit, sonst null */
export function nthSessionAt(sessions, n) {
  const s = bySession(sessions);
  return s.length >= n ? sessionAt(s[n - 1]) : null;
}

/* Zeitpunkt der Einheit, mit der die Summe aus Gewicht mal Wiederholungen die Grenze erreicht, sonst null */
export function tonnageReachedAt(sessions, kg) {
  let sum = 0;
  for (const s of bySession(sessions)) {
    sum += totalTonnage([s]);
    if (sum >= kg) return sessionAt(s);
  }
  return null;
}

/* Tag, an dem zum n-ten Mal Essen eingetragen wurde, sonst null */
export function nthLoggedDayAt(log, n) {
  const days = Object.keys(log || {}).filter(d => (log[d] || []).length > 0).sort();
  return days.length >= n ? dayMs(days[n - 1]) : null;
}

/* Summe aus Gewicht mal Wiederholungen über alle Einheiten, in kg */
export function totalTonnage(sessions) {
  return sessions.reduce((a, s) => a + (s.ex || []).reduce((b, x) =>
    b + (x.unit === 'sec' ? 0 : (x.sets || []).reduce((c, st) => c + (st.w || 0) * (st.r || 0), 0)), 0), 0);
}

/* Längste Folge aufeinanderfolgender Kalendertage mit Wasser ≥ Ziel */
export function longestWaterRun(water, goalMl) {
  const days = Object.keys(water || {}).filter(d => water[d] >= goalMl).map(dayNumber).sort((a, b) => a - b);
  let run = 0, best = 0, prev = null;
  days.forEach(n => { run = prev != null && n === prev + 1 ? run + 1 : 1; best = Math.max(best, run); prev = n; });
  return best;
}

/* Meiste Tage mit Protein ≥ Ziel innerhalb einer Woche (Montag bis Sonntag) */
export function bestProteinWeek(log, proteinTarget) {
  if (!(proteinTarget > 0)) return 0;
  const perWeek = new Map();
  Object.keys(log || {}).forEach(d => {
    if (dayTotals(log, d).protein >= proteinTarget) {
      const k = weekStart(new Date(d + 'T12:00').getTime());
      perWeek.set(k, (perWeek.get(k) || 0) + 1);
    }
  });
  return Math.max(0, ...perWeek.values());
}

/* Alles, was die Prüfungen brauchen, einmal aus dem Zustand gerechnet */
export function badgeContext(S, now = Date.now()) {
  const sessions = S.sessions || [];
  const target = S.profile.daysPerWeek || 3;
  const weights = S.body.weights || [];
  const kg = currentWeight(S.profile, weights);
  const start = firstWeight(weights);
  let targetReached = false;
  if (S.profile.targetWeightKg > 0 && start && kg) {
    const g = goalProgress(start.kg, kg, S.profile.targetWeightKg);
    targetReached = !!(g && g.reached && Math.abs(start.kg - S.profile.targetWeightKg) >= 0.3);
  }
  let proteinTarget = null;
  try { const t = targetsFromState(S, now); proteinTarget = t.ok ? t.protein : null; } catch (e) { proteinTarget = null; }
  const log = (S.nutrition && S.nutrition.log) || {};
  return {
    sessions: sessions.length,
    record: hadRecord(sessions),
    longest: longestStreak(sessions, target, now),
    weeks: trainingWeeks(sessions),
    nutritionDays: Object.keys(log).filter(d => (log[d] || []).length > 0).length,
    photos: (S.body.photos || []).length,
    measurements: (S.body.measurements || []).length,
    targetReached,
    waterRun: longestWaterRun(S.water, waterGoal(kg)),
    proteinWeek: bestProteinWeek(log, proteinTarget),
    tonnage: totalTonnage(sessions),
    ownPlan: (S.plans || []).some(p => p.id !== 'split'),
    recipes: ((S.nutrition && S.nutrition.recipes) || []).length,
  };
}

export const BADGES = [
  { id: 'first-session', title: 'Erstes Training', desc: 'Die erste Einheit abgeschlossen', label: '1', color: 'red', check: c => c.sessions >= 1, when: S => nthSessionAt(S.sessions || [], 1) },
  { id: 'sessions-10', title: '10 Einheiten', desc: '10 Einheiten abgeschlossen', label: '10', color: 'blue', check: c => c.sessions >= 10, when: S => nthSessionAt(S.sessions || [], 10) },
  { id: 'sessions-50', title: '50 Einheiten', desc: '50 Einheiten abgeschlossen', label: '50', color: 'green', check: c => c.sessions >= 50, when: S => nthSessionAt(S.sessions || [], 50) },
  { id: 'sessions-100', title: '100 Einheiten', desc: '100 Einheiten abgeschlossen', label: '100', color: 'yellow', check: c => c.sessions >= 100, when: S => nthSessionAt(S.sessions || [], 100) },
  { id: 'first-pr', title: 'Erster Rekord', desc: 'Einen Bestwert aus einer früheren Einheit übertroffen', label: 'PR', color: 'red', check: c => c.record, when: S => firstRecordAt(S.sessions || []) },
  { id: 'streak-4', title: '4 Wochen am Stück', desc: 'Vier Wochen in Folge die geplanten Einheiten geschafft', label: '4', color: 'blue', check: c => c.longest >= 4 },
  { id: 'streak-12', title: '12 Wochen am Stück', desc: 'Zwölf Wochen in Folge die geplanten Einheiten geschafft', label: '12', color: 'green', check: c => c.longest >= 12 },
  { id: 'weeks-12', title: '12 Wochen dabei', desc: 'In zwölf verschiedenen Wochen trainiert', label: '12', color: 'white', check: c => c.weeks >= 12 },
  { id: 'nutrition-30', title: '30 Tage Ernährung', desc: 'An 30 Tagen Essen eingetragen', label: '30', color: 'yellow', check: c => c.nutritionDays >= 30, when: S => nthLoggedDayAt(S.nutrition && S.nutrition.log, 30) },
  { id: 'first-photo', title: 'Erstes Foto', desc: 'Das erste Fortschrittsfoto gemacht', label: 'Foto', color: 'white', check: c => c.photos >= 1, when: S => earliestDay(S.body.photos) },
  { id: 'first-measure', title: 'Erste Messung', desc: 'Zum ersten Mal Umfänge eingetragen', label: 'cm', color: 'steel', check: c => c.measurements >= 1, when: S => earliestDay(S.body.measurements) },
  { id: 'target-weight', title: 'Zielgewicht erreicht', desc: 'Das Zielgewicht aus dem Profil erreicht', label: 'Ziel', color: 'green', check: c => c.targetReached },
  { id: 'water-7', title: '7 Tage Wasser', desc: 'Sieben Tage am Stück das Wasserziel geschafft', label: '7', color: 'blue', check: c => c.waterRun >= 7 },
  { id: 'protein-week', title: 'Proteinwoche', desc: 'An fünf Tagen einer Woche das Proteinziel geschafft', label: '5', color: 'red', check: c => c.proteinWeek >= 5 },
  { id: 'tons-10', title: '10 Tonnen', desc: 'Insgesamt 10 Tonnen bewegt, Gewicht mal Wiederholungen', label: '10 t', color: 'steel', check: c => c.tonnage >= 10000, when: S => tonnageReachedAt(S.sessions || [], 10000) },
  { id: 'own-plan', title: 'Eigener Plan', desc: 'Einen eigenen Plan oder einen aus einer Vorlage angelegt', label: 'Plan', color: 'blue', check: c => c.ownPlan },
  { id: 'first-recipe', title: 'Erstes Rezept', desc: 'Das erste eigene Rezept angelegt', label: 'Rezept', color: 'yellow', check: c => c.recipes >= 1,
    when: S => { const t = ((S.nutrition && S.nutrition.recipes) || []).map(r => r.createdAt).filter(Boolean); return t.length ? Math.min(...t) : null; } },
];

/* Trägt neu verdiente Abzeichen mit Zeitpunkt ein. Idempotent. Liefert die neu verdienten. */
export function syncBadges(S, now = Date.now()) {
  if (!S.motivation) S.motivation = { goals: [], weekly: { proteinDays: 5, waterDays: 5 }, badges: {}, reportSeen: null };
  if (!S.motivation.badges) S.motivation.badges = {};
  const ctx = badgeContext(S, now);
  const fresh = BADGES.filter(b => !S.motivation.badges[b.id] && b.check(ctx));
  /* Wo die Daten es hergeben, zählt der Zeitpunkt, an dem das Abzeichen tatsächlich verdient wurde, sonst der Moment des Erkennens */
  fresh.forEach(b => {
    let at = null;
    try { at = b.when ? b.when(S) : null; } catch (e) { at = null; }
    S.motivation.badges[b.id] = at != null && at <= now ? at : now;
  });
  return fresh;
}

/* Kurzer Tagesschlüssel, damit Serien und Wasser am Tageswechsel neu geprüft werden */
export const badgeDay = (now = Date.now()) => ymd(now);
