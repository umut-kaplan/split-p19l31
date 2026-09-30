/* Rekorde pro Übung. Schlüssel wie im Verlauf: exId|name. Reine Funktionen. */
import { fmt, fmt0, fmt1 } from '../util.js';
import { workSets, topSets, tonnage } from './settypes.js';

export const recordKey = x => x.exId + '|' + x.name;

/* Geschätztes Maximalgewicht für eine Wiederholung nach Epley: w × (1 + r / 30).
   Nur für 1 bis 12 Wiederholungen, darüber wird die Schätzung ungenau. Bei einer Wiederholung zählt das Gewicht selbst. */
export function e1rm(w, r) {
  if (!(w > 0) || !(r >= 1 && r <= 12)) return null;
  return r === 1 ? w : w * (1 + r / 30);
}

export const RECORD_KINDS = ['weight', 'e1rm', 'volume', 'reps', 'time'];
export const RECORD_LABEL = { weight: 'Gewicht', e1rm: '1RM', volume: 'Volumen', reps: 'Wiederholungen', time: 'Zeit' };

export function formatRecord(kind, v) {
  if (kind === 'weight') return `${fmt(v)} kg`;
  if (kind === 'e1rm') return `${fmt1(v)} kg`;
  if (kind === 'volume') return `${fmt0(v)} kg`;
  if (kind === 'reps') return `${fmt0(v)} Wdh.`;
  return `${fmt0(v)} s`;
}

/* Kennzahlen einer Übung in einer Einheit. sets: [{ w, r, t }].
   Sekunden-Übungen (Plank): längste Zeit. Wiederholungen ohne Zusatzgewicht: meiste Wiederholungen in einem Satz.
   Satztypen (settypes.js): Aufwärmsätze zählen gar nicht. Dropsätze zählen nur beim Volumen,
   Gewicht, 1RM, Wiederholungen und Zeit kommen aus normalen Sätzen und Sätzen bis Versagen. */
export function exerciseStats(sets, unit = 'reps') {
  const top = topSets(sets);
  const weight = Math.max(0, ...top.map(s => s.w || 0));
  if (unit === 'sec') {
    return { weight, e1rm: null, volume: null, reps: null, time: Math.max(0, ...top.map(s => s.r || 0)) };
  }
  const es = top.map(s => e1rm(s.w, s.r)).filter(v => v != null);
  const bodyweight = top.filter(s => !(s.w > 0));
  return {
    weight,
    e1rm: es.length ? Math.max(...es) : null,
    volume: tonnage(sets),
    reps: bodyweight.length ? Math.max(...bodyweight.map(s => s.r || 0)) : null,
    time: null,
  };
}

/* Bestwerte über alle Einheiten.
   Liefert Map key -> { key, exId, name, unit, count, weight, e1rm, volume, reps, time }, jeder Wert { value, date } oder null. */
export function personalRecords(sessions) {
  const map = new Map();
  sessions.forEach(s => s.ex.forEach(x => {
    /* Nur Aufwärmsätze: die Übung gilt in dieser Einheit als nicht trainiert */
    if (!workSets(x.sets).length) return;
    const key = recordKey(x);
    let r = map.get(key);
    if (!r) {
      r = { key, exId: x.exId, name: x.name, unit: x.unit, count: 0, weight: null, e1rm: null, volume: null, reps: null, time: null };
      map.set(key, r);
    }
    r.count++;
    const st = exerciseStats(x.sets, x.unit);
    RECORD_KINDS.forEach(k => {
      const v = st[k];
      if (v != null && v > 0 && (!r[k] || v > r[k].value)) r[k] = { value: v, date: s.startedAt };
    });
  }));
  return map;
}

/* Verlauf einer Übung, eine Zeile pro Einheit, chronologisch */
export function exerciseSeries(sessions, exId, name) {
  const out = [];
  sessions.forEach(s => {
    const x = s.ex.find(y => y.exId === exId && y.name === name && workSets(y.sets).length);
    if (x) out.push({ t: s.startedAt, unit: x.unit, ...exerciseStats(x.sets, x.unit) });
  });
  return out;
}

/* Ist ein gerade abgehakter Satz ein Rekord?
   prior: Eintrag aus personalRecords der früheren Einheiten, before: in dieser Einheit schon abgehakte Sätze.
   Aufwärm- und Dropsätze sind nie ein Rekord und zählen auch in before nicht mit.
   Ein Rekord muss alles Frühere und alle schon abgehakten Sätze übertreffen. Ohne frühere Einheit gibt es keinen Rekord.
   Liefert z. B. [{ kind: 'weight', value: 85 }, { kind: 'e1rm', value: 99.2 }] oder []. */
export function setRecords(prior, before, set, unit = 'reps') {
  if (!prior || !topSets([set]).length) return [];
  before = topSets(before);
  const out = [];
  const beat = (kind, v, earlier) => {
    const p = prior[kind];
    if (v == null || !(v > 0) || !p || !(v > p.value)) return;
    if (earlier.every(b => b == null || v > b)) out.push({ kind, value: v });
  };
  if (unit === 'sec') {
    beat('time', set.r, before.map(b => b.r));
    return out;
  }
  if (set.w > 0) {
    beat('weight', set.w, before.map(b => b.w));
    beat('e1rm', e1rm(set.w, set.r), before.map(b => e1rm(b.w, b.r)));
  } else {
    beat('reps', set.r, before.filter(b => !(b.w > 0)).map(b => b.r));
  }
  return out;
}

/* Rekorde einer abgeschlossenen Einheit gegenüber allen früheren. ex: Übungen der Einheit mit abgehakten Sätzen.
   Liefert [{ name, items: [{ kind, value }] }] */
export function sessionRecords(priorSessions, ex) {
  const prior = personalRecords(priorSessions);
  return ex.map(x => {
    const p = prior.get(recordKey(x));
    if (!p) return null;
    const st = exerciseStats(x.sets, x.unit);
    const items = RECORD_KINDS
      .filter(k => st[k] != null && st[k] > 0 && p[k] && st[k] > p[k].value)
      .map(k => ({ kind: k, value: st[k] }));
    return items.length ? { name: x.name, items } : null;
  }).filter(Boolean);
}
