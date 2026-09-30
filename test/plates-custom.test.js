import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  plateSettings, addPlate, removePlate, setPlateColor, setAllColors, colorMode, newPlateColor,
  saveBar, removeBar, chooseBar, chosenBarId, barFor, barKey, barUsage, loadBar, nearestLoadable,
  PLATE_COLORS, COLOR_IDS, compColor, PLATE_LIMIT,
} from '../js/domain/plates.js';
import { warmupRamp } from '../js/domain/warmup.js';
import { defaultState, normalize, toBackup, fromBackup, APP_ID, SCHEMA } from '../js/store/migrate.js';
import { defaultPlan } from '../js/plans.js';

const kgs = st => st.available.map(p => p.kg);
const BANK = { equipment: ['Langhantel', 'Hantelbank'] };
const CURL = { equipment: ['SZ-Stange'] };
const DEAD = { equipment: ['Langhantel'] };

/* ---------- Migration ---------- */

test('Alte Zahlenliste wird zu Scheiben mit den bisherigen Farben', () => {
  const st = plateSettings({ barKg: 20, szKg: 10, available: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5] });
  assert.deepEqual(st.available, [
    { kg: 25, color: 'red' }, { kg: 20, color: 'blue' }, { kg: 15, color: 'yellow' }, { kg: 10, color: 'green' },
    { kg: 5, color: 'white' }, { kg: 2.5, color: 'red' }, { kg: 1.25, color: 'silver' }, { kg: 0.5, color: 'white' },
  ]);
  /* Bisherige Zeichenfarben: 1,25 kg und unbekannte Gewichte waren #C9CDD2 */
  assert.equal(PLATE_COLORS.silver.fill, '#C9CDD2');
  assert.equal(PLATE_COLORS.red.fill, '#E0403F');
  assert.equal(plateSettings({ available: [7.5] }).available[0].color, 'silver');
});

test('Alte Stangengewichte werden zu den Standardstangen', () => {
  const st = plateSettings({ barKg: 15, szKg: 7.5, available: [20, 10] });
  assert.deepEqual(st.bars, [{ id: 'barbell', name: 'Langhantel', kg: 15 }, { id: 'sz', name: 'SZ-Stange', kg: 7.5 }]);
  assert.equal('barKg' in st, false);
  assert.equal('szKg' in st, false);
  assert.deepEqual(st.barFor, {});
});

test('normalize setzt alte Stände auf die neue Form, neue bleiben unverändert', () => {
  const old = { plans: [defaultPlan()], sessions: [], settings: { onboardingDone: true, plates: { barKg: 17.5, szKg: 8, available: [20, 5, 1.25] } } };
  const s = normalize(JSON.parse(JSON.stringify(old)));
  assert.equal(s.settings.onboardingDone, true);
  assert.deepEqual(s.settings.plates.bars.map(b => b.kg), [17.5, 8]);
  assert.deepEqual(s.settings.plates.available, [{ kg: 20, color: 'blue' }, { kg: 5, color: 'white' }, { kg: 1.25, color: 'silver' }]);
  /* Ein zweites normalize ändert nichts mehr */
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))).settings.plates, s.settings.plates);
  /* Ohne settings oder ohne plates: Vorgabe */
  assert.deepEqual(normalize({ plans: [defaultPlan()], sessions: [] }).settings.plates, plateSettings(null));
  assert.deepEqual(defaultState().settings.plates, plateSettings(null));
});

