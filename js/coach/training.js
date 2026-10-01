/* Trainingsregeln (Stufe 2): Deload, Volumenlücken, Einschränkungen. Format siehe coach/index.js.
   Reine Regeln ohne Zufall: gleiche Daten ergeben gleiche Vorschläge. Nichts passiert, bevor der Nutzer annimmt.
   4.7 (Q32, Recherche „Forschung“ 9.1/9.2): Vor einem Deload prüft die App, ob wenig Schlaf (Check-in oder
   eingetragener Schlaf) oder Schichten (nach einer Nachtschicht, kurze Ruhe zwischen zwei Schichten) die schwache
   Einheit erklären; dann schlägt sie vor, das Gewicht zu halten (Craven 2022, Knowles 2018). Wochen mit drei oder mehr
   Nachtschichten zählen nicht als Volumenlücke, dort reicht es, den Stand zu halten (Spiering 2021). */
import { fmt, fmt1, exName, ymd, dShort } from '../util.js';
import { findExercise, allExercises, limitationHits, safeAlternatives, defaultsFor, exerciseIdFor } from '../domain/library.js';
import { weekStart } from '../domain/streaks.js';
import { weekMuscleSets, prevWeekStart, isoWeekKey } from '../domain/volume.js';
import { MUSCLES, weeklyTarget } from '../domain/muscles.js';
import { doable, hasSmartCircuit } from '../domain/equipment.js';
import { topSets } from '../domain/settypes.js';
import { THRESHOLDS } from '../domain/recovery.js';
import { hasShiftPlan, dayShift, addDays } from '../domain/shifts.js';
import { shortRest } from '../domain/shift-plan.js';

