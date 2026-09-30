import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setType, nextType, isWarmup, isTop, workSets, topSets, tonnage, setLabels, setName, cleanSet, typePrefix,
} from '../js/domain/settypes.js';
import { exerciseStats, personalRecords, exerciseSeries, setRecords, sessionRecords } from '../js/domain/prs.js';
import { suggest, lastLog } from '../js/domain/progression.js';
import { weekMuscleSets } from '../js/domain/volume.js';
import { weekStart } from '../js/domain/streaks.js';
import { weeklyReport, weekRecords } from '../js/domain/report.js';
import { totalTonnage, firstRecordAt } from '../js/domain/badges.js';
import { dailyLoad } from '../js/domain/recovery.js';
import { missedTarget } from '../js/coach/training.js';
import { rampSets, warmupRamp } from '../js/domain/warmup.js';
import { normalize, defaultState, toBackup, fromBackup } from '../js/store/migrate.js';
import { dayNumber } from '../js/domain/body.js';

const at = (d, h = 18) => new Date(`${d}T${String(h).padStart(2, '0')}:00`).getTime();
const W = (w, r) => ({ w, r, rir: 2, t: 'w' });
const D = (w, r) => ({ w, r, rir: 0, t: 'd' });
const F = (w, r) => ({ w, r, rir: 0, t: 'f' });
const N = (w, r, rir = 2) => ({ w, r, rir });
const bank = sets => ({ exId: 'bank', name: 'Bankdrücken', unit: 'reps', sets });
const sess = (t, ex) => ({ startedAt: t, endedAt: t + 36e5, ex });

/* ---------- Grundlagen ---------- */
test('Satztyp: fehlend oder unbekannt heißt normal', () => {
  assert.equal(setType({ w: 1, r: 1 }), null);
  assert.equal(setType({ t: 'x' }), null);
  assert.equal(setType(W(20, 10)), 'w');
  assert.equal(setType(null), null);
  assert.equal(isWarmup(W(20, 10)), true);
  assert.equal(isTop(F(80, 8)), true);
  assert.equal(isTop(D(60, 10)), false);
  assert.equal(isTop(N(80, 8)), true);
});

test('Tippen wechselt normal, Aufwärmen, Drop, Versagen, wieder normal', () => {
  const seen = [];
  let t = null;
  for (let k = 0; k < 5; k++) { seen.push(t); t = nextType(t); }
  assert.deepEqual(seen, [null, 'w', 'd', 'f', null]);
  assert.equal(nextType('unsinn'), 'w');
});

test('Anzeige: A, D, V statt Nummer, normale Sätze zählen nur unter sich', () => {
  assert.deepEqual(setLabels([W(20, 10), W(40, 5), N(80, 8), N(80, 8), D(60, 10), F(80, 6), N(80, 7)]),
    ['A', 'A', '1', '2', 'D', 'V', '3']);
  assert.deepEqual(setLabels([N(1, 1), N(1, 1)]), ['1', '2']);
  assert.equal(setName([W(20, 10), N(80, 8)], 1), 'Satz 1');
  assert.equal(setName([W(20, 10), N(80, 8)], 0), 'Aufwärmsatz');
  assert.equal(typePrefix(D(60, 10)), 'D ');
  assert.equal(typePrefix(N(60, 10)), '');
});

test('Arbeitssätze ohne Aufwärmen, Rekordsätze ohne Aufwärmen und Drop, Volumen mit Drop', () => {
  const sets = [W(40, 10), N(80, 8), D(60, 10), F(80, 6)];
  assert.equal(workSets(sets).length, 3);
  assert.deepEqual(topSets(sets), [N(80, 8), F(80, 6)]);
  assert.equal(tonnage(sets), 640 + 600 + 480);
  assert.equal(tonnage(undefined), 0);
  assert.deepEqual(workSets(undefined), []);
});

