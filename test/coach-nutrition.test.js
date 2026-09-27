import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestions, isoWeek, waistChange, stepFor } from '../js/coach/nutrition.js';
import { pendingSuggestions, decide } from '../js/coach/index.js';
import { dayNumber, dateFromDayNumber } from '../js/domain/body.js';
import { defaultState } from '../js/store/migrate.js';

const NOW = new Date(2026, 8, 28, 12, 0).getTime(); // Montag, KW 40
const series = (days, kgAt) =>
  Array.from({ length: days }, (_, i) => ({ date: dateFromDayNumber(dayNumber('2026-09-28') - (days - 1) + i), kg: kgAt(i) }));
/* Gewichtsreihe über 28 Tage mit einer Rate in Prozent pro Woche und leichtem Rauschen */
const withRate = (pctPerWeek, start = 85) => series(28, i => start * (1 + pctPerWeek / 100 * i / 7) + (i % 2 ? 0.1 : -0.1));

function state(goal, weights, measurements = []) {
  const S = defaultState();
  Object.assign(S.profile, { goal, heightCm: 180, age: 30, sex: 'm' });
  S.body.weights = weights;
  S.body.measurements = measurements;
  return S;
}

test('Kalenderwoche', () => {
  assert.equal(isoWeek(NOW), '2026-40');
  assert.equal(isoWeek(new Date(2026, 0, 1, 12).getTime()), '2026-01');
  assert.equal(isoWeek(new Date(2027, 0, 1, 12).getTime()), '2026-53');
});

test('Schrittgröße 100 bis 200 kcal', () => {
  assert.equal(stepFor(0.05, 85), 100);
  assert.equal(stepFor(0.15, 85), 150);
  assert.equal(stepFor(1, 85), 200);
});

test('Zu wenige Daten: kein Vorschlag', () => {
  assert.deepEqual(suggestions(state('lose', series(3, () => 85)), NOW), []);
});

test('Abnehmen zu langsam: Ziel senken', () => {
  const S = state('lose', withRate(-0.2));
  const [s] = suggestions(S, NOW);
  assert.equal(s.id, 'nut-kcal:2026-40');
  assert.match(s.title, /um 200 kcal senken/);
  assert.match(s.reason, /0,5–1 % Abnahme pro Woche sinnvoll, du nimmst langsamer ab\.$/);
  assert.equal(s.reason.split('. ').length, 1, 'genau ein Satz');
  s.apply(S);
  assert.equal(S.nutrition.kcalAdjust, -200);
});

test('Abnehmen zu schnell: Ziel erhöhen', () => {
  const [s] = suggestions(state('lose', withRate(-1.5)), NOW);
  assert.match(s.title, /erhöhen/);
  assert.match(s.reason, /du nimmst schneller ab\.$/);
});

test('Im Zielbereich: kein Vorschlag', () => {
  assert.deepEqual(suggestions(state('lose', withRate(-0.7)), NOW), []);
  assert.deepEqual(suggestions(state('recomp', withRate(0.1)), NOW), []);
  assert.deepEqual(suggestions(state('gain', withRate(0.08)), NOW), []);
});

test('Aufbau zu schnell und zu langsam', () => {
  assert.match(suggestions(state('gain', withRate(0.4)), NOW)[0].title, /senken/);
  const slow = suggestions(state('gain', withRate(0.045)), NOW)[0];
  assert.equal(slow.id, 'nut-kcal:2026-40');
  assert.match(slow.title, /um 100 kcal erhöhen/);
});

test('Stagnation beim Abnehmen wird ausdrücklich gemeldet', () => {
  const S = state('lose', withRate(0));
  const [s] = suggestions(S, NOW);
  assert.equal(s.id, 'nut-stall:2026-40');
  assert.match(s.title, /steht seit drei Wochen/);
  s.apply(S);
  assert.equal(S.nutrition.kcalAdjust, -200);
});

test('Rekomposition: Taille sinkt bei gleichem Gewicht, keine Kürzung', () => {
  const m = [{ date: '2026-09-02', neck: 38, belly: 90 }, { date: '2026-09-26', neck: 38, belly: 88.5 }];
  assert.deepEqual(waistChange(m, '2026-09-28'), { key: 'belly', label: 'Bauch', delta: -1.5, spanDays: 24 });
  const [s] = suggestions(state('lose', withRate(0), m), NOW);
  assert.equal(s.id, 'nut-recomp:2026-40');
  assert.equal(s.apply, undefined);
  assert.match(s.reason, /um 1,5 cm geschrumpft/);
  // Beim Aufbau mit gleichem Gewicht bleibt es beim Vorschlag, mehr zu essen
  assert.match(suggestions(state('gain', withRate(0), m), NOW)[0].title, /steht seit drei Wochen/);
});

test('Von Hand gesetztes Ziel wird direkt angepasst', () => {
  const S = state('lose', withRate(-0.2));
  S.nutrition.overrides = { kcal: 2400 };
  suggestions(S, NOW)[0].apply(S);
  assert.equal(S.nutrition.overrides.kcal, 2200);
  assert.equal(S.nutrition.kcalAdjust, 0);
});

test('Abgelehnt bleibt weg, nächste Woche wird neu geprüft', () => {
  const S = state('lose', withRate(-0.2));
  const [s] = pendingSuggestions(S, NOW, 'nutrition');
  decide(S, s, 'declined', NOW);
  assert.deepEqual(pendingSuggestions(S, NOW, 'nutrition'), []);
  assert.equal(S.nutrition.kcalAdjust, 0);
});
