import { fmt0, fmt1 } from '../util.js';
import { leanMass, latestComposition, currentWeight } from './body.js';

/* Aktivität im Alltag, ohne Sport. Das Training rechnet die App aus den eingetragenen Einheiten dazu. */
export const ACTIVITY = {
  sedentary: { factor: 1.2, label: 'Kaum aktiv', hint: 'Viel Sitzen, z. B. Büro, kurze Wege' },
  light: { factor: 1.375, label: 'Leicht aktiv', hint: 'Viel Stehen und Gehen, z. B. Verkauf, Schule' },
  moderate: { factor: 1.55, label: 'Mäßig aktiv', hint: 'Teils körperliche Arbeit, z. B. Pflege, Gastronomie' },
  active: { factor: 1.725, label: 'Sehr aktiv', hint: 'Überwiegend körperliche Arbeit, z. B. Lager, Bau' },
  extreme: { factor: 1.9, label: 'Extrem aktiv', hint: 'Schwere körperliche Arbeit den ganzen Tag' },
};
/* Ohne Angabe im Profil */
export const DEFAULT_ACTIVITY = 'light';

export const GOALS = {
  gain: { adj: 0.10, label: 'Muskelaufbau', hint: 'Leichter Überschuss, damit Muskeln wachsen' },
  lose: { adj: -0.20, label: 'Abnehmen', hint: 'Defizit, Muskeln halten' },
  recomp: { adj: 0, label: 'Beides', hint: 'Ungefähr Erhaltung, Fett runter und Muskeln rauf' },
};

/* Krafttraining mit MET 5, pro Einheit höchstens 2 Stunden */
export const MET_STRENGTH = 5;
export const SESSION_CAP_HOURS = 2;

/* Grundumsatz nach Mifflin-St Jeor */
export function bmrMifflin({ kg, cm, age, sex }) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'f' ? -161 : 5);
}

/* Grundumsatz nach Katch-McArdle aus der fettfreien Masse */
export const bmrKatch = leanKg => 370 + 21.6 * leanKg;

export function missingForCalories(p) {
  const missing = [];
  if (!(p.weightKg > 0)) missing.push('Gewicht');
  if (!(p.heightCm > 0)) missing.push('Größe');
  if (!(p.age > 0)) missing.push('Alter');
  if (p.sex !== 'm' && p.sex !== 'f') missing.push('Geschlecht');
  return missing;
}

/* Verbrauch durch Training der letzten `days` Tage, auf einen Tag umgelegt */
export function trainingKcalPerDay(sessions, kg, now = Date.now(), days = 7) {
  const from = now - days * 864e5;
  const done = (sessions || []).filter(s => s.startedAt > from && s.startedAt <= now && s.endedAt > s.startedAt);
  const hours = done.reduce((a, s) => a + Math.min(SESSION_CAP_HOURS, (s.endedAt - s.startedAt) / 36e5), 0);
  return { count: done.length, hours, kcalPerDay: kg > 0 ? MET_STRENGTH * kg * hours / days : 0 };
}

/* Kalorienziel mit Rechenweg in ganzen Sätzen.
   ctx: { composition (aus latestComposition), sessions, now, kcalAdjust } – alles optional */
