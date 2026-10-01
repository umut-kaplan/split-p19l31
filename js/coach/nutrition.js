/* Ernährungsregeln (Stufe 4): Kalorienziel einmal pro Woche mit dem Gewichtstrend vergleichen.
   Format siehe coach/index.js. Nichts passiert automatisch, jede Änderung ist ein Vorschlag.
   4.7 (#34, Q32):
   - Aufbau 0,25 bis 0,5 % des Körpergewichts pro Woche (Iraki 2019), nicht mehr pro Monat.
   - Abnehmen 0,5 bis 1 % pro Woche (Garthe 2011, Helms 2014), aber höchstens so schnell, wie 500 kcal Defizit am Tag
     erlauben (Murphy & Koehler 2022); bei mehr Gewicht wird das Band darum enger.
   - Vorschlag nur, wenn die Zielgrenze außerhalb von ±1,5 Standardfehlern des Trends liegt, mit mindestens
     10 Wiegungen. Sonst folgte der Vorschlag dem Wiegerauschen (fast jede Woche, oft in wechselnder Richtung).
   - Nach einer angenommenen Anpassung vier Wochen Ruhe, bis der Trend nur noch Wiegungen danach enthält.
   - Eine gemeinsame Wochen-id für Kalorienvorschlag und Stagnation: nach „Ablehnen“ kommt in derselben Woche nichts mehr. */
import { fmt, fmt0, fmt1, ymd } from '../util.js';
import { weightTrend, dayNumber } from '../domain/body.js';
import { GOALS, MAX_DEFICIT } from '../domain/energy.js';

const KCAL_PER_KG = 7700;
/* Breite des Bereichs um die Trendsteigung, in Standardfehlern */
export const Z = 1.5;
export const MIN_POINTS = 10;
/* Tage ohne neuen Vorschlag nach einer angenommenen Anpassung, so lang wie das Fenster des Trends */
export const LOCK_DAYS = 28;

/* Zielrate in Prozent des Körpergewichts pro Woche für Ziel und Gewicht: { min, max, text } */
export function targetRate(goalKey, kg) {
  if (goalKey === 'lose') {
    /* So viel Prozent pro Woche entsprechen 500 kcal Defizit am Tag */
    const cap = kg > 0 ? MAX_DEFICIT * 7 / KCAL_PER_KG / kg * 100 : 1;
    const fast = Math.min(1, cap);
    const slow = Math.min(0.5, fast / 2);
    const k = v => fmt(Math.round(v / 100 * kg * 100) / 100);
    return { min: -fast, max: -slow, text: `sind ${k(slow)}–${k(fast)} kg Abnahme pro Woche sinnvoll, höchstens ${fmt0(MAX_DEFICIT)} kcal Defizit am Tag` };
  }
  if (goalKey === 'gain') return { min: 0.25, max: 0.5, text: 'sind 0,25–0,5 % Zunahme pro Woche sinnvoll' };
  return { min: -0.25, max: 0.25, text: 'soll das Gewicht ungefähr gleich bleiben' };
}
/* Unter dieser Veränderung pro Woche gilt das Gewicht als stehend: Abnehmen 0,1 %, Aufbau die halbe Untergrenze */
export const STALL = { lose: 0.1, gain: 0.125 };

