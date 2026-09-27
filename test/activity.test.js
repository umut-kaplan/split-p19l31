import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARDIO, runMet, cardioMet, cardioKcal, cardioKcalPerDay, stepsKcalPerDay, burnAverage,
  upsertByDate, lastDays, parseHours, hoursLabel, inWindow,
} from '../js/domain/activity.js';
import { calorieGoal, targetsFromState } from '../js/domain/energy.js';
import { defaultState } from '../js/store/migrate.js';

const TODAY = '2026-09-28';
const NOW = new Date(2026, 8, 28, 12, 0).getTime();
const base = { weightKg: 80, heightCm: 180, age: 30, sex: 'm', activity: 'moderate', goal: 'gain' };
const days = (from, to, value) => {
  const out = [];
  for (let d = from; d <= to; d++) out.push({ date: `2026-09-${String(d).padStart(2, '0')}`, ...value });
  return out;
};

test('kcal nach MET: MET × kg × Stunden', () => {
  assert.equal(cardioKcal({ type: 'bike', minutes: 60 }, 80), 600);     // 7,5 × 80 × 1
  assert.equal(cardioKcal({ type: 'walk', minutes: 60 }, 80), 280);     // 3,5 × 80 × 1
  assert.equal(cardioKcal({ type: 'unbekannt', minutes: 60 }, 80), 400); // Sonstiges, MET 5
  assert.equal(cardioKcal({ type: 'bike', minutes: 60 }, null), null);
  assert.equal(cardioKcal({ type: 'bike', minutes: 0 }, 80), null);
  Object.values(CARDIO).forEach(c => assert.ok(c.met > 1 && c.label));
});

test('Laufen richtet sich nach dem Tempo', () => {
  assert.equal(runMet(5), 6);
  assert.equal(runMet(8), 8.3);
  assert.equal(runMet(9.7), 9.8);
  assert.equal(runMet(12), 11);
  assert.equal(runMet(20), 16);
  // 10 km in 50 Minuten = 12 km/h -> MET 11
  const m = cardioMet('run', 50, 10);
  assert.equal(m.kmh, 12);
  assert.equal(m.met, 11);
  assert.equal(cardioKcal({ type: 'run', minutes: 50, km: 10 }, 80), 733);
  // ohne Distanz der mittlere Wert 9,8
  assert.equal(cardioKcal({ type: 'run', minutes: 30 }, 80), 392);
  // Tempo zählt nur beim Laufen
  assert.equal(cardioMet('bike', 60, 30).met, 7.5);
});

test('Cardio der letzten 7 Tage auf einen Tag verteilt', () => {
  const list = [
    { date: '2026-09-28', minutes: 30, kcal: 300 },
    { date: '2026-09-22', minutes: 40, kcal: 400 },
    { date: '2026-09-21', minutes: 60, kcal: 500 }, // vor 7 Tagen, zählt nicht mehr
    { date: '2026-09-29', minutes: 60, kcal: 500 }, // Zukunft
  ];
  assert.deepEqual(cardioKcalPerDay(list, TODAY), { count: 2, minutes: 70, kcal: 700, kcalPerDay: 100 });
  assert.equal(cardioKcalPerDay([], TODAY).kcalPerDay, 0);
  // ohne heute verschiebt sich das Fenster auf 21. bis 27.9.
  assert.deepEqual(inWindow(list, TODAY, 7, false).map(e => e.date), ['2026-09-22', '2026-09-21']);
});

test('Schritte: Zuschlag über der Grundlinie, erst ab 4 Tagen, heute zählt nicht', () => {
  const steps = [...days(21, 26, { steps: 10000 }), { date: TODAY, steps: 20000 }];
  const s = stepsKcalPerDay(steps, 'light', 80, TODAY);
  assert.equal(s.days, 6);
  assert.equal(s.enough, true);
  assert.equal(s.avgSteps, 10000);
  assert.equal(s.baseline, 6000);
  assert.equal(s.extra, 4000);
  assert.equal(s.kcalPerDay, 160); // 4000 × 0,0005 × 80
  // unter der Grundlinie kein Zuschlag
  assert.equal(stepsKcalPerDay(steps, 'active', 80, TODAY).kcalPerDay, 0);
  // zu wenige Tage
  const few = stepsKcalPerDay(days(25, 27, { steps: 15000 }), 'light', 80, TODAY);
  assert.equal(few.enough, false);
  assert.equal(few.kcalPerDay, 0);
  // ohne Alltagsstufe gilt „leicht aktiv“
  assert.equal(stepsKcalPerDay(steps, null, 80, TODAY).baseline, 6000);
});

test('Schritte: Gehen aus dem Cardio wird abgezogen, sehr viele Schritte gedeckelt', () => {
  const steps = days(21, 26, { steps: 10000 });
  const cardio = [{ date: '2026-09-26', type: 'walk', minutes: 60, kcal: 280 }, { date: '2026-09-26', type: 'bike', minutes: 60, kcal: 600 }];
  const s = stepsKcalPerDay(steps, 'light', 80, TODAY, cardio);
  assert.equal(s.walkSteps, 1000);   // 60 min × 100 Schritte, verteilt auf 6 Tage
  assert.equal(s.extra, 3000);
  assert.equal(s.kcalPerDay, 120);
  const huge = stepsKcalPerDay(days(21, 26, { steps: 30000 }), 'sedentary', 80, TODAY);
  assert.equal(huge.capped, true);
  assert.equal(huge.extra, 12000);
  assert.equal(huge.kcalPerDay, 480);
});

