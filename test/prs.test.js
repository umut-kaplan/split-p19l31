import { test } from 'node:test';
import assert from 'node:assert/strict';
import { e1rm, exerciseStats, personalRecords, exerciseSeries, setRecords, sessionRecords, formatRecord } from '../js/domain/prs.js';

const sess = (t, ex) => ({ startedAt: t, ex });
const bank = sets => ({ exId: 'bank', name: 'Bankdrücken', unit: 'reps', sets });
const plank = sets => ({ exId: 'plank', name: 'Plank', unit: 'sec', sets });
const pull = sets => ({ exId: 'latzug', name: 'Klimmzüge', unit: 'reps', sets });

test('Epley: 1 bis 12 Wiederholungen', () => {
  assert.equal(Math.round(e1rm(100, 5) * 100) / 100, 116.67);
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(100, 12), 140);
  assert.equal(e1rm(100, 13), null);
  assert.equal(e1rm(0, 5), null);
});

test('Kennzahlen einer Einheit', () => {
  const s = exerciseStats([{ w: 80, r: 8 }, { w: 85, r: 5 }, { w: 60, r: 15 }]);
  assert.equal(s.weight, 85);
  assert.equal(Math.round(s.e1rm * 10) / 10, 101.3);  // 80 × (1 + 8/30) = 101,33 schlägt 85 × (1 + 5/30) = 99,17
  assert.equal(s.volume, 640 + 425 + 900);
  assert.equal(s.reps, null);
  assert.equal(exerciseStats([{ w: 0, r: 30 }, { w: 0, r: 45 }], 'sec').time, 45);
  assert.equal(exerciseStats([{ w: 0, r: 8 }, { w: 0, r: 10 }]).reps, 10);
});

test('Bestwerte über alle Einheiten', () => {
  const recs = personalRecords([
    sess(1, [bank([{ w: 80, r: 8 }]), plank([{ w: 0, r: 40 }])]),
    sess(2, [bank([{ w: 82.5, r: 6 }, { w: 82.5, r: 6 }]), plank([{ w: 0, r: 35 }])]),
    sess(3, [pull([{ w: 0, r: 7 }])]),
  ]);
  const b = recs.get('bank|Bankdrücken');
  assert.equal(b.count, 2);
  assert.deepEqual(b.weight, { value: 82.5, date: 2 });
  // 80 × (1 + 8/30) = 101,3 bleibt vorn, 82,5 × (1 + 6/30) = 99 schlägt es nicht
  assert.equal(b.e1rm.date, 1);
  assert.equal(Math.round(b.e1rm.value * 10) / 10, 101.3);
  assert.deepEqual(b.volume, { value: 990, date: 2 });
  assert.deepEqual(recs.get('plank|Plank').time, { value: 40, date: 1 });
  assert.equal(recs.get('plank|Plank').weight, null);
  assert.deepEqual(recs.get('latzug|Klimmzüge').reps, { value: 7, date: 3 });
  assert.equal(exerciseSeries([sess(1, [bank([{ w: 80, r: 8 }])]), sess(2, [])], 'bank', 'Bankdrücken').length, 1);
});

test('Satz-Rekord beim Abhaken', () => {
  const prior = personalRecords([sess(1, [bank([{ w: 80, r: 8 }])])]).get('bank|Bankdrücken');
  // erstes Training einer Übung ist kein Rekord
  assert.deepEqual(setRecords(undefined, [], { w: 100, r: 5 }), []);
  // mehr Gewicht und höherer 1RM
  assert.deepEqual(setRecords(prior, [], { w: 85, r: 6 }).map(x => x.kind), ['weight', 'e1rm']);
  // gleiches Gewicht ist kein Rekord, aber mehr Wiederholungen heben den 1RM
  assert.deepEqual(setRecords(prior, [], { w: 80, r: 9 }).map(x => x.kind), ['e1rm']);
  // muss auch die schon abgehakten Sätze dieser Einheit schlagen
  assert.deepEqual(setRecords(prior, [{ w: 85, r: 6 }], { w: 85, r: 5 }), []);
  assert.deepEqual(setRecords(prior, [{ w: 82.5, r: 6 }], { w: 85, r: 5 }).map(x => x.kind), ['weight']);
  // Sekunden und Körpergewicht
  const pl = personalRecords([sess(1, [plank([{ w: 0, r: 40 }])])]).get('plank|Plank');
  assert.deepEqual(setRecords(pl, [], { w: 0, r: 45 }, 'sec'), [{ kind: 'time', value: 45 }]);
  assert.deepEqual(setRecords(pl, [], { w: 0, r: 40 }, 'sec'), []);
  const pu = personalRecords([sess(1, [pull([{ w: 0, r: 7 }])])]).get('latzug|Klimmzüge');
  assert.deepEqual(setRecords(pu, [], { w: 0, r: 8 }), [{ kind: 'reps', value: 8 }]);
  // erstes Mal mit Zusatzgewicht: vorher kein Gewichtswert, also kein Rekord
  assert.deepEqual(setRecords(pu, [], { w: 5, r: 6 }), []);
});

test('Rekorde einer abgeschlossenen Einheit', () => {
  const prior = [sess(1, [bank([{ w: 80, r: 8 }, { w: 80, r: 8 }])])];
  // Volumen vorher 2 × 80 × 8 = 1280, jetzt 2 × 82,5 × 8 = 1320
  const r = sessionRecords(prior, [bank([{ w: 82.5, r: 8 }, { w: 82.5, r: 8 }]), plank([{ w: 0, r: 60 }])]);
  assert.equal(r.length, 1);  // Plank ist das erste Mal
  assert.deepEqual(r[0].items.map(i => i.kind), ['weight', 'e1rm', 'volume']);
  assert.deepEqual(sessionRecords(prior, [bank([{ w: 70, r: 8 }])]), []);
});

test('Anzeige der Rekorde', () => {
  assert.equal(formatRecord('weight', 82.5), '82,5 kg');
  assert.equal(formatRecord('e1rm', 101.333), '101,3 kg');
  assert.equal(formatRecord('volume', 2640), '2.640 kg');
  assert.equal(formatRecord('time', 45), '45 s');
  assert.equal(formatRecord('reps', 8), '8 Wdh.');
});