test('cleanSet verwirft nur unbekannte Typen und lässt alte Sätze, wie sie sind', () => {
  const old = { w: 80, r: 8, rir: 2 };
  assert.equal(cleanSet(old), old);
  const ok = D(60, 10);
  assert.equal(cleanSet(ok), ok);
  assert.deepEqual(cleanSet({ w: 80, r: 8, rir: 2, t: 'z' }), old);
  assert.deepEqual(cleanSet({ w: 80, r: 8, rir: 2, t: null }), old);
});

/* ---------- Rekorde ---------- */
test('Kennzahlen: Aufwärmen zählt nie, Drop nur beim Volumen', () => {
  const s = exerciseStats([W(100, 1), N(80, 8), D(70, 12), F(82.5, 5)]);
  assert.equal(s.weight, 82.5);                       // die schwere Aufwärm-Single zählt nicht
  assert.equal(Math.round(s.e1rm * 10) / 10, 101.3);  // aus 80 × 8, nicht aus 100 × 1
  assert.equal(s.volume, 640 + 840 + 412.5);          // ohne Aufwärmen, mit Drop
  const bw = exerciseStats([N(0, 8), D(0, 20)]);
  assert.equal(bw.reps, 8);                            // der Dropsatz ohne Gewicht bringt keinen Wdh.-Rekord
  const plank = exerciseStats([W(0, 90), N(0, 45)], 'sec');
  assert.equal(plank.time, 45);
});

test('Bestwerte: reine Aufwärm-Einheit zählt nicht als Training der Übung', () => {
  const recs = personalRecords([
    sess(1, [bank([N(80, 8)])]),
    sess(2, [bank([W(90, 3)])]),
  ]);
  const b = recs.get('bank|Bankdrücken');
  assert.equal(b.count, 1);
  assert.deepEqual(b.weight, { value: 80, date: 1 });
  assert.equal(exerciseSeries([sess(1, [bank([N(80, 8)])]), sess(2, [bank([W(90, 3)])])], 'bank', 'Bankdrücken').length, 1);
});

test('Satz-Rekord beim Abhaken: nie bei Aufwärm- oder Dropsatz', () => {
  const prior = personalRecords([sess(1, [bank([N(80, 8)])])]).get('bank|Bankdrücken');
  assert.deepEqual(setRecords(prior, [], W(85, 5)), []);
  assert.deepEqual(setRecords(prior, [], D(85, 5)), []);
  assert.deepEqual(setRecords(prior, [], F(85, 5)).map(r => r.kind), ['weight']);
  /* Ein schwerer Aufwärmsatz vorher in dieser Einheit verhindert den Rekord nicht */
  assert.deepEqual(setRecords(prior, [{ w: 90, r: 2, t: 'w' }], { w: 85, r: 5 }).map(r => r.kind), ['weight']);
  assert.deepEqual(setRecords(prior, [{ w: 90, r: 2 }], { w: 85, r: 5 }), []);
});

test('Rekorde der Einheit und der Woche ignorieren Aufwärm- und Dropsätze beim Gewicht', () => {
  const before = [sess(at('2026-09-14'), [bank([N(80, 8), N(80, 8)])])];
  const today = [bank([W(100, 1), N(80, 8), D(60, 10)])];
  const items = sessionRecords(before, today);
  /* Kein Gewichts-Rekord durch die Aufwärm-Single; Volumen 640 + 600 = 1240 schlägt 1280 nicht */
  assert.deepEqual(items, []);
  const withDrop = [bank([N(80, 8), N(80, 8), D(60, 10)])];
  assert.deepEqual(sessionRecords(before, withDrop).map(r => r.items.map(i => i.kind)), [['volume']]);
  const all = [...before, sess(at('2026-09-22'), today)];
  assert.deepEqual(weekRecords(all, at('2026-09-21', 0), at('2026-09-28', 0)), []);
  assert.equal(firstRecordAt(all), null);
});

/* ---------- Progression ---------- */
const benchPlan = { id: 'bank', sets: 3, repMin: 6, repMax: 8, inc: 2.5, unit: 'reps' };
const pSess = sets => ({ startedAt: 1, ex: [bank(sets)] });

