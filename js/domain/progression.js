import { fmt } from '../util.js';
import { workSets, topSets } from './settypes.js';

/* Nächste Einheit: die nach der zuletzt trainierten, in der Reihenfolge des Plans */
export function nextDay(order, sessions, planId) {
  const mine = sessions.filter(s => !planId || !s.planId || s.planId === planId);
  const last = mine[mine.length - 1];
  if (!last || !order.includes(last.dayId)) return order[0];
  return order[(order.indexOf(last.dayId) + 1) % order.length];
}

/* Letzte Einheit mit dieser Übung. sets: alle Sätze in der Reihenfolge des Trainings, auch Aufwärm- und Dropsätze.
   pick wählt, welche Sätze die Einheit mindestens haben muss; Standard: ein Arbeitssatz (kein reines Aufwärmen). */
export function lastLog(sessions, exId, name, pick = workSets) {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    const x = s.ex.find(x => x.exId === exId && x.name === name && x.sets && pick(x.sets).length);
    if (x) return { date: s.startedAt, sets: x.sets };
  }
  return null;
}

/* Doppelprogression: alle Sätze am oberen Ende mit RIR >= 1, dann mehr Gewicht.
   Gezählt werden normale Sätze und Sätze bis Versagen; Aufwärm- und Dropsätze nicht. */
export function suggest(sessions, e, name) {
  const L = lastLog(sessions, e.id, name, topSets);
  if (!L) return { kind: 'new', weight: null, text: 'Erstes Mal', sub: 'Wähle ein Gewicht, bei dem noch 1–2 Wiederholungen in Reserve bleiben.' };
  const sets = topSets(L.sets);
  const w = Math.max(...sets.map(s => s.w || 0));
  const allTop = sets.length >= e.sets
    && sets.every(s => s.r >= e.repMax)
    && sets.every(s => s.rir == null || s.rir >= 1);
  if (e.unit === 'sec') {
    return allTop
      ? { kind: 'up', weight: w, text: 'Zeit ausgereizt', sub: `Alle Sätze ${e.repMax} s. Nimm Zusatzgewicht oder eine schwerere Variante.` }
      : { kind: 'hold', weight: w, text: 'Etwas länger halten', sub: `Ziel: ${e.repMax} s in allen Sätzen.` };
  }
  if (allTop) {
    const nw = w + (e.inc || 0);
    return { kind: 'up', weight: nw, text: `Mehr Gewicht: ${fmt(nw)} kg`, sub: `Letztes Mal alle Sätze mit ${e.repMax} Wdh. Starte wieder bei ${e.repMin}.` };
  }
  return { kind: 'hold', weight: w, text: `Gleiches Gewicht: ${fmt(w)} kg`, sub: `Ziel: ${e.repMax} Wdh. in allen Sätzen, dann kommt mehr Gewicht.` };
}
