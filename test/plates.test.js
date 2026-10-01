import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBar, nearestLoadable, barFor, plateSettings, perSideText, DEFAULT_PLATES } from '../js/domain/plates.js';

const STD = DEFAULT_PLATES.available;

test('Exakt ladbar: 82,5 kg an der 20-kg-Stange', () => {
  const r = loadBar(82.5, 20, STD);
  assert.equal(r.status, 'exact');
  assert.deepEqual(r.perSide, [25, 5, 1.25]);
  assert.equal(r.perSideKg, 31.25);
  assert.equal(perSideText(r.perSide), '25 + 5 + 1,25');
});

test('Schwere Last nimmt schwere Scheiben mehrfach', () => {
  assert.deepEqual(loadBar(140, 20, STD).perSide, [25, 25, 10]);
  assert.deepEqual(loadBar(100, 20, STD).perSide, [25, 15]);
});

test('Nicht ladbar: 83 kg nennt 82,5 und 85 kg', () => {
  const r = loadBar(83, 20, STD);
  assert.equal(r.status, 'nearest');
  assert.equal(r.below.total, 82.5);
  assert.deepEqual(r.below.perSide, [25, 5, 1.25]);
  assert.equal(r.above.total, 85);
  assert.deepEqual(r.above.perSide, [25, 5, 2.5]);
  assert.equal(nearestLoadable(83, 20, STD), 82.5);
  assert.equal(nearestLoadable(84, 20, STD), 85);
  /* Gleicher Abstand: das leichtere */
  assert.equal(nearestLoadable(83.75, 20, STD), 82.5);
});

test('Fehlende Scheiben: ohne 15 und 1,25 kg', () => {
  const avail = [25, 20, 10, 5, 2.5];
  assert.deepEqual(loadBar(50, 20, avail).perSide, [10, 5]);
  const r = loadBar(82.5, 20, avail);
  assert.equal(r.status, 'nearest');
  assert.equal(r.below.total, 80);
  assert.equal(r.above.total, 85);
});

test('Ungewöhnlicher Satz: die kleinste Scheibenzahl gewinnt', () => {
  /* nur 25, 20 und 15: 30 kg pro Seite geht als 15 + 15, nicht gierig als 25 + … */
  const r = loadBar(80, 20, [25, 20, 15]);
  assert.equal(r.status, 'exact');
  assert.deepEqual(r.perSide, [15, 15]);
});

test('Nur die Stange und leichter als die Stange', () => {
  assert.equal(loadBar(20, 20, STD).status, 'bar');
  const u = loadBar(15, 20, STD);
  assert.equal(u.status, 'underbar');
  assert.equal(u.above.total, 20);
  assert.equal(nearestLoadable(12, 20, STD), 20);
});

test('SZ-Stange mit 10 kg', () => {
  const r = loadBar(27.5, 10, STD);
  assert.equal(r.status, 'exact');
  assert.deepEqual(r.perSide, [5, 2.5, 1.25]);
});

test('Stange je Übung aus der Bibliothek', () => {
  const s = { barKg: 20, szKg: 8, available: STD };
  assert.equal(barFor({ equipment: ['Langhantel', 'Hantelbank'] }, s).kg, 20);
  assert.equal(barFor({ equipment: ['SZ-Stange'] }, s).kg, 8);
  assert.equal(barFor({ equipment: ['SZ-Stange'] }, s).kind, 'sz');
  assert.equal(barFor({ equipment: ['Maschinen'] }, s), null);
  assert.equal(barFor({ equipment: ['Kurzhanteln'] }, s), null);
  assert.equal(barFor({ equipment: ['Langhantel'], unit: 'sec' }, s), null);
  assert.equal(barFor(null, s), null);
});

test('Einstellungen werden bereinigt', () => {
  const kgs = s => s.available.map(p => p.kg);
  const d = plateSettings(null);
  assert.deepEqual(d.bars, [{ id: 'barbell', name: 'Langhantel', kg: 20 }, { id: 'sz', name: 'SZ-Stange', kg: 10 }]);
  assert.deepEqual(kgs(d), [25, 20, 15, 10, 5, 2.5, 1.25]);
  assert.deepEqual(d.barFor, {});
  assert.deepEqual(kgs(plateSettings({ barKg: 15, available: [5, '2.5', 25, 25] })), [25, 5, 2.5]);
  assert.equal(plateSettings({ barKg: 15 }).bars[0].kg, 15);
  assert.deepEqual(plateSettings({ available: [] }).available, STD);
});

test('4.7: Stange aus der Geräte-Anforderung mit ids, „eines davon“ nur, wenn alles Stangen sind', () => {
  const s = plateSettings(null);
  assert.equal(barFor({ equipment: ['langhantel', ['kniebeugenstaender', 'multipresse']] }, s).kind, 'barbell');
  assert.equal(barFor({ equipment: ['sz-stange', 'scottbank'] }, s).kind, 'sz');
  assert.equal(barFor({ equipment: [['sz-stange', 'langhantel']] }, s).kind, 'sz');
  assert.equal(barFor({ equipment: [['kurzhanteln', 'langhantel']] }, s), null);
  assert.equal(barFor({ equipment: ['multipresse'] }, s), null);
  assert.equal(barFor({ equipment: ['smart-zirkel'] }, s), null);
});
