process.env.TZ = 'Europe/Berlin';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPos, sameDays, narrow, nextQuestion, entryState, startFor, weekIndex, importFit, previewTwins } from '../js/domain/shift-entry.js';
import { templateById } from '../js/domain/shift-templates.js';
import { TEMPLATE_28, defaultShifts, patternAt, shiftOn, addDays } from '../js/domain/shifts.js';

const T28 = TEMPLATE_28.days;
const chain = s => s.split('');

test('Stelle im Block', () => {
  assert.deepEqual(T28.slice(0, 9).map((_, i) => runPos(T28, i)), [1, 2, 1, 2, 3, 1, 2, 1, 2]);
  /* Tag 1 folgt auf zwei freie Tage am Ende: er ist die erste Frühschicht */
  assert.equal(runPos(T28, 0), 1);
  assert.equal(runPos(chain('FFFF'), 2), 4);   // lauter gleiche Tage: nicht endlos zählen
});

test('Eindeutig: der Tag gibt es nur einmal', () => {
  /* 28-Tage-Vorlage: die 3. Spätschicht gibt es nur im ersten Block */
  const e = entryState(T28, 4);
  assert.deepEqual([e.index, e.question], [4, null]);
  /* 3. Frühschicht (FFF) gibt es nur im zweiten Block */
  assert.equal(entryState(T28, 11).index, 11);
  /* Konti wochenweise: jede Stelle ist eindeutig */
  const k4w = templateById('k4w').days;
  k4w.forEach((c, i) => { if (c !== '-') assert.equal(entryState(k4w, i).index, i); });
});

test('Mehrdeutig: „2. Frühschicht“ gibt es dreimal, dann fragt die App nach morgen', () => {
  assert.deepEqual(sameDays(T28, 1), [1, 10, 20]);
  const e = entryState(T28, 1);
  assert.equal(e.index, null);
  assert.deepEqual(e.cands, [1, 10, 20]);
  assert.deepEqual(e.question, { d: 1, options: ['S', 'F'] });
  /* Morgen Früh: nur der Block mit drei Frühschichten */
  assert.equal(entryState(T28, 1, [{ d: 1, code: 'F' }]).index, 10);
  /* Morgen Spät: noch zwei Kandidaten; erst in drei Tagen unterscheiden sie sich (S im ersten, N im dritten Block) */
  const two = entryState(T28, 1, [{ d: 1, code: 'S' }]);
  assert.deepEqual(two.cands, [1, 20]);
  assert.deepEqual(two.question, { d: 3, options: ['S', 'N'] });
  assert.equal(entryState(T28, 1, [{ d: 1, code: 'S' }, { d: 3, code: 'N' }]).index, 20);
  assert.equal(entryState(T28, 1, [{ d: 1, code: 'S' }, { d: 3, code: 'S' }]).index, 1);
});

test('Nach zwei Fragen ohne Ergebnis bleiben die Kandidaten zur Auswahl', () => {
  /* 1. Spätschicht: SSS im ersten Block, SS im zweiten und dritten */
  const cands = sameDays(T28, 2);
  assert.deepEqual(cands, [2, 12, 21]);
  /* Morgen ist überall Spät, erst übermorgen unterscheidet sich etwas */
  assert.deepEqual(nextQuestion(T28, cands), { d: 2, options: ['S', 'N'] });
  const e = entryState(T28, 2, [{ d: 2, code: 'N' }]);
  assert.deepEqual(e.cands, [12, 21]);
  assert.ok(e.question);
  /* Mit maxQuestions erreicht: keine weitere Frage, Auswahl aus den Kandidaten */
  const done = entryState(T28, 2, [{ d: 2, code: 'N' }, { d: 2, code: 'N' }]);
  assert.deepEqual([done.index, done.question, done.cands], [null, null, [12, 21]]);
});

test('Drehungen, die dasselbe Muster ergeben, zählen einmal', () => {
  /* „Früh, Spät“ im Wechsel über 4 Tage ist dasselbe wie über 2 Tage */
  assert.deepEqual(sameDays(chain('FSFS'), 0), [0]);
  assert.equal(entryState(chain('FSFS'), 2).index, 2);
  assert.deepEqual(sameDays(chain('X--'), 0), [0]);
});

