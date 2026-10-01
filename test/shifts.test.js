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
  /* T (Tag) und X (24-h-Dienst) sind seit den Schichtarten voreingestellt */
  assert.deepEqual(sh.times, { F: ['06:00', '14:00'], S: ['14:00', '22:00'], N: ['22:00', '06:00'], T: ['06:00', '18:00'], X: ['07:00', '07:00'] });
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

/* ---------- Schichtarten ---------- */
import {
  DEFAULT_TYPES, TYPE_TIMES, PATTERN_MIN, PATTERN_MAX, typeOf, catOf, isWork, typeLong, shortOf, shiftClass, newTypeId,
  dayShift, typeTimes, fmtTimes, typeUsage, removeType, shiftMinutes, overnight, patternIndex,
} from '../js/domain/shifts.js';

test('Voreingestellte Schichtarten mit Kategorie, Farbe und Zeiten', () => {
  assert.deepEqual(DEFAULT_TYPES.map(t => `${t.id} ${t.name} ${t.cat}`), [
    'F Früh early', 'S Spät late', 'N Nacht night', 'T Tag day', 'X 24-h-Dienst h24',
    'D Dispo dispo', '- frei off', 'U Urlaub vacation', 'K Krank sick',
  ]);
  const sh = defaultShifts();
  assert.deepEqual(sh.times, TYPE_TIMES);
  assert.deepEqual(typeTimes(sh, 'T'), ['06:00', '18:00']);
  assert.deepEqual(typeTimes(sh, 'X'), ['07:00', '07:00']);
  assert.equal(typeTimes(sh, 'D'), null);
  assert.equal(typeTimes(sh, '-'), null);
  assert.equal(shiftMinutes(sh.times.X), 1440);
  assert.equal(shiftMinutes(sh.times.N), 480);
  assert.deepEqual([overnight(sh.times.N), overnight(sh.times.X), overnight(sh.times.T)], [true, true, false]);
  assert.deepEqual(['F', 'T', 'X', 'D', 'U', 'K', '-', null].map(c => isWork(sh, c)), [true, true, true, false, false, false, false, false]);
  assert.equal(typeLong(typeOf(sh, 'F')), 'Frühschicht');
  assert.equal(typeLong(typeOf(sh, 'T')), 'Tagschicht');
  assert.equal(typeLong(typeOf(sh, 'X')), '24-h-Dienst');
  assert.equal(typeLong({ ...typeOf(sh, 'F'), name: 'Frühdienst' }), 'Frühdienst');
  assert.deepEqual([shortOf(sh, '-'), shortOf(sh, null)], ['–', '?']);
  assert.deepEqual([shiftClass(sh, 'F'), shiftClass(sh, '-'), shiftClass(sh, null), shiftClass(sh, 'X')], ['sh-c-yellow', 'sh-x', 'sh-q', 'sh-c-red']);
  assert.equal(fmtTimes(['07:00', '07:00']), '07–07 Uhr');
  assert.equal(newTypeId(sh.types), 'c1');
  assert.equal(newTypeId([...sh.types, { id: 'c1' }, { id: 'c2' }]), 'c3');
});

test('Eigene Schichtart im Muster, mit eigenen Zeiten und Kategorie', () => {
  const sh = defaultShifts();
  sh.types.push({ id: 'c1', short: 'Z', name: 'Zwischendienst', cat: 'early', color: 'teal' });
  sh.times.c1 = ['07:30', '15:30'];
  sh.pattern = { start: '2026-10-05', days: ['c1', 'c1', 'S', '-', '-', 'N', 'N'], template: null };
  const n = normalizeShifts(JSON.parse(JSON.stringify(sh)));
  assert.deepEqual(n.types.at(-1), { id: 'c1', short: 'Z', name: 'Zwischendienst', cat: 'early', color: 'teal' });
  assert.deepEqual(n.times.c1, ['07:30', '15:30']);
  assert.deepEqual(n.pattern.days.slice(0, 2), ['c1', 'c1']);
  const day = dayShift(n, '2026-10-06');
  assert.deepEqual([day.code, day.cat, day.times, day.ownTimes, day.source], ['c1', 'early', ['07:30', '15:30'], false, 'pattern']);
  assert.equal(catOf(n, 'c1'), 'early');
  assert.equal(shiftClass(n, 'c1'), 'sh-c-teal');
});