test('Kaputte Stände laden ohne Absturz', () => {
  for (const raw of [undefined, null, 'x', 42, [], { available: 'x', bars: 'y', barFor: [] }]) {
    const st = plateSettings(raw);
    assert.equal(st.bars.length, 2);
    assert.deepEqual(kgs(st), [25, 20, 15, 10, 5, 2.5, 1.25]);
  }
  const st = plateSettings({
    barKg: 'abc', szKg: -4,
    available: [null, -5, 'x', 0, 60, { kg: '2,5' }, { kg: 3, color: 'pink' }, { kg: 3.1 }, { kg: 20, color: 'black' }, { kg: 20, color: 'red' }, { kg: 5, color: 'constructor' }],
    bars: [null, { id: 'barbell', name: '  Olympia  ', kg: 99 }, { id: 'x1', name: '', kg: 12 }, { id: 'x2', name: 'Trap-Bar', kg: 25 }, { id: 'x2', name: 'Doppelt', kg: 12 },
      { id: 'bad id!', name: 'Kaputt', kg: 12 }, { id: 'x3', name: 'Zu schwer', kg: 31 }],
    barFor: { 'a|Kreuzheben': 'x2', 'b|Bankdrücken': 'weg', ['__proto__']: 'x2', 'c|Curls': 'sz' },
  });
  assert.deepEqual(st.available, [{ kg: 20, color: 'black' }, { kg: 5, color: 'white' }, { kg: 3, color: 'silver' }, { kg: 2.5, color: 'red' }]);
  assert.deepEqual(st.bars, [
    { id: 'barbell', name: 'Olympia', kg: 20 }, { id: 'sz', name: 'SZ-Stange', kg: 10 }, { id: 'x2', name: 'Trap-Bar', kg: 25 },
  ]);
  assert.deepEqual(st.barFor, { 'a|Kreuzheben': 'x2', 'c|Curls': 'sz' });
  assert.equal(Object.getPrototypeOf(st.barFor), Object.prototype);
});

test('Backup trägt Stangen, Farben und die Wahl pro Übung; altes Backup lädt sauber', () => {
  const S = defaultState();
  S.settings.plates = chooseBar(saveBar(setAllColors(S.settings.plates, 'black').st, { name: 'Trap-Bar', kg: 25 }, 'trap').st, 'kd|Kreuzheben', 'trap');
  const back = fromBackup(JSON.parse(JSON.stringify(toBackup(S))));
  assert.deepEqual(back.settings.plates, S.settings.plates);
  assert.equal(back.settings.plates.available.every(p => p.color === 'black'), true);
  assert.equal(back.settings.plates.barFor['kd|Kreuzheben'], 'trap');

  const old = { app: APP_ID, version: SCHEMA, exportedAt: '2026-01-01T00:00:00.000Z', data: {
    plans: [defaultPlan()], sessions: [], settings: { plates: { barKg: 20, szKg: 10, available: [25, 20, 10, 5, 2.5, 1.25] } },
  } };
  const s = fromBackup(old);
  assert.deepEqual(kgs(s.settings.plates), [25, 20, 10, 5, 2.5, 1.25]);
  assert.equal(s.settings.plates.available[0].color, 'red');
  assert.deepEqual(s.settings.plates.bars.map(b => b.id), ['barbell', 'sz']);
});

/* ---------- Eigene Scheiben ---------- */

test('Eigene Scheibe: Grenzen 0,25 bis 50 kg in Viertel-kg', () => {
  const base = { available: [20, 10] };
  assert.deepEqual(kgs(addPlate(base, 0.25).st), [20, 10, 0.25]);
  assert.deepEqual(kgs(addPlate(base, 50).st), [50, 20, 10]);
  assert.deepEqual(kgs(addPlate(base, 0.75).st), [20, 10, 0.75]);
  assert.deepEqual(kgs(addPlate(base, '1,5').st), [20, 10, 1.5]);
  for (const bad of [0, -1, 0.2, 50.25, 60, NaN, '', 'abc']) assert.ok(addPlate(base, bad).error, `${bad} müsste abgelehnt werden`);
  assert.match(addPlate(base, 1.3).error, /0,25/);
  assert.match(addPlate(base, 1.1).error, /Schritten/);
});

test('Eigene Scheibe: keine Duplikate, sortiert, höchstens 20 verschiedene', () => {
  assert.match(addPlate({ available: [20, 2.5] }, 2.5).error, /2,5 kg ist schon dabei/);
  assert.match(addPlate({ available: [20, 2.5] }, '2.50').error, /schon dabei/);
  assert.deepEqual(kgs(addPlate({ available: [20, 1] }, 2).st), [20, 2, 1]);
  const many = { available: Array.from({ length: PLATE_LIMIT }, (_, k) => k + 1) };
  assert.equal(plateSettings(many).available.length, PLATE_LIMIT);
  assert.match(addPlate(many, 0.5).error, /Mehr als 20/);
});

