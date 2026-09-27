import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekStreakWithJokers, weekHistoryWithJokers, longestStreak, trainingWeeks, weekStart } from '../js/domain/streaks.js';
import { weeklyGoals, weekDays, evaluateGoal, weightGoalStatus, syncGoals, bestWeight } from '../js/domain/motivation.js';
import { BADGES, badgeContext, syncBadges, hadRecord, totalTonnage, longestWaterRun, bestProteinWeek } from '../js/domain/badges.js';
import { defaultState } from '../js/store/migrate.js';

const at = s => new Date(s).getTime();
/* Einheiten an Tagen, je eine pro Eintrag */
const sess = (...days) => days.map((d, i) => ({ id: 's' + i, startedAt: at(d + 'T18:00'), ex: [] }));
/* Drei Einheiten in der Woche ab Montag d (Mo, Mi, Fr) */
const week3 = monday => {
  const m = new Date(monday + 'T18:00');
  return [0, 2, 4].map(o => { const d = new Date(m); d.setDate(m.getDate() + o); return d.toISOString().slice(0, 10); });
};
const lift = (day, w, r = 8, n = 3) => ({
  id: 'l' + day + w, startedAt: at(day + 'T18:00'), endedAt: at(day + 'T19:00'),
  ex: [{ exId: 'bank', name: 'Bankdrücken', unit: 'reps', sets: Array.from({ length: n }, () => ({ w, r, rir: 2 })) }],
});

/* ---------- Joker ---------- */
test('Joker überbrückt eine verpasste Woche, die aber nicht mitzählt', () => {
  // Wochen ab 31.8. erfüllt, 7.9. verpasst, 14.9. erfüllt; laufende Woche ab 21.9. mit 2 von 3
  const s = sess(...week3('2026-08-31'), ...week3('2026-09-14'), '2026-09-21', '2026-09-23');
  const r = weekStreakWithJokers(s, 3, at('2026-09-24T12:00'));
  assert.equal(r.weeks, 2);
  assert.deepEqual(r.bridged, [weekStart(at('2026-09-07T12:00'))]);
  assert.equal(r.jokerFree, false, 'der Joker für September ist verbraucht');
  const h = weekHistoryWithJokers(s, 3, at('2026-09-24T12:00'), 4);
  assert.deepEqual(h.map(w => [w.met, w.bridged]), [[true, false], [false, true], [true, false], [false, false]]);
});

test('Zwei verpasste Wochen im selben Monat beenden die Serie', () => {
  const s = sess(...week3('2026-08-31'), '2026-09-22');
  const r = weekStreakWithJokers(s, 3, at('2026-09-24T12:00'));
  assert.equal(r.weeks, 0);
  assert.deepEqual(r.bridged, [], 'ein Joker ohne erfüllte Woche davor verbraucht nichts');
  assert.equal(r.jokerFree, true);
});

test('Verpasste Wochen in zwei Monaten nutzen zwei Joker', () => {
  // 24.8. erfüllt, 31.8. (August) verpasst, 7.9. (September) verpasst, 14.9. erfüllt
  const s = sess(...week3('2026-08-24'), ...week3('2026-09-14'));
  const r = weekStreakWithJokers(s, 3, at('2026-09-17T12:00'));
  assert.equal(r.weeks, 1 + 1, 'laufende Woche erfüllt plus 24.8.');
  assert.equal(r.bridged.length, 2);
});

test('Die laufende Woche braucht keinen Joker und zählt, sobald sie erfüllt ist', () => {
  const s = sess(...week3('2026-09-14'), ...week3('2026-09-21'));
  assert.equal(weekStreakWithJokers(s, 3, at('2026-09-26T12:00')).weeks, 2);
  assert.equal(weekStreakWithJokers(sess(...week3('2026-09-14')), 3, at('2026-09-22T12:00')).weeks, 1);
  assert.deepEqual(weekStreakWithJokers([], 3, at('2026-09-22T12:00')), { weeks: 0, thisWeek: 0, target: 3, bridged: [], jokerFree: true });
});

