/* Satztypen wie in Hevy oder Strong. Reine Funktionen.
   Feld t am Satz: 'w' Aufwärmen, 'd' Drop, 'f' bis Versagen. Fehlt es, ist der Satz normal.
   Was wofür zählt:
   - Aufwärmsätze zählen für nichts: kein Volumen, keine Rekorde, keine Progression, nicht im Wochenbericht,
     nicht im Muskelvolumen und nicht im Satzzähler der Einheit.
   - Dropsätze zählen fürs Volumen (auch Muskelvolumen und Satzzähler), aber nicht für Rekorde
     (Gewicht, 1RM, Wiederholungen, Zeit) und nicht für die Progression.
   - Sätze bis Versagen zählen wie normale Sätze. */

export const SET_TYPES = ['w', 'd', 'f'];
/* Reihenfolge beim Tippen auf die Satznummer: normal, Aufwärmen, Drop, Versagen, wieder normal */
const CYCLE = [null, 'w', 'd', 'f'];
export const TYPE_SHORT = { w: 'A', d: 'D', f: 'V' };
export const TYPE_NAME = { w: 'Aufwärmsatz', d: 'Dropsatz', f: 'Satz bis Versagen' };

/* Typ eines Satzes; null steht für normal, auch bei fehlendem oder unbekanntem Wert */
export const setType = s => (s && SET_TYPES.includes(s.t) ? s.t : null);
export const nextType = t => CYCLE[(CYCLE.indexOf(SET_TYPES.includes(t) ? t : null) + 1) % CYCLE.length];
export const isWarmup = s => setType(s) === 'w';
/* Zählt für Rekorde und Progression: normal oder bis Versagen */
export const isTop = s => { const t = setType(s); return t !== 'w' && t !== 'd'; };

/* Arbeitssätze: alles außer Aufwärmen. Grundlage für Volumen, Muskelvolumen, Wochenbericht, Satzzähler. */
export const workSets = (sets = []) => (sets || []).filter(s => !isWarmup(s));
/* Sätze für Rekorde und Progression: ohne Aufwärm- und Dropsätze */
export const topSets = (sets = []) => (sets || []).filter(isTop);

/* Gewicht mal Wiederholungen der Arbeitssätze in kg */
export const tonnage = (sets = []) => workSets(sets).reduce((a, s) => a + (s.w || 0) * (s.r || 0), 0);

/* Anzeige statt Satznummer: „A“, „D“, „V“; normale Sätze tragen ihre Nummer, gezählt nur unter den normalen.
   Beispiel: [A, normal, normal, D] ergibt ['A', '1', '2', 'D']. */
export function setLabels(sets = []) {
  let n = 0;
  return (sets || []).map(s => {
    const t = setType(s);
    return t ? TYPE_SHORT[t] : String(++n);
  });
}

/* Satz mit gültigem Typ oder ohne Feld t. Unbekannte Werte fallen weg, alles andere bleibt, wie es ist. */
export function cleanSet(s) {
  if (!s || typeof s !== 'object' || !('t' in s) || SET_TYPES.includes(s.t)) return s;
  const { t, ...rest } = s;
  return rest;
}

/* Kurzes Präfix für Listen wie „Letztes Mal“ oder den Verlauf, z. B. „A “ */
export const typePrefix = s => { const t = setType(s); return t ? TYPE_SHORT[t] + ' ' : ''; };

/* Name eines Satzes für Ansagen und Bedienhilfen: „Satz 2“, „Aufwärmsatz“, „Dropsatz“ */
export function setName(sets, j) {
  const t = setType(sets[j]);
  return t ? TYPE_NAME[t] : `Satz ${setLabels(sets)[j]}`;
}
