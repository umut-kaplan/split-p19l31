/* 4.7: Kalorienvorschläge folgen nicht mehr dem Wiegerauschen (#34), Aufbautempo nach Iraki 2019, Defizit höchstens 500 kcal */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestions, targetRate, locked, LOCK_DAYS, MIN_POINTS, Z } from '../js/coach/nutrition.js';
import { pendingSuggestions, decide } from '../js/coach/index.js';
import { dayNumber, dateFromDayNumber } from '../js/domain/body.js';
import { defaultState } from '../js/store/migrate.js';
import { calorieGoal, MAX_DEFICIT } from '../js/domain/energy.js';

const NOW = new Date(2026, 8, 28, 12, 0).getTime(); // Montag, KW 40
const DAY = 864e5;
function state(goal, weights) {
  const S = defaultState();
  Object.assign(S.profile, { goal, heightCm: 180, age: 30, sex: 'm' });
  S.body.weights = weights;
  return S;
}
/* Kleiner, fester Zufallsgenerator (mulberry32) und Normalverteilung (Box-Muller) */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
/* Tägliches Wiegen über `days` Tage bis zum Tag `end` mit wahrer Rate (% pro Woche) und Rauschen sd (kg) */
function noisy(r, { kg = 80, rate, sd, days = 35, end = '2026-09-28', skip = 0 }) {
  const e = dayNumber(end);
  const out = [];
  for (let i = 0; i < days; i++) {
    if (skip && r() < skip) continue;
    out.push({ date: dateFromDayNumber(e - (days - 1) + i), kg: Math.round((kg * (1 + rate / 100 * i / 7) + gauss(r) * sd) * 10) / 10 });
  }
  return out;
}
/* Anteil der Läufe mit einem Kalorienvorschlag: montags oder an mindestens einem Tag der Woche */
function share(goal, opts, trials = 600, seed = 7) {
  const r = rng(seed);
  let monday = 0, anyDay = 0;
  for (let k = 0; k < trials; k++) {
    const S = state(goal, noisy(r, opts));
    const hits = [0, 1, 2, 3, 4, 5, 6].map(d => suggestions(S, NOW + d * DAY).filter(s => s.id.startsWith('nut:')).length > 0);
    if (hits[0]) monday++;
    if (hits.some(Boolean)) anyDay++;
  }
  return { monday: monday / trials, anyDay: anyDay / trials };
}

test('Zielband: Aufbau pro Woche, Abnehmen höchstens 500 kcal Defizit', () => {
  assert.deepEqual(targetRate('gain', 80).min, 0.25);
  assert.deepEqual(targetRate('gain', 80).max, 0.5);
  /* 80 kg: 500 kcal am Tag sind 0,45 kg pro Woche, also 0,57 % */
  const l80 = targetRate('lose', 80);
  assert.ok(Math.abs(l80.min + 0.568) < 0.001 && Math.abs(l80.max + 0.284) < 0.001);
  assert.match(l80.text, /0,23–0,45 kg Abnahme pro Woche sinnvoll, höchstens 500 kcal Defizit am Tag/);
  /* Leichte Menschen: 0,5–1 % bleibt die Grenze */
  const l40 = targetRate('lose', 40);
  assert.deepEqual([l40.min, l40.max], [-1, -0.5]);
  assert.equal(MAX_DEFICIT, 500);
  assert.deepEqual([Z, MIN_POINTS, LOCK_DAYS], [1.5, 10, 28]);
});

test('#34: Rate genau in der Bandmitte, tägliches Wiegen mit Rauschen: selten ein Vorschlag', () => {
  /* Vorher (4.3): 68 bis 87 % der Montage, an mindestens einem Tag der Woche 98 bis 100 % */
  for (const sd of [0.3, 0.5, 0.8]) {
    const g = share('gain', { rate: 0.375, sd });
    assert.ok(g.monday < 0.05, `Aufbau sd ${sd}: montags ${g.monday}`);
    assert.ok(g.anyDay < 0.15, `Aufbau sd ${sd}: an einem Tag der Woche ${g.anyDay}`);
  }
  const l = share('lose', { rate: -0.426, sd: 0.5 });
  assert.ok(l.monday < 0.05 && l.anyDay < 0.1, JSON.stringify(l));
  /* 40 % der Tage ungewogen */
  const m = share('gain', { rate: 0.375, sd: 0.5, skip: 0.4 });
  assert.ok(m.monday < 0.05 && m.anyDay < 0.1, JSON.stringify(m));
});