test('Joker am Anfang einer Kette zählt nicht', () => {
  // erste Woche ab 31.8. nur eine Einheit, 7.9. erfüllt, 14.9. verpasst, laufende Woche leer
  const s = sess('2026-09-01', ...week3('2026-09-07'));
  const r = weekStreakWithJokers(s, 3, at('2026-09-23T12:00'));
  assert.equal(r.weeks, 1);
  assert.deepEqual(r.bridged, [weekStart(at('2026-09-14T12:00'))]);
});

test('Längste Serie mit Joker, Trainingswochen', () => {
  const s = sess(...week3('2026-08-03'), ...week3('2026-08-10'), ...week3('2026-08-24'), ...week3('2026-08-31'));
  assert.equal(longestStreak(s, 3, at('2026-09-02T12:00')), 4, '17.8. vom August-Joker überbrückt');
  const t = sess(...week3('2026-08-03'), ...week3('2026-08-24'), ...week3('2026-08-31'));
  assert.equal(longestStreak(t, 3, at('2026-09-02T12:00')), 2, 'zwei Lücken im August beenden die Serie');
  assert.equal(trainingWeeks(t), 3);
  assert.equal(longestStreak([], 3), 0);
});

/* ---------- Wochenziele ---------- */
test('Wochenziele zählen Tage der laufenden Woche', () => {
  const now = at('2026-09-24T12:00');
  assert.deepEqual(weekDays(now), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
  const p = g => ({ grams: 100, per100: { kcal: 0, protein: g, fat: 0, carbs: 0 } });
  const r = weeklyGoals({
    sessions: sess('2026-09-21', '2026-09-23', '2026-09-23', '2026-09-18'),
    log: { '2026-09-21': [p(160)], '2026-09-22': [p(100)], '2026-09-20': [p(200)] },
    water: { '2026-09-21': 3000, '2026-09-22': 2500, '2026-09-20': 3000 },
    proteinTarget: 150, waterTarget: 2800, daysPerWeek: 3, weekly: { proteinDays: 4, waterDays: 6 }, now,
  });
  assert.deepEqual(r.training, { done: 2, target: 3 });
  assert.equal(r.protein.done, 1);
  assert.equal(r.protein.target, 4);
  assert.equal(r.protein.available, true);
  assert.equal(r.water.done, 1);
  assert.equal(r.water.target, 6);
  assert.equal(r.daysLeft, 4);
  assert.equal(weeklyGoals({ proteinTarget: null, now }).protein.available, false);
});

/* ---------- Ziele ---------- */
test('Kraftziel aus dem besten Gewicht, egal unter welcher id', () => {
  const s = [lift('2026-09-01', 80), lift('2026-09-08', 90)];
  s[1].ex[0].exId = 'x-andere-id';
  assert.equal(bestWeight(s, 'Bankdrücken'), 90);
  const g = { kind: 'lift', ref: 'Bankdrücken', target: 100 };
  const ev = evaluateGoal(g, { sessions: s });
  assert.equal(ev.pct, 0.9);
  assert.equal(ev.reached, false);
  assert.match(ev.text, /Bestwert 90 kg von 100 kg/);
  assert.equal(evaluateGoal(g, { sessions: [] }).text, 'Noch kein Satz Bankdrücken eingetragen');
});

test('Dabeibleiben und eigenes Ziel', () => {
  const s = sess('2026-09-01', '2026-09-02', '2026-09-08', '2026-09-22');
  const ev = evaluateGoal({ kind: 'weeks', target: 12 }, { sessions: s });
  assert.equal(ev.pct, 3 / 12);
  assert.equal(evaluateGoal({ kind: 'custom' }, {}).reached, false);
  assert.equal(evaluateGoal({ kind: 'custom', doneAt: 1 }, {}).pct, 1);
});

test('Zielgewicht aus dem Profil', () => {
  const w = [{ date: '2026-09-01', kg: 90 }, { date: '2026-09-20', kg: 87 }];
  const st = weightGoalStatus({ targetWeightKg: 85 }, w);
  assert.equal(Math.round(st.pct * 100), 60);
  assert.equal(st.reached, false);
  assert.match(st.text, /noch 2 kg/);
  assert.equal(weightGoalStatus({ targetWeightKg: null }, w), null);
  assert.equal(weightGoalStatus({ targetWeightKg: 85 }, []).pct, 0);
});

test('Erreichte Ziele bekommen einmal ein Datum', () => {
  const S = defaultState();
  S.sessions = [lift('2026-09-01', 100)];
  S.motivation.goals = [
    { id: 'a', kind: 'lift', ref: 'Bankdrücken', target: 100, title: 'Bank 100', doneAt: null },
    { id: 'b', kind: 'weeks', target: 2, title: '2 Wochen', doneAt: null },
    { id: 'c', kind: 'custom', title: 'Selbst', doneAt: null },
  ];
  const done = syncGoals(S, 123);
  assert.deepEqual(done.map(g => g.id), ['a']);
  assert.equal(S.motivation.goals[0].doneAt, 123);
  assert.deepEqual(syncGoals(S, 456), []);
  assert.equal(S.motivation.goals[0].doneAt, 123, 'bleibt beim ersten Datum');
});

/* ---------- Abzeichen ---------- */
const base = () => {
  const S = defaultState();
  S.profile = { ...S.profile, name: 'A', age: 30, heightCm: 180, sex: 'm', weightKg: 80, activity: 'light', goal: 'recomp' };
  S.body.weights = [{ date: '2026-09-01', kg: 80, source: 'manual' }];
  return S;
};
const now = at('2026-09-27T12:00');
const earned = S => new Set(BADGES.filter(b => b.check(badgeContext(S, now))).map(b => b.id));
const days = (start, n) => Array.from({ length: n }, (_, i) => {
  const d = new Date(start + 'T12:00'); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10);
});

