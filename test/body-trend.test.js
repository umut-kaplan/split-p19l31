import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  navyBodyFat, leanMass, latestComposition, movingAverage, linearRegression,
  weightTrend, forecastGoal, dayNumber, dateFromDayNumber,
} from '../js/domain/body.js';

test('Navy-Formel', () => {
  // Mann: 180 cm, Hals 38, Bauch 85 -> etwa 16,1 %
  assert.equal(Math.round(navyBodyFat({ sex: 'm', heightCm: 180, neckCm: 38, waistCm: 85 }) * 10) / 10, 16.1);
  // Frau: 165 cm, Hals 32, Taille 70, Hüfte 95 -> 495 / (1,29579 - 0,35004·log(133) + 0,221·log(165)) - 450 = 24,9 %
  assert.equal(Math.round(navyBodyFat({ sex: 'f', heightCm: 165, neckCm: 32, waistCm: 70, hipCm: 95 }) * 10) / 10, 24.9);
  assert.equal(navyBodyFat({ sex: 'f', heightCm: 165, neckCm: 32, waistCm: 70 }), null);
  assert.equal(navyBodyFat({ sex: null, heightCm: 180, neckCm: 38, waistCm: 85 }), null);
  assert.equal(navyBodyFat({ sex: 'm', heightCm: 180, neckCm: 40, waistCm: 39 }), null);
});

test('Fettfreie Masse', () => {
  assert.equal(leanMass(80, 20), 64);
  assert.equal(leanMass(null, 20), null);
});

test('Jüngster Körperfettwert, gemessen schlägt geschätzt am selben Tag', () => {
  const p = { sex: 'm', heightCm: 180 };
  const body = {
    measurements: [{ date: '2026-09-01', neck: 38, belly: 85 }, { date: '2026-09-20', neck: 38, belly: 88 }],
    composition: [{ date: '2026-09-20', bfPct: 15, method: 'scale' }],
  };
  assert.deepEqual(latestComposition(p, body), { date: '2026-09-20', bfPct: 15, measured: true, method: 'scale' });
  body.composition[0].date = '2026-09-10';
  const r = latestComposition(p, body);
  assert.equal(r.measured, false);
  assert.equal(r.method, 'navy');
  assert.equal(r.date, '2026-09-20');
  assert.equal(latestComposition(p, { measurements: [], composition: [] }), null);
});

test('Kalendertage', () => {
  assert.equal(dayNumber('2026-03-30') - dayNumber('2026-03-28'), 2); // über die Zeitumstellung
  assert.equal(dateFromDayNumber(dayNumber('2026-09-27')), '2026-09-27');
});

test('Gleitender 7-Tage-Durchschnitt', () => {
  const pts = [{ date: '2026-09-01', kg: 80 }, { date: '2026-09-03', kg: 82 }, { date: '2026-09-09', kg: 84 }];
  assert.deepEqual(movingAverage(pts, 7).map(x => x.avg), [80, 81, 83]); // am 9.9. fällt der 1.9. aus dem Fenster
});

test('Regression', () => {
  const r = linearRegression([0, 1, 2, 3], [10, 12, 14, 16]);
  assert.equal(r.slope, 2);
  assert.equal(r.intercept, 10);
  assert.equal(r.sd, 0);
  assert.equal(linearRegression([1], [1]), null);
});

const series = (start, days, kgAt) =>
  Array.from({ length: days }, (_, i) => ({ date: dateFromDayNumber(dayNumber(start) + i), kg: kgAt(i) }));

test('Trend braucht genug Daten', () => {
  const r = weightTrend(series('2026-09-20', 5, () => 80), '2026-09-24');
  assert.equal(r.ok, false);
  assert.match(r.reason, /mindestens 5 Einträge über 2 Wochen/);
  assert.match(r.reason, /Bisher: 5 Einträge über 4 Tage\./);
  /* Einzahl (#64) */
  assert.match(weightTrend(series('2026-09-24', 1, () => 80), '2026-09-24').reason, /Bisher: 1 Eintrag über 0 Tage\./);
  assert.match(weightTrend(series('2026-09-23', 2, () => 80), '2026-09-24').reason, /Bisher: 2 Einträge über 1 Tag\./);
});

test('Trend und Prognose zum Zielgewicht', () => {
  // 28 Tage, jeden Tag 0,1 kg weniger, leichtes Rauschen
  const w = series('2026-09-01', 28, i => 90 - 0.1 * i + (i % 2 ? 0.2 : -0.2));
  const tr = weightTrend(w, '2026-09-28');
  assert.equal(tr.ok, true);
  assert.ok(Math.abs(tr.perWeek + 0.7) < 0.05, 'etwa -0,7 kg pro Woche, war ' + tr.perWeek);
  const f = forecastGoal(w, 85, '2026-09-28');
  assert.equal(f.ok, true);
  const days = dayNumber(f.date) - dayNumber('2026-09-28');
  assert.ok(days >= 20 && days <= 26, 'Tage bis Ziel: ' + days);
  assert.ok(f.earliest <= f.date && f.date <= f.latest);
});

test('Prognose sagt ehrlich, wenn der Trend nicht zum Ziel zeigt', () => {
  const w = series('2026-09-01', 28, i => 80 + 0.05 * i);
  const f = forecastGoal(w, 75, '2026-09-28');
  assert.equal(f.ok, false);
  assert.match(f.reason, /nicht in Richtung Ziel/);
});
