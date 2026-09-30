process.env.TZ = 'Europe/Berlin';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  unfold, parseLine, parseIcs, parseDateValue, parseDuration, toLocal, zoneOf,
  codeFromTitle, codeFromTime, shiftsFromIcs,
} from '../js/domain/ics-parse.js';
import { DEFAULT_TIMES } from '../js/domain/shifts.js';

/* Kalender aus Terminen; jeder Termin ist eine Liste von Zeilen ohne BEGIN/END */
const cal = (events, nl = '\r\n') => [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Test//DE',
  ...events.flatMap((e, i) => ['BEGIN:VEVENT', `UID:e${i}@test`, 'DTSTAMP:20260901T000000Z', ...e, 'END:VEVENT']),
  'END:VCALENDAR', '',
].join(nl);
const tz = (start, end, title, extra = []) => [`DTSTART;TZID=Europe/Berlin:${start}`, `DTEND;TZID=Europe/Berlin:${end}`, `SUMMARY:${title}`, ...extra];
const read = (events, opts) => shiftsFromIcs(cal(events), opts);

test('Zeilenfaltung: Leerzeichen oder Tab am Zeilenanfang setzt die Zeile fort', () => {
  const lines = unfold('SUMMARY:Früh\r\n schicht Hal\r\n\tle 3\r\nLOCATION:Werk\nDESCRIPTION:a\n b');
  assert.deepEqual(lines, ['SUMMARY:Frühschicht Halle 3', 'LOCATION:Werk', 'DESCRIPTION:ab']);
});

test('Eigenschaften mit Parametern, auch mit Doppelpunkt in Anführungszeichen', () => {
  const p = parseLine('DTSTART;TZID="Europe/Berlin";VALUE=DATE-TIME:20261014T060000');
  assert.equal(p.name, 'DTSTART');
  assert.deepEqual(p.params, { TZID: 'Europe/Berlin', VALUE: 'DATE-TIME' });
  assert.equal(p.value, '20261014T060000');
  assert.equal(parseLine('X-A;X-B="a:b":wert').value, 'wert');
  assert.equal(parseLine('ohne doppelpunkt'), null);
});

test('Gefaltete Titel mit Maskierung werden gelesen', () => {
  const ics = cal([[
    'DTSTART;TZID=Europe/Berlin:20261005T060000', 'DTEND;TZID=Europe/Berlin:20261005T140000',
    'SUMMARY:Frühschicht Werkstatt\\, Halle 3\\; mit einem Titel\\, der so lang ist\\, dass er gef',
    ' altet werden muss',
  ]]);
  const [ev] = parseIcs(ics);
  assert.equal(ev.summary, 'Frühschicht Werkstatt, Halle 3; mit einem Titel, der so lang ist, dass er gefaltet werden muss');
  assert.deepEqual(shiftsFromIcs(ics).days, { '2026-10-05': 'F' });
});

test('Zeiten mit TZID, in UTC, ohne Zone und ganztägig', () => {
  const berlin = toLocal(parseDateValue({ params: { TZID: 'Europe/Berlin' }, value: '20261014T060000' }));
  assert.equal(berlin.date, '2026-10-14');
  assert.equal(berlin.min, 360);
  /* UTC: im Sommer 04:00Z = 06:00, im Winter 05:00Z = 06:00 */
  const summer = toLocal(parseDateValue({ params: {}, value: '20261014T040000Z' }));
  assert.deepEqual([summer.date, summer.min], ['2026-10-14', 360]);
  const winter = toLocal(parseDateValue({ params: {}, value: '20261104T050000Z' }));
  assert.deepEqual([winter.date, winter.min], ['2026-11-04', 360]);
  /* Andere Zone: 05:00 in London ist 06:00 in Berlin */
  const london = toLocal(parseDateValue({ params: { TZID: 'Europe/London' }, value: '20261014T050000' }));
  assert.deepEqual([london.date, london.min], ['2026-10-14', 360]);
  /* UTC am späten Abend landet am nächsten Tag */
  const late = toLocal(parseDateValue({ params: {}, value: '20261013T230000Z' }));
  assert.deepEqual([late.date, late.min], ['2026-10-14', 60]);
  const floating = toLocal(parseDateValue({ params: {}, value: '20261014T140000' }));
  assert.deepEqual([floating.date, floating.min], ['2026-10-14', 840]);
  const allDay = parseDateValue({ params: { VALUE: 'DATE' }, value: '20261019' });
  assert.deepEqual(allDay, { date: '2026-10-19', allDay: true });
  assert.deepEqual(parseDateValue({ params: {}, value: '20261019' }), { date: '2026-10-19', allDay: true });
  assert.equal(parseDateValue({ params: {}, value: '20261319T100000' }), null);
});