test('Es gibt etwa 15 Abzeichen mit eindeutigen ids', () => {
  assert.ok(BADGES.length >= 15);
  assert.equal(new Set(BADGES.map(b => b.id)).size, BADGES.length);
  BADGES.forEach(b => assert.ok(b.title && b.desc && b.label && b.color, b.id));
});

test('Leerer Stand verdient nichts', () => {
  assert.equal(earned(base()).size, 0);
});

test('Einheiten-Abzeichen', () => {
  const S = base();
  S.sessions = Array.from({ length: 10 }, (_, i) => lift(`2026-0${1 + Math.floor(i / 5)}-1${i % 5}`, 50));
  const e = earned(S);
  assert.ok(e.has('first-session') && e.has('sessions-10'));
  assert.ok(!e.has('sessions-50'));
  S.sessions = Array.from({ length: 100 }, (_, i) => ({ ...lift('2026-01-01', 0), startedAt: at('2026-01-01T10:00') + i * 864e5 * 2 }));
  const f = earned(S);
  assert.ok(f.has('sessions-50') && f.has('sessions-100'));
});

test('Erster Rekord erst, wenn eine frühere Einheit übertroffen wird', () => {
  assert.equal(hadRecord([lift('2026-09-01', 80)]), false);
  assert.equal(hadRecord([lift('2026-09-01', 80), lift('2026-09-08', 80)]), false);
  assert.equal(hadRecord([lift('2026-09-08', 82.5), lift('2026-09-01', 80)]), true, 'Reihenfolge nach Datum');
  const S = base();
  S.sessions = [lift('2026-09-01', 80), lift('2026-09-08', 82.5)];
  assert.ok(earned(S).has('first-pr'));
});