/* ISO-Kalenderwoche als 'JJJJ-WW', damit jeder Vorschlag nur einmal pro Woche kommt */
export function isoWeek(t) {
  const d = new Date(t);
  const day = (d.getDay() + 6) % 7;
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + 3);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const week = 1 + Math.round(((thursday - firstThursday) / 864e5 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${thursday.getFullYear()}-${String(week).padStart(2, '0')}`;
}

/* Veränderung von Taille oder Bauch in den letzten 3–5 Wochen, in cm (negativ = kleiner) */
export function waistChange(measurements, today) {
  const t = dayNumber(today);
  const recent = (measurements || []).filter(m => { const n = dayNumber(m.date); return n <= t && n > t - 35; })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const key of ['belly', 'waist']) {
    const pts = recent.filter(m => m[key] > 0);
    if (pts.length < 2) continue;
    const first = pts[0], last = pts[pts.length - 1];
    const span = dayNumber(last.date) - dayNumber(first.date);
    if (span >= 18) return { key, label: key === 'belly' ? 'Bauch' : 'Taille', delta: last[key] - first[key], spanDays: span };
  }
  return null;
}

/* 100, 150 oder 200 kcal je nach Abstand zur Zielrate (7700 kcal pro kg); beim Aufbau ab 50 kcal */
export function stepFor(gapPctPerWeek, kg, goalKey = 'lose') {
  const kcalPerDay = Math.abs(gapPctPerWeek) / 100 * kg * KCAL_PER_KG / 7;
  const min = goalKey === 'gain' ? 50 : 100;
  return Math.max(min, Math.min(200, Math.round(kcalPerDay / 50) * 50));
}

/* Angenommene Anpassung in den letzten LOCK_DAYS Tagen? Dann ist der Trend noch nicht aussagekräftig. */
export function locked(S, now) {
  return Object.entries(S.suggestions || {}).some(([id, d]) =>
    /^nut(-kcal|-stall)?:/.test(id) && d && d.status === 'accepted' && now - d.date < LOCK_DAYS * 864e5);
}

const pct = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(Math.round(v * 100) / 100))} %`;
const kgw = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(Math.round(v * 100) / 100))} kg`;

/* Wie weicht das Tempo ab, in Alltagssprache */
function paceText(goalKey, rate, target) {
  const dir = rate < 0 ? 'ab' : 'zu';
  if (goalKey === 'lose') return rate > 0 ? 'du nimmst aber zu' : rate > target.max ? 'du nimmst langsamer ab' : 'du nimmst schneller ab';
  if (goalKey === 'gain') return rate < 0 ? 'du nimmst aber ab' : rate > target.max ? 'du nimmst schneller zu' : 'du nimmst langsamer zu';
  return `du nimmst ${dir}`;
}

function changeKcal(delta) {
  return S => {
    const n = S.nutrition;
    if (n.overrides && n.overrides.kcal > 0) n.overrides = { ...n.overrides, kcal: n.overrides.kcal + delta };
    else n.kcalAdjust = (n.kcalAdjust || 0) + delta;
  };
}

/* Steigung und Standardfehler in Prozent des Körpergewichts pro Woche */
const ratesOf = tr => ({ rate: tr.perWeek / tr.current * 100, se: tr.slopeSE * 7 / tr.current * 100 });

export function suggestions(S, now = Date.now()) {
  const goalKey = GOALS[S.profile.goal] ? S.profile.goal : 'recomp';
  const goal = GOALS[goalKey];
  const today = ymd(now);
  const week = isoWeek(now);
  const tr = weightTrend(S.body.weights, today);
  if (!tr.ok || tr.n < MIN_POINTS) return [];
  if (locked(S, now)) return [];
  const kg = tr.current;
  const { rate, se } = ratesOf(tr);
  const target = targetRate(goalKey, kg);
  const trendText = `Dein Gewicht ändert sich im Trend der letzten ${tr.spanDays} Tage um ${kgw(tr.perWeek)} pro Woche (${pct(rate)})`;

  /* Welche Richtung wäre nötig? Nur, wenn der Trend auch mit seiner Unsicherheit außerhalb des Zielbands liegt. */
  let delta = 0;
  if (rate - Z * se > target.max) delta = -stepFor(rate - target.max, kg, goalKey);
  else if (rate + Z * se < target.min) delta = stepFor(target.min - rate, kg, goalKey);

  /* Stagnation: drei Wochen fast keine Veränderung, obwohl das Ziel eine verlangt, und sicher langsamer als das Band */
  let stalled = null;
  if (goalKey === 'lose' || goalKey === 'gain') {
    const tr3 = weightTrend(S.body.weights, today, 21);
    if (tr3.ok && tr3.spanDays >= 18 && tr3.n >= MIN_POINTS * 3 / 4) {
      const r3 = ratesOf(tr3);
      const slower = goalKey === 'lose' ? r3.rate - Z * r3.se > target.max : r3.rate + Z * r3.se < target.min;
      if (Math.abs(r3.rate) < STALL[goalKey] && slower) stalled = tr3;
    }
  }

  /* Rekomposition: Taille oder Bauch sinken bei etwa gleichem Gewicht, dann keine Kürzung */
  const waist = waistChange(S.body.measurements, today);
  const steady = Math.abs(rate) < 0.25;
  if (delta < 0 || (stalled && goalKey === 'lose')) {
    if (waist && waist.delta <= -1 && steady) {
      return [{
        id: `nut-recomp:${week}`, area: 'nutrition',
        title: 'Sieht nach Rekomposition aus',
        reason: `Dein Gewicht bleibt bei ${pct(rate)} pro Woche fast gleich, aber dein ${waist.label} ist in ${waist.spanDays} Tagen um ${fmt1(Math.abs(waist.delta))} cm geschrumpft, darum schlägt die App keine Kürzung vor.`,
        acceptLabel: 'Verstanden',
      }];
    }
  }

  if (stalled) {
    const r3 = stalled.perWeek / stalled.current * 100;
    const step = goalKey === 'lose' ? -stepFor(target.max - r3, kg, goalKey) : stepFor(target.min - r3, kg, goalKey);
    return [{
      id: `nut:${week}`, area: 'nutrition',
      title: 'Dein Gewicht steht seit drei Wochen',
      reason: `In den letzten ${stalled.spanDays} Tagen hat sich dein Gewicht nur um ${pct(r3)} pro Woche verändert, obwohl für „${goal.label}“ ${target.text.replace(/^sind /, '')} wären.`,
      acceptLabel: `Ziel um ${fmt0(Math.abs(step))} kcal ${step < 0 ? 'senken' : 'erhöhen'}`,
      apply: changeKcal(step),
    }];
  }

  if (!delta) return [];
  const up = delta > 0;
  return [{
    id: `nut:${week}`, area: 'nutrition',
    title: `Kalorienziel um ${fmt0(Math.abs(delta))} kcal ${up ? 'erhöhen' : 'senken'}`,
    reason: `${trendText}, für „${goal.label}“ ${target.text}, ${paceText(goalKey, rate, target)}.`,
    acceptLabel: `Um ${fmt0(Math.abs(delta))} kcal ${up ? 'erhöhen' : 'senken'}`,
    apply: changeKcal(delta),
  }];
}