test('Neue Scheibe bekommt Wettkampffarbe, bei lauter schwarzen Scheiben schwarz', () => {
  assert.equal(addPlate({ available: [20, 10] }, 2).st.available.find(p => p.kg === 2).color, 'blue');
  assert.equal(addPlate({ available: [20, 10] }, 7.5).st.available.find(p => p.kg === 7.5).color, 'silver');
  const black = setAllColors({ available: [20, 10, 5] }, 'black').st;
  assert.equal(addPlate(black, 2).st.available.find(p => p.kg === 2).color, 'black');
  assert.equal(addPlate(black, 2, 'orange').st.available.find(p => p.kg === 2).color, 'orange');
  assert.equal(newPlateColor([{ kg: 20, color: 'black' }], 10), 'green');
});

test('Scheibe entfernen: mindestens eine bleibt', () => {
  assert.deepEqual(kgs(removePlate({ available: [20, 10] }, 10).st), [20]);
  assert.match(removePlate({ available: [20] }, 20).error, /Mindestens eine/);
  assert.deepEqual(kgs(removePlate({ available: [20, 10] }, 7).st), [20, 10]);
});

test('Farbe pro Scheibe, alle schwarz und zurück zu Wettkampffarben', () => {
  const st = setPlateColor({ available: [25, 20, 1.25] }, 20, 'grey').st;
  assert.equal(st.available.find(p => p.kg === 20).color, 'grey');
  assert.equal(colorMode(st), 'mixed');
  assert.ok(setPlateColor(st, 20, 'pink').error);
  const black = setAllColors(st, 'black').st;
  assert.equal(colorMode(black), 'black');
  assert.deepEqual(black.available.map(p => p.color), ['black', 'black', 'black']);
  const comp = setAllColors(black, 'comp').st;
  assert.equal(colorMode(comp), 'comp');
  assert.deepEqual(comp.available.map(p => p.color), ['red', 'blue', 'silver']);
});

test('Palette: etwa neun Farben, Schrift auf jeder Scheibe gut lesbar, auf Schwarz hell', () => {
  assert.ok(COLOR_IDS.length >= 8 && COLOR_IDS.length <= 10);
  ['red', 'blue', 'yellow', 'green', 'white', 'black', 'grey', 'silver'].forEach(c => assert.ok(COLOR_IDS.includes(c), c));
  const lum = hex => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  COLOR_IDS.forEach(c => assert.ok(contrast(PLATE_COLORS[c].fill, PLATE_COLORS[c].ink) >= 4, `${c}: ${contrast(PLATE_COLORS[c].fill, PLATE_COLORS[c].ink).toFixed(2)}`));
  assert.ok(lum(PLATE_COLORS.black.ink) > 0.7);
  /* Dunkle Scheiben brauchen einen hellen Rand, sonst verschwinden sie auf dem dunklen Grund */
  assert.ok(PLATE_COLORS.black.edge);
});

test('Wettkampffarben auch für Wechselscheiben 2, 1,5 und 1 kg', () => {
  assert.deepEqual([2, 1.5, 1, 0.5, 50].map(compColor), ['blue', 'yellow', 'green', 'white', 'silver']);
});

/* ---------- Rechner mit eigenen Gewichten ---------- */

test('Scheibenrechner mit eigenen Gewichten 0,5 / 1 / 2 / 15 / 50', () => {
  const A = [50, 15, 2, 1, 0.5];
  assert.deepEqual(loadBar(150, 20, A).perSide, [50, 15]);
  assert.deepEqual(loadBar(153, 20, A).perSide, [50, 15, 1, 0.5]);
  assert.deepEqual(loadBar(27, 20, A).perSide, [2, 1, 0.5]);
  assert.deepEqual(loadBar(21, 20, A).perSide, [0.5]);
  /* Kleinste Scheibenzahl: 60,5 kg je Seite als 4 × 15 + 0,5 statt 50 + 5 × 2 + 0,5 */
  assert.deepEqual(loadBar(141, 20, A).perSide, [15, 15, 15, 15, 0.5]);
  const r = loadBar(120.5, 20, A);
  assert.equal(r.status, 'nearest');
  assert.equal(r.below.total, 120);
  assert.equal(r.above.total, 121);
  assert.equal(nearestLoadable(121.25, 20, A), 121);
  /* Mit Objekten aus den Einstellungen dasselbe */
  const st = plateSettings({ available: A });
  assert.deepEqual(loadBar(153, 20, st.available).perSide, [50, 15, 1, 0.5]);
  assert.equal(nearestLoadable(121.25, 20, st.available), 121);
});

