/* Geräteseite und Kurzhantel-Steigerung (4.7, B): Aufbau, Aktionen, Texte */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, V } from '../js/state.js';
import { defaultState } from '../js/store/migrate.js';
import { fEquipment, dumbbellSection, dumbbellEntries, equipmentStatus, actions } from '../js/views/gear.js';
import { subview } from '../js/views/settings.js';
import { presetEquipment } from '../js/domain/equipment.js';

beforeEach(() => {
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, defaultState());
  V.gearOpen = null;
  V.setView = null;
});

const tap = (act, v) => actions[act]({ dataset: { v, g: v }, closest: () => null });
const count = (html, re) => (html.match(re) || []).length;

test('Aufbau: drei Schnellauswahlen, Smart-Schalter, sechs Gruppen mit Zähler, 59 Geräte zum Abhaken', () => {
  const html = fEquipment(S.profile);
  assert.deepEqual([...html.matchAll(/data-act="gearpreset" data-v="(\w+)"/g)].map(m => m[1]), ['gross', 'discount', 'zuhause']);
  assert.match(html, /<b>Großes Studio<\/b><span>Alle 59 Gerätetypen<\/span>/);
  assert.match(html, /<b>Discount-Studio<\/b><span>38 Geräte/);
  assert.match(html, /role="switch" aria-checked="false" data-act="gearsmart"[\s\S]*Smart-Zirkel \(z\. B\. EGYM\)/);
  assert.equal(count(html, /class="gear-group"/g), 6);
  assert.equal(count(html, /data-act="geartoggle"/g), 59);
  assert.equal(count(html, /role="checkbox" aria-checked="false"/g), 59);
  assert.match(html, /<span class="gear-cnt num ">0\/5<\/span>/);
  assert.match(html, /Geräte <span class="num">0 von 59<\/span>/);
  assert.match(html, /data-act="gearclear" disabled>Alles abwählen/);
  /* Keine Marke außer „EGYM“ im Schalter */
  assert.equal(count(html, /EGYM/g), 1);
  assert.doesNotMatch(html, /technogym|gym80|hammer strength|life fitness|nautilus|milon|trx/i);
  /* Gruppen zu, bis man sie öffnet */
  assert.doesNotMatch(html, /<details class="gear-group" open>/);
});

test('Schnellauswahl und Smart-Schalter sind kombinierbar; „Alles abwählen“ lässt den Schalter stehen', () => {
  tap('gearsmart');
  assert.deepEqual(S.profile.equipment, ['smart-zirkel']);
  tap('gearpreset', 'discount');
  assert.equal(S.profile.equipment.length, 39);
  assert.ok(S.profile.equipment.includes('smart-zirkel'));
  let html = fEquipment(S.profile);
  assert.match(html, /class="choice on" aria-pressed="true" data-act="gearpreset" data-v="discount"/);
  assert.match(html, /aria-checked="true" data-act="gearsmart"/);
  assert.match(html, /38 von 59/);
  tap('geartoggle', 'trap-bar');
  html = fEquipment(S.profile);
  assert.doesNotMatch(html, /class="choice on"/, 'eigene Auswahl: keine Schnellauswahl markiert');
  tap('gearpreset', 'zuhause');
  assert.deepEqual(S.profile.equipment, ['kurzhanteln', 'widerstandsband', 'smart-zirkel']);
  tap('gearclear');
  assert.deepEqual(S.profile.equipment, ['smart-zirkel']);
  tap('gearsmart');
  assert.deepEqual(S.profile.equipment, []);
});

