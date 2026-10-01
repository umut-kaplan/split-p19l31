import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bmrMifflin, bmrKatch, calorieGoal, macros, waterGoal, missingForCalories,
  trainingKcalPerDay, nutritionTargets, targetsFromState, carbsRest,
} from '../js/domain/energy.js';
import { defaultState } from '../js/store/migrate.js';

const NOW = new Date(2026, 8, 28, 12, 0).getTime();
const H = 36e5, D = 864e5;
const base = { weightKg: 80, heightCm: 180, age: 30, sex: 'm', activity: 'moderate', goal: 'gain' };

test('Grundumsatz nach Mifflin-St Jeor', () => {
  // 10*80 + 6,25*180 - 5*30 + 5 = 1780
  assert.equal(bmrMifflin({ kg: 80, cm: 180, age: 30, sex: 'm' }), 1780);
  // 10*60 + 6,25*165 - 5*25 - 161 = 1345,25
  assert.equal(bmrMifflin({ kg: 60, cm: 165, age: 25, sex: 'f' }), 1345.25);
});

test('Grundumsatz nach Katch-McArdle', () => {
  assert.equal(Math.round(bmrKatch(64) * 10) / 10, 1752.4); // 370 + 21,6 * 64
});

test('Kalorienziel nach Mifflin, ohne Training', () => {
  const r = calorieGoal(base, { now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.formula, 'mifflin');
  assert.equal(Math.round(r.tdee), 2759);            // 1780 * 1,55
  assert.equal(r.kcal, 3030);                         // 2759 * 1,1 = 3034,9, auf 10 gerundet
  assert.match(r.lines[0], /Mifflin-St Jeor/);
  assert.match(r.lines[1], /Alltag „Mäßig aktiv“/);
  assert.match(r.lines[2], /Kein Zuschlag fürs Training/);
  assert.match(r.lines[3], /Plus 10 % für das Ziel „Muskelaufbau“/);
  assert.match(r.lines[r.lines.length - 1], /Auf 10 gerundet: 3.030 kcal/);
  /* 20 % wären 552 kcal, gedeckelt auf 500 kcal Defizit (4.7): 2759 - 500 */
  const lose = calorieGoal({ ...base, goal: 'lose' }, { now: NOW });
  assert.equal(lose.kcal, 2260);
  assert.match(lose.lines[3], /Minus 500 kcal für das Ziel „Abnehmen“: 2\.259 kcal\. 20 % wären 552 kcal, die App zieht aber höchstens 500 kcal am Tag ab/);
  assert.equal(calorieGoal({ ...base, goal: 'recomp' }, { now: NOW }).kcal, 2760);
});

test('Katch-McArdle, sobald ein Körperfettwert da ist', () => {
  const r = calorieGoal(base, { now: NOW, composition: { bfPct: 20, measured: true } });
  assert.equal(r.formula, 'katch');
  assert.equal(r.lean, 64);
  assert.equal(Math.round(r.bmr), 1752);
  assert.match(r.lines[0], /Katch-McArdle aus 64 kg fettfreier Masse \(20 % Körperfett, gemessen\)/);
  const est = calorieGoal(base, { now: NOW, composition: { bfPct: 18.5, measured: false } });
  assert.match(est.lines[0], /nach der Navy-Formel geschätzt/);
  // Mit Körperfettwert reichen Gewicht und Fettanteil, Alter und Größe fehlen dürfen
  assert.equal(calorieGoal({ weightKg: 80, activity: 'light' }, { composition: { bfPct: 20, measured: true } }).ok, true);
});

test('Ohne Angaben: Alltag leicht aktiv und Beides', () => {
  const r = calorieGoal({ ...base, activity: null, goal: null }, { now: NOW });
  assert.equal(r.kcal, 2450); // 1780 * 1,375 = 2447,5
  assert.match(r.lines[1], /Standardwert/);
  assert.match(r.lines[3], /Ohne Ziel im Profil/);
});

test('Fehlende Werte werden benannt statt geraten', () => {
  assert.deepEqual(missingForCalories({ weightKg: 80, heightCm: null, age: null, sex: null }), ['Größe', 'Geburtsdatum', 'Geschlecht']);
  assert.equal(calorieGoal({ weightKg: null, heightCm: 180, age: 30, sex: 'm' }).ok, false);
});

test('Mifflin mit Alter aus dem Geburtsdatum, am Tag der Rechnung', () => {
  const p = { weightKg: 80, heightCm: 180, sex: 'm', activity: 'moderate', goal: 'recomp' };
  // NOW ist der 28.09.2026: wer am 28.09.1996 geboren ist, wird heute 30
  const birthday = calorieGoal({ ...p, birthDate: '1996-09-28' }, { now: NOW });
  assert.equal(birthday.bmr, 1780);
  assert.match(birthday.lines[0], /Alter \(30 Jahre\) und Geschlecht: 1\.780 kcal/);
  // Einen Tag vor dem 30. Geburtstag: 29 Jahre, 5 kcal mehr
  assert.equal(calorieGoal({ ...p, birthDate: '1996-09-29' }, { now: NOW }).bmr, 1785);
  // Ein Jahr später rechnet dieselbe Angabe von selbst mit 31
  assert.equal(calorieGoal({ ...p, birthDate: '1996-09-28' }, { now: NOW + 365 * D }).bmr, 1775);
  // Das Geburtsdatum gewinnt gegen ein altes Alter
  assert.equal(calorieGoal({ ...p, birthDate: '1996-09-28', age: 40 }, { now: NOW }).bmr, 1780);
});

test('Ohne Geburtsdatum rechnet die App mit dem früher eingetragenen Alter weiter', () => {
  const p = { weightKg: 80, heightCm: 180, sex: 'm', activity: 'moderate', goal: 'recomp' };
  const r = calorieGoal({ ...p, age: 30, birthDate: null }, { now: NOW });
  assert.equal(r.bmr, 1780);
  assert.match(r.lines[0], /Alter \(30 Jahre, ohne Geburtsdatum im Profil\)/);
  // Auch ein Jahr später bleibt es bei 30, geschätzt wird nichts
  assert.equal(calorieGoal({ ...p, age: 30 }, { now: NOW + 365 * D }).bmr, 1780);
  assert.deepEqual(missingForCalories({ ...p, age: 30 }, NOW), []);
  assert.deepEqual(missingForCalories({ ...p, birthDate: '1996-09-28' }, NOW), []);
  assert.deepEqual(missingForCalories({ ...p, birthDate: 'kaputt' }, NOW), ['Geburtsdatum']);
  assert.deepEqual(calorieGoal({ ...p }, { now: NOW }).missing, ['Geburtsdatum']);
});

test('Trainingszuschlag aus den letzten 7 Tagen, pro Einheit höchstens 2 Stunden', () => {
  const s = (daysAgo, hours) => ({ startedAt: NOW - daysAgo * D, endedAt: NOW - daysAgo * D + hours * H });
  const sessions = [s(1, 1), s(3, 1), s(5, 1), s(6, 3), s(8, 1), { startedAt: NOW - D, endedAt: NOW - D }];
  const t = trainingKcalPerDay(sessions, 80, NOW);
  assert.equal(t.count, 4);          // die vor 8 Tagen und die ohne Dauer zählen nicht
  assert.equal(t.hours, 5);          // 1 + 1 + 1 + 2 (gedeckelt)
  assert.equal(Math.round(t.kcalPerDay * 100) / 100, 285.71); // 5 MET * 80 kg * 5 h / 7
  const r = calorieGoal({ ...base, goal: 'recomp' }, { now: NOW, sessions });
  assert.equal(r.kcal, Math.round((1780 * 1.55 + 5 * 80 * 5 / 7) / 10) * 10);
  assert.match(r.lines[2], /4 Einheiten mit zusammen 5 Stunden/);
  assert.equal(trainingKcalPerDay([], 80, NOW).kcalPerDay, 0);
});

test('Angenommene Anpassungen verschieben das Ziel', () => {
  const r = calorieGoal({ ...base, goal: 'recomp' }, { now: NOW, kcalAdjust: -150 });
  assert.equal(r.kcal, 2610);
  assert.match(r.lines[4], /Minus 150 kcal aus angenommenen Anpassungen/);
});

test('Makros: 2 g Protein pro kg, 0,8 g Fett, Rest Kohlenhydrate', () => {
  const m = macros(2760, 80);
  assert.equal(m.protein, 160);
  assert.equal(m.fat, 64);
  assert.equal(m.carbs, Math.round((2760 - 640 - 576) / 4));
  assert.deepEqual(m.proteinRange, [144, 176]);
  assert.equal(m.proteinBasis, 'weight');
  assert.equal(macros(500, 80).carbs, 0);
});

test('Makros mit fettfreier Masse: 2,2 g pro kg davon', () => {
  const m = macros(2500, 80, 64);
  assert.equal(m.protein, 141);
  assert.equal(m.proteinBasis, 'lean');
  assert.deepEqual(m.proteinRange, [115, 141]);
  assert.equal(m.fat, 64);
  assert.equal(m.carbs, carbsRest(2500, 141, 64));
});

test('Von Hand gesetzte Ziele gehen vor, Kohlenhydrate rechnen sich neu', () => {
  const auto = nutritionTargets({ profile: base, weightKg: 80, now: NOW });
  assert.equal(auto.kcal, 3030);
  assert.deepEqual(auto.manual, { kcal: false, protein: false, fat: false, carbs: false });
  const t = nutritionTargets({ profile: base, weightKg: 80, now: NOW, overrides: { kcal: 2500, protein: 180 } });
  assert.equal(t.kcal, 2500);
  assert.equal(t.protein, 180);
  assert.equal(t.fat, 64);
  assert.equal(t.carbs, carbsRest(2500, 180, 64));
  assert.equal(t.manual.kcal, true);
  assert.equal(t.calc.kcal, 3030); // die Berechnung bleibt zum Aufklappen erhalten
  const c = nutritionTargets({ profile: base, weightKg: 80, now: NOW, overrides: { carbs: 0 } });
  assert.equal(c.carbs, 0);
  // Ohne Profil, aber mit festem Kalorienziel
  const m = nutritionTargets({ profile: {}, weightKg: null, now: NOW, overrides: { kcal: 2000 } });
  assert.equal(m.ok, true);
  assert.equal(m.protein, null);
  assert.equal(nutritionTargets({ profile: {}, weightKg: null, now: NOW }).ok, false);
});

test('Ziele aus dem gespeicherten Zustand', () => {
  const S = defaultState();
  Object.assign(S.profile, { heightCm: 180, age: 30, sex: 'm', activity: 'moderate', goal: 'recomp', weightKg: 90 });
  S.body.weights = [{ date: '2026-09-20', kg: 80 }];
  S.body.measurements = [{ date: '2026-09-20', neck: 38, belly: 85 }];
  S.sessions = [{ startedAt: NOW - D, endedAt: NOW - D + H }];
  S.nutrition.kcalAdjust = 100;
  const t = targetsFromState(S, NOW);
  assert.equal(t.calc.formula, 'katch');       // Navy aus Hals und Bauch
  assert.equal(t.calc.training.count, 1);
  assert.equal(t.calc.adjust, 100);
  assert.ok(t.protein > 0 && t.macro.proteinBasis === 'lean');
});

test('Wasserziel 35 ml pro kg', () => {
  assert.equal(waterGoal(80), 2800);
  assert.equal(waterGoal(82.4), 2900);
  assert.equal(waterGoal(null), 2500);
});