test('Einzeltag mit eigener Uhrzeit und mit anderer Art', () => {
  const sh = tpl('2026-10-05');
  /* Montag Früh, aber heute 05:00–13:00 */
  sh.overrides = setOverride(sh, '2026-10-05', 'F', ['05:00', '13:00']);
  assert.deepEqual(sh.overrides, { '2026-10-05': { code: 'F', times: ['05:00', '13:00'] } });
  assert.deepEqual(shiftOn(sh, '2026-10-05'), { code: 'F', source: 'override' });
  const d = dayShift(sh, '2026-10-05');
  assert.deepEqual([d.times, d.ownTimes], [['05:00', '13:00'], true]);
  /* Wieder die üblichen Zeiten: die Änderung verschwindet */
  assert.deepEqual(setOverride(sh, '2026-10-05', 'F', ['06:00', '14:00']), {});
  /* Art und Zeit zugleich: Dienstag Tagschicht 08–20 */
  sh.overrides = setOverride(sh, '2026-10-06', 'T', ['08:00', '20:00']);
  assert.deepEqual(dayShift(sh, '2026-10-06').times, ['08:00', '20:00']);
  /* Urlaub hat keine Uhrzeiten */
  assert.deepEqual(setOverride(sh, '2026-10-07', 'U', ['08:00', '20:00'])['2026-10-07'], 'U');
  /* normalize behält beides, wirft kaputte Zeiten weg */
  const n = normalizeShifts({ ...sh, overrides: { ...sh.overrides, '2026-10-08': { code: 'S', times: ['25:00', '1'] }, '2026-10-09': { code: 'Q' } } });
  assert.deepEqual(n.overrides, {
    '2026-10-05': { code: 'F', times: ['05:00', '13:00'] }, '2026-10-06': { code: 'T', times: ['08:00', '20:00'] }, '2026-10-08': 'S',
  });
});

test('Schichtart löschen: im Muster wird sie frei, Import und Einzeländerungen fallen weg; frei bleibt immer', () => {
  const sh = tpl('2026-10-05');
  sh.imported = { '2026-10-20': 'N', '2026-10-21': 'F' };
  sh.importInfo = { at: 1, from: '2026-10-20', to: '2026-10-21', shifts: 2, unknown: 0 };
  sh.overrides = { '2026-10-06': 'N', '2026-10-07': { code: 'N', times: ['21:00', '05:00'] } };
  sh.importMap = { 'nd': 'N', 'fd': 'F' };
  assert.deepEqual(typeUsage(sh, 'N'), { pattern: 7, imported: 1, overrides: 2, map: 1 });
  const r = removeType(sh, 'N');
  assert.ok(!r.types.some(t => t.id === 'N'));
  assert.equal(r.pattern.days.join(''), 'FFSSS----FFFSS-----FFSS-----');
  assert.deepEqual(r.imported, { '2026-10-21': 'F' });
  assert.deepEqual(r.overrides, {});
  assert.deepEqual(r.importMap, { fd: 'F' });
  assert.equal(r.times.N, undefined);
  assert.equal(sh.types.some(t => t.id === 'N'), true);   // alter Stand unverändert
  assert.equal(removeType(sh, '-'), sh);
  /* Ohne „frei“ ergänzt normalize es wieder */
  const n = normalizeShifts({ types: [{ id: 'F', short: 'F', name: 'Früh', cat: 'early', color: 'yellow' }] });
  assert.deepEqual(n.types.map(t => t.id), ['F', '-']);
});

test('normalize: Schichtarten prüfen, doppelte und kaputte fallen weg', () => {
  const n = normalizeShifts({
    types: [
      { id: 'F', short: 'FR', name: '  Frühdienst ', cat: 'early', color: 'orange' },
      { id: 'F', short: 'X', name: 'doppelt', cat: 'late', color: 'red' },
      { id: 'c1', short: 'ABCD', name: 'Z'.repeat(40), cat: 'day', color: 'lila' },
      { id: 'c2', short: '', name: 'ohne Kürzel', cat: 'early', color: 'red' },
      { id: 'böse', short: 'B', name: 'B', cat: 'early', color: 'red' },
      { id: 'c3', short: 'Q', name: 'Q', cat: 'quatsch', color: 'red' },
      { id: '-', short: '–', name: 'frei', cat: 'early', color: 'grey' },
    ],
    times: { F: ['05:30', '13:30'], c1: ['09:00', '21:00'], '-': ['06:00', '14:00'] },
  });
  assert.deepEqual(n.types, [
    { id: 'F', short: 'FR', name: 'Frühdienst', cat: 'early', color: 'orange' },
    { id: 'c1', short: 'ABC', name: 'Z'.repeat(24), cat: 'day', color: 'steel' },
    { id: '-', short: '–', name: 'frei', cat: 'off', color: 'grey' },
  ]);
  assert.deepEqual(n.times, { F: ['05:30', '13:30'], c1: ['09:00', '21:00'] });
});

