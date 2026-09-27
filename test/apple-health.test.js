import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8, Zip, ZipDeflate } from '../js/vendor/fflate.js';
import {
  createRecordScanner, parseAttrs, createAggregator, readExport, isMainXml, TYPES, wallMs,
} from '../js/importers/apple-health.js';
import { mergeHealthImport, previewHealthImport, removeHealthImport } from '../js/importers/health-merge.js';

const attr = o => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');
const rec = (type, o, children = '') => (children
  ? `<Record type="${type}" ${attr(o)}>\n  ${children}\n </Record>`
  : `<Record type="${type}" ${attr(o)}/>`);
const w = (start, value, unit = 'kg', src = 'Waage') => rec(TYPES.weight, { sourceName: src, unit, startDate: start, endDate: start, value });
const st = (start, value, src) => rec(TYPES.steps, { sourceName: src, unit: 'count', startDate: start, endDate: start, value });
const hr = (start, value) => rec(TYPES.restingHr, { sourceName: 'Uhr', unit: 'count/min', startDate: start, endDate: start, value });
const sl = (start, end, value, src = 'Uhr') => rec(TYPES.sleep, { sourceName: src, startDate: start, endDate: end, value: `HKCategoryValueSleepAnalysis${value}` });
const doc = body => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE HealthData [\n<!ATTLIST Record type CDATA #REQUIRED>\n]>\n<HealthData locale="de_DE">\n <ExportDate value="2026-09-27 10:00:00 +0200"/>\n${body}\n</HealthData>\n`;

function scanAll(text, sizes) {
  const out = [];
  const sc = createRecordScanner(r => out.push(r));
  let i = 0, k = 0;
  while (i < text.length) { const n = sizes[k++ % sizes.length]; sc.push(text.slice(i, i + n)); i += n; }
  return { out, records: sc.records };
}

test('Attribute mit Entitäten', () => {
  assert.deepEqual(parseAttrs('<Record type="X" sourceName="Uhr &amp; Co &quot;neu&quot;" value="1"/>'), { type: 'X', sourceName: 'Uhr & Co "neu"', value: '1' });
});

test('Scanner setzt Records über beliebige Stückgrenzen zusammen', () => {
  const body = [
    w('2026-09-01 07:00:00 +0200', '82.4'),
    rec('HKQuantityTypeIdentifierHeartRate', { sourceName: 'Uhr', value: '70', startDate: '2026-09-01 08:00:00 +0200' }),
    st('2026-09-01 09:00:00 +0200', '1200', 'Uhr > iPhone'),
    rec(TYPES.steps, { sourceName: 'iPhone', unit: 'count', startDate: '2026-09-01 10:00:00 +0200', value: '300' },
      '<MetadataEntry key="HKMetadataKeyWasUserEntered" value="1"/>'),
    '<Correlation type="HKCorrelationTypeIdentifierBloodPressure">',
    hr('2026-09-01 06:00:00 +0200', '58'),
    '</Correlation>',
    '<Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30"/>',
  ].join('\n ');
  const text = doc(body);
  const whole = scanAll(text, [text.length]);
  assert.equal(whole.out.length, 4, 'nur die vier gesuchten Typen');
  assert.equal(whole.records, 5, 'alle Records gezählt');
  assert.equal(whole.out[1].sourceName, 'Uhr > iPhone', '„>“ im Attribut beendet das Tag nicht');
  for (const sizes of [[1], [7], [13, 2, 5], [64]]) {
    const r = scanAll(text, sizes);
    assert.deepEqual(r.out, whole.out, 'Stückgröße ' + sizes.join(','));
  }
});

test('Gewicht: kg und lb, letzter Wert des Tages', () => {
  const a = createAggregator();
  [w('2026-09-01 07:00:00 +0200', '82.4'), w('2026-09-01 21:00:00 +0200', '83.0'), w('2026-09-01 12:00:00 +0200', '82.7'),
    w('2026-09-02 07:00:00 +0200', '180', 'lb'), w('2026-09-03 07:00:00 +0200', '5', 'kg')]
    .forEach(t => a.add(parseAttrs(t)));
  const r = a.result();
  assert.deepEqual(r.weights, [{ date: '2026-09-01', kg: 83 }, { date: '2026-09-02', kg: 81.6 }]); // 5 kg ist unplausibel
});

test('Schritte: Summe pro Quelle, dann das Maximum über die Quellen', () => {
  const a = createAggregator();
  [st('2026-09-01 09:00:00 +0200', '4000', 'iPhone'), st('2026-09-01 15:00:00 +0200', '3000', 'iPhone'),
    st('2026-09-01 09:00:00 +0200', '3900', 'Uhr'), st('2026-09-01 15:00:00 +0200', '3500', 'Uhr'),
    st('2026-09-02 10:00:00 +0200', '500', 'iPhone')].forEach(t => a.add(parseAttrs(t)));
  assert.deepEqual(a.result().steps, [{ date: '2026-09-01', steps: 7400 }, { date: '2026-09-02', steps: 500 }]);
});

test('Ruhepuls: Mittel des Tages', () => {
  const a = createAggregator();
  [hr('2026-09-01 06:00:00 +0200', '57'), hr('2026-09-01 18:00:00 +0200', '60'), hr('2026-09-02 06:00:00 +0200', '300')]
    .forEach(t => a.add(parseAttrs(t)));
  assert.deepEqual(a.result().restingHr, [{ date: '2026-09-01', bpm: 59 }]);
});

test('Schlaf: nur Schlafphasen, Überlappung zusammengeführt, dem Aufwachtag zugeordnet, Maximum über Quellen', () => {
  const a = createAggregator();
  [
    sl('2026-09-01 22:00:00 +0200', '2026-09-02 07:00:00 +0200', 'InBed'),            // zählt nicht
    sl('2026-09-01 22:30:00 +0200', '2026-09-01 23:50:00 +0200', 'AsleepCore'),       // vor Mitternacht, gehört zum 2.9.
    sl('2026-09-01 23:30:00 +0200', '2026-09-02 01:00:00 +0200', 'AsleepDeep'),       // überlappt, zusammen 22:30 bis 01:00
    sl('2026-09-02 01:00:00 +0200', '2026-09-02 01:20:00 +0200', 'Awake'),            // zählt nicht
    sl('2026-09-02 01:20:00 +0200', '2026-09-02 06:50:00 +0200', 'AsleepREM'),
    sl('2026-09-01 23:00:00 +0200', '2026-09-02 06:00:00 +0200', 'Asleep', 'iPhone'), // 7 h, weniger als die Uhr
    sl('2026-09-02 14:00:00 +0200', '2026-09-02 14:30:00 +0200', 'AsleepUnspecified'),// Nickerchen am selben Tag
  ].forEach(t => a.add(parseAttrs(t)));
  // Uhr: 22:30–01:00 (2,5 h) + 01:20–06:50 (5,5 h) + 0,5 h = 8,5 h
  assert.deepEqual(a.result().sleep, [{ date: '2026-09-02', hours: 8.5 }]);
});

test('Wandzeit aus Health-Zeitangaben', () => {
  assert.equal(wallMs('2026-09-02 06:50:00 +0200') - wallMs('2026-09-01 22:30:00 +0200'), 8 * 36e5 + 20 * 6e4);
});

test('Hauptdatei im Export erkennen', () => {
  assert.equal(isMainXml('apple_health_export/export.xml'), true);
  assert.equal(isMainXml('apple_health_export/Export.xml'), true);
  assert.equal(isMainXml('export.xml'), true);
  assert.equal(isMainXml('apple_health_export/export_cda.xml'), false);
  assert.equal(isMainXml('apple_health_export/workout-routes/route_1.gpx'), false);
  assert.equal(isMainXml('apple_health_export/clinical-records/a.xml'), false);
  assert.equal(isMainXml('__MACOSX/apple_health_export/._export.xml'), false);
});

const body2 = [
  w('2026-09-01 07:00:00 +0200', '82.4', 'kg', 'Wäge-Station Ü'),   // Umlaute prüfen Stückgrenzen mitten im Zeichen
  st('2026-09-01 09:00:00 +0200', '8000', 'iPhone'),
  hr('2026-09-01 06:00:00 +0200', '58'),
  sl('2026-08-31 23:00:00 +0200', '2026-09-01 06:30:00 +0200', 'AsleepCore'),
].join('\n ');

test('XML-Datei in kleinen Stücken lesen', async () => {
  const file = new File([doc(body2)], 'export.xml', { type: 'text/xml' });
  const seen = [];
  const r = await readExport(file, { chunkSize: 37, onProgress: (d, t) => seen.push([d, t]) });
  assert.deepEqual(r.weights, [{ date: '2026-09-01', kg: 82.4 }]);
  assert.deepEqual(r.steps, [{ date: '2026-09-01', steps: 8000 }]);
  assert.deepEqual(r.restingHr, [{ date: '2026-09-01', bpm: 58 }]);
  assert.deepEqual(r.sleep, [{ date: '2026-09-01', hours: 7.5 }]);
  assert.equal(r.stats.weights.days, 1);
  assert.equal(seen[seen.length - 1][0], file.size);
});

test('ZIP-Export: Hauptdatei statt export_cda.xml, Rest übersprungen', async () => {
  const decoy = doc(w('2020-01-01 07:00:00 +0100', '99'));
  const zip = zipSync({
    'apple_health_export/export_cda.xml': strToU8(decoy),
    'apple_health_export/export.xml': strToU8(doc(body2)),
    'apple_health_export/workout-routes/route_2026.gpx': strToU8('<gpx/>'.repeat(5000)),
  });
  const file = new File([zip], 'export.zip', { type: 'application/zip' });
  const r = await readExport(file, { chunkSize: 97 });
  assert.equal(r.stats.file, 'apple_health_export/export.xml');
  assert.deepEqual(r.weights, [{ date: '2026-09-01', kg: 82.4 }]);
  assert.equal(r.sleep[0].hours, 7.5);
});

/* Wie iOS: Einträge gestreamt gepackt, Größen stehen erst im Datendeskriptor hinter den Daten */
function streamedZip(files) {
  const parts = [];
  const z = new Zip((err, chunk) => { if (err) throw err; parts.push(chunk); });
  for (const [name, text] of Object.entries(files)) {
    const f = new ZipDeflate(name, { level: 6 });
    z.add(f);
    const u8 = strToU8(text);
    for (let i = 0; i < u8.length; i += 1000) f.push(u8.subarray(i, i + 1000), i + 1000 >= u8.length);
  }
  z.end();
  return new Blob(parts);
}

test('ZIP mit Datendeskriptoren (gestreamt gepackt)', async () => {
  const many = Array.from({ length: 400 }, (_, i) => st(`2026-09-${String(1 + (i % 28)).padStart(2, '0')} ${String(i % 24).padStart(2, '0')}:00:00 +0200`, '100', 'iPhone')).join('\n ');
  const blob = streamedZip({ 'apple_health_export/export_cda.xml': doc(''), 'apple_health_export/export.xml': doc(many) });
  const file = new File([blob], 'export.zip');
  const r = await readExport(file, { chunkSize: 512 });
  assert.equal(r.steps.length, 28);
  assert.equal(r.steps.reduce((a, x) => a + x.steps, 0), 40000);
});

test('ZIP ohne Health-Export und leere Datei geben verständliche Fehler', async () => {
  const zip = zipSync({ 'fotos/bild.jpg': new Uint8Array([1, 2, 3]) });
  await assert.rejects(readExport(new File([zip], 'x.zip')), /kein Apple-Health-Export/);
  await assert.rejects(readExport(new File(['<html></html>'], 'x.xml')), /keine Health-Einträge/);
});

test('Abbrechen', async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  await assert.rejects(readExport(new File([doc(body2)], 'export.xml'), { signal: ctrl.signal }), e => e.name === 'AbortError');
});

