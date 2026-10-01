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

/* ---------- Schichtarten beim Import ---------- */
import { titleKey } from '../js/domain/ics-parse.js';
import { defaultShifts, DEFAULT_TYPES } from '../js/domain/shifts.js';

const app = () => { const sh = defaultShifts(); return { types: sh.types, times: sh.times }; };

test('Titel für Tag, 24-h-Dienst, Wache, Dispo und Krank', () => {
  const cases = {
    Tag: 'T', Tagschicht: 'T', Tagdienst: 'T', 'Tag 06-18': 'T', '12h Tag': 'T', 'T': 'T', 'Day shift': 'T',
    '24h': 'X', '24 h Dienst': 'X', '24-Stunden-Dienst': 'X', '24-h-Dienst': 'X', '24er': 'X', Wache: 'X', 'Wachdienst': 'X',
    Dispo: 'D', 'Reserve': 'D', Krank: 'K', 'krankgeschrieben': 'K',
    'Tag der offenen Tür': null, Geburtstag: null, Dienstag: null, Feiertag: null, 'Tagung': null,
  };
  Object.entries(cases).forEach(([title, code]) => assert.equal(codeFromTitle(title), code, title));
  /* Eine Wache von 8 Stunden ist kein 24-h-Dienst */
  assert.equal(codeFromTitle('Wache', 480), null);
  assert.equal(codeFromTitle('Wache', 1440), 'X');
});

test('Startzeit und Dauer: 12 h ab 06:00 ist Tag, 24 h ab 07:00 der 24-h-Dienst, 8 h bleibt Früh', () => {
  const { times } = app();
  assert.equal(codeFromTime(6 * 60, times, 120, 480), 'F');
  assert.equal(codeFromTime(6 * 60, times, 120, 720), 'T');
  assert.equal(codeFromTime(7 * 60, times, 120, 1440), 'X');
  assert.equal(codeFromTime(8 * 60, times, 120, 480), 'F');
  assert.equal(codeFromTime(7 * 60, times, 120, 720), 'T');
  const r = shiftsFromIcs(cal([
    tz('20261005T060000', '20261005T180000', 'Dienst'),
    tz('20261006T070000', '20261007T070000', 'Dienst'),
    tz('20261008T060000', '20261008T140000', 'Dienst'),
    tz('20261009T180000', '20261010T060000', 'Tagschicht'),
  ]), app());
  assert.deepEqual(r.days, { '2026-10-05': 'T', '2026-10-06': 'X', '2026-10-08': 'F', '2026-10-09': 'T' });
  assert.equal(r.shifts, 4);
});

test('Eigene Schichtart über Name oder Kürzel, gemerkte Zuordnung vor allem anderen', () => {
  const a = app();
  a.types = [...a.types, { id: 'c1', short: 'Z', name: 'Zwischendienst', cat: 'early', color: 'teal' }];
  a.times = { ...a.times, c1: ['07:30', '15:30'] };
  const ics = cal([
    tz('20261005T073000', '20261005T153000', 'Zwischendienst'),
    tz('20261006T073000', '20261006T153000', 'Z'),
    tz('20261007T073000', '20261007T153000', 'Arbeit'),
    tz('20261008T100000', '20261008T180000', 'BD Station 3'),
    tz('20261009T100000', '20261009T180000', 'bd  station 3'),
    tz('20261010T100000', '20261010T110000', 'Zahnarzt'),
  ]);
  const r = shiftsFromIcs(ics, a);
  assert.deepEqual(r.days, { '2026-10-05': 'c1', '2026-10-06': 'c1', '2026-10-07': 'c1' });   // 07:30: über die Zeit
  assert.deepEqual(r.unknownTitles.map(g => [g.key, g.count, g.first]), [['bd station 3', 2, '2026-10-08'], ['zahnarzt', 1, '2026-10-10']]);
  assert.equal(titleKey('  BD   Station 3 '), 'bd station 3');
  /* Zuordnung gemerkt: beim nächsten Import zählt der Titel als Tagschicht */
  const m = shiftsFromIcs(ics, { ...a, map: { 'bd station 3': 'T' } });
  assert.deepEqual([m.days['2026-10-08'], m.days['2026-10-09']], ['T', 'T']);
  assert.deepEqual(m.unknownTitles.map(g => g.key), ['zahnarzt']);
  /* Eine Zuordnung schlägt auch die Worterkennung, eine unbekannte Art wird ignoriert */
  const f = shiftsFromIcs(cal([tz('20261005T060000', '20261005T140000', 'Frühschicht')]), { ...a, map: { frühschicht: 'c1', x: 'gibtsnicht' } });
  assert.deepEqual(f.days, { '2026-10-05': 'c1' });
});