test('Doppelprogression: Aufwärmsätze vorn blockieren die Steigerung nicht', () => {
  const s = suggest([pSess([W(20, 10), W(40, 5), N(80, 8), N(80, 8), N(80, 8)])], benchPlan, 'Bankdrücken');
  assert.equal(s.kind, 'up');
  assert.equal(s.weight, 82.5);
});

test('Doppelprogression: Dropsätze zählen weder als Satz noch beim Gewicht', () => {
  /* Zwei normale Sätze plus ein Drop reichen nicht für drei Sätze am oberen Ende */
  assert.equal(suggest([pSess([N(80, 8), N(80, 8), D(60, 12)])], benchPlan, 'Bankdrücken').kind, 'hold');
  /* Ein Dropsatz mit wenig Wiederholungen bremst nicht */
  const up = suggest([pSess([N(80, 8), N(80, 8), N(80, 8), D(60, 5)])], benchPlan, 'Bankdrücken');
  assert.equal(up.kind, 'up');
  assert.equal(up.weight, 82.5);
});

test('Doppelprogression: Versagenssätze zählen normal', () => {
  const s = suggest([pSess([N(80, 8), N(80, 8), { w: 80, r: 8, rir: 1, t: 'f' }])], benchPlan, 'Bankdrücken');
  assert.equal(s.kind, 'up');
});

test('Letzte Einheit: reine Aufwärm-Einheit wird übersprungen', () => {
  const sessions = [pSess([N(80, 8), N(80, 8), N(80, 8)]), pSess([W(40, 10)])];
  assert.equal(suggest(sessions, benchPlan, 'Bankdrücken').weight, 82.5);
  assert.deepEqual(lastLog(sessions, 'bank', 'Bankdrücken').sets.length, 3);
});

test('Deload-Regel: Aufwärm- und Dropsätze zählen nicht als geplante Sätze', () => {
  const e = { sets: 3, repMin: 6 };
  assert.equal(missedTarget([W(40, 3), N(80, 6), N(80, 6), N(80, 6), D(60, 4)], e), false);
  assert.equal(missedTarget([W(40, 10), N(80, 6), N(80, 6), D(60, 10)], e), true);
});

/* ---------- Volumen, Bericht, Abzeichen, Belastung ---------- */
test('Muskelvolumen: Aufwärmsätze zählen nicht, Dropsätze schon', () => {
  const resolve = n => (n === 'Bankdrücken' ? { muscles: { primary: ['chest'], secondary: ['triceps'] } } : null);
  const w = weekMuscleSets([sess(at('2026-09-22'), [bank([W(40, 10), W(60, 5), N(80, 8), N(80, 8), D(60, 10)])])],
    weekStart(at('2026-09-22')), resolve);
  assert.equal(w.sets.chest, 3);
  assert.equal(w.sets.triceps, 1.5);
  assert.equal(w.total, 3);
});

test('Wochenbericht: harte Sätze und bewegtes Gewicht ohne Aufwärmen', () => {
  const S = {
    profile: { daysPerWeek: 3 },
    sessions: [sess(at('2026-09-22'), [bank([W(40, 10), N(80, 8), D(60, 10)])])],
    body: { weights: [] }, nutrition: { log: {} },
  };
  const r = weeklyReport(S, at('2026-09-21', 0));
  assert.equal(r.training.sets, 2);
  assert.equal(r.training.tonnage, 640 + 600);
});

test('Abzeichen-Tonnage und Belastung der Erholungsampel ohne Aufwärmsätze', () => {
  const s = [sess(at('2026-09-22'), [bank([W(40, 10), W(60, 5), N(80, 8), D(60, 10)])])];
  assert.equal(totalTonnage(s), 640 + 600);
  assert.equal(dailyLoad(s, []).get(dayNumber('2026-09-22')), 2);
});