/* ---------- Zusammenführen ---------- */
const state = () => ({
  profile: { weightKg: 84 },
  settings: {},
  body: { weights: [
    { date: '2026-09-01', kg: 84.5, source: 'manual', method: 'scale' },
    { date: '2026-08-01', kg: 90, source: 'apple-health', method: 'scale' },   // alter Import
  ] },
  activity: { steps: [], restingHr: [], sleep: [{ date: '2026-09-02', hours: 6, source: 'manual' }], cardio: [], burn: [] },
});
const data = {
  weights: [{ date: '2026-08-20', kg: 85 }, { date: '2026-09-01', kg: 83 }, { date: '2026-09-02', kg: 82.8 }],
  steps: [{ date: '2026-09-01', steps: 8000 }],
  restingHr: [{ date: '2026-09-01', bpm: 58 }],
  sleep: [{ date: '2026-09-01', hours: 7.5 }, { date: '2026-09-02', hours: 8 }],
};

test('Eigene Einträge gewinnen, alter Import wird ersetzt', () => {
  const S = state();
  const c = mergeHealthImport(S, data, { at: 1 });
  assert.deepEqual(S.body.weights.map(x => [x.date, x.kg, x.source]), [
    ['2026-08-20', 85, 'apple-health'], ['2026-09-01', 84.5, 'manual'], ['2026-09-02', 82.8, 'apple-health'],
  ]);
  assert.deepEqual(c.weights, { added: 2, kept: 1 });
  assert.deepEqual(S.activity.sleep.map(x => [x.date, x.hours, x.source]), [['2026-09-01', 7.5, 'apple-health'], ['2026-09-02', 6, 'manual']]);
  assert.equal(S.profile.weightKg, 82.8);
  assert.equal(S.settings.healthImport.at, 1);
  // Ein zweiter Import mit weniger Tagen ersetzt den ersten vollständig
  mergeHealthImport(S, { weights: [{ date: '2026-09-02', kg: 82.5 }], steps: [], restingHr: [], sleep: [] });
  assert.deepEqual(S.body.weights.map(x => [x.date, x.kg]), [['2026-09-01', 84.5], ['2026-09-02', 82.5]]);
  assert.equal(S.activity.steps.length, 0);
});

test('Zeitraum begrenzen, Vorschau und Entfernen', () => {
  const S = state();
  const pre = previewHealthImport(S, data, { since: '2026-09-01' });
  assert.deepEqual(pre.weights, { days: 2, added: 1, kept: 1, from: '2026-09-01', to: '2026-09-02' });
  assert.equal(S.body.weights.length, 2, 'Vorschau ändert nichts');
  mergeHealthImport(S, data, { since: '2026-09-01' });
  assert.deepEqual(S.body.weights.map(x => x.date), ['2026-09-01', '2026-09-02']);
  const removed = removeHealthImport(S);
  assert.equal(removed, 4); // Gewicht, Schritte, Ruhepuls, Schlaf je ein importierter Tag
  assert.deepEqual(S.body.weights.map(x => x.source), ['manual']);
  assert.equal(S.settings.healthImport, undefined);
});