test('Viertel-kg-Scheiben gehen ohne Rundungsfehler auf', () => {
  const A = [20, 0.25];
  assert.deepEqual(loadBar(60.5, 20, A).perSide, [20, 0.25]);
  assert.equal(loadBar(60.25, 20, A).status, 'nearest');
  assert.equal(nearestLoadable(60.3, 20, A), 60.5);
});

/* ---------- Eigene Stangen ---------- */

test('Stange anlegen: Name, 3 bis 30 kg, keine doppelten Namen', () => {
  const r = saveBar(null, { name: '  Trap-Bar ', kg: 25 }, 'trap');
  assert.equal(r.id, 'trap');
  assert.deepEqual(r.st.bars[2], { id: 'trap', name: 'Trap-Bar', kg: 25 });
  assert.deepEqual(saveBar(null, { name: '15er', kg: '15,1' }, 'b15').st.bars[2].kg, 15);
  assert.equal(saveBar(null, { name: 'Leicht', kg: 3 }, 'l').st.bars[2].kg, 3);
  assert.equal(saveBar(null, { name: 'Schwer', kg: 30 }, 's').st.bars[2].kg, 30);
  assert.match(saveBar(null, { name: '', kg: 15 }, 'x').error, /Namen/);
  assert.match(saveBar(null, { name: 'Zu leicht', kg: 2.9 }, 'x').error, /3 bis 30/);
  assert.match(saveBar(null, { name: 'Zu schwer', kg: 30.5 }, 'x').error, /3 bis 30/);
  assert.match(saveBar(null, { name: 'Ohne', kg: NaN }, 'x').error, /3 bis 30/);
  assert.match(saveBar(null, { name: 'langhantel', kg: 15 }, 'x').error, /gibt es schon/);
  assert.match(saveBar(r.st, { name: 'TRAP-BAR', kg: 15 }, 'y').error, /gibt es schon/);
  assert.ok(saveBar(r.st, { name: 'Zweite', kg: 15 }, 'trap').error, 'id schon vergeben');
});

test('Standardstangen umbenennen und Gewicht ändern, aber nicht löschen', () => {
  const r = saveBar(null, { id: 'barbell', name: 'Olympiastange', kg: 20 });
  assert.deepEqual(r.st.bars[0], { id: 'barbell', name: 'Olympiastange', kg: 20 });
  assert.equal(saveBar(null, { id: 'sz', name: 'SZ-Stange', kg: 7.5 }).st.bars[1].kg, 7.5);
  /* Eigener Name bleibt beim Speichern der eigenen Stange erlaubt */
  assert.ok(saveBar(null, { id: 'sz', name: 'sz-stange', kg: 8 }).st);
  assert.match(removeBar(null, 'barbell').error, /bleiben/);
  assert.match(removeBar(null, 'sz').error, /bleiben/);
  assert.match(saveBar(null, { id: 'weg', name: 'X', kg: 10 }).error, /nicht mehr/);
});

test('Eigene Stange löschen setzt Übungen auf die passende Standardstange zurück', () => {
  let st = saveBar(null, { name: 'Trap-Bar', kg: 25 }, 'trap').st;
  st = chooseBar(st, 'kd|Kreuzheben', 'trap');
  st = chooseBar(st, 'rd|Rumänisches Kreuzheben', 'trap');
  assert.equal(barUsage(st, 'trap'), 2);
  assert.equal(barFor(DEAD, st, 'kd|Kreuzheben').kg, 25);
  st = removeBar(st, 'trap').st;
  assert.equal(st.bars.length, 2);
  assert.deepEqual(st.barFor, {});
  const b = barFor(DEAD, st, 'kd|Kreuzheben');
  assert.equal(b.id, 'barbell');
  assert.equal(b.chosen, false);
});

/* ---------- Stange pro Übung ---------- */

