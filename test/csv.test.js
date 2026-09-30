import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainingsCsv, csvField, strongDate, strongDuration, num, csvFileName, STRONG_HEADER } from '../js/store/csv.js';
import { defaultState } from '../js/store/migrate.js';

const HEADER = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE';
const T = new Date(2026, 8, 28, 18, 5, 9).getTime();
const MIN = 60000;

const stateWith = sessions => { const s = defaultState(); s.sessions = sessions; return s; };
const lines = csv => csv.trimEnd().split('\n');

/* Einfacher Leser nach RFC 4180, nur für die Tests */
function parse(csv) {
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (q) {
      if (c === '"' && csv[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

test('Kopfzeile exakt wie bei Strong', () => {
  assert.equal(STRONG_HEADER.join(','), HEADER);
  assert.equal(lines(trainingsCsv(stateWith([])))[0], HEADER);
  assert.equal(trainingsCsv(stateWith([])), HEADER + '\n');
});

test('Eine Zeile pro Satz mit Datum in Ortszeit, Dauer, Gewicht mit Punkt', () => {
  const csv = trainingsCsv(stateWith([{
    id: 'a', name: 'Push', startedAt: T, endedAt: T + 65 * MIN,
    ex: [{ exId: 'bank', name: 'Bankdrücken', unit: 'reps', sets: [{ w: 62.5, r: 8, rir: 2 }, { w: 60, r: 10, rir: 1 }] }],
  }]));
  assert.deepEqual(lines(csv), [
    HEADER,
    '2026-09-28 18:05:09,Push,1h 5m,Bankdrücken,1,62.5,8,0,0,,,',
    '2026-09-28 18:05:09,Push,1h 5m,Bankdrücken,2,60,10,0,0,,,',
  ]);
});

test('Datum und Dauer', () => {
  assert.equal(strongDate(new Date(2026, 0, 3, 7, 4, 5).getTime()), '2026-01-03 07:04:05');
  assert.equal(strongDuration(65 * MIN), '1h 5m');
  assert.equal(strongDuration(45 * MIN), '45m');
  assert.equal(strongDuration(60 * MIN), '1h 0m');
  assert.equal(strongDuration(125 * MIN + 40000), '2h 6m');
  assert.equal(strongDuration(20000), '1m');
  assert.equal(strongDuration(0), '0m');
  assert.equal(strongDuration(-5), '0m');
});

test('Zahlen mit Punkt als Dezimaltrenner, ohne Einheit', () => {
  assert.equal(num(62.5), '62.5');
  assert.equal(num(80), '80');
  assert.equal(num(1.256), '1.26');
  assert.equal(num(1.125), '1.13');
  assert.equal(num('22,5'), '22.5');
  assert.equal(num(0), '0');
  assert.equal(num(null), '0');
  assert.equal(num(NaN), '0');
  assert.equal(num(-0.001), '0');
});

test('Quoting: Komma, Anführungszeichen und Zeilenumbruch', () => {
  assert.equal(csvField('Push'), 'Push');
  assert.equal(csvField('Push, schwer'), '"Push, schwer"');
  assert.equal(csvField('Rudern "eng"'), '"Rudern ""eng"""');
  assert.equal(csvField('zwei\nZeilen'), '"zwei\nZeilen"');
  assert.equal(csvField(null), '');
  const csv = trainingsCsv(stateWith([{
    id: 'a', name: 'Oberkörper, schwer', startedAt: T, endedAt: T + 50 * MIN,
    rating: { rpe: 8, note: 'Schulter "gezwickt", sonst gut', at: T },
    ex: [{ exId: 'c1', name: 'Rudern "eng", Kabel', unit: 'reps', sets: [{ w: 45, r: 12 }] }],
  }]));
  assert.equal(lines(csv)[1], '2026-09-28 18:05:09,"Oberkörper, schwer",50m,"Rudern ""eng"", Kabel",1,45,12,0,0,,"Schulter ""gezwickt"", sonst gut",8');
  const rows = parse(csv);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(r => r.length === 12));
  assert.equal(rows[1][1], 'Oberkörper, schwer');
  assert.equal(rows[1][3], 'Rudern "eng", Kabel');
  assert.equal(rows[1][10], 'Schulter "gezwickt", sonst gut');
});

test('Zeitübungen stehen in Seconds statt Reps', () => {
  const csv = trainingsCsv(stateWith([{
    id: 'a', name: 'Beine', startedAt: T, endedAt: T + 45 * MIN,
    ex: [{ exId: 'plank', name: 'Plank', unit: 'sec', sets: [{ w: 0, r: 45 }, { w: 10, r: 30 }] }],
  }]));
  const rows = parse(csv);
  assert.deepEqual(rows[1].slice(3, 9), ['Plank', '1', '0', '0', '0', '45']);
  assert.deepEqual(rows[2].slice(3, 9), ['Plank', '2', '10', '0', '0', '30']);
});

test('Leere und nicht abgehakte Sätze fallen heraus, Set Order zählt nur die übrigen', () => {
  const csv = trainingsCsv(stateWith([{
    id: 'a', name: 'Pull', startedAt: T, endedAt: T + 40 * MIN,
    ex: [
      { exId: 'lat', name: 'Latzug', unit: 'reps', sets: [{ w: 50, r: null }, { w: 55, r: 10 }, { w: 55, r: 9, done: false }, { w: 55, r: 0 }, { w: 57.5, r: 8 }] },
      { exId: 'curl', name: 'SZ-Curls', unit: 'reps', sets: [{ w: 20, r: null }] },
      { exId: 'x', name: 'Ohne Sätze', unit: 'reps' },
    ],
  }]));
  const rows = parse(csv).slice(1);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => [r[3], r[4], r[5], r[6]]), [['Latzug', '1', '55', '10'], ['Latzug', '2', '57.5', '8']]);
});

test('Satztyp t am Satz stört nicht', () => {
  const csv = trainingsCsv(stateWith([{
    id: 'a', name: 'Push', startedAt: T, endedAt: T + 30 * MIN,
    ex: [{ exId: 'bank', name: 'Bankdrücken', unit: 'reps', sets: [{ w: 40, r: 10, t: 'warmup' }, { w: 80, r: 8 }] }],
  }]));
  assert.equal(parse(csv).length, 3);
});

test('Übungsnotiz in Notes, Einheitsnotiz in Workout Notes, RPE aus der Bewertung', () => {
  const s = stateWith([
    { id: 'b', name: 'Push', startedAt: T + 2 * 864e5, endedAt: T + 2 * 864e5 + 30 * MIN, rating: { rpe: 9, note: '', at: 1 },
      ex: [{ exId: 'bank', name: 'Bankdrücken', unit: 'reps', sets: [{ w: 80, r: 5 }] }] },
    { id: 'a', name: 'Push', startedAt: T, endedAt: T + 30 * MIN, rating: { rpe: null, note: 'Wenig geschlafen', at: 1 },
      ex: [{ exId: 'bank', name: 'Bankdrücken', unit: 'reps', sets: [{ w: 77.5, r: 6 }] }] },
  ]);
  s.exerciseNotes = { 'bank|Bankdrücken': 'Griff eng' };
  const rows = parse(trainingsCsv(s)).slice(1);
  /* Nach Beginn sortiert, ältestes zuerst */
  assert.deepEqual(rows.map(r => [r[0].slice(0, 10), r[9], r[10], r[11]]), [
    ['2026-09-28', 'Griff eng', 'Wenig geschlafen', ''],
    ['2026-09-30', 'Griff eng', '', '9'],
  ]);
});

test('Notiz unter einem anderen Plan-Eintrag derselben Übung wird gefunden', () => {
  const s = stateWith([{ id: 'a', name: 'Push', startedAt: T, endedAt: T + 30 * MIN,
    ex: [{ exId: 'd1', name: 'Bankdrücken', unit: 'reps', sets: [{ w: 80, r: 5 }] }] }]);
  s.exerciseNotes = { 'andere-id|Bankdrücken': 'Bank Stufe 3' };
  assert.equal(parse(trainingsCsv(s))[1][9], 'Bank Stufe 3');
});

test('Übungsname wie im Verlauf, sonst alle Namen wie im Plan', () => {
  const s = stateWith([{ id: 'a', name: 'Pull', startedAt: T, endedAt: T + 30 * MIN,
    ex: [
      { exId: 'lat', name: 'Klimmzüge', names: ['Latzug', 'Klimmzüge'], unit: 'reps', sets: [{ w: 0, r: 8 }] },
      { exId: 'row', names: ['Rudern sitzend', 'Kabelrudern'], unit: 'reps', sets: [{ w: 50, r: 10 }] },
    ] }]);
  const rows = parse(trainingsCsv(s)).slice(1);
  assert.deepEqual(rows.map(r => r[3]), ['Klimmzüge', 'Rudern sitzend oder Kabelrudern']);
});

test('Dateiname mit Datum', () => {
  assert.equal(csvFileName(T), 'split-trainings-2026-09-28.csv');
});

test('CSV: Satztypen stehen in der Notiz, die Satznummer bleibt eine Zahl', async () => {
  const { setNote, setOrder } = await import('../js/store/csv.js');
  assert.equal(setOrder({ t: 'w' }, 1), '1');
  assert.equal(setNote({ t: 'w' }, ''), 'Aufwärmsatz');
  assert.equal(setNote({ t: 'd' }, 'Griff eng'), 'Dropsatz · Griff eng');
  assert.equal(setNote({ t: 'f' }, ''), 'Bis Versagen');
  assert.equal(setNote({}, 'Griff eng'), 'Griff eng');
  assert.equal(setNote({ t: 'x' }, ''), '');
});