test('Zeitzonen-Namen aus Outlook und Pfade werden erkannt, unbekannte als Ortszeit gelesen', () => {
  assert.equal(zoneOf('Europe/Berlin'), null);                     // Zone des Geräts: Uhrzeit wie angegeben
  assert.equal(zoneOf('W. Europe Standard Time'), null);
  assert.equal(zoneOf('/mozilla.org/20070129_1/Europe/London'), 'Europe/London');
  assert.equal(zoneOf('Foo/Bar'), null);
  const r = read([['DTSTART;TZID=Irgendwas:20261014T220000', 'DTEND;TZID=Irgendwas:20261015T060000', 'SUMMARY:Dienst']]);
  assert.deepEqual(r.days, { '2026-10-14': 'N' });
});

test('Dauer statt Ende', () => {
  assert.equal(parseDuration('PT8H'), 480);
  assert.equal(parseDuration('P1D'), 1440);
  assert.equal(parseDuration('PT7H30M'), 450);
  assert.equal(parseDuration('P1W'), 10080);
  assert.equal(parseDuration('quatsch'), null);
  const r = read([['DTSTART;TZID=Europe/Berlin:20261014T060000', 'DURATION:PT8H', 'SUMMARY:Arbeit']]);
  assert.deepEqual(r.days, { '2026-10-14': 'F' });
  const short = read([['DTSTART;TZID=Europe/Berlin:20261014T060000', 'DURATION:PT1H', 'SUMMARY:Arbeit']]);
  assert.deepEqual(short.days, {});
  assert.equal(short.unknown.length, 1);
});

test('Nachtschicht über Mitternacht zählt zum Tag, an dem sie beginnt, auch in der Nacht der Zeitumstellung', () => {
  const r = read([
    tz('20261009T220000', '20261010T060000', 'Nachtschicht'),
    tz('20261024T220000', '20261025T060000', 'N'),
    tz('20261025T220000', '20261026T060000', 'Nachtdienst'),
    ['DTSTART:20261026T210000Z', 'DTEND:20261027T050000Z', 'SUMMARY:Dienst'],   // 22:00 Winterzeit, nur über die Startzeit
  ]);
  assert.deepEqual(r.days, { '2026-10-09': 'N', '2026-10-24': 'N', '2026-10-25': 'N', '2026-10-26': 'N' });
  assert.equal(r.from, '2026-10-09');
  assert.equal(r.to, '2026-10-26');
});

test('Schichtart aus dem Titel', () => {
  const cases = {
    Frühschicht: 'F', Frueh: 'F', 'Früh': 'F', F: 'F', 'F-Schicht': 'F', 'F 06-14': 'F', 'Frühdienst Halle': 'F', 'Early shift': 'F',
    Spätschicht: 'S', Spaetdienst: 'S', S: 'S', 's-dienst': 'S', 'Late': 'S',
    Nachtschicht: 'N', Nacht: 'N', N: 'N', 'N (22-06)': 'N', 'Night': 'N',
    Urlaub: 'U', 'Urlaub Ostsee': 'U', frei: '-', 'Frei (Überstunden)': '-',
    'Frühstück mit Team': null, 'S-Bahn': null, Freitag: null, Zahnarzt: null, '': null, Dienst: null,
  };
  Object.entries(cases).forEach(([title, code]) => assert.equal(codeFromTitle(title), code, title));
  assert.equal(codeFromTitle('Früh/Spät getauscht'), 'F');
});

test('Schichtart aus der Startzeit, wenn der Titel nichts verrät', () => {
  assert.equal(codeFromTime(5 * 60), 'F');
  assert.equal(codeFromTime(8 * 60), 'F');
  assert.equal(codeFromTime(13 * 60 + 45), 'S');
  assert.equal(codeFromTime(21 * 60), 'N');
  assert.equal(codeFromTime(0), 'N');
  assert.equal(codeFromTime(10 * 60), null);
  assert.equal(codeFromTime(18 * 60), null);
  /* Eigene Schichtzeiten verschieben die Fenster */
  assert.equal(codeFromTime(10 * 60, { ...DEFAULT_TIMES, F: ['09:00', '17:00'] }), 'F');
});

test('Abgesagte Termine fallen weg, unerkannte werden genannt, kurze zählen nicht über die Uhrzeit', () => {
  const r = read([
    tz('20261012T060000', '20261012T140000', 'Frühschicht', ['STATUS:CANCELLED']),
    tz('20261013T070000', '20261013T080000', 'Zahnarzt'),
    tz('20261014T133000', '20261014T220000', 'Dienst'),
    ['DTSTART;VALUE=DATE:20261015', 'DTEND;VALUE=DATE:20261016', 'SUMMARY:Geburtstag'],
    tz('20261016T100000', '20261016T180000', 'Schulung'),
  ]);
  assert.deepEqual(r.days, { '2026-10-14': 'S' });
  assert.equal(r.cancelled, 1);
  assert.deepEqual(r.unknown.map(u => [u.date, u.title]), [['2026-10-13', 'Zahnarzt'], ['2026-10-15', 'Geburtstag'], ['2026-10-16', 'Schulung']]);
  assert.equal(r.shifts, 1);
});