test('Gewählte Stange gilt pro Übung, sonst die Stange zum Gerät', () => {
  let st = saveBar(null, { name: 'Trap-Bar', kg: 25 }, 'trap').st;
  st = saveBar(st, { name: 'Kurze Stange', kg: 15 }, 'short').st;
  st = chooseBar(st, 'kd|Kreuzheben', 'trap');
  st = chooseBar(st, 'bank|Bankdrücken', 'short');
  assert.deepEqual(barFor(DEAD, st, 'kd|Kreuzheben'), { id: 'trap', kind: 'barbell', label: 'Trap-Bar', kg: 25, chosen: true });
  assert.equal(barFor(BANK, st, 'bank|Bankdrücken').kg, 15);
  /* Andere Übung mit Langhantel: weiter die Langhantel */
  assert.deepEqual(barFor(BANK, st, 'sq|Kniebeugen'), { id: 'barbell', kind: 'barbell', label: 'Langhantel', kg: 20, chosen: false });
  /* Ohne Schlüssel: Gerät */
  assert.equal(barFor(DEAD, st).kg, 20);
  assert.equal(barFor(CURL, st, 'curl|Curls').id, 'sz');
  /* Maschinen und Zeitübungen bekommen auch mit Eintrag keinen Scheibenrechner */
  const m = chooseBar(st, 'bp|Beinpresse', 'trap');
  assert.equal(barFor({ equipment: ['Maschinen'] }, m, 'bp|Beinpresse'), null);
  assert.equal(barFor({ equipment: ['Langhantel'], unit: 'sec' }, m, 'kd|Kreuzheben'), null);
});

test('Gleiche Übung in anderem Plan: die Wahl gilt über den Namen', () => {
  let st = saveBar(null, { name: 'Trap-Bar', kg: 25 }, 'trap').st;
  st = chooseBar(st, 'kd|Kreuzheben', 'trap');
  assert.equal(chosenBarId(st.barFor, 'kreuzheben-2|Kreuzheben'), 'trap');
  assert.equal(barFor(DEAD, st, 'kreuzheben-2|Kreuzheben').kg, 25);
  /* Neue Wahl zieht die Einträge mit gleichem Namen mit */
  st = chooseBar(st, 'kreuzheben-2|Kreuzheben', 'barbell');
  assert.deepEqual(st.barFor, { 'kd|Kreuzheben': 'barbell', 'kreuzheben-2|Kreuzheben': 'barbell' });
  assert.equal(barKey({ exId: 'kd', name: 'Kreuzheben' }), 'kd|Kreuzheben');
});

test('Unbekannte Stange wird nicht gemerkt', () => {
  const st = chooseBar(null, 'kd|Kreuzheben', 'gibtsnicht');
  assert.deepEqual(st.barFor, {});
  assert.deepEqual(chooseBar(null, '', 'sz').barFor, {});
});

test('Aufwärmrampe und Runden nutzen die gewählte Stange', () => {
  let st = setAllColors({ available: [20, 10, 5, 2.5, 1.25] }, 'black').st;
  st = saveBar(st, { name: 'Trap-Bar', kg: 25 }, 'trap').st;
  st = saveBar(st, { name: '15-kg-Stange', kg: 15 }, 'b15').st;
  st = chooseBar(st, 'kd|Kreuzheben', 'trap');
  st = chooseBar(st, 'bank|Bankdrücken', 'b15');
  const ramp = (lib, key, work) => {
    const bar = barFor(lib, st, key);
    return warmupRamp(work, { barKg: bar.kg, round: kg => nearestLoadable(kg, bar.kg, st.available) });
  };
  assert.deepEqual(ramp(DEAD, 'kd|Kreuzheben', 100), [
    { kg: 25, reps: 10, bar: true }, { kg: 40, reps: 10, bar: false }, { kg: 60, reps: 5, bar: false }, { kg: 80, reps: 3, bar: false },
  ]);
  /* 15-kg-Stange, 60 kg: 40 % = 24 kg, ladbar sind 22,5 und 25, näher liegt 25 */
  assert.deepEqual(ramp(BANK, 'bank|Bankdrücken', 60).map(s => s.kg), [25, 35, 47.5]);
  assert.deepEqual(loadBar(100, 15, st.available).perSide, [20, 20, 2.5]);
  assert.deepEqual(loadBar(100, 25, st.available).perSide, [20, 10, 5, 2.5]);
});
