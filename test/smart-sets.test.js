/* Methode je Satz am Smart-Zirkel in der laufenden Einheit (4.7, B): Karte für alle Sätze, je Satz überschreibbar,
   gespeichert wird die geltende Methode, Rekorde nur aus regulären Sätzen. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  METHOD_IDS, METHOD_HINTS, isAutoLoad, cardMethod, methodOf, methodName, overridden, savedSet, setCardMethod, setSetMethod, lastMethod,
} from '../js/domain/smart-sets.js';
import { SET_METHODS } from '../js/domain/settypes.js';
import { setRecords } from '../js/domain/prs.js';

const set = (o = {}) => ({ w: '60', r: '10', rir: 2, done: false, ...o });
const card = (log, m) => (m ? { log, m } : { log });

test('Sechs Methoden, jede mit einer Zeile Erklärung ohne Markennamen', () => {
  assert.deepEqual(METHOD_IDS, Object.keys(SET_METHODS));
  METHOD_IDS.forEach(m => {
    assert.ok(METHOD_HINTS[m] && /\.$/.test(METHOD_HINTS[m]), m);
    assert.doesNotMatch(METHOD_HINTS[m], /egym/i);
  });
  assert.equal(methodName('negative'), 'Negativ');
  assert.equal(methodName(null), 'Regulär');
  assert.equal(methodName('quatsch'), 'Regulär');
});

test('Gerät stellt das Gewicht ein: aus der Bibliothek oder dem Plan-Eintrag', () => {
  assert.ok(isAutoLoad({}, { autoLoad: 'smart' }));
  assert.ok(isAutoLoad({ autoLoad: 'smart' }));
  assert.ok(!isAutoLoad({}, { autoLoad: null }));
  assert.ok(!isAutoLoad(null, null));
});

test('Methode der Karte gilt für alle Sätze ohne eigene; ohne beides regulär', () => {
  const x = card([set(), set({ m: 'negative' })], 'adaptive');
  assert.equal(cardMethod(x), 'adaptive');
  assert.equal(methodOf(x, x.log[0]), 'adaptive');
  assert.equal(methodOf(x, x.log[1]), 'negative');
  assert.ok(!overridden(x, x.log[0]) && overridden(x, x.log[1]));
  const plain = card([set()]);
  assert.equal(methodOf(plain, plain.log[0]), null);
  assert.ok(!overridden(plain, plain.log[0]));
  /* Regulär als eigener Wert weicht von keiner Karte ab, die regulär ist */
  assert.ok(!overridden(plain, set({ m: 'regular' })));
});

test('Speichern: die geltende Methode am Satz, ohne Methode wie bisher { w, r, rir }', () => {
  const x = card([set(), set({ m: 'negative' })], 'adaptive');
  assert.deepEqual(savedSet(x, x.log[0]), { w: 60, r: 10, rir: 2, m: 'adaptive' });
  assert.deepEqual(savedSet(x, x.log[1]), { w: 60, r: 10, rir: 2, m: 'negative' });
  assert.deepEqual(savedSet(card([set({ t: 'f' })]), set({ t: 'f' })), { w: 60, r: 10, rir: 2, t: 'f' });
});

test('Karte wechseln: offene Sätze folgen, erledigte behalten, was beim Abhaken galt', () => {
  const x = card([set({ done: true }), set({ done: true, m: 'negative' }), set({ m: 'explonic' }), set()]);
  setCardMethod(x, 'adaptive');
  assert.equal(x.m, 'adaptive');
  assert.equal(x.log[0].m, 'regular', 'erledigt und regulär: bleibt regulär');
  assert.equal(x.log[1].m, 'negative');
  assert.ok(!('m' in x.log[2]), 'offene eigene Methode fällt weg');
  assert.equal(methodOf(x, x.log[3]), 'adaptive');
  /* Noch einmal wechseln: der erste Satz bleibt regulär, der zweite negativ */
  setCardMethod(x, 'isokinetic');
  assert.deepEqual(x.log.map(s => methodOf(x, s)), ['regular', 'negative', 'isokinetic', 'isokinetic']);
  /* Zurück auf regulär: x.m bleibt als ausdrückliche Wahl stehen, Unbekanntes löscht sie */
  setCardMethod(x, 'regular');
  assert.equal(x.m, 'regular');
  setCardMethod(x, 'gibtsnicht');
  assert.ok(!('m' in x));
});

