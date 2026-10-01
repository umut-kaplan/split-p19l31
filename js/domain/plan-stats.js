/* Kennzahlen eines Plan-Tages: geschätzte Dauer, Kurzversion und Sätze pro Muskel. Reine Funktionen.
   Ein Plan-Eintrag ist { id, names, sets, repMin, repMax, rest, inc, unit, ss? } wie in js/plans.js. */
import { SECONDARY_WEIGHT } from './muscles.js';

/* Dauer: je Satz 45 Sekunden Arbeit plus die Pause der Übung, dazu 10 Minuten für Aufwärmen und Wege.
   Im Supersatz (ss: true, siehe domain/superset.js) folgt auf einen Satz statt der Pause nur der Wechsel
   zur nächsten Übung der Gruppe; die Pause kommt nach der letzten Übung der Runde. */
export const SET_SECONDS = 45;
export const SWITCH_SECONDS = 15;
export const OVERHEAD_MINUTES = 10;

/* Sekunden aller Sätze ohne den festen Aufschlag */
export function workSeconds(exercises = []) {
  return exercises.reduce((a, e, i) => {
    const linked = e.ss === true && i < exercises.length - 1;
    return a + (e.sets || 0) * (SET_SECONDS + (linked ? SWITCH_SECONDS : (e.rest || 0)));
  }, 0);
}

/* Geschätzte Minuten, auf ganze Minuten gerundet */
export const dayMinutes = (exercises = []) => Math.round(workSeconds(exercises) / 60 + OVERHEAD_MINUTES);

/* Kurzversion (4.7): die ersten vier Übungen mit je höchstens zwei Sätzen. Die Vorlagen stehen nach Wichtigkeit,
   so bleiben die Grundübungen. Eine Supersatz-Verbindung zur abgeschnittenen Übung fällt weg. Verändert nichts. */
export const SHORT = { exercises: 4, sets: 2 };
export function shortExercises(exercises = []) {
  const list = exercises.slice(0, SHORT.exercises).map(e => ({ ...e, sets: Math.min(e.sets || 0, SHORT.sets) }));
  const last = list[list.length - 1];
  if (last && 'ss' in last) delete last.ss;
  return list;
}
/* Die tatsächliche Kurzversion in Worten: „4 Übungen mit je 2 Sätzen“, „3 Übungen mit bis zu 2 Sätzen“,
   „1 Übung mit 2 Sätzen“; first: „die ersten 4 Übungen mit je 2 Sätzen“, „die erste Übung mit 2 Sätzen“ */
export function shortText(exercises = [], { first = false } = {}) {
  const list = shortExercises(exercises);
  const n = list.length;
  const max = Math.max(0, ...list.map(e => e.sets || 0));
  const same = list.every(e => (e.sets || 0) === max);
  const sets = `${same ? (n === 1 ? '' : 'je ') : 'bis zu '}${max} ${max === 1 ? 'Satz' : 'Sätzen'}`;
  const ex = first ? (n === 1 ? 'die erste Übung' : `die ersten ${n} Übungen`) : `${n} ${n === 1 ? 'Übung' : 'Übungen'}`;
  return `${ex} mit ${sets}`;
}

/* Lohnt die Kurzversion? Nur, wenn sie wirklich kürzer ist als die ganze Einheit. */
export const hasShortVersion = (exercises = []) => exercises.length > 0 && dayMinutes(shortExercises(exercises)) < dayMinutes(exercises);

/* Sätze pro Muskel an einem Tag: primär voll, mitbeansprucht halb (wie domain/volume.js).
   resolve(name) liefert den Bibliotheks-Eintrag; gezählt wird die erste Variante eines Eintrags. */
export function dayMuscleSets(exercises = [], resolve) {
  const sets = {};
  exercises.forEach(e => {
    const lib = resolve(e.names ? e.names[0] : e.name);
    if (!lib || !lib.muscles) return;
    const p = lib.muscles.primary || [];
    p.forEach(m => { sets[m] = (sets[m] || 0) + (e.sets || 0); });
    (lib.muscles.secondary || []).forEach(m => {
      if (!p.includes(m)) sets[m] = (sets[m] || 0) + (e.sets || 0) * SECONDARY_WEIGHT;
    });
  });
  return sets;
}

/* Sätze pro Muskel und Woche, wenn der Plan perWeek Einheiten pro Woche in seiner Reihenfolge läuft.
   Liefert { week: { muscle: Sätze }, maxPerDay: { muscle: höchster Wert an einem Tag } } */
export function weekMuscleSetsOfPlan(plan, perWeek, resolve) {
  const ids = plan.order.filter(id => plan.days[id] && (plan.days[id].exercises || []).length);
  const week = {};
  const maxPerDay = {};
  if (!ids.length) return { week, maxPerDay };
  const f = perWeek / ids.length;
  ids.forEach(id => {
    const v = dayMuscleSets(plan.days[id].exercises, resolve);
    Object.entries(v).forEach(([m, n]) => {
      week[m] = (week[m] || 0) + n * f;
      maxPerDay[m] = Math.max(maxPerDay[m] || 0, n);
    });
  });
  return { week, maxPerDay };
}
