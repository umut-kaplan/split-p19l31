process.env.TZ = 'Europe/Berlin';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEMPLATE_28, WORK, defaultShifts, normalizeShifts, patternAt, shiftOn, baseShift, setOverride, shiftDays,
  hasShiftPlan, timesText, addDays, dayNum, weekdayOf, mondayOf, localMs, isYmd, toMin, fromMin,
} from '../js/domain/shifts.js';
import { defaultState, normalize, toBackup, fromBackup } from '../js/store/migrate.js';

const tpl = start => ({ ...defaultShifts(), pattern: { start, days: [...TEMPLATE_28.days], template: 't28' } });
const seq = (sh, from, n) => shiftDays(sh, from, n).map(d => d.code).join('');
const H = 36e5;

test('Vorlage: 28 Tage, 21 Schichten in drei Blöcken', () => {
  assert.equal(TEMPLATE_28.days.length, 28);
  assert.equal(TEMPLATE_28.days.filter(c => WORK.includes(c)).length, 21);
  assert.equal(TEMPLATE_28.blocks.join(''), TEMPLATE_28.days.join(''));
  assert.deepEqual(TEMPLATE_28.blocks.map(b => b.length), [9, 10, 9]);
  assert.equal(TEMPLATE_28.days.join(''), 'FFSSSNN--FFFSSNN---FFSSNNN--');
});

test('Muster: Tag 1 ist der Starttag, danach geht es im Kreis', () => {
  const sh = tpl('2026-10-05');
  assert.equal(seq(sh, '2026-10-05', 28), 'FFSSSNN--FFFSSNN---FFSSNNN--');
  assert.equal(seq(sh, '2026-11-02', 3), 'FFS');
  assert.deepEqual(shiftOn(sh, '2026-11-02'), { code: 'F', source: 'pattern' });
});

test('Muster gilt auch vor dem Starttag', () => {
  const sh = tpl('2026-10-05');
  assert.equal(shiftOn(sh, '2026-10-04').code, '-');   // Tag 28
  assert.equal(shiftOn(sh, '2026-10-02').code, 'N');   // Tag 26
  assert.equal(seq(sh, '2026-09-07', 7), 'FFSSSNN');   // genau 28 Tage vorher
  assert.equal(shiftOn(sh, '2025-10-06').code, 'F');   // 364 Tage = 13 Runden vorher
});

test('Muster über Monats- und Jahresgrenzen', () => {
  const sh = tpl('2026-12-20');
  assert.equal(seq(sh, '2026-12-28', 7), '-FFFSSN');
  assert.equal(shiftOn(sh, '2027-01-17').code, 'F');   // Tag 29
  assert.equal(shiftOn(sh, '2027-01-01').code, 'S');   // Tag 13
  const feb = tpl('2027-02-01');
  assert.equal(shiftOn(feb, '2027-03-01').code, 'F');  // Februar mit 28 Tagen
  const leap = tpl('2028-02-01');
  assert.equal(shiftOn(leap, '2028-02-29').code, 'F'); // Schaltjahr
  assert.equal(shiftOn(leap, '2028-03-01').code, 'F');
});

test('Zeitumstellung verschiebt keinen Tag', () => {
  /* 25.10.2026 hat 25 Stunden, 28.03.2027 hat 23 Stunden */
  assert.equal(localMs('2026-10-26') - localMs('2026-10-25'), 25 * H);
  assert.equal(localMs('2027-03-29') - localMs('2027-03-28'), 23 * H);
  assert.equal(addDays('2026-10-24', 1), '2026-10-25');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
  assert.equal(addDays('2027-03-27', 2), '2027-03-29');
  assert.equal(dayNum('2027-03-28') - dayNum('2026-10-19'), 160);
  const sh = tpl('2026-10-19');
  assert.equal(seq(sh, '2026-10-24', 3), 'NN-');
  assert.equal(seq(sh, '2027-03-27', 3), 'FFS');       // Tag 20 bis 22 der Runde
});

test('Wochentage und Wochenbeginn', () => {
  assert.equal(weekdayOf('2026-10-05'), 0);
  assert.equal(weekdayOf('2026-09-30'), 2);
  assert.equal(weekdayOf('2026-10-04'), 6);
  assert.equal(mondayOf('2026-10-04'), '2026-09-28');
  assert.equal(mondayOf('2027-01-01'), '2026-12-28');
  assert.equal(fromMin(toMin('15:30') + 75), '16:45');
  assert.ok(isYmd('2028-02-29'));
  assert.ok(!isYmd('2027-02-29'));
  assert.ok(!isYmd('2026-1-5'));
});