test('Gelöschte voreingestellte Art: die erste Art derselben Kategorie übernimmt', () => {
  const types = DEFAULT_TYPES.filter(t => t.id !== 'T').concat({ id: 'c1', short: 'TD', name: 'Tagdienst lang', cat: 'day', color: 'orange' });
  const r = shiftsFromIcs(cal([tz('20261005T070000', '20261005T190000', 'Tagschicht')]), { types, times: { c1: ['07:00', '19:00'] } });
  assert.deepEqual(r.days, { '2026-10-05': 'c1' });
  const none = shiftsFromIcs(cal([tz('20261005T070000', '20261005T190000', 'Tagschicht')]), { types: DEFAULT_TYPES.filter(t => t.id !== 'T'), times: {} });
  assert.equal(none.unknown.length, 1);
});

test('Lücken im Importzeitraum wahlweise als Urlaub; Krank über mehrere Tage', () => {
  const events = [
    tz('20261005T060000', '20261005T140000', 'Früh'),
    ['DTSTART;VALUE=DATE:20261006', 'DTEND;VALUE=DATE:20261007', 'SUMMARY:frei'],
    tz('20261010T060000', '20261010T140000', 'Früh'),
    tz('20261012T000000', '20261014T000000', 'Krank'),
  ];
  const off = read(events, app());
  assert.deepEqual(off.days, { '2026-10-05': 'F', '2026-10-10': 'F', '2026-10-12': 'K', '2026-10-13': 'K' });
  assert.equal(off.gapDays, 0);
  const on = read(events, { ...app(), gaps: 'U' });
  assert.deepEqual(on.days, {
    '2026-10-05': 'F', '2026-10-07': 'U', '2026-10-08': 'U', '2026-10-09': 'U', '2026-10-10': 'F', '2026-10-11': 'U', '2026-10-12': 'K', '2026-10-13': 'K',
  });
  assert.equal(on.gapDays, 4);
  assert.equal(on.vacation, 4);
  assert.deepEqual([on.byCode.U, on.byCode.K, on.byCode['-'], on.byCode.F], [4, 2, 1, 2]);
});

test('Krank und Urlaub nur als ganzes Wort; ein Schichtwort im Titel geht vor', () => {
  const cases = {
    Krank: 'K', krank: 'K', 'Krank gemeldet': 'K', krankgeschrieben: 'K', Krankmeldung: 'K', Krankschreibung: 'K', AU: 'K', 'AU 05.10.': 'K',
    Urlaub: 'U', Urlaubstag: 'U', Urlaubstage: 'U', Resturlaub: 'U', 'Urlaub Ostsee': 'U',
    Krankengymnastik: null, Krankenhaus: null, Krankenkasse: null, Urlaubsvertretung: null, Urlaubsplanung: null, 'HU/AU Auto': null, Aussendienst: null,
    'Krankenpflege Spätdienst': 'S', 'Krankenhaus Frühdienst': 'F', 'Urlaubsvertretung Frühdienst': 'F',
    'Krank Frühdienst': 'F', 'Spätdienst (Urlaub Kollege)': 'S', 'Urlaub, frei': 'U', 'Frei statt Früh': '-',
  };
  Object.entries(cases).forEach(([title, code]) => assert.equal(codeFromTitle(title), code, title));
  /* Eine kurze Wache ist keine Schicht, ein Schichtwort daneben zählt trotzdem */
  assert.equal(codeFromTitle('Wache Frühdienst', 480), 'F');
});