/* Reihenfolge, in der Volumenlücken vorgeschlagen werden: große Muskelgruppen zuerst */
const PRIORITY = ['back', 'chest', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps', 'calves', 'abs', 'adductors', 'abductors', 'forearms'];
/* Nacken/Trapez und unterer Rücken fehlen mit Absicht: Sie kommen über Grundübungen mit, dafür schlägt die App nichts extra vor. */
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

/* ---------- Schlaf und Schichten ---------- */
/* Ab so vielen Nachtschichten in einer Woche (Mo–So) reicht Halten */
export const NIGHT_WEEK = 3;

/* Schlaf der Nacht vor dem Tag: Check-in, sonst der größte eingetragene Wert; null ohne Angabe */
function sleepOn(S, date) {
  const ci = S.checkins && S.checkins[date];
  if (ci && ci.sleepH > 0) return ci.sleepH;
  const vals = ((S.activity && S.activity.sleep) || []).filter(x => x && x.date === date && x.hours > 0).map(x => x.hours);
  return vals.length ? Math.max(...vals) : null;
}

/* Erklären Schlaf oder Schicht eine schwächere Einheit? Liefert { kind: 'sleep' | 'night' | 'shortRest', text } oder null.
   Schlaf: unter der gelben Schwelle der Ampel (6 Stunden). Nacht: am Vortag Nachtschicht oder 24-h-Dienst (also auch
   zwischen zwei Nächten). Kurze Ruhe: weniger als 11 Stunden zwischen der Schicht des Tages und der davor oder danach. */
export function strainOf(S, startedAt) {
  const date = ymd(startedAt);
  const when = dShort(startedAt);
  const h = sleepOn(S, date);
  if (h != null && h < THRESHOLDS.sleep.yellow) return { kind: 'sleep', text: `vor der Einheit am ${when} hast du nur ${fmt1(h)} Stunden geschlafen` };
  if (!hasShiftPlan(S.shifts)) return null;
  const cur = dayShift(S.shifts, date);
  const prev = dayShift(S.shifts, addDays(date, -1));
  const next = dayShift(S.shifts, addDays(date, 1));
  if (prev.cat === 'night' || prev.cat === 'h24') return { kind: 'night', text: `die Einheit am ${when} lag nach einer ${prev.cat === 'h24' ? '24-h-Schicht' : 'Nachtschicht'}` };
  if (shortRest(cur, prev, next)) return { kind: 'shortRest', text: `um die Einheit am ${when} lagen weniger als 11 Stunden zwischen zwei Schichten` };
  return null;
}

/* Nachtschichten in der Woche ab mondayMs (Mo–So) laut Schichtplan, 0 ohne Schichtplan */
export function nightsInWeek(S, mondayMs) {
  if (!hasShiftPlan(S.shifts)) return 0;
  const mon = ymd(mondayMs);
  let n = 0;
  for (let i = 0; i < 7; i++) if (dayShift(S.shifts, addDays(mon, i)).cat === 'night') n++;
  return n;
}
const nightWeek = (S, mondayMs) => nightsInWeek(S, mondayMs) >= NIGHT_WEEK;

/* ---------- a) Deload ---------- */
/* Verfehlt: nicht alle geplanten Sätze mit mindestens der unteren Wiederholungszahl.
   Aufwärm- und Dropsätze zählen dabei nicht, sie sind keine geplanten Arbeitssätze. */
export const missedTarget = (sets, e) => {
  const top = topSets(sets);
  return top.length < e.sets || top.some(s => !(s.r >= e.repMin));
};

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
    /* Am Smart-Zirkel stellt das Gerät das Gewicht ein, ein Deload in kg ergibt dort keinen Sinn. Mit Gegengewicht
       (Klimmzüge oder Dips mit Unterstützung) hieße weniger kg schwerer, auch dort gibt es keinen Deload. */
    const lib = findExercise(name, S.exercisesCustom);
    if (lib && (lib.autoLoad || lib.assisted)) return;
    seen.add(key);
    if (S.trainingOverrides && S.trainingOverrides[key]) return;
    const hist = S.sessions
      .map(s => ({ s, x: s.ex.find(x => x.exId === e.id && x.name === name && topSets(x.sets).length) }))
      .filter(h => h.x);
    if (hist.length < 2) return;
    const [a, b] = hist.slice(-2);
    /* Gemessen am Ziel, das beim Training galt. Ältere Einheiten ohne gespeichertes Ziel nehmen den Plan von heute. */
    if (!missedTarget(a.x.sets, a.x.target || e) || !missedTarget(b.x.sets, b.x.target || e)) return;
    const w = Math.max(...topSets(b.x.sets).map(s => s.w || 0));
    if (!(w > 0)) return;
    const nw = deloadWeight(w, e.inc);
    if (!(nw < w)) return;
    const missed = `Bei ${name} hast du zweimal hintereinander nicht ${e.sets === 1 ? 'den Satz' : `alle ${e.sets} Sätze`} mit mindestens ${e.repMin} Wdh. geschafft`;
    /* Erklären Schlaf oder Schicht eine der beiden Einheiten, ist das kein Zeichen von Ermüdung durchs Training */
    const strain = strainOf(S, b.s.startedAt) || strainOf(S, a.s.startedAt);
    if (strain) {
      out.push({
        id: `deload-hold:${key}:${isoWeekKey(b.s.startedAt)}`,
        area: 'training',
        title: `${name}: Gewicht halten`,
        reason: `${missed}, aber ${strain.text}; das kann eine schwächere Einheit erklären, darum schlägt die App keinen Deload vor und du bleibst bei ${fmt(w)} kg.`,
        acceptLabel: 'Verstanden',
      });
      return;
    }
    out.push({
      id: `deload:${key}:${isoWeekKey(b.s.startedAt)}`,
      area: 'training',
      title: `Deload für ${name}`,
      reason: `${missed}, darum schlägt die App für die nächste Einheit ${fmt(nw)} statt ${fmt(w)} kg vor, also etwa 10 % weniger.`,
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
/* Zielbereich je Muskel aus domain/muscles.js (weeklyTarget): meist 10 bis 20, Waden und Bauch 4 bis 10 */
function volumeGaps(S, now) {
  const resolve = n => findExercise(n, S.exercisesCustom);
  /* In einer Woche mit vielen Nachtschichten reicht Halten: dann kein Vorschlag für mehr */
  if (nightWeek(S, weekStart(now))) return [];
  /* Die letzten drei abgeschlossenen Wochen, jüngste zuerst. Wochen mit vielen Nachtschichten zählen nicht;
     mindestens zwei bleiben, und jede gezählte muss Training enthalten. */
  const all = [];
  let k = weekStart(now);
  for (let i = 0; i < 3; i++) { k = prevWeekStart(k); all.push(k); }
  const weeks = all.filter(w => !nightWeek(S, w));
  if (weeks.length < 2) return [];
  if (!weeks.every(w => S.sessions.some(s => weekStart(s.startedAt) === w))) return [];
  const skipped = all.length - weeks.length;
  const counts = weeks.map(w => weekMuscleSets(S.sessions, w, resolve).sets);

  const plan = planOf(S);
  /* Frisch übernommener Plan (createdAt, domain/plan-update.js): erst nach einer vollen Woche mit ihm, sonst
     beruhte der Vorschlag nur auf dem alten Plan */
  if (plan.createdAt && prevWeekStart(weekStart(now)) < plan.createdAt) return [];
  const entries = planEntries(plan).map(p => ({ ...p, lib: resolve(p.name) })).filter(p => p.lib && p.lib.muscles);
  const primary = new Set(entries.flatMap(p => p.lib.muscles.primary || []));
  const secondary = new Set(entries.flatMap(p => p.lib.muscles.secondary || []));
  const muscles = PRIORITY.filter(m => primary.has(m) || (MAJOR.includes(m) && secondary.has(m)));
  const week = isoWeekKey(now);

  for (const m of muscles) {
    const [lo, hi] = weeklyTarget(m);
    const vals = counts.map(c => c[m] || 0);
    if (!vals.every(v => v < lo)) continue;
    const id = `volume:${m}:${week}`;
    if (S.suggestions[id]) continue; // entschieden: die nächste Lücke darf nachrücken
    const said = [...vals].reverse().map(v => fmt1(v)).join(', ');
    const span = skipped
      ? `in den letzten drei Wochen ohne die ${skipped === 1 ? 'Woche' : 'Wochen'} mit vielen Nachtschichten (dort reicht Halten)`
      : 'in den letzten drei Wochen';
    const lead = `${MUSCLES[m]} kam ${span} auf ${said} Sätze, der Zielbereich liegt bei ${lo} bis ${hi}`;

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
    /* Nur Übungen, die die Geräte im Profil erlauben (leer = alle); Smart-Zirkel nur, wenn er angehakt ist */
    const equipment = S.profile.equipment || [];
    const ok = doable(equipment);
    const smart = hasSmartCircuit(equipment);
    const inPlan = new Set(entries.map(p => p.lib.id));
    const pick = allExercises(S.exercisesCustom).find(x =>
      (x.muscles && x.muscles.primary || []).includes(m)
      && !inPlan.has(x.id)
      && x.unit !== 'sec'
      && limitationHits(x, tags).length === 0
      && (!x.autoLoad || smart)
      && ok(x));
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
        const def = defaultsFor(pick, S2.settings);
        d.exercises.push({ id: exerciseIdFor(pick.name, S2.plans, S2.exercisesCustom), names: [pick.name], ...def, sets: 3 });
      },
    }];
  }
  return [];
}