test('Muster von 2 bis 371 Tagen', () => {
  assert.deepEqual([PATTERN_MIN, PATTERN_MAX], [2, 371]);
  const days = Array.from({ length: 371 }, (_, i) => (i % 53 === 0 ? 'F' : i === 370 ? 'N' : '-'));
  const n = normalizeShifts({ pattern: { start: '2026-01-05', days } });
  assert.equal(n.pattern.days.length, 371);
  const sh = { ...defaultShifts(), pattern: n.pattern };
  assert.equal(shiftOn(sh, '2026-01-05').code, 'F');
  assert.equal(shiftOn(sh, addDays('2026-01-05', 370)).code, 'N');
  assert.equal(shiftOn(sh, addDays('2026-01-05', 371)).code, 'F');       // zweite Runde
  assert.equal(shiftOn(sh, addDays('2026-01-05', 371 + 53)).code, 'F');
  assert.equal(shiftOn(sh, addDays('2026-01-05', -1)).code, 'N');        // vor dem Start
  assert.equal(patternIndex(sh.pattern, addDays('2026-01-05', 742 + 5)), 5);
  assert.equal(normalizeShifts({ pattern: { start: '2026-01-05', days: [...days, '-'] } }).pattern, null);
  assert.equal(normalizeShifts({ pattern: { start: '2026-01-05', days: ['X', '-'] } }).pattern.days.join(''), 'X-');
});

/* ---------- Umzug von Version 4.4 ---------- */
/* So sah ein Stand aus 4.4 aus: feste Codes, Zeiten nur für F, S und N, Vorlage t28, Import, Einzeländerungen */
const STAND_44 = {
  pattern: { start: '2026-09-14', days: 'FFSSSNN--FFFSSNN---FFSSNNN--'.split(''), template: 't28' },
  imported: { '2026-10-01': 'F', '2026-10-02': 'S', '2026-10-05': 'U', '2026-10-06': 'N' },
  importInfo: { at: 1759300000000, from: '2026-10-01', to: '2026-10-10', shifts: 3, unknown: 1 },
  overrides: { '2026-10-12': 'U', '2026-10-13': '-', '2026-10-14': 'N' },
  times: { F: ['05:45', '13:45'], S: ['13:45', '21:45'], N: ['21:45', '05:45'] },
  prefer: { F: '15:00', S: '09:30', N: '16:00', '-': '10:30' },
  exported: { '2026-09-28': 1759000000000 },
};

test('Ein Stand aus 4.4 läuft ohne Datenverlust weiter', () => {
  const n = normalizeShifts(JSON.parse(JSON.stringify(STAND_44)));
  assert.deepEqual(n.pattern, STAND_44.pattern);
  assert.deepEqual(n.imported, STAND_44.imported);
  assert.deepEqual(n.importInfo, STAND_44.importInfo);
  assert.deepEqual(n.overrides, STAND_44.overrides);
  assert.deepEqual(n.prefer, STAND_44.prefer);
  assert.deepEqual(n.exported, STAND_44.exported);
  /* Eigene Zeiten bleiben, die neuen Arten kommen mit ihren Standardzeiten dazu */
  assert.deepEqual(n.times, { ...STAND_44.times, T: ['06:00', '18:00'], X: ['07:00', '07:00'] });
  assert.deepEqual(n.types, DEFAULT_TYPES);
  assert.deepEqual(n.importMap, {});
  /* Jeder Tag hat dieselbe Schicht wie vorher */
  const old = { ...STAND_44 };
  for (let d = '2026-09-01'; d <= '2026-12-31'; d = addDays(d, 1)) assert.deepEqual(shiftOn(n, d), shiftOn(old, d), d);
  assert.deepEqual(dayShift(n, '2026-10-06').times, ['21:45', '05:45']);
  /* Zweimal normalisiert bleibt gleich */
  assert.deepEqual(normalizeShifts(JSON.parse(JSON.stringify(n))), n);
});

test('Backup aus 4.4 lädt weiter', () => {
  const s = defaultState();
  s.shifts = JSON.parse(JSON.stringify(STAND_44));
  delete s.shifts.types;
  const back = fromBackup({ app: 'fit', version: 2, exportedAt: '2026-09-30T10:00:00.000Z', data: JSON.parse(JSON.stringify(s)) });
  assert.deepEqual(back.shifts.pattern, STAND_44.pattern);
  assert.deepEqual(back.shifts.overrides, STAND_44.overrides);
  assert.deepEqual(back.shifts.times.F, ['05:45', '13:45']);
  assert.equal(back.shifts.types.length, DEFAULT_TYPES.length);
  /* Und ein neuer Stand mit eigener Art und Tageszeit kommt durch das Backup */
  back.shifts.types.push({ id: 'c1', short: 'Z', name: 'Zwischen', cat: 'early', color: 'teal' });
  back.shifts.times.c1 = ['07:30', '15:30'];
  back.shifts.overrides['2026-10-15'] = { code: 'c1', times: ['08:00', '16:00'] };
  back.shifts.importMap = { 'bd 12h': 'T' };
  const again = fromBackup(JSON.parse(JSON.stringify(toBackup(back))));
  assert.deepEqual(again.shifts, back.shifts);
});
