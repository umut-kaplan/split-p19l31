/* Tippfehler beim Gewicht abfangen (4.6): „950 kg stimmt?“ statt 95 kg. Reine Funktionen.
   Verglichen wird mit dem bisherigen Bestwert der Übung (schwerster Satz, wie bei den Rekorden),
   ohne Bestwert mit dem letzten Arbeitsgewicht. Ohne Vorwert fragt die App nicht. */
import { toNum } from '../util.js';
import { workSets, topSets } from './settypes.js';

/* Mehr als 50 % über dem Vorwert gilt als möglicher Tippfehler */
export const CHECK_FACTOR = 1.5;

const kg = v => { const n = typeof v === 'number' ? v : toNum(v); return Number.isFinite(n) && n > 0 ? n : 0; };

/* Vorwerte für einen Satz der laufenden Einheit.
   prior: Eintrag aus personalRecords (früheren Einheiten) oder null; last: lastLog der Übung oder null;
   log: Sätze dieser Einheit, j: der Satz, der gerade abgehakt wird (zählt selbst nicht mit).
   Bestwert: schwerster normaler Satz oder Satz bis Versagen, früher oder in dieser Einheit schon abgehakt.
   Letztes Arbeitsgewicht: zuletzt abgehakter Arbeitssatz dieser Einheit, sonst der schwerste Arbeitssatz vom letzten Mal. */
export function referenceFor({ prior = null, last = null, log = [], j = -1 } = {}) {
  const doneHere = (log || []).filter((s, k) => k !== j && s && s.done);
  const best = Math.max(prior && prior.weight ? kg(prior.weight.value) : 0, ...topSets(doneHere).map(s => kg(s.w)));
  const hereWork = workSets(doneHere).map(s => kg(s.w)).filter(w => w > 0);
  const lastWork = hereWork.length ? hereWork[hereWork.length - 1]
    : Math.max(0, ...workSets((last && last.sets) || []).map(s => kg(s.w)));
  return { best: best > 0 ? best : null, last: lastWork > 0 ? lastWork : null };
}

/* Fragen oder nicht? Liefert { ask, ref, basis: 'best' | 'last' | null }. */
export function checkWeight(w, { best = null, last = null } = {}) {
  const v = kg(w);
  const ref = best > 0 ? best : last > 0 ? last : null;
  const basis = best > 0 ? 'best' : last > 0 ? 'last' : null;
  return { ask: !!(ref && v > ref * CHECK_FACTOR), ref, basis };
}