test('Zähler je Gruppe und abgedeckte Geräte', () => {
  S.profile.equipment = ['kniebeugenstaender', 'flachbank', 'kurzhanteln'];
  const html = fEquipment(S.profile);
  assert.match(html, /<span class="gear-cnt num on">1\/5<\/span>/);
  assert.match(html, /aria-label="Bänke und Racks, 2 von 14 angehakt"/);
  assert.match(html, /gear-item  cov" role="checkbox" aria-checked="false" data-act="geartoggle" data-v="bankdrueckstation"[\s\S]{0,200}Abgedeckt über Power Rack \/ Kniebeugenständer \+ Flachbank/);
});

test('Landmine ohne Langhantel: angehakt, aber mit Hinweis', () => {
  S.profile.equipment = ['landmine'];
  assert.match(fEquipment(S.profile), /data-v="landmine"[\s\S]{0,200}Zählt erst mit Langhantel mit Scheiben/);
});

test('Offene Gruppen bleiben beim Neuzeichnen offen', () => {
  actions.geargroup({ dataset: { g: 'kabel' }, closest: () => ({ open: false }) });
  assert.match(fEquipment(S.profile), /<details class="gear-group" open>\s*<summary data-act="geargroup" data-g="kabel"/);
  actions.geargroup({ dataset: { g: 'kabel' }, closest: () => ({ open: true }) });
  assert.doesNotMatch(fEquipment(S.profile), /<details class="gear-group" open>/);
});

test('Satz unter der Liste: leer heißt alles, nur Smart-Zirkel, sonst „zuerst, was geht“', () => {
  assert.match(equipmentStatus([]), /alle Geräte/);
  assert.match(equipmentStatus(['smart-zirkel']), /Nur der Smart-Zirkel/);
  assert.match(equipmentStatus(['kurzhanteln']), /zuerst, was mit diesen Geräten geht/);
});

test('Einstellungen → Studio: Geräte zuerst, dann Kurzhanteln, dann Stangen und Scheiben', () => {
  V.setView = 'studio';
  const html = subview();
  const a = html.indexOf('data-act="gearpreset"');
  const b = html.indexOf('data-act="geardbinc"');
  const c = html.indexOf('data-act="gymplateedit"');
  assert.ok(a > 0 && b > a && c > b);
});

test('Kurzhantel-Steigerung: 1, 2 oder 2,5 kg, Standard 2', () => {
  let html = dumbbellSection();
  assert.deepEqual([...html.matchAll(/data-act="geardbinc" data-v="([\d.]+)">([^<]+)</g)].map(m => [m[1], m[2]]),
    [['1', '1 kg'], ['2', '2 kg'], ['2.5', '2,5 kg']]);
  assert.match(html, /aria-checked="true" class="on" data-act="geardbinc" data-v="2"/);
  tap('geardbinc', '2.5');
  assert.equal(S.settings.dumbbellInc, 2.5);
  tap('geardbinc', '7');
  assert.equal(S.settings.dumbbellInc, 2, 'Unbekanntes fällt auf den Standard');
  html = dumbbellSection();
  assert.match(html, /aria-checked="true" class="on" data-act="geardbinc" data-v="2"/);
});

test('Kurzhantel-Steigerung auf Plan-Übungen übernehmen: nur Kurzhanteln mit abweichender Steigerung', () => {
  const lib = e => ({
    'KH-Bankdrücken': { equipment: ['kurzhanteln', 'flachbank'] },
    Bankdrücken: { equipment: ['langhantel', 'bankdrueckstation'] },
    'Brustpresse (Smart-Zirkel)': { equipment: ['smart-zirkel'], autoLoad: 'smart' },
    Hammercurls: { equipment: ['kurzhanteln'] },
  }[e.names[0]] || null);
  const plans = [{ days: { a: { exercises: [
    { names: ['KH-Bankdrücken'], inc: 2.5, unit: 'reps' },
    { names: ['Bankdrücken'], inc: 2.5, unit: 'reps' },
    { names: ['Brustpresse (Smart-Zirkel)'], inc: 0, unit: 'reps' },
    { names: ['Hammercurls'], inc: 2, unit: 'reps' },
    { names: ['Unbekannt'], inc: 1, unit: 'reps' },
  ] } } }];
  assert.deepEqual(dumbbellEntries(plans, 2, lib).map(e => e.names[0]), ['KH-Bankdrücken']);
  assert.deepEqual(dumbbellEntries(plans, 1, lib).map(e => e.names[0]), ['KH-Bankdrücken', 'Hammercurls']);
});

test('Standardplan: Knopf zum Übernehmen erscheint nur, wenn etwas abweicht, und stellt um', () => {
  globalThis.document = { querySelector: () => ({ remove() {} }) };
  S.settings.dumbbellInc = 1;
  const n = dumbbellEntries(S.plans, 1).length;
  if (!n) { assert.doesNotMatch(dumbbellSection(), /geardbapply/); return; }
  assert.match(dumbbellSection(), new RegExp(`${n === 1 ? 'Eine Kurzhantel-Übung' : `${n} Kurzhantel-Übungen`} in deinen Plänen[\\s\\S]*data-act="geardbapply">Auf 1 kg angleichen`));
  actions.geardbapply();
  assert.equal(dumbbellEntries(S.plans, 1).length, 0);
  assert.doesNotMatch(dumbbellSection(), /geardbapply/);
  delete globalThis.document;
});

test('Großes Studio umfasst genau die Geräte der Schnellauswahl', () => {
  tap('gearpreset', 'gross');
  assert.deepEqual(S.profile.equipment, presetEquipment('gross'));
});