test('narrow und die Rechnung zum Starttag', () => {
  assert.deepEqual(narrow(T28, [1, 10, 20], [{ d: 1, code: 'F' }]), [10]);
  assert.equal(startFor('2026-10-07', 10), '2026-09-27');
  /* Heute ist dann wirklich Tag 11 */
  const sh = { ...defaultShifts(), pattern: { start: startFor('2026-10-07', 10), days: [...T28], template: 't28' } };
  assert.equal(shiftOn(sh, '2026-10-07').code, 'F');
  assert.equal(patternAt(sh.pattern, '2026-10-08'), 'F');
  assert.equal(patternAt(sh.pattern, '2026-10-09'), 'S');
});

test('Mo–Fr-Vorlagen: ein Tipp in eine Zeile wählt die Woche, der Wochentag kommt vom Datum', () => {
  const w3 = templateById('w3v').days;
  /* Mittwoch 07.10.2026 in der Spätwoche (Zeile 2) */
  const i = weekIndex(w3, 1, '2026-10-07');
  assert.equal(i, 9);
  assert.equal(w3[i], 'S');
  const start = startFor('2026-10-07', i);
  assert.equal(start, '2026-09-28');   // ein Montag
  /* Samstag in der Nachtwoche: frei, und die Nachtwoche beginnt am Montag davor */
  assert.equal(weekIndex(w3, 2, '2026-10-10'), 19);
  assert.equal(startFor('2026-10-10', 19), '2026-09-21');
});

test('Import: die App findet den Einstieg, der am besten passt', () => {
  const sh = defaultShifts();
  /* Import über vier Wochen nach der 28-Tage-Vorlage mit Tag 1 am 12.10.; ein Tag Urlaub, einer getauscht */
  const truth = '2026-10-12';
  sh.imported = {};
  for (let i = 0; i < 28; i++) {
    const d = addDays('2026-10-05', i);
    const c = patternAt({ start: truth, days: T28 }, d);
    if (c !== '-') sh.imported[d] = c;
  }
  sh.imported['2026-10-14'] = 'U';
  sh.imported['2026-10-20'] = 'N';
  sh.importInfo = { at: 1, from: '2026-10-05', to: '2026-11-01', shifts: 20, unknown: 0 };
  const fit = importFit(T28, sh, '2026-10-01', '2026-10-05');
  /* Der Starttag liegt vor heute: 14.09. ist genau 28 Tage vor dem 12.10., also derselbe Einstieg */
  assert.equal(fit.start, '2026-09-14');
  assert.equal(addDays(fit.start, 28), truth);
  assert.equal(fit.index, 17);   // 01.10. ist Tag 18, wenn Tag 1 der 12.10. ist
  assert.deepEqual([fit.same, fit.total], [26, 27]);   // Urlaub zählt nicht, ein Tag getauscht
  assert.ok(fit.current < fit.same);
  /* Ohne Import oder mit zu wenig Tagen kein Vorschlag */
  assert.equal(importFit(T28, defaultShifts(), '2026-10-01'), null);
});

test('Gleiche Vorschau: der erste Tag, an dem sich zwei Kandidaten unterscheiden', () => {
  /* Eigenes Muster über 8 Wochen: dreimal Früh, einmal Spät, dreimal Früh, einmal Nacht (je Mo–Fr) */
  const W = (c) => `${c.repeat(5)}--`;
  const days = chain(W('F') + W('F') + W('F') + W('S') + W('F') + W('F') + W('F') + W('N'));
  const st = entryState(days, 0, [{ d: 7, code: 'F' }, { d: 14, code: 'F' }]);
  assert.deepEqual([st.index, st.question, st.cands], [null, null, [0, 28]]);
  /* Zwei Wochen lang gleich, in der vierten Woche Spät hier, Nacht dort */
  assert.deepEqual(previewTwins(days, st.cands), { 0: 21, 28: 21 });
  assert.equal(days[21], 'S');
  assert.equal(days[(28 + 21) % days.length], 'N');
  /* Unterscheiden sich die Vorschauen, steht nichts da */
  assert.deepEqual(previewTwins(T28, [12, 21]), {});
  assert.deepEqual(previewTwins(days, [0]), {});
  /* Mit kürzerer Vorschau zählt schon ein früherer Unterschied nicht als gleich */
  assert.deepEqual(previewTwins(days, [0, 28], 22), {});
});
