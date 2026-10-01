import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRatio, recoveryStatus, recentSleep, restingHrShift, THRESHOLDS } from '../js/domain/recovery.js';

/* Montag, 28.09.2026. Vergleichswochen: 15.–21.9., 8.–14.9., 1.–7.9., 25.–31.8.; akut: 22.–28.9. */
const TODAY = '2026-09-28';
const at = d => new Date(d + 'T18:00').getTime();
const sess = (date, sets) => ({ startedAt: at(date), endedAt: at(date) + 3600e3, ex: [{ name: 'Bankdrücken', sets: Array.from({ length: sets }, () => ({ w: 60, r: 8 })) }] });
const base = () => [sess('2026-09-16', 12), sess('2026-09-09', 12), sess('2026-09-02', 12), sess('2026-08-26', 12)];

test('Belastung braucht zwei Vergleichswochen', () => {
  const r = loadRatio([sess('2026-09-16', 12), sess('2026-09-24', 12)], [], TODAY);
  assert.equal(r.ok, false);
  assert.match(r.reason, /mindestens 2 Wochen/);
});

test('Belastung: Schwellen 1,3 und 1,5', () => {
  const r = acute => recoveryStatus({ sessions: [...base(), sess('2026-09-23', acute)] }, TODAY);
  assert.equal(loadRatio([...base(), sess('2026-09-23', 18)], [], TODAY).ratio, 1.5);
  assert.equal(r(12).level, 'green');
  assert.equal(r(16).level, 'yellow');   // 1,33
  assert.equal(r(18).level, 'yellow');   // genau 1,5 ist noch gelb
  assert.equal(r(19).level, 'red');      // 1,58
  assert.match(r(19).summary, /^Rot, weil du in den letzten 7 Tagen 1,6-mal so viel trainiert hast wie sonst\.$/);
});

test('Cardio zählt: 10 Minuten wie ein Satz', () => {
  assert.equal(THRESHOLDS.cardioMinutesPerSet, 10);
  const r = loadRatio([...base(), sess('2026-09-23', 12)], [{ date: '2026-09-25', minutes: 60 }], TODAY);
  assert.equal(r.acute, 18);
  assert.equal(r.ratio, 1.5);
});

test('Neuer Anfang drückt den Schnitt nicht', () => {
  /* Erst seit zwei Wochen dabei: Schnitt aus zwei Wochen, nicht aus vier */
  const r = loadRatio([sess('2026-09-16', 12), sess('2026-09-09', 12), sess('2026-09-23', 12)], [], TODAY);
  assert.equal(r.ok, true);
  assert.equal(r.chronic, 12);
  assert.equal(r.weeks, 2);
});

test('Schlaf: Schnitt der letzten Nächte, Check-in geht vor', () => {
  const sleep = [{ date: '2026-09-27', hours: 8 }, { date: '2026-09-26', hours: 8 }, { date: '2026-09-28', hours: 7, source: 'apple-health' }];
  assert.deepEqual(recentSleep(sleep, { [TODAY]: { sleepH: 4.5 } }, TODAY).map(n => n.hours), [4.5, 8, 8]);
  const s = checkin => recoveryStatus({ sleep, checkins: { [TODAY]: checkin } }, TODAY);
  assert.equal(s({ sleepH: 7.5 }).level, 'green');
  assert.equal(s({ sleepH: 4.5 }).level, 'yellow');     // Schnitt 6,8, aber die letzte Nacht unter 6 h
  assert.equal(s({ sleepH: 5.5 }).level, 'yellow');
  assert.match(s({ sleepH: 5.5 }).summary, /^Gelb, weil du letzte Nacht nur 5,5 Stunden geschlafen hast\.$/);
  /* Einzahl (4.6) */
  assert.match(s({ sleepH: 1 }).summary, /letzte Nacht nur 1 Stunde geschlafen hast\.$/);
  assert.equal(s({ sleepH: 3.5 }).level, 'red');        // letzte Nacht unter 4 h
  assert.equal(recoveryStatus({ checkins: { [TODAY]: { sleepH: 5.5 } } }, TODAY).level, 'yellow');
  assert.equal(recoveryStatus({ checkins: { [TODAY]: { sleepH: 4.5 } } }, TODAY).level, 'red');
});

test('Gefühl: 2 gelb, 1 rot', () => {
  const f = n => recoveryStatus({ checkins: { [TODAY]: { feeling: n } } }, TODAY).level;
  assert.equal(f(1), 'red');
  assert.equal(f(2), 'yellow');
  assert.equal(f(3), 'green');
  assert.equal(f(5), 'green');
});

test('Ruhepuls gegen den Median der 14 Tage davor', () => {
  const hist = Array.from({ length: 10 }, (_, i) => ({ date: `2026-09-${String(17 + i).padStart(2, '0')}`, bpm: 55 }));
  assert.equal(restingHrShift(hist.slice(0, 4).concat({ date: TODAY, bpm: 70 }), TODAY), null); // zu wenig Vergleichswerte
  const h = bpm => recoveryStatus({ restingHr: [...hist, { date: TODAY, bpm }] }, TODAY);
  assert.equal(h(57).level, 'green');
  assert.equal(h(60).level, 'yellow');
  assert.equal(h(65).level, 'red');
  assert.match(h(60).reasons[0].text, /heute 60, 5 Schläge über deinem Schnitt von 55/);
});

test('Das schlechteste Signal gewinnt, die Begründung nennt nur die schlechtesten', () => {
  const hist = Array.from({ length: 10 }, (_, i) => ({ date: `2026-09-${String(17 + i).padStart(2, '0')}`, bpm: 55 }));
  const r = recoveryStatus({
    sessions: [...base(), sess('2026-09-23', 12)],
    restingHr: [...hist, { date: TODAY, bpm: 61 }],
    checkins: { [TODAY]: { sleepH: 7, feeling: 1 } },
  }, TODAY);
  assert.equal(r.level, 'red');
  assert.equal(r.signals, 4);
  assert.equal(r.summary, 'Rot, weil du dich heute schlecht fühlst.');
});

test('Ohne Daten grün mit ehrlichem Hinweis', () => {
  const r = recoveryStatus({}, TODAY);
  assert.equal(r.level, 'green');
  assert.equal(r.signals, 0);
  assert.match(r.summary, /wenig Daten/);
  assert.ok(r.notes.length >= 2);
});