test('Gleiche Methode noch einmal wählen friert nichts ein', () => {
  const x = card([set({ done: true }), set()]);
  setCardMethod(x, 'regular');
  assert.ok(!('m' in x.log[0]));
});

test('Einzelner Satz: eigene Methode, leer heißt wieder wie die Karte', () => {
  const x = card([set(), set()], 'negative');
  setSetMethod(x, 1, 'maxout');
  assert.equal(methodOf(x, x.log[1]), 'maxout');
  setSetMethod(x, 1, '');
  assert.equal(methodOf(x, x.log[1]), 'negative');
  setSetMethod(x, 1, 'quatsch');
  assert.ok(!('m' in x.log[1]));
  assert.doesNotThrow(() => setSetMethod(x, 9, 'regular'));
});

test('Startwert der Karte: die Methode vom letzten Mal, nur wenn alle Arbeitssätze sie hatten', () => {
  assert.equal(lastMethod([{ w: 50, r: 10, m: 'adaptive' }, { w: 50, r: 12, m: 'adaptive' }]), 'adaptive');
  assert.equal(lastMethod([{ w: 20, r: 10, t: 'w' }, { w: 50, r: 10, m: 'negative' }]), 'negative', 'Aufwärmsätze zählen nicht');
  assert.equal(lastMethod([{ w: 50, r: 10, m: 'adaptive' }, { w: 50, r: 12 }]), null);
  assert.equal(lastMethod([{ w: 50, r: 10 }, { w: 50, r: 12, m: 'regular' }]), null);
  assert.equal(lastMethod([]), null);
  assert.equal(lastMethod(null), null);
});

test('Rekord beim Abhaken nur mit regulärer Methode, auch wenn die Karte sie vorgibt', () => {
  const prior = { weight: { value: 60 }, e1rm: { value: 80 }, reps: null, time: null };
  const neg = card([set({ w: '90' })], 'negative');
  assert.deepEqual(setRecords(prior, [], savedSet(neg, neg.log[0])), []);
  const reg = card([set({ w: '90' })]);
  assert.ok(setRecords(prior, [], savedSet(reg, reg.log[0])).some(r => r.kind === 'weight'));
  /* Eigene Methode „Regulär“ unter einer Karte „Negativ“: zählt */
  const mix = card([set({ w: '90', m: 'regular' })], 'negative');
  assert.ok(setRecords(prior, [], savedSet(mix, mix.log[0])).some(r => r.kind === 'weight'));
});

test('Methodentexte (Prüfung M2): Explonic mit leichtem bis mittlerem Gewicht, Max Out ohne erfundene Angaben', () => {
  assert.equal(METHOD_HINTS.explonic, 'Leichtes bis mittleres Gewicht, die hebende Phase explosiv.');
  assert.equal(METHOD_HINTS.maxout, 'Folge der Anzeige am Gerät.');
});

test('Anleitungen am Smart-Zirkel legen kein Tempo und keine Kurve fest (Explonic, Isokinetisch)', async () => {
  const { EXERCISES_SMART } = await import('../js/data/exercises-smart.js');
  EXERCISES_SMART.forEach(e => [...e.steps, ...e.mistakes].forEach(t => {
    assert.doesNotMatch(t, /\b(langsam|schnell|schneller|Tempo|Kurve)\w*/i, `„${t}“ bei ${e.id}`);
    /* Infinitivgruppe mit „statt … zu“ steht mit Komma */
    if (/ statt .* zu \w+\.$/.test(t)) assert.match(t, /, statt /, `Komma bei „${t}“`);
  }));
});