export function calorieGoal(p, ctx = {}) {
  const comp = ctx.composition || null;
  const lean = comp && p.weightKg > 0 ? leanMass(p.weightKg, comp.bfPct) : null;
  let bmr, bmrLine;
  if (lean) {
    bmr = bmrKatch(lean);
    bmrLine = `Grundumsatz nach Katch-McArdle aus ${fmt1(lean)} kg fettfreier Masse (${fmt1(comp.bfPct)} % Körperfett, ${comp.measured ? 'gemessen' : 'nach der Navy-Formel geschätzt'}): ${fmt0(bmr)} kcal.`;
  } else {
    const missing = missingForCalories(p);
    if (missing.length) return { ok: false, missing };
    bmr = bmrMifflin({ kg: p.weightKg, cm: p.heightCm, age: p.age, sex: p.sex });
    bmrLine = `Grundumsatz nach Mifflin-St Jeor aus Gewicht, Größe, Alter und Geschlecht: ${fmt0(bmr)} kcal.`;
  }
  const act = ACTIVITY[p.activity] || ACTIVITY[DEFAULT_ACTIVITY];
  const daily = bmr * act.factor;
  const tr = trainingKcalPerDay(ctx.sessions, p.weightKg, ctx.now ?? Date.now());
  const tdee = daily + tr.kcalPerDay;
  const goal = GOALS[p.goal] || GOALS.recomp;
  const goalKcal = tdee * (1 + goal.adj);
  const adjust = ctx.kcalAdjust || 0;
  const kcal = Math.round((goalKcal + adjust) / 10) * 10;
  const lines = [
    bmrLine,
    `Mal ${act.factor.toLocaleString('de-DE')} für deinen Alltag „${act.label}“${p.activity ? '' : ' (Standardwert, im Profil änderbar)'}: ${fmt0(daily)} kcal.`,
    tr.count
      ? `Plus ${fmt0(tr.kcalPerDay)} kcal pro Tag fürs Training: ${tr.count} ${tr.count === 1 ? 'Einheit' : 'Einheiten'} mit zusammen ${fmt1(tr.hours)} Stunden in den letzten 7 Tagen, gerechnet mit MET 5 und auf 7 Tage verteilt. Zusammen ${fmt0(tdee)} kcal Gesamtumsatz.`
      : `Kein Zuschlag fürs Training, weil in den letzten 7 Tagen keine Einheit eingetragen ist. Gesamtumsatz ${fmt0(tdee)} kcal.`,
    goal.adj
      ? `${goal.adj > 0 ? 'Plus' : 'Minus'} ${fmt0(Math.abs(goal.adj * 100))} % für das Ziel „${goal.label}“: ${fmt0(goalKcal)} kcal.`
      : `Für das Ziel „${goal.label}“ kein Zu- oder Abschlag.${p.goal ? '' : ' Ohne Ziel im Profil rechnet die App so.'}`,
  ];
  if (adjust) lines.push(`${adjust > 0 ? 'Plus' : 'Minus'} ${fmt0(Math.abs(adjust))} kcal aus angenommenen Anpassungen nach deinem Gewichtstrend.`);
  lines.push(`Auf 10 gerundet: ${fmt0(kcal)} kcal.`);
  return {
    ok: true, bmr, formula: lean ? 'katch' : 'mifflin', lean,
    daily, training: tr, tdee, goalKcal, adjust, kcal, factor: act.factor, adj: goal.adj, lines,
  };
}

/* Protein 2 g pro kg Körpergewicht, bei bekannter fettfreier Masse 2,2 g pro kg davon.
   Fett 0,8 g pro kg Körpergewicht, der Rest Kohlenhydrate. */
export function macros(kcal, kg, lean = null) {
  const byLean = lean > 0;
  const basisKg = byLean ? lean : kg;
  const perKg = byLean ? 2.2 : 2;
  const protein = Math.round(perKg * basisKg);
  const fat = Math.round(0.8 * kg);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return {
    protein, fat, carbs, perKg, basisKg,
    proteinBasis: byLean ? 'lean' : 'weight',
    proteinRange: [Math.round(1.8 * basisKg), Math.round(2.2 * basisKg)],
  };
}

/* Kohlenhydrate als Rest, nie negativ */
export const carbsRest = (kcal, protein, fat) => Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

/* Alle Tagesziele. Von Hand gesetzte Werte (overrides) gehen vor.
   Liefert { ok, kcal, protein, fat, carbs, manual: { kcal, protein, fat, carbs }, calc, macro } oder { ok: false, missing, calc } */
export function nutritionTargets({ profile, weightKg, composition = null, sessions = [], kcalAdjust = 0, overrides = null, now = Date.now() }) {
  const p = { ...profile, weightKg };
  const calc = calorieGoal(p, { composition, sessions, now, kcalAdjust });
  const ov = overrides || {};
  const has = k => ov[k] > 0 || (k === 'carbs' && ov[k] === 0);
  if (!calc.ok && !has('kcal')) return { ok: false, missing: calc.missing, calc };
  const kcal = has('kcal') ? ov.kcal : calc.kcal;
  const lean = calc.ok ? calc.lean : null;
  const macro = weightKg > 0 ? macros(kcal, weightKg, lean) : null;
  const protein = has('protein') ? ov.protein : macro ? macro.protein : null;
  const fat = has('fat') ? ov.fat : macro ? macro.fat : null;
  const carbs = has('carbs') ? ov.carbs : protein != null && fat != null ? carbsRest(kcal, protein, fat) : null;
  return {
    ok: true, kcal, protein, fat, carbs, calc, macro,
    manual: { kcal: has('kcal'), protein: has('protein'), fat: has('fat'), carbs: has('carbs') },
  };
}

/* Dasselbe direkt aus dem gespeicherten Zustand */
export function targetsFromState(S, now = Date.now()) {
  const weightKg = currentWeight(S.profile, S.body.weights);
  const profile = { ...S.profile, weightKg };
  return nutritionTargets({
    profile,
    weightKg,
    composition: latestComposition(profile, S.body),
    sessions: S.sessions,
    kcalAdjust: (S.nutrition && S.nutrition.kcalAdjust) || 0,
    overrides: S.nutrition && S.nutrition.overrides,
    now,
  });
}

/* 35 ml pro kg, auf 50 ml gerundet; ohne Gewicht 2,5 l */
export const waterGoal = kg => (kg > 0 ? Math.round(35 * kg / 50) * 50 : 2500);