test('Kalorienziel mit Cardio und Schritten', () => {
  const activity = {
    cardio: [{ date: '2026-09-28', minutes: 30, kcal: 300 }, { date: '2026-09-22', minutes: 40, kcal: 400 }],
    steps: days(21, 26, { steps: 10000 }),
  };
  const r = calorieGoal(base, { now: NOW, activity });
  // 1780 × 1,55 = 2759, plus 100 Cardio, plus (10000 − 8000) × 0,0005 × 80 = 80
  assert.equal(Math.round(r.tdee), 2939);
  assert.equal(r.kcal, 3230); // 2939 × 1,1 = 3232,9
  assert.match(r.lines[2], /Kein Zuschlag fürs Training/);
  assert.match(r.lines[3], /Plus 100 kcal pro Tag für Cardio: 2 Einheiten mit zusammen 70 Minuten/);
  assert.match(r.lines[4], /Plus 80 kcal pro Tag für Schritte: im Schnitt 10\.000 Schritte an 6 Tagen, davon 2\.000 über den 8\.000/);
  assert.match(r.lines[4], /mal 0,0005 kcal pro Schritt und kg/);
  assert.match(r.lines[4], /Zusammen 2\.939 kcal Gesamtumsatz\./);
  assert.match(r.lines[5], /Plus 10 % für das Ziel/);
  // Schritte unter der Grundlinie: eigener Satz ohne Zuschlag
  const low = calorieGoal({ ...base, activity: 'active' }, { now: NOW, activity: { steps: days(21, 26, { steps: 9000 }) } });
  assert.match(low.lines[3], /Kein Zuschlag für Schritte: im Schnitt 9\.000 an 6 Tagen/);
  // ohne Aktivitätsdaten bleibt alles wie vorher
  const none = calorieGoal(base, { now: NOW, activity: { steps: [], cardio: [], burn: [] } });
  assert.equal(none.kcal, 3030);
  assert.equal(none.lines.length, 5);
});

test('Gemessener Verbrauch nur als Vergleich, nicht im Ziel', () => {
  const burn = days(21, 27, { kcal: 3500 });
  assert.deepEqual(burnAverage(burn, TODAY), { days: 7, enough: true, avg: 3500 });
  assert.equal(burnAverage(days(25, 27, { kcal: 3500 }), TODAY).enough, false);
  const r = calorieGoal(base, { now: NOW, activity: { burn } });
  assert.equal(r.kcal, 3030); // unverändert
  const last = r.lines[r.lines.length - 1];
  assert.match(last, /Deine Uhr misst im Schnitt 3\.500 kcal Tagesverbrauch an 7 Tagen, die Rechnung ergibt 2\.759 kcal \(27 % weniger\)/);
  assert.match(last, /bleibt bei ihrer Rechnung/);
});

test('Ziele aus dem Zustand nehmen die Aktivität mit', () => {
  const S = defaultState();
  Object.assign(S.profile, { heightCm: 180, age: 30, sex: 'm', activity: 'moderate', goal: 'recomp', weightKg: 80 });
  S.activity.cardio = [{ id: 'a', date: TODAY, type: 'bike', minutes: 60, kcal: 700, source: 'manual' }];
  const t = targetsFromState(S, NOW);
  assert.equal(t.calc.cardio.count, 1);
  assert.equal(t.calc.kcal, Math.round((1780 * 1.55 + 100) / 10) * 10);
});

test('Ein Wert pro Tag, der ersetzte Eintrag kommt zurück', () => {
  const list = [{ date: '2026-09-27', steps: 8000, source: 'apple-health' }];
  const r = upsertByDate(list, { date: '2026-09-27', steps: 9000, source: 'manual' });
  assert.equal(r.list.length, 1);
  assert.equal(r.list[0].steps, 9000);
  assert.equal(r.replaced.source, 'apple-health');
  const r2 = upsertByDate(r.list, { date: '2026-09-25', steps: 5000 });
  assert.deepEqual(r2.list.map(e => e.date), ['2026-09-25', '2026-09-27']);
  assert.equal(r2.replaced, null);
});

test('Letzte Tage für die Balken', () => {
  const d = lastDays([{ date: '2026-09-28', steps: 5000 }, { date: '2026-09-26', steps: 7000 }], 'steps', TODAY, 3);
  assert.deepEqual(d, [{ date: '2026-09-26', value: 7000 }, { date: '2026-09-27', value: null }, { date: '2026-09-28', value: 5000 }]);
});

test('Schlafdauer lesen und zeigen', () => {
  assert.equal(parseHours('7:30'), 7.5);
  assert.equal(parseHours('7,5'), 7.5);
  assert.equal(parseHours('6.25'), 6.25);
  assert.equal(parseHours('8h15'), 8.25);
  assert.ok(Number.isNaN(parseHours('viel')));
  assert.equal(hoursLabel(7.5), '7:30 h');
  assert.equal(hoursLabel(6.99), '6:59 h');
});
