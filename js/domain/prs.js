/* Rekorde pro Übung. Schlüssel wie im Verlauf: exId|name. Reine Funktionen. */
import { fmt, fmt0, fmt1 } from '../util.js';
import { workSets, recordSets, isRegular, tonnage } from './settypes.js';
import { isAssisted } from './library.js';

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
   Gewicht, 1RM, Wiederholungen und Zeit kommen aus normalen Sätzen und Sätzen bis Versagen.
   Smart-Zirkel (4.7): Sätze mit einer anderen Methode als „Regulär“ zählen für keinen Rekord, auch nicht fürs Volumen.
   Gegengewicht (4.7, assisted): Die kg sind Unterstützung. Kein Gewicht, kein 1RM, kein Volumen; Wiederholungen aus dem
   besten Satz (meiste Wiederholungen, bei Gleichstand weniger Unterstützung), dazu assist: seine Unterstützung in kg. */
export function exerciseStats(sets, unit = 'reps', assisted = false) {
  const top = recordSets(sets);
  const regular = (Array.isArray(sets) ? sets : []).filter(isRegular);
  if (assisted && unit !== 'sec') {
    const best = top.filter(s => s.r > 0).map(assistOf).reduce((a, c) => (!a || c.value > a.value || (c.value === a.value && c.assist < a.assist) ? c : a), null);
    return { weight: null, e1rm: null, volume: null, reps: best ? best.value : null, assist: best ? best.assist : null, time: null };
  }
  const weight = Math.max(0, ...top.map(s => s.w || 0));
  if (unit === 'sec') {
    return { weight, e1rm: null, volume: null, reps: null, time: Math.max(0, ...top.map(s => s.r || 0)) };
  }
  const es = top.map(s => e1rm(s.w, s.r)).filter(v => v != null);
  const bodyweight = top.filter(s => !(s.w > 0));
  return {
    weight,
    e1rm: es.length ? Math.max(...es) : null,
    volume: tonnage(regular),
    reps: bodyweight.length ? Math.max(...bodyweight.map(s => s.r || 0)) : null,
    time: null,
  };
}

/* Gegengewicht: Satz als { value: Wiederholungen, assist: Unterstützung in kg } */
const assistOf = s => ({ value: s.r || 0, assist: s.w > 0 ? s.w : 0 });
/* Ist c besser als p? Mehr Wiederholungen bei gleicher oder weniger Unterstützung, oder gleich viele mit weniger.
   Mehr Wiederholungen mit mehr Unterstützung sind kein Rekord. */
export const betterAssisted = (c, p) => !!c && c.value > 0
  && (!p || (c.value > p.value && c.assist <= p.assist) || (c.value >= p.value && c.assist < p.assist));

/* Bestwerte über alle Einheiten.
   Liefert Map key -> { key, exId, name, unit, assisted, count, weight, e1rm, volume, reps, time }, jeder Wert
   { value, date } oder null; mit Gegengewicht trägt reps zusätzlich assist (Unterstützung in kg). */