test('#34: Liegt der Trend klar daneben, kommt der Vorschlag trotzdem', () => {
  /* Aufbau, aber das Gewicht steht: meistens mehr essen (Stagnation oder Erhöhung) */
  assert.ok(share('gain', { rate: 0, sd: 0.5 }, 300).monday > 0.6);
  /* Abnehmen, aber das Gewicht steigt */
  assert.ok(share('lose', { rate: 0.3, sd: 0.5 }, 300).monday > 0.9);
});

test('#34: zu wenige Wiegungen, kein Vorschlag', () => {
  const few = Array.from({ length: 9 }, (_, i) => ({ date: dateFromDayNumber(dayNumber('2026-09-28') - 24 + i * 3), kg: 85 - i * 0.02 }));
  assert.deepEqual(suggestions(state('lose', few), NOW), []);
});

test('#34: nach „Übernommen“ vier Wochen Ruhe, eine Wochen-id für beide Vorschläge', () => {
  const flat = Array.from({ length: 28 }, (_, i) => ({ date: dateFromDayNumber(dayNumber('2026-09-28') - 27 + i), kg: 85 + (i % 2 ? 0.1 : -0.1) }));
  const S = state('lose', flat);
  const [s] = suggestions(S, NOW);
  assert.equal(s.id, 'nut:2026-40');
  decide(S, s, 'accepted', NOW);
  assert.equal(locked(S, NOW + 7 * DAY), true);
  assert.deepEqual(suggestions(S, NOW + 7 * DAY), []);
  assert.deepEqual(suggestions(S, NOW + 27 * DAY), []);
  assert.equal(locked(S, NOW + 28 * DAY), false);
  /* Angenommene Vorschläge mit den ids bis 4.6 sperren auch */
  const T = state('lose', flat);
  T.suggestions['nut-kcal:2026-38'] = { status: 'accepted', date: NOW - 10 * DAY };
  assert.deepEqual(suggestions(T, NOW), []);
  /* Abgelehnt sperrt nicht, aber in derselben Woche kommt kein anderer Vorschlag */
  const U = state('lose', flat);
  const [u] = pendingSuggestions(U, NOW, 'nutrition');
  decide(U, u, 'declined', NOW);
  assert.equal(locked(U, NOW), false);
  assert.deepEqual(pendingSuggestions(U, NOW + 2 * DAY, 'nutrition'), []);
  assert.equal(pendingSuggestions(U, NOW + 7 * DAY, 'nutrition').length, 1);
});

test('Startziel: Defizit höchstens 500 kcal, kleiner bleibt es bei 20 %', () => {
  const big = { weightKg: 110, heightCm: 190, age: 30, sex: 'm', activity: 'active', goal: 'lose' };
  const r = calorieGoal(big, { now: NOW });
  assert.equal(Math.round(r.tdee - r.goalKcal), 500);
  /* Verständlich: erst das Ergebnis, dann was 20 % wären und warum weniger */
  const line = r.lines.find(l => /Abnehmen/.test(l));
  assert.match(line, /^Minus 500 kcal für das Ziel „Abnehmen“: [\d.]+ kcal\. 20 % wären [\d.]+ kcal, die App zieht aber höchstens 500 kcal am Tag ab: Ein größeres Defizit bremst in Studien den Muskelaufbau\.$/);
  const small = { weightKg: 55, heightCm: 160, age: 40, sex: 'f', activity: 'sedentary', goal: 'lose' };
  const q = calorieGoal(small, { now: NOW });
  assert.ok(q.tdee * 0.2 < 500);
  assert.equal(Math.round(q.goalKcal), Math.round(q.tdee * 0.8));
  assert.match(q.lines.find(l => /Abnehmen/.test(l)), /^Minus 20 % für das Ziel „Abnehmen“/);
});
