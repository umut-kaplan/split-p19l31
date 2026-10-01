import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mealForTime, clockMeal, inOvernightShift, lastAmounts, quickFoods, lastMeal } from '../js/domain/food-quick.js';

const at = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const N = { cat: 'night', times: ['22:00', '06:00'] };
const F = { cat: 'early', times: ['06:00', '14:00'] };
const S = { cat: 'late', times: ['14:00', '22:00'] };
const X = { cat: 'h24', times: ['07:00', '07:00'] };
const FREE = { cat: 'off', times: null };

test('Ohne Schichtplan entscheidet die Uhr', () => {
  const cases = { '05:00': 'breakfast', '07:30': 'breakfast', '10:29': 'breakfast', '10:30': 'lunch', '14:59': 'lunch', '15:00': 'snack',
    '17:29': 'snack', '17:30': 'dinner', '21:59': 'dinner', '22:00': 'snack', '00:30': 'snack', '04:59': 'snack' };
  Object.entries(cases).forEach(([t, meal]) => {
    assert.equal(mealForTime(at(t)), meal, t);
    assert.equal(clockMeal(at(t)), meal, t);
  });
});

test('Freie Tage und Urlaub ändern nichts an der Uhr', () => {
  assert.equal(mealForTime(at('08:00'), { today: FREE, yesterday: FREE }), 'breakfast');
  assert.equal(mealForTime(at('12:00'), { today: { cat: 'vacation', times: null } }), 'lunch');
});

test('In der Nachtschicht: auch frühmorgens Snacks, nach Schichtende Frühstück', () => {
  assert.equal(mealForTime(at('23:30'), { today: N }), 'snack');
  assert.equal(mealForTime(at('02:00'), { yesterday: N }), 'snack');
  assert.equal(mealForTime(at('05:30'), { yesterday: N }), 'snack', 'um 05:30 noch in der Schicht');
  assert.equal(mealForTime(at('06:30'), { yesterday: N }), 'breakfast', 'nach der Schicht, vor dem Tagschlaf');
  assert.equal(mealForTime(at('14:00'), { yesterday: N, today: N }), 'lunch', 'nach dem Ausschlafen nach der Uhr');
  assert.equal(mealForTime(at('19:00'), { yesterday: N, today: N }), 'dinner', 'vor der nächsten Nacht');
});

test('Eigene Uhrzeiten der Nachtschicht zählen', () => {
  const late = { cat: 'night', times: ['21:00', '07:00'] };
  assert.equal(mealForTime(at('06:45'), { yesterday: late }), 'snack');
  assert.equal(mealForTime(at('07:15'), { yesterday: late }), 'breakfast');
  /* Ab Schichtbeginn zählt der Abend noch als Abendessen, erst ab 22:00 als Nacht */
  assert.equal(mealForTime(at('21:30'), { today: late }), 'dinner');
});

test('24-h-Dienst: nachts Snacks, tagsüber nach der Uhr', () => {
  assert.equal(mealForTime(at('03:00'), { yesterday: X }), 'snack');
  assert.equal(mealForTime(at('06:30'), { yesterday: X }), 'snack');
  assert.equal(mealForTime(at('12:00'), { today: X, yesterday: FREE }), 'lunch');
  assert.equal(mealForTime(at('23:00'), { today: X }), 'snack');
});

test('Vor der Frühschicht: Frühstück schon ab drei Stunden vor Beginn', () => {
  assert.equal(mealForTime(at('03:30'), { today: F }), 'breakfast');
  assert.equal(mealForTime(at('04:45'), { today: F }), 'breakfast');
  assert.equal(mealForTime(at('02:30'), { today: F }), 'snack', 'mehr als drei Stunden vorher');
  assert.equal(mealForTime(at('03:30')), 'snack', 'ohne Frühschicht noch Snacks');
  assert.equal(mealForTime(at('04:30'), { today: { cat: 'day', times: ['06:00', '18:00'] } }), 'breakfast', 'Tagschicht ab 06:00');
  assert.equal(mealForTime(at('04:30'), { today: S }), 'snack', 'Spätschicht beginnt nicht früh');
});

test('Spätschicht: Abendessen in der Pause, danach Snacks', () => {
  assert.equal(mealForTime(at('12:00'), { today: S }), 'lunch');
  assert.equal(mealForTime(at('18:30'), { today: S }), 'dinner');
  assert.equal(mealForTime(at('22:30'), { today: S }), 'snack');
});

test('Schicht über Mitternacht: gestern bis zum Ende, heute ab Beginn', () => {
  assert.equal(inOvernightShift(at('05:59'), { yesterday: N }), true);
  assert.equal(inOvernightShift(at('06:00'), { yesterday: N }), false);
  assert.equal(inOvernightShift(at('21:59'), { today: N }), false);
  assert.equal(inOvernightShift(at('22:00'), { today: N }), true);
  assert.equal(inOvernightShift(at('10:00'), { today: F, yesterday: F }), false, 'Frühschicht geht nicht über Mitternacht');
  assert.equal(inOvernightShift(at('03:00'), {}), false);
  assert.equal(inOvernightShift(at('03:00'), { yesterday: { cat: 'night', times: null } }), false, 'ohne Uhrzeit keine Aussage');
});

/* ---------- Vorschläge ---------- */
const e = (meal, ref, grams, name = ref) => ({ id: ref + meal + grams, meal, ref, grams, name, per100: { kcal: 100, protein: 1, fat: 1, carbs: 1 }, source: 'basic' });
const LOG = {
  '2026-09-27': [e('breakfast', 'b:hafer', 60), e('lunch', 'b:reis', 250)],
  '2026-09-28': [e('breakfast', 'b:hafer', 80), e('snack', 'b:apfel', 150)],
  '2026-09-29': [e('lunch', 'b:reis', 300)],
};

test('Letzte Menge je Lebensmittel', () => {
  const m = lastAmounts(LOG);
  assert.equal(m.get('b:hafer'), 80);
  assert.equal(m.get('b:reis'), 300);
  assert.equal(m.get('b:apfel'), 150);
  assert.equal(lastAmounts(null).size, 0);
});

test('Zuletzt benutzt mit Menge, ohne Lebensmittel ohne Eintrag', () => {
  const recent = [{ key: 'b:reis', ref: 'b:reis', name: 'Reis' }, { key: 'c:zutat', ref: 'c:zutat', name: 'Nur Zutat' }, { key: 'b:hafer', ref: 'b:hafer', name: 'Hafer' }];
  const q = quickFoods(recent, LOG);
  assert.deepEqual(q.map(x => [x.food.name, x.grams]), [['Reis', 300], ['Hafer', 80]]);
  assert.equal(quickFoods(recent, LOG, 1).length, 1);
  assert.deepEqual(quickFoods(null, LOG), []);
});

test('Dieselbe Mahlzeit vom letzten Tag, an dem sie eingetragen ist', () => {
  const b = lastMeal(LOG, '2026-09-30', 'breakfast');
  assert.equal(b.date, '2026-09-28');
  assert.deepEqual(b.entries.map(x => x.grams), [80]);
  assert.equal(lastMeal(LOG, '2026-09-30', 'lunch').date, '2026-09-29');
  assert.equal(lastMeal(LOG, '2026-09-30', 'dinner'), null);
  assert.equal(lastMeal(LOG, '2026-09-28', 'breakfast').date, '2026-09-27', 'nur Tage davor');
  assert.equal(lastMeal(LOG, '2026-10-20', 'breakfast'), null, 'höchstens 7 Tage zurück');
  assert.equal(lastMeal(LOG, '2026-10-20', 'breakfast', 30).date, '2026-09-28');
});
