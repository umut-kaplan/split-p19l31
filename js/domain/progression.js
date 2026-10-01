import { fmt } from '../util.js';
import { workSets, topSets } from './settypes.js';

/* Nächste Einheit: die nach der zuletzt trainierten, in der Reihenfolge des Plans.
   days (4.7): die Tage des Plans. Hat der Plan noch keine eigene Einheit, etwa der eben übernommene überarbeitete
   3er-Split, geht es nach der zuletzt trainierten Einheit eines anderen Plans weiter, wenn ein Tag hier genauso heißt
   (Push, Pull, Legs). Sonst beginnt der Plan vorn. */
export function nextDay(order, sessions, planId, days = null) {
  const mine = sessions.filter(s => !planId || !s.planId || s.planId === planId);
  const last = mine[mine.length - 1];
  const after = id => order[(order.indexOf(id) + 1) % order.length];
  if (last) return order.includes(last.dayId) ? after(last.dayId) : order[0];
  const prev = days && sessions[sessions.length - 1];
  const same = prev && prev.name ? order.find(id => days[id] && days[id].name === prev.name) : null;
  return same ? after(same) : order[0];
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
   Gezählt werden normale Sätze und Sätze bis Versagen; Aufwärm- und Dropsätze nicht.
   lib: Eintrag der Bibliothek (optional). Stellt das Gerät das Gewicht ein (autoLoad, Smart-Zirkel), gibt es
   keinen kg-Vorschlag: kind 'auto', weight null. Mit Gegengewicht (lib.assisted) geht es über weniger Unterstützung. */
export function suggest(sessions, e, name, lib = null) {
  if ((lib && lib.autoLoad) || e.autoLoad) {
    return { kind: 'auto', weight: null, text: 'Gewicht stellt das Gerät ein', sub: 'Trag ein, was das Display nach dem Satz zeigt.' };
  }
  if ((lib ? lib.assisted : e.assisted) && e.unit !== 'sec') return suggestAssisted(sessions, e, name);
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

/* Übung mit Gegengewicht (4.7, lib.assisted): Die kg sind Unterstützung. Sind alle Sätze oben, kommt nicht mehr
   Gewicht, sondern weniger Unterstützung: das Gegengewicht um die Steigerung des Plans (sonst 2,5 kg) kleiner.
   Gemessen wird an der kleinsten Unterstützung vom letzten Mal, das war der schwerste Satz. */
export const ASSIST_STEP = 2.5;
function suggestAssisted(sessions, e, name) {
  const L = lastLog(sessions, e.id, name, topSets);
  if (!L) return { kind: 'new', weight: null, text: 'Erstes Mal', sub: 'Wähle so viel Unterstützung, dass noch 1–2 Wiederholungen in Reserve bleiben.' };
  const sets = topSets(L.sets);
  const w = Math.min(...sets.map(s => (s.w > 0 ? s.w : 0)));
  const allTop = sets.length >= e.sets
    && sets.every(s => s.r >= e.repMax)
    && sets.every(s => s.rir == null || s.rir >= 1);
  if (allTop) {
    const nw = Math.max(0, w - (e.inc > 0 ? e.inc : ASSIST_STEP));
    return nw > 0
      ? { kind: 'up', weight: nw, text: `Weniger Unterstützung: ${fmt(nw)} kg`, sub: `Letztes Mal alle Sätze mit ${e.repMax} Wdh. Starte wieder bei ${e.repMin}.` }
      : { kind: 'up', weight: 0, text: 'Ohne Unterstützung versuchen', sub: `Letztes Mal alle Sätze mit ${e.repMax} Wdh. Probier es ohne Gegengewicht und starte wieder bei ${e.repMin}.` };
  }
  return { kind: 'hold', weight: w, text: `Gleiche Unterstützung: ${fmt(w)} kg`, sub: `Ziel: ${e.repMax} Wdh. in allen Sätzen. Weniger Unterstützung, sobald alle Sätze oben sind.` };
}