test('Krank oder Urlaub aus einem Termin unter 4 Stunden verdrängt keine Schicht am selben Tag', () => {
  const r = read([
    tz('20261005T060000', '20261005T140000', 'Frühdienst'),
    tz('20261005T103000', '20261005T110000', 'Krankengymnastik'),
    tz('20261006T060000', '20261006T140000', 'Frühdienst'),
    tz('20261006T150000', '20261006T160000', 'Krank'),
    tz('20261007T090000', '20261007T113000', 'Urlaub'),
    tz('20261007T130000', '20261007T213000', 'Spätdienst'),
    tz('20261008T130000', '20261008T213000', 'Krankenpflege Spätdienst'),
    tz('20261009T060000', '20261009T140000', 'Krankenhaus Frühdienst'),
    tz('20261010T060000', '20261010T140000', 'Urlaubsvertretung Frühdienst'),
    tz('20261011T080000', '20261011T090000', 'Krank'),
    /* Ganztägig oder ab 4 Stunden gehen Krank und Urlaub weiter vor */
    tz('20261012T060000', '20261012T140000', 'Frühdienst'),
    ['DTSTART;VALUE=DATE:20261012', 'DTEND;VALUE=DATE:20261013', 'SUMMARY:Krank'],
    tz('20261013T060000', '20261013T140000', 'Frühdienst'),
    tz('20261013T060000', '20261013T140000', 'Urlaub'),
  ], app());
  assert.deepEqual(r.days, {
    '2026-10-05': 'F', '2026-10-06': 'F', '2026-10-07': 'S', '2026-10-08': 'S', '2026-10-09': 'F', '2026-10-10': 'F',
    '2026-10-11': 'K', '2026-10-12': 'K', '2026-10-13': 'U',
  });
  assert.deepEqual(r.unknown.map(u => u.title), ['Krankengymnastik']);
  /* Kurzer und langer Termin mit Krank am selben Tag: der lange zählt, die Schicht weicht */
  const both = read([
    tz('20261005T080000', '20261005T090000', 'Krank'),
    tz('20261005T000000', '20261005T235900', 'Krank'),
    tz('20261005T060000', '20261005T140000', 'Frühdienst'),
  ], app());
  assert.deepEqual(both.days, { '2026-10-05': 'K' });
});

test('Ohne Ende und Dauer: 8 Stunden, nur Früh, Spät oder Nacht, nie 24-h-Dienst oder Tag', () => {
  const r = read([
    ['DTSTART;TZID=Europe/Berlin:20261005T070000', 'SUMMARY:Dienst'],
    ['DTSTART;TZID=Europe/Berlin:20261006T060000', 'SUMMARY:Dienst'],
    ['DTSTART;TZID=Europe/Berlin:20261007T140000', 'SUMMARY:Dienst'],
    ['DTSTART;TZID=Europe/Berlin:20261008T220000', 'SUMMARY:Dienst'],
    ['DTSTART;TZID=Europe/Berlin:20261009T100000', 'SUMMARY:Dienst'],
  ], app());
  assert.deepEqual(r.days, { '2026-10-05': 'F', '2026-10-06': 'F', '2026-10-07': 'S', '2026-10-08': 'N' });
  assert.equal(r.unknown.length, 1);
  /* Nur 24-h-Dienst und Tag eingerichtet (Feuerwehr): ohne Ende kein Raten */
  const fw = { types: DEFAULT_TYPES.filter(t => ['X', 'T', '-'].includes(t.id)), times: { X: ['07:00', '07:00'], T: ['07:00', '19:00'] } };
  const x = read([['DTSTART;TZID=Europe/Berlin:20261005T070000', 'SUMMARY:Dienst']], fw);
  assert.deepEqual([x.days, x.unknown.length], [{}, 1]);
  /* Mit Ende erkennt die App den 24-h-Dienst weiter über die Dauer */
  assert.deepEqual(read([tz('20261005T070000', '20261006T070000', 'Dienst')], fw).days, { '2026-10-05': 'X' });
});

test('Lange unbekannte Titel enden nach 60 Zeichen mit „…“', () => {
  const long = 'Mitteldienst Station 3 mit sehr langem Titel für die Zuordnung am Wochenende';
  const r = read([tz('20261005T100000', '20261005T183000', long), tz('20261006T100000', '20261006T183000', 'Dienst A')]);
  assert.equal(r.unknown[0].title.length, 60);
  assert.ok(r.unknown[0].title.endsWith('…'));
  assert.ok(long.startsWith(r.unknown[0].title.slice(0, -1)));
  assert.equal(r.unknownTitles[0].title, r.unknown[0].title);
  assert.equal(r.unknown[1].title, 'Dienst A');
});
