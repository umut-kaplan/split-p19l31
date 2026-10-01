import { fmt0, fmt1, ymd, plural } from '../util.js';
import { leanMass, latestComposition, currentWeight } from './body.js';
import { cardioKcalPerDay, stepsKcalPerDay, burnAverage, KCAL_PER_STEP_KG } from './activity.js';
import { profileAge } from './birthdate.js';

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
/* Höchstes Defizit am Tag beim Abnehmen (4.7): Darüber gab es in Studien kaum noch Zuwachs an Magermasse
   (Murphy & Koehler 2022). Gilt für das Startziel; die wöchentlichen Vorschläge halten sich an dasselbe Tempo. */
export const MAX_DEFICIT = 500;

/* Krafttraining mit MET 5, pro Einheit höchstens 2 Stunden */
export const MET_STRENGTH = 5;
export const SESSION_CAP_HOURS = 2;

/* Grundumsatz nach Mifflin-St Jeor */
export function bmrMifflin({ kg, cm, age, sex }) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'f' ? -161 : 5);
}

/* Grundumsatz nach Katch-McArdle aus der fettfreien Masse */
export const bmrKatch = leanKg => 370 + 21.6 * leanKg;

/* Alter aus dem Geburtsdatum am Tag von now; ohne Geburtsdatum das früher eingetragene Alter (profile.age) */
export function missingForCalories(p, now = Date.now()) {
  const missing = [];
  if (!(p.weightKg > 0)) missing.push('Gewicht');
  if (!(p.heightCm > 0)) missing.push('Größe');
  const a = profileAge(p, now);
  if (!(a && a.age > 0)) missing.push('Geburtsdatum');
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

const n0 = v => fmt0(v);

/* Sätze zu Cardio und Schritten, jeweils nur, wenn es Daten gibt */
function activityLines(cardio, steps, activityLabel) {
  const out = [];
  if (cardio.count) {
    out.push(`Plus ${n0(cardio.kcalPerDay)} kcal pro Tag für Cardio: ${cardio.count} ${cardio.count === 1 ? 'Einheit' : 'Einheiten'} mit zusammen ${n0(cardio.minutes)} Minuten und ${n0(cardio.kcal)} kcal in den letzten 7 Tagen, geschätzt nach MET und auf 7 Tage verteilt.`);
  }
  if (steps.enough) {
    const walk = steps.walkSteps >= 1 ? ` Gehen aus deinem Cardio (etwa ${n0(steps.walkSteps)} ${plural(n0(steps.walkSteps), 'Schritt', 'Schritte')} am Tag) zieht die App ab, weil es schon als Cardio zählt.` : '';
    out.push(steps.kcalPerDay > 0
      ? `Plus ${n0(steps.kcalPerDay)} kcal pro Tag für Schritte: im Schnitt ${n0(steps.avgSteps)} Schritte an ${steps.days} ${plural(steps.days, 'Tag', 'Tagen')}, davon ${n0(steps.extra)} über den ${n0(steps.baseline)}, die in „${activityLabel}“ schon stecken, mal ${KCAL_PER_STEP_KG.toLocaleString('de-DE', { maximumFractionDigits: 4 })} kcal pro Schritt und kg.${steps.capped ? ' Mehr als 12.000 zusätzliche Schritte am Tag zählen nicht weiter.' : ''}${walk}`
      : `Kein Zuschlag für Schritte: im Schnitt ${n0(steps.avgSteps)} an ${steps.days} ${plural(steps.days, 'Tag', 'Tagen')}, das steckt in „${activityLabel}“ (${n0(steps.baseline)} Schritte) schon drin.${walk}`);
  }
  return out;
}

/* Kalorienziel mit Rechenweg in ganzen Sätzen.
   ctx: { composition (aus latestComposition), sessions, activity (S.activity), now, kcalAdjust } – alles optional */
export function calorieGoal(p, ctx = {}) {
  const comp = ctx.composition || null;
  const lean = comp && p.weightKg > 0 ? leanMass(p.weightKg, comp.bfPct) : null;
  const now = ctx.now ?? Date.now();
  let bmr, bmrLine;
  if (lean) {
    bmr = bmrKatch(lean);
    bmrLine = `Grundumsatz nach Katch-McArdle aus ${fmt1(lean)} kg fettfreier Masse (${fmt1(comp.bfPct)} % Körperfett, ${comp.measured ? 'gemessen' : 'nach der Navy-Formel geschätzt'}): ${fmt0(bmr)} kcal.`;
  } else {
    const missing = missingForCalories(p, now);
    if (missing.length) return { ok: false, missing };
    const { age, from } = profileAge(p, now);
    bmr = bmrMifflin({ kg: p.weightKg, cm: p.heightCm, age, sex: p.sex });
    bmrLine = `Grundumsatz nach Mifflin-St Jeor aus Gewicht, Größe, Alter (${age} Jahre${from === 'age' ? ', ohne Geburtsdatum im Profil' : ''}) und Geschlecht: ${fmt0(bmr)} kcal.`;
  }
  const actKey = ACTIVITY[p.activity] ? p.activity : DEFAULT_ACTIVITY;
  const act = ACTIVITY[actKey];
  const daily = bmr * act.factor;
  const today = ymd(now);
  const tr = trainingKcalPerDay(ctx.sessions, p.weightKg, now);
  const a = ctx.activity || {};
  const cardio = cardioKcalPerDay(a.cardio, today);
  const steps = stepsKcalPerDay(a.steps, actKey, p.weightKg, today, a.cardio);
  const burn = burnAverage(a.burn, today);
  const tdee = daily + tr.kcalPerDay + cardio.kcalPerDay + steps.kcalPerDay;
  const goal = GOALS[p.goal] || GOALS.recomp;
  /* Defizit 20 %, höchstens 500 kcal am Tag */
  const capped = goal.adj < 0 && -goal.adj * tdee > MAX_DEFICIT;
  const goalKcal = capped ? tdee - MAX_DEFICIT : tdee * (1 + goal.adj);
  const adjust = ctx.kcalAdjust || 0;
  const kcal = Math.round((goalKcal + adjust) / 10) * 10;
  /* Verbrauch: Training, dann Cardio und Schritte; der letzte Satz nennt die Summe */
  const usage = [
    tr.count
      ? `Plus ${fmt0(tr.kcalPerDay)} kcal pro Tag fürs Training: ${tr.count} ${tr.count === 1 ? 'Einheit' : 'Einheiten'} mit zusammen ${fmt1(tr.hours)} Stunden in den letzten 7 Tagen, gerechnet mit MET 5 und auf 7 Tage verteilt.`
      : 'Kein Zuschlag fürs Training, weil in den letzten 7 Tagen keine Einheit eingetragen ist.',
    ...activityLines(cardio, steps, act.label),
  ];
  usage[usage.length - 1] += ` Zusammen ${fmt0(tdee)} kcal Gesamtumsatz.`;
  const lines = [
    bmrLine,
    `Mal ${act.factor.toLocaleString('de-DE')} für deinen Alltag „${act.label}“${p.activity ? '' : ' (Standardwert, im Profil änderbar)'}: ${fmt0(daily)} kcal.`,
    ...usage,
    /* Gedeckelt (4.7): erst, was die Prozent wären, dann warum es weniger ist */
    capped
      ? `Minus ${fmt0(MAX_DEFICIT)} kcal für das Ziel „${goal.label}“: ${fmt0(goalKcal)} kcal. ${fmt0(Math.abs(goal.adj * 100))} % wären ${fmt0(-goal.adj * tdee)} kcal, die App zieht aber höchstens ${fmt0(MAX_DEFICIT)} kcal am Tag ab: Ein größeres Defizit bremst in Studien den Muskelaufbau.`
      : goal.adj
      ? `${goal.adj > 0 ? 'Plus' : 'Minus'} ${fmt0(Math.abs(goal.adj * 100))} % für das Ziel „${goal.label}“: ${fmt0(goalKcal)} kcal.`
      : `Für das Ziel „${goal.label}“ kein Zu- oder Abschlag.${p.goal ? '' : ' Ohne Ziel im Profil rechnet die App so.'}`,
  ];
  if (adjust) lines.push(`${adjust > 0 ? 'Plus' : 'Minus'} ${fmt0(Math.abs(adjust))} kcal aus angenommenen Anpassungen nach deinem Gewichtstrend.`);
  lines.push(`Auf 10 gerundet: ${fmt0(kcal)} kcal.`);
  /* Gemessener Verbrauch fließt nicht ein, er dient nur zum Vergleich */
  if (burn.enough) {
    const diff = burn.avg - tdee;
    const rel = Math.abs(diff) / tdee * 100;
    lines.push(`Zum Vergleich: Deine Uhr misst im Schnitt ${fmt0(burn.avg)} kcal Tagesverbrauch an ${burn.days} ${plural(burn.days, 'Tag', 'Tagen')}, die Rechnung ergibt ${fmt0(tdee)} kcal${rel >= 5 ? ` (${fmt0(rel)} % ${diff > 0 ? 'weniger' : 'mehr'})` : ''}. Die App bleibt bei ihrer Rechnung, weil Uhren den Verbrauch oft deutlich überschätzen und der wöchentliche Abgleich mit deinem Gewicht das Ziel ohnehin nachführt.`);
  }
  return {
    ok: true, bmr, formula: lean ? 'katch' : 'mifflin', lean,
    daily, training: tr, cardio, steps, burn, tdee, goalKcal, adjust, kcal, factor: act.factor, adj: goal.adj, lines,
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
export function nutritionTargets({ profile, weightKg, composition = null, sessions = [], activity = null, kcalAdjust = 0, overrides = null, now = Date.now() }) {
  const p = { ...profile, weightKg };
  const calc = calorieGoal(p, { composition, sessions, activity, now, kcalAdjust });
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
    activity: S.activity || null,
    kcalAdjust: (S.nutrition && S.nutrition.kcalAdjust) || 0,
    overrides: S.nutrition && S.nutrition.overrides,
    now,
  });
}

/* 35 ml pro kg, auf 50 ml gerundet; ohne Gewicht 2,5 l */
export const waterGoal = kg => (kg > 0 ? Math.round(35 * kg / 50) * 50 : 2500);
