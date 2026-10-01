/* Methode je Satz am Smart-Zirkel (4.7), reine Funktionen für die laufende Einheit.
   Die Übungskarte trägt eine Methode für alle Sätze (x.m), jeder Satz kann sie mit einer eigenen überschreiben (s.m).
   Gespeichert wird je Satz die geltende Methode (domain/settypes.js, storedSet); fehlt sie, gilt der Satz als regulär.
   Rekorde zählen nur aus regulären Sätzen (domain/prs.js), fürs Volumen zählt jeder Arbeitssatz. */
import { SET_METHODS, setMethod, storedSet, workSets } from './settypes.js';

export const METHOD_IDS = Object.keys(SET_METHODS);

/* Eine Zeile je Methode für die Auswahl; ohne Markennamen, nur was die Unterlagen der Geräte belegen
   (Recherche „Trainingspläne“, Abschnitt Smart-Zirkel). Zu „Max Out“ ist nur belegt, dass es eine neue Methode ist. */
export const METHOD_HINTS = {
  regular: 'Gleiches Gewicht beim Drücken und Nachgeben. Zählt für Rekorde.',
  negative: 'Mehr Gewicht in der nachgebenden Phase.',
  adaptive: 'Das Gewicht sinkt mit der nachlassenden Kraft.',
  isokinetic: 'Festes Tempo, der Widerstand folgt deiner Kraft.',
  explonic: 'Leichtes bis mittleres Gewicht, die hebende Phase explosiv.',
  maxout: 'Folge der Anzeige am Gerät.',
};

/* Stellt das Gerät das Gewicht ein? x: Übung der Einheit oder Plan-Eintrag, lib: Eintrag der Bibliothek */
export const isAutoLoad = (x, lib = null) => !!((x && x.autoLoad) || (lib && lib.autoLoad));

/* Methode der Karte, gilt für alle Sätze ohne eigene; null heißt regulär */
export const cardMethod = x => setMethod(x);
/* Methode eines Satzes: eigene, sonst die der Karte, sonst null (regulär) */
export const methodOf = (x, s) => setMethod(s) || setMethod(x);
/* Anzeigename der geltenden Methode */
export const methodName = m => SET_METHODS[setMethod({ m }) || 'regular'];
/* Weicht der Satz von der Karte ab? Dann trägt er ein eigenes Schild. */
export const overridden = (x, s) => (methodOf(x, s) || 'regular') !== (cardMethod(x) || 'regular');

/* Satz zum Speichern mit der geltenden Methode (Karte oder eigene) */
export const savedSet = (x, s) => storedSet({ ...s, m: methodOf(x, s) || undefined });

/* Methode der Karte wechseln. Offene Sätze folgen ihr (eigene Methoden fallen weg), erledigte behalten,
   was beim Abhaken galt. Unbekannte Werte heißen regulär. Ändert x, liefert x. */
export function setCardMethod(x, m) {
  const next = setMethod({ m });
  const prev = cardMethod(x);
  (x.log || []).forEach(s => {
    if (!s.done) delete s.m;
    else if (!setMethod(s) && (prev || 'regular') !== (next || 'regular')) s.m = prev || 'regular';
  });
  if (next) x.m = next; else delete x.m;
  return x;
}

/* Methode eines einzelnen Satzes; '' oder Unbekanntes: wieder wie die Karte. Ändert x, liefert x. */
export function setSetMethod(x, j, m) {
  const s = x && x.log && x.log[j];
  if (!s) return x;
  const id = setMethod({ m });
  if (id) s.m = id; else delete s.m;
  return x;
}

/* Startwert der Karte: die Methode vom letzten Mal, wenn alle Arbeitssätze dieselbe hatten und sie nicht regulär war */
export function lastMethod(sets) {
  const ms = workSets(sets).map(s => setMethod(s) || 'regular');
  if (!ms.length || ms.some(m => m !== ms[0]) || ms[0] === 'regular') return null;
  return ms[0];
}
