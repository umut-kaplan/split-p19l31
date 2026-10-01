/* Ablauf der laufenden Einheit (4.6): Startziel nach einem Neustart, Fortschritt pro Übung, nächste offene Übung,
   Zusammenfassung erledigter Übungen. Reine Funktionen.
   ex: Übungen der Einheit wie in S.active.ex, je { name, unit, log: [{ w, r, done, t }] }. Aufwärmsätze zählen nie mit. */
import { fmt, toNum } from '../util.js';
import { workSets, typePrefix, methodSuffix } from './settypes.js';
import { groupsOf } from './superset.js';

/* Wohin die App beim Start springt: Läuft ein Training, direkt in die Einheit, sonst auf „Heute“ */
export function startView(state) {
  const a = state && state.active;
  return a && Array.isArray(a.ex) ? { tab: 'training', trainSub: 'start' } : { tab: 'today' };
}

/* Arbeitssätze einer Übung: abgehakt, gesamt, fertig */
export function progressOf(x) {
  const work = workSets((x && x.log) || []);
  const done = work.filter(s => s.done).length;
  return { done, total: work.length, complete: work.length > 0 && done >= work.length };
}

/* Erste Übung mit offenen Arbeitssätzen, in der Reihenfolge der Einheit; -1, wenn alles erledigt ist */
export function nextOpen(ex = []) {
  return ex.findIndex(x => { const p = progressOf(x); return p.total > 0 && !p.complete; });
}

/* Übersicht für die Leiste und das Übersichts-Sheet.
   state: 'done' erledigt, 'next' die nächste offene Übung, 'open' noch offen. group: Nummer des Supersatzes oder null. */
export function overviewOf(ex = []) {
  const next = nextOpen(ex);
  const groupOf = new Map();
  let g = 0;
  groupsOf(ex).forEach(list => { if (list.length > 1) { g++; list.forEach(i => groupOf.set(i, g)); } });
  const items = ex.map((x, i) => {
    const p = progressOf(x);
    return { i, name: x.name, done: p.done, total: p.total, state: p.complete ? 'done' : i === next ? 'next' : 'open', group: groupOf.get(i) || null };
  });
  return {
    items,
    next,
    exDone: items.filter(it => it.state === 'done').length,
    setsDone: items.reduce((n, it) => n + it.done, 0),
    setsTotal: items.reduce((n, it) => n + it.total, 0),
  };
}

/* Sätze kurz als eine Zeile, gleiche Gewichte, Satztypen und Methoden am Stück zusammengefasst:
   „100 kg × 8, 8, 7“, „A 40 kg × 10 · 100 kg × 8 · D 70 kg × 12“, „12, 10, 9 Wdh.“, „45, 50 s“.
   Am Smart-Zirkel steht eine Methode außer „Regulär“ dahinter: „90 kg × 10, 10 (Negativ)“.
   sets: [{ w, r, t, m }], Werte als Zahl oder Eingabetext („42,5“); leere Gewichte gelten als 0. */
export function setsSummary(sets = [], unit = 'reps') {
  const list = (Array.isArray(sets) ? sets : []).map(s => ({ w: num(s.w), r: Math.round(num(s.r)), p: typePrefix(s), m: methodSuffix(s) }));
  if (!list.length) return '';
  if (list.every(s => !(s.w > 0))) return list.map(s => s.p + s.r + s.m).join(', ') + (unit === 'sec' ? ' s' : ' Wdh.');
  const runs = [];
  list.forEach(s => {
    const last = runs[runs.length - 1];
    if (last && last.w === s.w && last.p === s.p && last.m === s.m) last.r.push(s.r);
    else runs.push({ w: s.w, p: s.p, m: s.m, r: [s.r] });
  });
  const tail = unit === 'sec' ? ' s' : '';
  return runs.map(run => run.p + (run.w > 0 ? `${fmt(run.w)} kg × ` : '') + run.r.join(', ') + tail + run.m).join(' · ');
}

/* Zeile der eingeklappten Übung: die abgehakten Arbeitssätze, am Smart-Zirkel mit der Methode der Karte */
export const foldSummary = x => setsSummary(workSets((x && x.log) || []).filter(s => s.done)
  .map(s => (x.m && !s.m ? { ...s, m: x.m } : s)), x && x.unit);

/* Eingabe („42,5“, „1.000“) oder Zahl als Zahl, Leeres als 0 */
const num = v => { const n = typeof v === 'number' ? v : toNum(v); return Number.isFinite(n) ? n : 0; };
