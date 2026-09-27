import { fmt, fmt0 } from '../util.js';

/* Übliche Aktivitätsfaktoren. Das Training ist darin schon enthalten. */
export const ACTIVITY = {
  sedentary: { factor: 1.2, label: 'Kaum aktiv', hint: 'Sitzende Arbeit, kaum Sport' },
  light: { factor: 1.375, label: 'Leicht aktiv', hint: 'Sport 1–3 × pro Woche' },
  moderate: { factor: 1.55, label: 'Mäßig aktiv', hint: 'Sport 3–5 × pro Woche' },
  active: { factor: 1.725, label: 'Sehr aktiv', hint: 'Sport 6–7 × pro Woche oder stehende Arbeit' },
  extreme: { factor: 1.9, label: 'Extrem aktiv', hint: 'Körperliche Arbeit und viel Sport' },
};

export const GOALS = {
  gain: { adj: 0.10, label: 'Muskelaufbau', hint: 'Leichter Überschuss, damit Muskeln wachsen' },
  lose: { adj: -0.20, label: 'Abnehmen', hint: 'Defizit, Muskeln halten' },
  recomp: { adj: 0, label: 'Beides', hint: 'Ungefähr Erhaltung, Fett runter und Muskeln rauf' },
};

/* Grundumsatz nach Mifflin-St Jeor */
export function bmrMifflin({ kg, cm, age, sex }) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'f' ? -161 : 5);
}

export function missingForCalories(p) {
  const missing = [];
  if (!(p.weightKg > 0)) missing.push('Gewicht');
  if (!(p.heightCm > 0)) missing.push('Größe');
  if (!(p.age > 0)) missing.push('Alter');
  if (p.sex !== 'm' && p.sex !== 'f') missing.push('Geschlecht');
  return missing;
}

/* Kalorienziel mit Rechenweg in ganzen Sätzen, damit die App zeigen kann, woher die Zahl kommt */
export function calorieGoal(p) {
  const missing = missingForCalories(p);
  if (missing.length) return { ok: false, missing };
  const act = ACTIVITY[p.activity] || ACTIVITY.moderate;
  const goal = GOALS[p.goal] || GOALS.recomp;
  const bmr = bmrMifflin({ kg: p.weightKg, cm: p.heightCm, age: p.age, sex: p.sex });
  const tdee = bmr * act.factor;
  const kcal = Math.round(tdee * (1 + goal.adj) / 10) * 10;
  const lines = [
    `Grundumsatz nach Mifflin-St Jeor aus Gewicht, Größe, Alter und Geschlecht: ${fmt0(bmr)} kcal.`,
    `Mal ${fmt(act.factor)} für „${act.label}“${p.activity ? '' : ' (Standardwert, im Profil änderbar)'}: ${fmt0(tdee)} kcal Gesamtumsatz.`,
    goal.adj
      ? `${goal.adj > 0 ? 'Plus' : 'Minus'} ${fmt0(Math.abs(goal.adj * 100))} % für das Ziel „${goal.label}“, gerundet: ${fmt0(kcal)} kcal.`
      : `Für das Ziel „${goal.label}“ kein Zu- oder Abschlag, gerundet: ${fmt0(kcal)} kcal.${p.goal ? '' : ' Ohne Ziel im Profil rechnet die App so.'}`,
  ];
  return { ok: true, bmr, tdee, kcal, factor: act.factor, adj: goal.adj, lines };
}

/* Protein 2 g/kg (Spanne 1,8–2,2), Fett 0,8 g/kg, der Rest Kohlenhydrate */
export function macros(kcal, kg) {
  const protein = Math.round(2 * kg);
  const fat = Math.round(0.8 * kg);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { protein, fat, carbs, proteinRange: [Math.round(1.8 * kg), Math.round(2.2 * kg)] };
}

/* 35 ml pro kg, auf 50 ml gerundet; ohne Gewicht 2,5 l */
export const waterGoal = kg => (kg > 0 ? Math.round(35 * kg / 50) * 50 : 2500);
