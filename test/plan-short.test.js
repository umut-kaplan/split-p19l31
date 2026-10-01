/* 4.7: Kurzversion im Schichtplaner (Q30a) */
process.env.TZ = 'Europe/Berlin';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTrainings, sessionMinutes, shortMinutes, PLAN_RULES, SHORT_CARD } from '../js/domain/shift-plan.js';
import { defaultShifts } from '../js/domain/shifts.js';
import { defaultState } from '../js/store/migrate.js';
import { LEGACY_SPLIT, DEFAULT_PLAN } from '../js/plans.js';
import { findKnowledge } from '../js/data/knowledge.js';

/* Spätschicht ab 08:15: Ende 90 Minuten vorher, also nur 06:00 bis 06:45 frei */
function state(pattern, perWeek = 2, plan = LEGACY_SPLIT) {
  const s = defaultState();
  s.plans = [JSON.parse(JSON.stringify(plan))];
  s.profile.daysPerWeek = perWeek;
  s.shifts = defaultShifts();
  s.shifts.times = { ...s.shifts.times, S: ['08:15', '16:15'] };
  s.shifts.pattern = { start: '2026-10-05', days: [...pattern], template: null };
  return s;
}

test('Dauer der Kurzversion', () => {
  const push = LEGACY_SPLIT.days.push;
  assert.equal(sessionMinutes(push), 75);
  assert.equal(shortMinutes(push), 35);
  assert.equal(shortMinutes({ exercises: [] }), null);
  /* Supersatz im neuen Split zählt ohne Pause dazwischen */
  assert.equal(sessionMinutes(DEFAULT_PLAN.days.legs), 60);
});

test('Fenster zu klein für die ganze Einheit: Kurzversion mit Hinweis und Wissen-Karte', () => {
  const r = planTrainings(state('SSSSSSS'), '2026-10-05', 7);
  assert.equal(r.trainings.length, 2);
  r.trainings.forEach(t => {
    assert.equal(t.shortVersion, true);
    assert.equal(t.minutes, 35);
    assert.equal(t.time, '06:00');
    assert.equal(t.end, '06:35');
    assert.equal(t.hints[0].id, 'short');
    assert.equal(t.hints[0].short, 'Kurzversion');
    assert.match(t.hints[0].text, /^Kurzversion: die ersten 4 Übungen mit je 2 Sätzen, etwa 35 Minuten\. Für die ganze Einheit \(\d+ Minuten\) reicht das Zeitfenster nicht\.$/);
  });
  assert.equal(r.trainings[0].name, 'Push');
  assert.ok(findKnowledge(SHORT_CARD), 'Warum?-Karte existiert');
  assert.equal(r.weeks[0].short, false, 'Wochenziel erreicht');
});

test('Passt die ganze Einheit, plant die App sie ganz; ein Tag mit voller Einheit geht vor', () => {
  /* Ein freier Tag am Sonntag: dort passt alles */
  const r = planTrainings(state('SSSSSS-', 1), '2026-10-05', 7);
  assert.equal(r.trainings.length, 1);
  assert.equal(r.trainings[0].date, '2026-10-11');
  assert.equal(r.trainings[0].shortVersion, false);
  assert.ok(!r.trainings[0].hints.some(h => h.id === 'short'));
  /* Zwei Trainings: eins voll am Sonntag, eins kurz unter der Woche, statt keins */
  const two = planTrainings(state('SSSSSS-', 2), '2026-10-05', 7);
  assert.equal(two.trainings.length, 2);
  assert.deepEqual(two.trainings.map(t => t.shortVersion), [true, false]);
  assert.equal(PLAN_RULES.shortRank, 1.5);
});

test('Ohne Kurzversion (kurzer Tag) bleibt der Tag frei', () => {
  const tiny = { id: 'x', name: 'X', order: ['a'], days: { a: { id: 'a', name: 'A', color: 'red', muscles: '', exercises: [
    { id: 'bank', names: ['Bankdrücken'], sets: 2, repMin: 6, repMax: 10, rest: 1200, inc: 2.5, unit: 'reps' }] } } };
  const r = planTrainings(state('SSSSSSS', 2, tiny), '2026-10-05', 7);
  assert.equal(r.trainings.length, 0);
});

test('Kurzversion in Worten aus der tatsächlichen Kurzversion (Knopf, Hinweis, Planer)', async () => {
  const { shortText } = await import('../js/domain/plan-stats.js');
  const ex = (sets, n) => Array.from({ length: n }, (_, i) => ({ id: 'e' + i, names: ['Ü' + i], sets, repMin: 8, repMax: 12, rest: 90, inc: 2.5, unit: 'reps' }));
  assert.equal(shortText(ex(3, 6)), '4 Übungen mit je 2 Sätzen');
  assert.equal(shortText(ex(3, 3)), '3 Übungen mit je 2 Sätzen');
  assert.equal(shortText([...ex(3, 2), { ...ex(1, 1)[0], id: 'x' }]), '3 Übungen mit bis zu 2 Sätzen');
  assert.equal(shortText(ex(4, 1)), '1 Übung mit 2 Sätzen');
  assert.equal(shortText(ex(1, 2)), '2 Übungen mit je 1 Satz');
  assert.equal(shortText(ex(3, 3), { first: true }), 'die ersten 3 Übungen mit je 2 Sätzen');
  assert.equal(shortText(ex(4, 1), { first: true }), 'die erste Übung mit 2 Sätzen');
});
