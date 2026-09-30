process.env.TZ = 'Europe/Berlin';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainingsIcs, escapeText, foldLine, trainingUid, utcStamp, ICS_TZ, ICS_FILE } from '../js/domain/ics-write.js';
import { parseIcs, toLocal, unfold } from '../js/domain/ics-parse.js';
import { planTrainings } from '../js/domain/shift-plan.js';
import { defaultShifts, TEMPLATE_28 } from '../js/domain/shifts.js';
import { defaultState } from '../js/store/migrate.js';

const NOW = Date.UTC(2026, 8, 30, 10, 0, 0);
const item = (o = {}) => ({
  date: '2026-10-14', time: '15:30', end: '16:45', minutes: 75, dayId: 'push', name: 'Push', color: 'red',
  muscles: 'Brust, Schulter, Trizeps', shift: 'F', reason: 'nach der Frühschicht', note: null, ...o,
});
const bytes = s => new TextEncoder().encode(s).length;

test('Kalender-Datei: Aufbau, Zeitzone, UID, Erinnerung', () => {
  const ics = trainingsIcs([item()], { now: NOW });
  const lines = ics.split('\r\n');
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(lines.includes('VERSION:2.0'));
  assert.ok(lines.some(l => l.startsWith('PRODID:')));
  /* VTIMEZONE für Europe/Berlin mit Sommer- und Winterzeit */
  const tz = ics.slice(ics.indexOf('BEGIN:VTIMEZONE'), ics.indexOf('END:VTIMEZONE'));
  assert.match(tz, /TZID:Europe\/Berlin/);
  assert.match(tz, /BEGIN:DAYLIGHT[\s\S]*TZOFFSETTO:\+0200[\s\S]*BYMONTH=3;BYDAY=-1SU/);
  assert.match(tz, /BEGIN:STANDARD[\s\S]*TZOFFSETTO:\+0100[\s\S]*BYMONTH=10;BYDAY=-1SU/);
  assert.ok(ics.indexOf('END:VTIMEZONE') < ics.indexOf('BEGIN:VEVENT'));
  const ev = ics.slice(ics.indexOf('BEGIN:VEVENT'), ics.indexOf('END:VEVENT'));
  assert.match(ev, /\r\nUID:split-2026-10-14@split\r\n/);
  assert.match(ev, /\r\nDTSTAMP:20260930T100000Z\r\n/);
  assert.match(ev, /\r\nDTSTART;TZID=Europe\/Berlin:20261014T153000\r\n/);
  assert.match(ev, /\r\nDTEND;TZID=Europe\/Berlin:20261014T164500\r\n/);
  assert.match(ev, /\r\nSUMMARY:Split: Push\r\n/);
  assert.match(ev, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Split: Push\r\nTRIGGER:-PT30M\r\nEND:VALARM/);
  assert.equal(ICS_TZ, 'Europe/Berlin');
  assert.equal(ICS_FILE, 'split-training.ics');
  assert.equal(trainingUid('2026-10-14'), 'split-2026-10-14@split');
  assert.equal(utcStamp(NOW), '20260930T100000Z');
});

test('Nur CRLF als Zeilenende, keine Zeile über 75 Oktette', () => {
  const long = item({ reason: 'vor der Nachtschicht, nach dem Ausschlafen', note: null, muscles: 'Beine, Adduktoren, Abduktoren, Bauch; dazu Waden und Gesäß, Rücken — alles übergröße' });
  const ics = trainingsIcs([long, item({ date: '2026-10-16' })], { now: NOW });
  assert.ok(!/[^\r]\n/.test(ics), 'LF ohne CR');
  assert.ok(!/\r(?!\n)/.test(ics), 'CR ohne LF');
  ics.split('\r\n').forEach(l => assert.ok(bytes(l) <= 75, `${bytes(l)} Oktette: ${l}`));
  assert.ok(ics.includes('\r\n '), 'mindestens eine gefaltete Zeile');
});

test('Faltung zerteilt keine Umlaute und lässt sich verlustfrei zurückfalten', () => {
  const line = 'DESCRIPTION:' + 'Übung für Schultern und Gesäß, '.repeat(6);
  const folded = foldLine(line);
  folded.split('\r\n').forEach((l, i) => {
    assert.ok(bytes(l) <= 75);
    if (i) assert.equal(l[0], ' ');
    assert.ok(!l.includes('�'));
  });
  assert.equal(unfold(folded).join(''), line);
  assert.equal(foldLine('X'.repeat(75)), 'X'.repeat(75));
  assert.equal(foldLine('X'.repeat(76)), 'X'.repeat(75) + '\r\n X');
});

test('Sonderzeichen werden maskiert', () => {
  assert.equal(escapeText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  const ics = trainingsIcs([item({ name: 'Push; schwer, mit\\ohne' })], { now: NOW });
  assert.match(ics, /SUMMARY:Split: Push\\; schwer\\, mit\\\\ohne\r\n/);
});

test('Die Datei lässt sich wieder lesen: Zeiten, Titel und Beschreibung', () => {
  const ics = trainingsIcs([item(), item({ date: '2026-11-02', time: '10:00', end: '11:05', name: 'Pull', reason: 'vor der Spätschicht' })], { now: NOW });
  const evs = parseIcs(ics);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].summary, 'Split: Push');
  const a = toLocal(evs[0].start);
  assert.deepEqual([a.date, a.min], ['2026-10-14', 15 * 60 + 30]);
  /* Nach der Zeitumstellung bleibt es 10:00 Ortszeit */
  const b = toLocal(evs[1].start);
  assert.deepEqual([b.date, b.min], ['2026-11-02', 600]);
  assert.equal(toLocal(evs[1].end).min, 11 * 60 + 5);
  assert.equal(evs[0].uid, 'split-2026-10-14@split');
  const desc = unfold(ics).find(l => l.startsWith('DESCRIPTION:Nach'));
  assert.equal(desc, 'DESCRIPTION:Nach der Frühschicht.\\nBrust\\, Schulter\\, Trizeps\\nGeplant von Split nach deinem Schichtplan.');
});

test('Geplante Woche der Vorlage als Kalender-Datei', () => {
  const s = defaultState();
  s.shifts = defaultShifts();
  s.shifts.pattern = { start: '2026-10-05', days: [...TEMPLATE_28.days], template: 't28' };
  const week = planTrainings(s, '2026-10-05', 7).trainings;
  const ics = trainingsIcs(week, { now: NOW });
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 3);
  assert.deepEqual([...ics.matchAll(/UID:(.*)\r\n/g)].map(m => m[1]), ['split-2026-10-05@split', 'split-2026-10-07@split', 'split-2026-10-09@split']);
});

test('Leere Liste: gültiger Kalender ohne Termine', () => {
  const ics = trainingsIcs([], { now: NOW });
  assert.ok(!ics.includes('BEGIN:VEVENT'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
});