test('Urlaub über mehrere Tage und Vorrang bei zwei Terminen am selben Tag', () => {
  const r = read([
    ['DTSTART;VALUE=DATE:20261019', 'DTEND;VALUE=DATE:20261022', 'SUMMARY:Urlaub'],
    tz('20261020T060000', '20261020T140000', 'Frühschicht'),
    tz('20261023T060000', '20261023T140000', 'Frühschicht'),
    tz('20261023T140000', '20261023T220000', 'Spätschicht'),
  ]);
  assert.deepEqual(r.days, { '2026-10-19': 'U', '2026-10-20': 'U', '2026-10-21': 'U', '2026-10-23': 'F' });
  assert.equal(r.vacation, 3);
  assert.equal(r.shifts, 1);
  assert.equal(r.conflicts, 2);
});

test('Wöchentliche und tägliche Serien, Ausnahmen und verschobene Einzeltermine', () => {
  const r = read([
    [...tz('20261027T060000', '20261027T140000', 'Früh'), 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=4'],
    [...tz('20261102T140000', '20261102T220000', 'Spät'), 'RRULE:FREQ=DAILY;INTERVAL=7;UNTIL=20261124T000000Z', 'EXDATE;TZID=Europe/Berlin:20261109T140000'],
  ]);
  assert.deepEqual(r.days, {
    '2026-10-27': 'F', '2026-10-29': 'F', '2026-11-03': 'F', '2026-11-05': 'F',
    '2026-11-02': 'S', '2026-11-16': 'S', '2026-11-23': 'S',
  });
  /* Ein Termin der Serie wird verschoben, ein anderer abgesagt */
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT', 'UID:serie', ...tz('20261102T060000', '20261102T140000', 'Früh'), 'RRULE:FREQ=DAILY;COUNT=3', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:serie', 'RECURRENCE-ID;TZID=Europe/Berlin:20261103T060000', ...tz('20261103T140000', '20261103T220000', 'Spät'), 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:serie', 'RECURRENCE-ID;TZID=Europe/Berlin:20261104T060000', ...tz('20261104T060000', '20261104T140000', 'Früh'), 'STATUS:CANCELLED', 'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const r2 = shiftsFromIcs(ics);
  assert.deepEqual(r2.days, { '2026-11-02': 'F', '2026-11-03': 'S' });
  assert.equal(r2.cancelled, 1);
});

test('Monatliche Serien zählen nur mit dem ersten Termin und werden gemeldet; endlose Serien enden am Horizont', () => {
  const r = read([[...tz('20261005T060000', '20261005T140000', 'Frühschicht'), 'RRULE:FREQ=MONTHLY;BYMONTHDAY=5']]);
  assert.deepEqual(r.days, { '2026-10-05': 'F' });
  assert.equal(r.unsupported, 1);
  const endless = read([[...tz('20261005T220000', '20261006T060000', 'Nacht'), 'RRULE:FREQ=DAILY;INTERVAL=28']], { until: '2027-01-31' });
  assert.deepEqual(Object.keys(endless.days), ['2026-10-05', '2026-11-02', '2026-11-30', '2026-12-28', '2027-01-25']);
});

test('Nur Datum und Schichtart kommen heraus, keine Titel, Orte oder Notizen', () => {
  const r = read([[...tz('20261005T060000', '20261005T140000', 'Frühschicht Kunde Geheim'), 'LOCATION:Werk Nord', 'DESCRIPTION:Schlüssel beim Pförtner']]);
  assert.deepEqual(r.days, { '2026-10-05': 'F' });
  const json = JSON.stringify({ days: r.days, from: r.from, to: r.to, shifts: r.shifts });
  assert.ok(!/Geheim|Werk|Pförtner/.test(json));
});

test('LF statt CRLF, Byte-Order-Mark und Alarme im Termin stören nicht', () => {
  const ics = '﻿' + cal([[...tz('20261005T060000', '20261005T140000', 'Früh'), 'BEGIN:VALARM', 'TRIGGER:-PT1H', 'SUMMARY:Spät', 'END:VALARM']], '\n');
  const r = shiftsFromIcs(ics);
  assert.deepEqual(r.days, { '2026-10-05': 'F' });
});

test('Keine Kalender-Datei', () => {
  assert.throws(() => shiftsFromIcs('{"app":"fit"}'), /keine Kalender-Datei/);
  const empty = shiftsFromIcs('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
  assert.equal(empty.from, null);
  assert.equal(empty.shifts, 0);
});