export function personalRecords(sessions) {
  const map = new Map();
  sessions.forEach(s => s.ex.forEach(x => {
    /* Nur Aufwärmsätze: die Übung gilt in dieser Einheit als nicht trainiert */
    if (!workSets(x.sets).length) return;
    const key = recordKey(x);
    let r = map.get(key);
    if (!r) {
      r = { key, exId: x.exId, name: x.name, unit: x.unit, assisted: isAssisted(x), count: 0, weight: null, e1rm: null, volume: null, reps: null, time: null };
      map.set(key, r);
    }
    r.count++;
    if (r.assisted && x.unit !== 'sec') {
      recordSets(x.sets).map(assistOf).forEach(c => { if (betterAssisted(c, r.reps)) r.reps = { ...c, date: s.startedAt }; });
      return;
    }
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
    if (x) out.push({ t: s.startedAt, unit: x.unit, ...exerciseStats(x.sets, x.unit, isAssisted(x)) });
  });
  return out;
}

/* Ist ein gerade abgehakter Satz ein Rekord?
   prior: Eintrag aus personalRecords der früheren Einheiten, before: in dieser Einheit schon abgehakte Sätze.
   Aufwärm- und Dropsätze sind nie ein Rekord und zählen auch in before nicht mit.
   Ein Rekord muss alles Frühere und alle schon abgehakten Sätze übertreffen. Ohne frühere Einheit gibt es keinen Rekord.
   Gegengewicht (prior.assisted): nur Wiederholungen, und nur bei gleicher oder weniger Unterstützung als beim Bestwert
   und als bei den früheren Sätzen dieser Einheit, gegen die verglichen wird.
   Liefert z. B. [{ kind: 'weight', value: 85 }, { kind: 'e1rm', value: 99.2 }] oder []. */
export function setRecords(prior, before, set, unit = 'reps') {
  if (!prior || !recordSets([set]).length) return [];
  before = recordSets(before);
  const out = [];
  if (prior.assisted && unit !== 'sec') {
    const c = assistOf(set);
    const p = prior.reps;
    if (p && c.value > p.value && c.assist <= p.assist
      && before.map(assistOf).filter(b => b.assist <= c.assist).every(b => c.value > b.value)) out.push({ kind: 'reps', value: c.value, assist: c.assist });
    return out;
  }
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
    /* Gegengewicht: mehr Wiederholungen als der Bestwert, bei höchstens so viel Unterstützung */
    if (p.assisted && x.unit !== 'sec') {
      const hits = p.reps ? recordSets(x.sets).map(assistOf).filter(c => c.value > p.reps.value && c.assist <= p.reps.assist) : [];
      if (!hits.length) return null;
      const best = hits.reduce((a, c) => (c.value > a.value || (c.value === a.value && c.assist < a.assist) ? c : a));
      return { name: x.name, items: [{ kind: 'reps', value: best.value, assist: best.assist }] };
    }
    const st = exerciseStats(x.sets, x.unit);
    const items = RECORD_KINDS
      .filter(k => st[k] != null && st[k] > 0 && p[k] && st[k] > p[k].value)
      .map(k => ({ kind: k, value: st[k] }));
    return items.length ? { name: x.name, items } : null;
  }).filter(Boolean);
}

/* Mehrere Einträge aus personalRecords zu einer Übung zusammenführen, z. B. dieselbe Übung in zwei Plänen.
   Je Kennzahl gilt der höchste Wert mit seinem Datum. Liefert null bei leerer Liste. */
export function mergeRecords(list = []) {
  const recs = list.filter(Boolean);
  if (!recs.length) return null;
  const out = { ...recs[0], count: 0 };
  RECORD_KINDS.forEach(k => { out[k] = null; });
  recs.forEach(r => {
    out.count += r.count || 0;
    RECORD_KINDS.forEach(k => {
      if (!r[k]) return;
      if (k === 'reps' && r.assisted) { if (betterAssisted(r[k], out[k])) out[k] = r[k]; return; }
      if (!out[k] || r[k].value > out[k].value) out[k] = r[k];
    });
  });
  return out;
}

/* Wiederholungen mit Unterstützung: „8 Wdh. bei 20 kg Unterstützung“, ohne Gegengewicht „8 Wdh. ohne Unterstützung“ */
export const assistText = r => `${formatRecord('reps', r.value)} ${r.assist > 0 ? `bei ${fmt(r.assist)} kg Unterstützung` : 'ohne Unterstützung'}`;

/* Bestwert für die Übungskarte im Training und das Anleitungs-Sheet (4.6).
   Mit Gewicht: schwerster Satz und, wenn vorhanden, 1RM nach Epley. Ohne Gewicht: meiste Wiederholungen. Auf Zeit: längste Zeit.
   Mit Gegengewicht: Wiederholungen samt Unterstützung.
   Liefert { items: [{ kind, label, text }], date, text } oder null, wenn es noch keinen Bestwert gibt. */
export function bestSummary(rec) {
  if (!rec) return null;
  const kinds = rec.unit === 'sec' ? ['time'] : rec.weight ? ['weight', 'e1rm'] : ['reps'];
  const items = kinds.filter(k => rec[k] && rec[k].value > 0)
    .map(k => ({ kind: k, label: k === 'e1rm' ? RECORD_LABEL.e1rm : '', text: k === 'reps' && rec.assisted ? assistText(rec[k]) : formatRecord(k, rec[k].value) }));
  if (!items.length) return null;
  const date = rec[kinds.find(k => rec[k] && rec[k].value > 0)].date;
  return { items, date, text: items.map(it => (it.label ? `${it.label} ${it.text}` : it.text)).join(' · ') };
}
