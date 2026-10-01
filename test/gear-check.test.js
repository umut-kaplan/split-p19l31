/* Hinweis nach dem Update (Prüfung M1): Wer Geräte-Kategorien bis 4.6 hatte, sieht auf „Heute“ einmal
   „Neu: Geräte deines Studios“ mit dem Weg zur Geräteseite. */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

const el = () => ({ textContent: '', hidden: false, style: {}, setAttribute() {}, appendChild() {}, remove() {}, querySelector: () => null, addEventListener() {} });
globalThis.document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: el, body: el(), addEventListener() {} };
globalThis.window = { addEventListener() {}, scrollTo() {}, scrollBy() {} };
after(() => { delete globalThis.document; delete globalThis.window; });

const { S, V } = await import('../js/state.js');
const { defaultState, normalize } = await import('../js/store/migrate.js');
const { presetEquipment } = await import('../js/domain/equipment.js');
const gear = await import('../js/views/gear.js');
const today = await import('../js/views/today.js');

const ALL9 = ['Langhantel', 'Kurzhanteln', 'SZ-Stange', 'Hantelbank', 'Kabelzug', 'Maschinen', 'Beinpresse', 'Klimmzugstange', 'Dip-Station'];
function load(st) {
  const next = normalize(JSON.parse(JSON.stringify(st)));
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, next);
}
beforeEach(() => { Object.assign(V, { tab: 'today', setView: null, sheet: null }); });

test('4.6-Stand mit allen neun Kategorien: großes Studio, Hinweis auf „Heute“ mit Weg zur Geräteseite', () => {
  const st = defaultState();
  st.settings.onboardingDone = true; st.settings.disclaimerSeen = true; st.settings.lastBackup = Date.now();
  st.profile.equipment = [...ALL9];
  load(st);
  assert.deepEqual(S.profile.equipment, presetEquipment('gross'));
  assert.equal(S.settings.gearCheck, true);
  const card = gear.gearCheckCard();
  assert.match(card, /<h2>Neu: Geräte deines Studios<\/h2>/);
  assert.match(card, /Prüf kurz, ob alles stimmt\. Deine bisherige Auswahl steht jetzt als 59 einzelne Geräte unter Einstellungen · Studio\./);
  assert.match(card, /data-act="gearcheckgo"/);
  assert.match(today.view(), /Neu: Geräte deines Studios/);
  /* Ein Tipp: Geräteseite, Hinweis weg, auch nach dem nächsten Laden */
  gear.actions.gearcheckgo();
  assert.equal(V.tab, 'profile');
  assert.equal(V.setView, 'studio');
  assert.equal(S.settings.gearCheck, false);
  assert.equal(gear.gearCheckCard(), '');
  load(S);
  assert.equal(S.settings.gearCheck, false);
});

test('„Passt so“ blendet aus; neue Nutzer und Stände ohne Kategorien sehen nichts', () => {
  const st = defaultState();
  st.profile.equipment = ['Kurzhanteln', 'Hantelbank'];
  load(st);
  assert.deepEqual(S.profile.equipment, ['kurzhanteln', 'flachbank', 'schraegbank']);
  assert.match(gear.gearCheckCard(), /als 3 einzelne Geräte/);
  gear.actions.gearcheckok();
  assert.equal(gear.gearCheckCard(), '');
  load(defaultState());
  assert.equal(S.settings.gearCheck, undefined);
  assert.equal(gear.gearCheckCard(), '');
  const ids = defaultState();
  ids.profile.equipment = ['kurzhanteln'];
  load(ids);
  assert.equal(gear.gearCheckCard(), '');
});