test('Serien- und Dabeibleiben-Abzeichen', () => {
  const S = base();
  const mondays = days('2026-06-08', 84).filter((_, i) => i % 7 === 0);
  S.sessions = sess(...mondays.slice(0, 4).flatMap(week3));
  let e = earned(S);
  assert.ok(e.has('streak-4') && !e.has('streak-12') && !e.has('weeks-12'));
  S.sessions = sess(...mondays.flatMap(week3));
  e = earned(S);
  assert.ok(e.has('streak-12') && e.has('weeks-12'));
  S.sessions = sess(...mondays);
  e = earned(S);
  assert.ok(e.has('weeks-12') && !e.has('streak-4'), 'eine Einheit pro Woche reicht für „dabei“, nicht für die Serie');
});

test('Ernährung, Wasser und Protein', () => {
  const S = base();
  const entry = g => ({ meal: 'lunch', grams: 100, per100: { kcal: 400, protein: g, fat: 10, carbs: 30 } });
  days('2026-08-01', 29).forEach(d => { S.nutrition.log[d] = [entry(20)]; });
  assert.ok(!earned(S).has('nutrition-30'));
  S.nutrition.log['2026-08-30'] = [entry(20)];
  assert.ok(earned(S).has('nutrition-30'));
  // Proteinziel 160 g (2 g × 80 kg): fünf Tage einer Woche
  days('2026-09-21', 5).forEach(d => { S.nutrition.log[d] = [entry(170)]; });
  assert.equal(bestProteinWeek(S.nutrition.log, 160), 5);
  assert.ok(earned(S).has('protein-week'));
  // Wasserziel 2,8 l: sechs Tage, eine Lücke, dann sieben am Stück
  days('2026-09-01', 6).forEach(d => { S.water[d] = 3000; });
  assert.equal(longestWaterRun(S.water, 2800), 6);
  assert.ok(!earned(S).has('water-7'));
  days('2026-09-10', 7).forEach(d => { S.water[d] = 2800; });
  assert.ok(earned(S).has('water-7'));
});

test('Körper-Abzeichen', () => {
  const S = base();
  S.body.photos = [{ id: 'p1', date: '2026-09-01', pose: 'front' }];
  S.body.measurements = [{ date: '2026-09-01', waist: 85 }];
  let e = earned(S);
  assert.ok(e.has('first-photo') && e.has('first-measure') && !e.has('target-weight'));
  S.profile.targetWeightKg = 85;
  S.body.weights = [{ date: '2026-09-01', kg: 90 }, { date: '2026-09-20', kg: 85.1 }];
  assert.ok(earned(S).has('target-weight'));
  S.body.weights = [{ date: '2026-09-01', kg: 85 }];
  assert.ok(!earned(S).has('target-weight'), 'schon beim Start am Ziel zählt nicht');
});

test('Tonnen, eigener Plan, Rezept', () => {
  const S = base();
  S.sessions = [lift('2026-09-01', 100, 10, 9)];
  assert.equal(totalTonnage(S.sessions), 9000);
  assert.ok(!earned(S).has('tons-10'));
  S.sessions.push(lift('2026-09-03', 100, 10, 1));
  assert.ok(earned(S).has('tons-10'));
  S.plans.push({ id: 'x1', name: 'Ganzkörper', order: [], days: {} });
  S.nutrition.recipes.push({ id: 'r1', name: 'Porridge', portions: 1, items: [] });
  const e = earned(S);
  assert.ok(e.has('own-plan') && e.has('first-recipe'));
});

test('syncBadges merkt das erste Datum und ist idempotent', () => {
  const S = base();
  S.sessions = [lift('2026-09-01', 80)];
  const first = syncBadges(S, 111);
  assert.deepEqual(first.map(b => b.id), ['first-session']);
  assert.deepEqual(syncBadges(S, 222), []);
  assert.equal(S.motivation.badges['first-session'], 111);
  S.sessions = [];
  assert.deepEqual(syncBadges(S, 333), []);
  assert.equal(S.motivation.badges['first-session'], 111, 'verdient bleibt verdient');
});