/* ---------- c) Einschränkungen ----------
   Ein Vorschlag pro Plan-Eintrag (#65): Belasten mehrere Varianten eines Eintrags (z. B. „Kniebeugen / Hackenschmidt“)
   den eingetragenen Bereich, ersetzt das Annehmen alle zusammen durch eine schonende Alternative. Steht schon eine
   schonende Variante im Eintrag und gibt es keine weitere Alternative, schlägt die App vor, die belastenden zu streichen. */
function limitations(S) {
  const tags = (S.profile.limitations && S.profile.limitations.tags) || [];
  if (!tags.length) return [];
  /* Alternativen nur mit den Geräten aus dem Profil; Smart-Zirkel nur, wenn er angehakt ist */
  const equipment = S.profile.equipment || [];
  const smart = hasSmartCircuit(equipment);
  const out = [];
  const seen = new Set();
  const plan = planOf(S);
  plan.order.forEach(dayId => {
    const day = plan.days[dayId];
    if (!day) return;
    day.exercises.forEach(e => {
      const hits = e.names.map(name => {
        const lib = findExercise(name, S.exercisesCustom);
        return { name, lib, areas: limitationHits(lib, tags) };
      }).filter(h => h.areas.length);
      if (!hits.length) return;
      const names = hits.map(h => h.name);
      const key = `${e.id}|${names.join('+')}`;
      if (seen.has(key)) return;
      seen.add(key);
      const areas = [...new Set(hits.flatMap(h => h.areas))];
      const sameDay = new Set(day.exercises.flatMap(x => x.names));
      const alt = hits.map(h => safeAlternatives(h.lib, S.exercisesCustom, tags, equipment)
        .find(a => !sameDay.has(a.name) && (!a.autoLoad || smart))).find(Boolean) || null;
      const keep = e.names.filter(n => !names.includes(n));
      if (!alt && !keep.length) return;
      const who = names.join(' und ');
      const what = `${who} ${names.length > 1 ? 'belasten' : 'belastet'} ${areas.length > 1 ? 'deine eingetragenen Bereiche' : 'deinen eingetragenen Bereich'} ${areas.join(' und ')}`;
      const them = areas.length > 1 ? 'sie' : 'ihn';
      out.push({
        id: `limit:${key}:${[...areas].sort().join('+')}`,
        area: 'training',
        title: alt ? `${who} tauschen?` : `${who} streichen?`,
        reason: alt
          ? `${what}, ${alt.name} trainiert ähnliche Muskeln und schont ${them}.`
          : `${what}. ${keep.join(' und ')} ${keep.length > 1 ? 'stehen' : 'steht'} schon als Variante in dieser Übung und ${keep.length > 1 ? 'schonen' : 'schont'} ${them}.`,
        acceptLabel: alt ? `Gegen ${alt.name} tauschen` : `${who} streichen`,
        /* Im ganzen Plan: belastende Varianten raus, an die Stelle der ersten die Alternative (nie doppelt) */
        apply: S2 => {
          const p = planOf(S2);
          p.order.forEach(dId => (p.days[dId] ? p.days[dId].exercises : []).forEach(x => {
            if (!x.names.some(n => names.includes(n))) return;
            const next = [];
            x.names.forEach(n => {
              const v = !names.includes(n) ? n : alt && !x.names.includes(alt.name) ? alt.name : null;
              if (v && !next.includes(v)) next.push(v);
            });
            if (next.length) x.names = next;
          }));
        },
      });
    });
  });
  return out;
}

export function suggestions(S, now = Date.now()) {
  const all = [...limitations(S), ...deloads(S, now), ...volumeGaps(S, now)];
  const ids = new Set();
  return all.filter(s => !ids.has(s.id) && ids.add(s.id));
}
