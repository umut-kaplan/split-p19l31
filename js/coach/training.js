/* Trainingsregeln (Stufe 2): Deload, Volumenlücken, Einschränkungen. Format siehe coach/index.js.
   Reine Regeln ohne Zufall: gleiche Daten ergeben gleiche Vorschläge. Nichts passiert, bevor der Nutzer annimmt. */
import { fmt, fmt1, exName } from '../util.js';
import { findExercise, allExercises, limitationHits, safeAlternatives, defaultsFor, exerciseIdFor } from '../domain/library.js';
import { weekStart } from '../domain/streaks.js';
import { weekMuscleSets, prevWeekStart, isoWeekKey } from '../domain/volume.js';
import { MUSCLES, WEEKLY_SET_TARGET } from '../domain/muscles.js';

/* Reihenfolge, in der Volumenlücken vorgeschlagen werden: große Muskelgruppen zuerst */
const PRIORITY = ['back', 'chest', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps', 'calves', 'abs', 'adductors', 'abductors', 'forearms'];
/* Mitbeanspruchte Muskeln zählen nur bei diesen Gruppen als „trainiert der Plan“ */
const MAJOR = ['back', 'chest', 'quads', 'hamstrings', 'glutes', 'shoulders'];
const MAX_SETS = 6;

const planOf = S => S.plans.find(p => p.id === S.activePlanId) || S.plans[0];

/* Jede Übung im Plan mit jedem ihrer Varianten-Namen */
function planEntries(plan) {
  const out = [];
  plan.order.forEach(dayId => {
    const day = plan.days[dayId];
    if (!day) return;
    day.exercises.forEach(e => e.names.forEach(name => out.push({ dayId, day, e, name })));
  });
  return out;
}

const findPlanExercise = (S, dayId, id) => {
  const d = planOf(S).days[dayId];
  return d ? d.exercises.find(x => x.id === id) : null;
};

/* ---------- a) Deload ---------- */
/* Verfehlt: nicht alle geplanten Sätze mit mindestens der unteren Wiederholungszahl */
export const missedTarget = (sets, e) => sets.length < e.sets || sets.some(s => !(s.r >= e.repMin));

export function deloadWeight(w, inc) {
  const step = inc > 0 ? inc : 0.5;
  return Math.max(step, Math.round(w * 0.9 / step) * step);
}

function deloads(S, now) {
  const out = [];
  const seen = new Set();
  planEntries(planOf(S)).forEach(({ e, name }) => {
    const key = e.id + '|' + name;
    if (seen.has(key) || e.unit === 'sec') return;
    seen.add(key);
    if (S.trainingOverrides && S.trainingOverrides[key]) return;
    const hist = S.sessions
      .map(s => ({ s, x: s.ex.find(x => x.exId === e.id && x.name === name && x.sets && x.sets.length) }))
      .filter(h => h.x);
    if (hist.length < 2) return;
    const [a, b] = hist.slice(-2);
    /* Gemessen am Ziel, das beim Training galt. Ältere Einheiten ohne gespeichertes Ziel nehmen den Plan von heute. */
    if (!missedTarget(a.x.sets, a.x.target || e) || !missedTarget(b.x.sets, b.x.target || e)) return;
    const w = Math.max(...b.x.sets.map(s => s.w || 0));
    if (!(w > 0)) return;
    const nw = deloadWeight(w, e.inc);
    if (!(nw < w)) return;
    out.push({
      id: `deload:${key}:${isoWeekKey(b.s.startedAt)}`,
      area: 'training',
      title: `Deload für ${name}`,
      reason: `Bei ${name} hast du zweimal hintereinander nicht alle ${e.sets} Sätze mit mindestens ${e.repMin} Wdh. geschafft, darum schlägt die App für die nächste Einheit ${fmt(nw)} statt ${fmt(w)} kg vor, also etwa 10 % weniger.`,
      acceptLabel: `Auf ${fmt(nw)} kg senken`,
      apply: S2 => {
        S2.trainingOverrides = S2.trainingOverrides || {};
        S2.trainingOverrides[key] = { weight: nw, createdAt: now };
      },
    });
  });
  return out;
}

/* ---------- b) Volumenlücke ---------- */
function volumeGaps(S, now) {
  const [lo, hi] = WEEKLY_SET_TARGET;
  const resolve = n => findExercise(n, S.exercisesCustom);
  /* Die letzten drei abgeschlossenen Wochen, jüngste zuerst. Jede muss Training enthalten. */
  const weeks = [];
  let k = weekStart(now);
  for (let i = 0; i < 3; i++) { k = prevWeekStart(k); weeks.push(k); }
  if (!weeks.every(w => S.sessions.some(s => weekStart(s.startedAt) === w))) return [];
  const counts = weeks.map(w => weekMuscleSets(S.sessions, w, resolve).sets);

  const plan = planOf(S);
  const entries = planEntries(plan).map(p => ({ ...p, lib: resolve(p.name) })).filter(p => p.lib && p.lib.muscles);
  const primary = new Set(entries.flatMap(p => p.lib.muscles.primary || []));
  const secondary = new Set(entries.flatMap(p => p.lib.muscles.secondary || []));
  const muscles = PRIORITY.filter(m => primary.has(m) || (MAJOR.includes(m) && secondary.has(m)));
  const week = isoWeekKey(now);

  for (const m of muscles) {
    const vals = counts.map(c => c[m] || 0);
    if (!vals.every(v => v < lo)) continue;
    const id = `volume:${m}:${week}`;
    if (S.suggestions[id]) continue; // entschieden: die nächste Lücke darf nachrücken
    const said = [...vals].reverse().map(v => fmt1(v)).join(', ');
    const lead = `${MUSCLES[m]} kam in den letzten drei Wochen auf ${said} Sätze, der Zielbereich liegt bei ${lo} bis ${hi}`;

    /* Passendste Übung: trainiert den Muskel primär und hat die wenigsten Sätze */
    const cands = entries.filter(p => (p.lib.muscles.primary || []).includes(m) && p.e.sets < MAX_SETS)
      .sort((a, b) => a.e.sets - b.e.sets);
    if (cands.length) {
      const best = cands[0];
      return [{
        id, area: 'training',
        title: `Mehr Volumen für ${MUSCLES[m]}`,
        reason: `${lead}, darum schlägt die App bei ${exName(best.e)} einen Satz mehr vor (${best.e.sets + 1} statt ${best.e.sets}).`,
        acceptLabel: 'Satz hinzufügen',
        apply: S2 => { const pe = findPlanExercise(S2, best.dayId, best.e.id); if (pe) pe.sets = Math.min(MAX_SETS, pe.sets + 1); },
      }];
    }

    /* Sonst eine Übung aus der Bibliothek im Tag, der den Muskel am meisten trainiert */
    const tags = (S.profile.limitations && S.profile.limitations.tags) || [];
    const equipment = S.profile.equipment || [];
    const inPlan = new Set(entries.map(p => p.lib.id));
    const pick = allExercises(S.exercisesCustom).find(x =>
      (x.muscles && x.muscles.primary || []).includes(m)
      && !inPlan.has(x.id)
      && x.unit !== 'sec'
      && limitationHits(x, tags).length === 0
      && (!equipment.length || (x.equipment || []).every(q => equipment.includes(q))));
    if (!pick) continue;
    const score = dayId => entries.filter(p => p.dayId === dayId
      && [...(p.lib.muscles.primary || []), ...(p.lib.muscles.secondary || [])].includes(m)).length;
    const dayId = [...plan.order].sort((a, b) => score(b) - score(a))[0];
    const day = plan.days[dayId];
    return [{
      id, area: 'training',
      title: `Mehr Volumen für ${MUSCLES[m]}`,
      reason: `${lead}, darum schlägt die App ${pick.name} mit 3 Sätzen am Tag ${day.name} vor.`,
      acceptLabel: 'Übung hinzufügen',
      apply: S2 => {
        const d = planOf(S2).days[dayId];
        if (!d) return;
        const def = defaultsFor(pick);
        d.exercises.push({ id: exerciseIdFor(pick.name, S2.plans, S2.exercisesCustom), names: [pick.name], ...def, sets: 3 });
      },
    }];
  }
  return [];
}

/* ---------- c) Einschränkungen ---------- */
function limitations(S) {
  const tags = (S.profile.limitations && S.profile.limitations.tags) || [];
  if (!tags.length) return [];
  const out = [];
  const seen = new Set();
  planEntries(planOf(S)).forEach(({ day, e, name }) => {
    if (seen.has(name)) return;
    const lib = findExercise(name, S.exercisesCustom);
    const hit = limitationHits(lib, tags);
    if (!hit.length) return;
    seen.add(name);
    const sameDay = new Set(day.exercises.flatMap(x => x.names));
    const alt = safeAlternatives(lib, S.exercisesCustom, tags).find(a => !sameDay.has(a.name));
    if (!alt) return;
    out.push({
      id: `limit:${e.id}|${name}:${[...hit].sort().join('+')}`,
      area: 'training',
      title: `${name} tauschen?`,
      reason: `${name} belastet ${hit.length > 1 ? 'deine eingetragenen Bereiche' : 'deinen eingetragenen Bereich'} ${hit.join(' und ')}, ${alt.name} trainiert ähnliche Muskeln und schont ${hit.length > 1 ? 'sie' : 'ihn'}.`,
      acceptLabel: `Gegen ${alt.name} tauschen`,
      apply: S2 => {
        const p = planOf(S2);
        p.order.forEach(dId => (p.days[dId] ? p.days[dId].exercises : []).forEach(x => {
          x.names = x.names.map(n => (n === name ? alt.name : n));
        }));
      },
    });
  });
  return out;
}

export function suggestions(S, now = Date.now()) {
  const all = [...limitations(S), ...deloads(S, now), ...volumeGaps(S, now)];
  const ids = new Set();
  return all.filter(s => !ids.has(s.id) && ids.add(s.id));
}