/* ---------- Aufwärmrampe übernehmen ---------- */
test('Rampe als Aufwärmsätze: Typ A, Werte als graue Vorschläge', () => {
  const ramp = warmupRamp(82.5, { barKg: 20 });
  const log = rampSets(ramp);
  assert.equal(log.length, ramp.length);
  assert.ok(log.every(s => s.t === 'w' && s.done === false && s.w === '' && s.r === ''));
  assert.deepEqual(log.map(s => [s.pw, s.pr]), ramp.map(s => [String(s.kg).replace('.', ','), String(s.reps)]));
  assert.deepEqual(setLabels([...log, N(82.5, 8)]).slice(-2), ['A', '1']);
});

/* ---------- Speicher und Backup ---------- */
test('normalize: alte Stände ohne Satztyp und Supersatz bleiben unverändert', () => {
  const s = defaultState();
  s.sessions = [{ id: 'a', startedAt: 1, endedAt: 2, ex: [bank([N(80, 8), N(80, 7)])] }];
  const before = JSON.parse(JSON.stringify(s));
  const n = normalize(s);
  assert.deepEqual(n.sessions, before.sessions);
  assert.deepEqual(n.plans, before.plans);
  assert.equal(n.active, null);
  assert.deepEqual(s, before);   // Eingabe nicht verändert
  assert.ok(n.plans.every(p => p.order.every(o => p.days[o].exercises.every(e => !('ss' in e)))));
});

test('normalize: gültige Typen und Supersätze bleiben, unbekannte Werte fallen weg', () => {
  const s = defaultState();
  const ex = s.plans[0].days.push.exercises;
  ex[0].ss = true;
  ex[1].ss = 'ja';
  ex[ex.length - 1].ss = true;   // an der letzten Übung ohne Bedeutung
  s.sessions = [{ id: 'a', startedAt: 1, endedAt: 2, ex: [bank([W(40, 10), N(80, 8), { w: 80, r: 8, t: 'q' }, D(60, 10), F(80, 6)])] }];
  s.active = { dayId: 'push', startedAt: 5, ex: [
    { exId: 'a', name: 'A', ss: true, log: [{ w: '', r: '', t: 'w', done: false }, { w: '', r: '', t: 7, done: false }] },
    { exId: 'b', name: 'B', ss: true, log: [] },
  ] };
  const n = normalize(JSON.parse(JSON.stringify(s)));
  const nx = n.plans[0].days.push.exercises;
  assert.equal(nx[0].ss, true);
  assert.equal('ss' in nx[1], false);
  assert.equal('ss' in nx[nx.length - 1], false);
  assert.deepEqual(n.sessions[0].ex[0].sets.map(x => x.t), ['w', undefined, undefined, 'd', 'f']);
  assert.equal('t' in n.sessions[0].ex[0].sets[2], false);
  assert.equal(n.active.ex[0].ss, true);
  assert.equal('ss' in n.active.ex[1], false);
  assert.deepEqual(n.active.ex[0].log.map(x => x.t), ['w', undefined]);
});

test('Backup behält Satztypen und Supersätze', () => {
  const s = defaultState();
  s.plans[0].days.pull.exercises[1].ss = true;
  s.sessions = [{ id: 'a', startedAt: 1, endedAt: 2, ex: [bank([W(40, 10), N(80, 8), D(60, 10), F(80, 6)])] }];
  const back = fromBackup(JSON.parse(JSON.stringify(toBackup(s))));
  assert.equal(back.plans[0].days.pull.exercises[1].ss, true);
  assert.deepEqual(back.sessions[0].ex[0].sets, s.sessions[0].ex[0].sets);
  /* Backup ohne die neuen Felder: kommt unverändert an */
  const old = defaultState();
  old.sessions = [{ id: 'b', startedAt: 1, endedAt: 2, ex: [bank([N(80, 8)])] }];
  const b2 = fromBackup(JSON.parse(JSON.stringify(toBackup(old))));
  assert.deepEqual(b2.sessions, old.sessions);
  assert.deepEqual(b2.plans, old.plans);
});
