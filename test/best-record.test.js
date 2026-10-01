import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personalRecords, bestSummary, mergeRecords } from '../js/domain/prs.js';

const sess = (t, ex) => ({ startedAt: t, ex });
const x = (exId, name, sets, unit = 'reps') => ({ exId, name, unit, sets });

test('Bestwert mit Gewicht: schwerster Satz und 1RM nach Epley', () => {
  const recs = personalRecords([
    sess(10, [x('squat', 'Kniebeugen', [{ w: 100, r: 8 }, { w: 105, r: 5 }])]),
    sess(20, [x('squat', 'Kniebeugen', [{ w: 102.5, r: 8 }])]),
  ]);
  const b = bestSummary(recs.get('squat|Kniebeugen'));
  assert.equal(b.text, '105 kg · 1RM 129,8 kg');            // 102,5 × (1 + 8/30) = 129,83 schlägt 105 × (1 + 5/30) = 122,5
  assert.deepEqual(b.items.map(it => it.kind), ['weight', 'e1rm']);
  assert.equal(b.date, 10);                                 // Datum des schwersten Satzes
});

test('Bestwert ohne 1RM: über 12 Wiederholungen schätzt die App keins', () => {
  const recs = personalRecords([sess(1, [x('waden', 'Wadenheben', [{ w: 80, r: 15 }])])]);
  assert.equal(bestSummary(recs.get('waden|Wadenheben')).text, '80 kg');
});

test('Bestwert ohne Gewicht und auf Zeit', () => {
  const recs = personalRecords([
    sess(1, [x('latzug', 'Klimmzüge', [{ w: 0, r: 9 }, { w: 0, r: 11 }]), x('plank', 'Plank', [{ w: 0, r: 45 }, { w: 0, r: 60 }], 'sec')]),
  ]);
  assert.equal(bestSummary(recs.get('latzug|Klimmzüge')).text, '11 Wdh.');
  assert.equal(bestSummary(recs.get('plank|Plank')).text, '60 s');
});

test('Kein Bestwert: nur Aufwärm- oder Dropsätze, oder nie trainiert', () => {
  const recs = personalRecords([sess(1, [x('bank', 'Bankdrücken', [{ w: 40, r: 10, t: 'w' }]), x('fly', 'Kabel-Flys', [{ w: 20, r: 12, t: 'd' }])])]);
  assert.equal(recs.get('bank|Bankdrücken'), undefined);
  assert.equal(bestSummary(recs.get('fly|Kabel-Flys')), null);
  assert.equal(bestSummary(null), null);
  assert.equal(bestSummary(undefined), null);
});

test('Dieselbe Übung unter zwei Schlüsseln (zwei Pläne): höchster Wert je Kennzahl', () => {
  const recs = personalRecords([
    sess(1, [x('squat', 'Kniebeugen', [{ w: 100, r: 8 }])]),
    sess(2, [x('g1', 'Kniebeugen', [{ w: 110, r: 3 }])]),
  ]);
  const m = mergeRecords([recs.get('squat|Kniebeugen'), recs.get('g1|Kniebeugen')]);
  assert.equal(m.weight.value, 110);
  assert.equal(m.weight.date, 2);
  assert.equal(Math.round(m.e1rm.value * 10) / 10, 126.7);  // 100 × (1 + 8/30) schlägt 110 × 1,1
  assert.equal(m.e1rm.date, 1);
  assert.equal(m.count, 2);
  assert.equal(mergeRecords([]), null);
  assert.equal(mergeRecords([null, undefined]), null);
  assert.equal(bestSummary(m).text, '110 kg · 1RM 126,7 kg');
});
