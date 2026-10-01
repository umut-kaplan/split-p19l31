/* Bibliothek, Übungsauswahl im Plan und Editor eigener Übungen mit den Geräten von 4.7 (B) */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { S, V } from '../js/state.js';
import { defaultState } from '../js/store/migrate.js';
import { libraryView, vLibrary, showExercise, editCustom, draftRequirement, actions, inputs } from '../js/views/library.js';
import { pickerBody } from '../js/views/planedit.js';
import { EXERCISES } from '../js/data/exercises.js';
import { canDo } from '../js/domain/equipment.js';
import { MUSCLES } from '../js/domain/muscles.js';

/* Kleinste DOM-Attrappe für Sheet und Hinweise */
const el = () => ({ textContent: '', hidden: false, style: {}, setAttribute() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.document = { querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el() };
after(() => { delete globalThis.document; });

beforeEach(() => {
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, defaultState());
  Object.assign(V, { libQ: '', libMuscle: null, libEquip: null, libAll: false, libDraft: null, sheet: null });
});

const ids = list => list.map(e => e.id);
/* Ein Listeneintrag als Text, ohne das lange Platzhalter-SVG davor */
const itemOf = (html, attr, id) => { const i = html.indexOf(`${attr}="${id}"`); return i < 0 ? '' : html.slice(i, html.indexOf('</li>', i)); };

test('Leere Geräteauswahl: alle Übungen, kein Schalter, Hinweis auf Studio', () => {
  const lv = libraryView(EXERCISES, { have: [] });
  assert.equal(lv.shown.length, EXERCISES.length);
  assert.equal(lv.hidden.length, 0);
  assert.equal(lv.gear, false);
  const html = vLibrary();
  assert.doesNotMatch(html, /data-act="libmine"[^>]*role|class="cmp-switch lib-mine"/);
  assert.match(html, /Alle Übungen\. Deine Geräte wählst du unter Profil · Einstellungen · Studio/);
  assert.match(html, new RegExp(`lib-count" aria-live="polite">${EXERCISES.length} Übungen`));
});

test('Standard „Nur meine Geräte“: zeigt nur, was geht, und nennt die Zahl der ausgeblendeten', () => {
  S.profile.equipment = ['kurzhanteln', 'flachbank'];
  const lv = libraryView(EXERCISES, { have: S.profile.equipment });
  assert.ok(lv.mine && lv.gear);
  lv.shown.forEach(e => assert.ok(canDo(e, S.profile.equipment), e.id));
  lv.hidden.forEach(e => assert.ok(!canDo(e, S.profile.equipment), e.id));
  assert.equal(lv.shown.length + lv.hidden.length, EXERCISES.length);
  const html = vLibrary();
  assert.match(html, /class="cmp-switch lib-mine" role="switch" aria-checked="true" data-act="libmine"/);
  assert.match(html, new RegExp(`<small class="lib-hid">${lv.hidden.length} Übungen ausgeblendet</small>`));
  assert.equal((html.match(/<li data-libid=/g) || []).length, lv.shown.length);
  assert.doesNotMatch(html, /fehlt:/);
  /* Umschalten: alle Übungen, die fehlenden Geräte stehen dabei */
  actions.libmine();
  assert.equal(V.libAll, true);
  const all = vLibrary();
  assert.match(all, /aria-checked="false" data-act="libmine"/);
  assert.match(all, /Aus: auch Übungen für andere Geräte/);
  assert.equal((all.match(/<li data-libid=/g) || []).length, EXERCISES.length);
  assert.match(itemOf(all, 'data-libid', 'kniebeugen'), /fehlt: Langhantel mit Scheiben, Power Rack \/ Kniebeugenständer oder Multipresse/);
  actions.libmine();
  assert.equal(V.libAll, false);
});

test('Suche findet Aliase; Treffer nur bei ausgeblendeten Übungen werden genannt', () => {
  S.profile.equipment = ['kurzhanteln'];
  V.libQ = 'EGYM Brustpresse';
  const html = vLibrary();
  assert.match(html, /<div class="empty lib-none" >/, 'Hinweis sichtbar');
  assert.match(html, /Mit deinen Geräten nichts gefunden\. Ein Treffer braucht andere Geräte\./);
  assert.match(html, /<button class="link lib-none-all" data-act="libmine" >Alle Übungen zeigen/);
  assert.match(html, /<small class="lib-hid">1 Übung ausgeblendet<\/small>/);
  S.profile.equipment = ['kurzhanteln', 'smart-zirkel'];
  const hit = vLibrary();
  assert.match(hit, /<li data-libid="smart-brustpresse" >/);
  assert.match(hit, /lib-count" aria-live="polite">1 Übung</);
});

test('Muskelfilter mit den neuen Gruppen, Gerätefilter nach Gruppen geordnet', () => {
  const html = vLibrary();
  assert.match(html, /data-act="libmuscle" data-v="traps">Nacken\/Trapez</);
  assert.match(html, /data-act="libmuscle" data-v="lower_back">Unterer Rücken</);
  assert.equal((html.match(/data-act="libmuscle"/g) || []).length, Object.keys(MUSCLES).length + 1);
  assert.match(html, /<optgroup label="Freie Gewichte">[\s\S]*<optgroup label="Zusatz"><option value="smart-zirkel" >Smart-Zirkel<\/option><\/optgroup>/);
  V.libMuscle = 'lower_back';
  const lb = libraryView(EXERCISES, { muscle: 'lower_back', have: [] });
  assert.ok(lb.shown.length > 0);
  lb.shown.forEach(e => assert.ok([...e.muscles.primary, ...e.muscles.secondary].includes('lower_back'), e.id));
  V.libEquip = 'smart-zirkel';
  assert.equal(libraryView(EXERCISES, { equipment: 'smart-zirkel', have: [] }).shown.length, 18);
});

test('Übungs-Sheet: Geräte mit „fehlt dir“, bei Smart-Übungen ein Satz zur Methode', () => {
  S.profile.equipment = ['kurzhanteln'];
  showExercise('smart-brustpresse');
  assert.match(V.sheet.body, /fehlt dir: Smart-Zirkel/);
  assert.match(V.sheet.body, /class="lib-smart">Das Gerät stellt das Gewicht ein\. Die Methode \(Regulär, Negativ, Adaptiv, Isokinetisch, Explonic, Max Out\) wählst du im Training an der Übungskarte; Rekorde zählen nur aus „Regulär“\./);
  S.profile.equipment = ['kurzhanteln', 'flachbank'];
  showExercise('kh-bankdruecken');
  assert.doesNotMatch(V.sheet.body, /lib-smart|fehlt dir/);
  S.profile.equipment = ['kurzhanteln'];
  showExercise('kh-bankdruecken');
  assert.match(V.sheet.body, /Kurzhanteln \+ Flachbank<br><span class="lib-miss">fehlt dir: Flachbank<\/span>/);
});

test('Übungsauswahl im Plan: passende zuerst, darunter die übrigen mit „fehlt: …“', () => {
  S.profile.equipment = ['kurzhanteln', 'flachbank'];
  const html = pickerBody();
  const sep = html.indexOf('class="pick-sep"');
  assert.ok(sep > 0);
  const before = [...html.slice(0, sep).matchAll(/data-pickid="([^"]+)"/g)].map(m => m[1]);
  const below = [...html.slice(sep).matchAll(/data-pickid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(before.length + below.length, EXERCISES.length);
  assert.ok(before.includes('kh-bankdruecken') && below.includes('bankdruecken'));
  assert.match(itemOf(html, 'data-pickid', 'smart-latzug'), /fehlt: Smart-Zirkel/);
  assert.match(itemOf(html, 'data-pickid', 'bankdruecken'), /fehlt: Langhantel mit Scheiben, Bankdrückstation mit Ablage/);
  assert.doesNotMatch(itemOf(html, 'data-pickid', 'kh-bankdruecken'), /fehlt/);
  assert.deepEqual(before, [...before].sort((a, b) => EXERCISES.find(e => e.id === a).name.localeCompare(EXERCISES.find(e => e.id === b).name, 'de')));
  /* Leere Auswahl: keine Trennung */
  S.profile.equipment = [];
  assert.doesNotMatch(pickerBody(), /pick-sep|fehlt:/);
});

test('Editor eigener Übungen: Geräte abhaken, alle nötig oder eines genügt, Smart-Zirkel stellt das Gewicht ein', () => {
  editCustom(null);
  const d = V.libDraft;
  assert.deepEqual(draftRequirement(d), []);
  assert.match(V.sheet.body, /Kein Gerät angehakt: eine Übung mit Körpergewicht/);
  actions.libdeq({ dataset: { v: 'kabelturm' } });
  actions.libdeq({ dataset: { v: 'widerstandsband' } });
  assert.deepEqual(draftRequirement(d), ['kabelturm', 'widerstandsband']);
  assert.match(V.sheet.body, /Braucht: <b>Kabelzug, einzeln \(Rolle verstellbar\) \+ Widerstandsbänder \/ Minibands<\/b>/);
  actions.libdeqmode({ dataset: { v: 'any' } });
  assert.deepEqual(draftRequirement(d), [['kabelturm', 'widerstandsband']]);
  assert.match(V.sheet.body, /aria-checked="true" class="on" data-act="libdeqmode" data-v="any"/);
  assert.match(V.sheet.body, / oder Widerstandsbänder/);
  d.name = 'Face Pulls mit Band';
  d.primary = ['shoulders'];
  V.sheet.actions[0].fn();
  const saved = S.exercisesCustom.find(e => e.name === 'Face Pulls mit Band');
  assert.deepEqual(saved.equipment, [['kabelturm', 'widerstandsband']]);
  assert.equal(saved.autoLoad, null);
  /* Smart-Zirkel als einziges Gerät: das Gerät stellt das Gewicht ein */
  editCustom(null);
  actions.libdeq({ dataset: { v: 'smart-zirkel' } });
  Object.assign(V.libDraft, { name: 'Smart Wadenpresse', primary: ['calves'] });
  V.sheet.actions[0].fn();
  assert.equal(S.exercisesCustom.find(e => e.name === 'Smart Wadenpresse').autoLoad, 'smart');
});

test('Editor: gemischte Anforderung bleibt erhalten, bis man an den Geräten etwas ändert', () => {
  S.exercisesCustom = [{ id: 'c1', name: 'Kniebeuge eigen', aliases: [], type: 'compound', unit: 'reps', muscles: { primary: ['quads'], secondary: [] },
    equipment: ['langhantel', ['kniebeugenstaender', 'multipresse']], steps: [], mistakes: [], stresses: [], alternatives: [], image: null, credit: null, media: null, custom: true }];
  editCustom('c1');
  assert.match(V.sheet.body, /Bisher: <b>Langhantel mit Scheiben \+ Power Rack \/ Kniebeugenständer oder Multipresse \(Smith-Maschine\)<\/b>/);
  assert.match(V.sheet.body, /<details class="gear-group" open>\s*<summary data-act="libdeqgrp" data-g="frei"/);
  V.sheet.actions[0].fn();
  assert.deepEqual(S.exercisesCustom[0].equipment, ['langhantel', ['kniebeugenstaender', 'multipresse']]);
  editCustom('c1');
  actions.libdeq({ dataset: { v: 'multipresse' } });
  assert.deepEqual(draftRequirement(V.libDraft), ['langhantel', 'kniebeugenstaender']);
  assert.match(V.sheet.body, /Braucht: <b>Langhantel mit Scheiben \+ Power Rack/);
});

test('Suche im Picker blendet die Trennzeile aus, wenn nur eine Seite Treffer hat', () => {
  const items = [
    { dataset: { pickid: 'kh-bankdruecken' }, hidden: false, closest: () => null },
    { dataset: { pickid: 'bankdruecken' }, hidden: false, closest: () => ({}) },
  ];
  const sep = { hidden: false };
  const none = { hidden: true };
  const doc = globalThis.document;
  globalThis.document = { ...doc, querySelectorAll: () => items, querySelector: s => (s === '.pick-sep' ? sep : s === '.plan-pick-none' ? none : null) };
  const run = async () => (await import('../js/views/planedit.js')).inputs.planpickq({ value: 'Kurzhantel-Bankdrücken' });
  return run().then(() => {
    assert.equal(sep.hidden, true);
    assert.equal(items[1].hidden, true);
    globalThis.document = doc;
  });
});

test('Live-Suche in der Bibliothek zählt ausgeblendete Treffer mit', () => {
  S.profile.equipment = ['kurzhanteln'];
  const t = { textContent: '' }, all = { hidden: true }, none = { hidden: true, querySelector: s => (s === '.lib-none-t' ? t : all) };
  const hid = { textContent: '' }, count = { textContent: '' };
  const doc = globalThis.document;
  globalThis.document = { ...doc, querySelectorAll: () => [], querySelector: s => ({ '.lib-none': none, '.lib-hid': hid, '.lib-count': count }[s] || null) };
  inputs.libq({ value: 'egym' });
  globalThis.document = doc;
  assert.equal(none.hidden, false);
  assert.equal(all.hidden, false);
  assert.match(t.textContent, /18 Treffer brauchen andere Geräte/);
  assert.equal(hid.textContent, '18 Übungen ausgeblendet');
  assert.equal(count.textContent, '0 Übungen');
});

test('Gefilterte Liste und Picker sind nach Namen sortiert und ohne Dubletten', () => {
  S.profile.equipment = ['langhantel', 'kniebeugenstaender', 'flachbank'];
  const lv = libraryView(EXERCISES, { have: S.profile.equipment });
  assert.equal(new Set(ids(lv.shown)).size, lv.shown.length);
  assert.ok(ids(lv.shown).includes('bankdruecken'), 'Rack + Flachbank deckt die Bankdrückstation ab');
});