test('Rangfolge je Tag: Einzeländerung vor Import vor Muster', () => {
  const sh = tpl('2026-10-05');
  sh.imported = { '2026-10-06': 'N', '2026-10-08': 'U' };
  sh.importInfo = { at: 1, from: '2026-10-06', to: '2026-10-10', shifts: 1, unknown: 0 };
  sh.overrides = { '2026-10-08': 'F', '2026-10-12': 'U' };
  assert.deepEqual(shiftOn(sh, '2026-10-05'), { code: 'F', source: 'pattern' });   // vor dem Import
  assert.deepEqual(shiftOn(sh, '2026-10-06'), { code: 'N', source: 'import' });
  assert.deepEqual(shiftOn(sh, '2026-10-07'), { code: '-', source: 'import' });    // im Zeitraum ohne Termin: frei
  assert.deepEqual(shiftOn(sh, '2026-10-08'), { code: 'F', source: 'override' });
  assert.deepEqual(baseShift(sh, '2026-10-08'), { code: 'U', source: 'import' });
  assert.deepEqual(shiftOn(sh, '2026-10-11'), { code: 'N', source: 'pattern' });  // nach dem Import
  assert.deepEqual(shiftOn(sh, '2026-10-12'), { code: 'U', source: 'override' });
  /* Ohne Muster ist außerhalb des Imports nichts bekannt */
  const only = { ...sh, pattern: null };
  assert.deepEqual(shiftOn(only, '2026-10-20'), { code: null, source: null });
});

test('Einzeländerung setzen und „wie im Plan“', () => {
  const sh = tpl('2026-10-05');
  let o = setOverride(sh, '2026-10-05', 'U');
  assert.deepEqual(o, { '2026-10-05': 'U' });
  o = setOverride({ ...sh, overrides: o }, '2026-10-05', 'F');   // gleich wie im Plan: keine Änderung nötig
  assert.deepEqual(o, {});
  o = setOverride({ ...sh, overrides: { '2026-10-05': 'N' } }, '2026-10-05', null);
  assert.deepEqual(o, {});
});

test('Schichtplan eingerichtet: Muster oder Import, Einzeländerungen allein reichen nicht', () => {
  assert.equal(hasShiftPlan(defaultShifts()), false);
  assert.equal(hasShiftPlan(null), false);
  assert.equal(hasShiftPlan(tpl('2026-10-05')), true);
  assert.equal(hasShiftPlan({ ...defaultShifts(), importInfo: { from: '2026-10-01', to: '2026-10-31' } }), true);
  assert.equal(hasShiftPlan({ ...defaultShifts(), overrides: { '2026-10-01': 'F' } }), false);
});

test('Schichtzeiten als Text', () => {
  const t = defaultShifts().times;
  assert.equal(timesText(t, 'F'), '06–14 Uhr');
  assert.equal(timesText(t, 'N'), '22–06 Uhr');
  assert.equal(timesText({ F: ['05:45', '13:45'] }, 'F'), '05:45–13:45 Uhr');
  assert.equal(timesText(t, '-'), '');
});

test('Grundzustand und alte Stände ohne Schichtplan', () => {
  assert.deepEqual(defaultState().shifts, defaultShifts());
  const old = defaultState();
  delete old.shifts;
  const n = normalize(old);
  assert.deepEqual(n.shifts, defaultShifts());
  assert.equal(hasShiftPlan(n.shifts), false);
});

test('normalize räumt kaputte Schichtdaten auf', () => {
  const s = defaultState();
  s.shifts = {
    pattern: { start: '2026-13-01', days: ['F'] },
    imported: { '2026-10-01': 'F', 'x': 'S', '2026-10-02': 'Q' },
    importInfo: null,
    overrides: { '2026-10-03': 'U', '2026-10-04': 'Z', 'kaputt': 'F' },
    times: { F: ['6 Uhr', '14:00'], S: ['14:00'] },
    prefer: { F: '25:00', N: '16:30' },
    exported: { '2026-09-28': 123, foo: 1, '2026-10-05': 'x' },
  };
  const sh = normalize(s).shifts;
  assert.equal(sh.pattern, null);                                   // ungültiger Starttag
  assert.deepEqual(sh.imported, {});                                 // ohne Zeitraum kein Import
  assert.deepEqual(sh.overrides, { '2026-10-03': 'U' });
  assert.deepEqual(sh.times, { F: ['06:00', '14:00'], S: ['14:00', '22:00'], N: ['22:00', '06:00'] });
  assert.deepEqual(sh.prefer, { F: '15:30', S: '10:00', N: '16:30', '-': '11:00' });
  assert.deepEqual(sh.exported, { '2026-09-28': 123 });
  const ok = normalizeShifts({
    pattern: { start: '2026-10-05', days: ['F', 'S', 'N', '-', 'U', 'F', 'F'] },
    imported: { '2026-10-01': 'F', '2026-10-02': 'U', '2026-10-03': '-' },
    importInfo: { at: 5, from: '2026-10-01', to: '2026-10-31', shifts: 1, unknown: 2 },
  });
  assert.deepEqual(ok.pattern, { start: '2026-10-05', days: ['F', 'S', 'N', '-', 'U', 'F', 'F'], template: null });
  assert.deepEqual(ok.imported, { '2026-10-01': 'F', '2026-10-02': 'U' });
  assert.deepEqual(ok.importInfo, { at: 5, from: '2026-10-01', to: '2026-10-31', shifts: 1, unknown: 2 });
});

test('Der Schichtplan steckt im Backup', () => {
  const s = defaultState();
  s.shifts = tpl('2026-10-05');
  s.shifts.overrides = { '2026-10-06': 'U' };
  const back = fromBackup(JSON.parse(JSON.stringify(toBackup(s))));
  assert.equal(back.shifts.pattern.start, '2026-10-05');
  assert.equal(back.shifts.pattern.template, 't28');
  assert.deepEqual(back.shifts.overrides, { '2026-10-06': 'U' });
});
