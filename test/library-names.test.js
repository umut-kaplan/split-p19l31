/* Eigene Übungen mit Namen, die 4.7 selbst kennt (Prüfung H2): Die eigene gewinnt bei gleichem Namen, ein Alias der
   Bibliothek verdrängt sie nicht, Speichern mit unverändertem Namen geht, und die Bibliothek nennt die Fälle einmal. */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

const el = () => ({ textContent: '', hidden: false, style: {}, setAttribute() {}, appendChild() {}, remove() {}, querySelector: () => null, addEventListener() {} });
const toastEl = el();
globalThis.document = { querySelector: s => (s === '.toast' ? toastEl : null), querySelectorAll: () => [], getElementById: () => null, createElement: el, body: el(), addEventListener() {} };
globalThis.window = { addEventListener() {}, scrollTo() {}, scrollBy() {} };
after(() => { delete globalThis.document; delete globalThis.window; });

const { S, V } = await import('../js/state.js');
const { defaultState, normalize } = await import('../js/store/migrate.js');
const { findExercise, nameClashes, exerciseIdFor } = await import('../js/domain/library.js');
const lib = await import('../js/views/library.js');

const own = (id, name, extra = {}) => ({ id, name, aliases: [], type: 'isolation', unit: 'reps', muscles: { primary: ['abs'], secondary: [] },
  equipment: [], steps: [], mistakes: [], stresses: [], alternatives: [], image: null, credit: null, media: null, custom: true, ...extra });
const CUSTOM = [
  own('c-crunch', 'Crunches'),
  own('c-shrug', 'Shrugs', { muscles: { primary: ['back'], secondary: [] }, equipment: ['kurzhanteln'] }),
  own('c-egym', 'EGYM Brustpresse', { muscles: { primary: ['chest'], secondary: [] }, equipment: [['brustpresse', 'butterfly']] }),
  own('c-row', 'Kabelrudern einarmig', { muscles: { primary: ['back'], secondary: [] } }),
];

beforeEach(() => {
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, defaultState());
  S.exercisesCustom = JSON.parse(JSON.stringify(CUSTOM));
  Object.assign(V, { sheet: null, libDraft: null });
  toastEl.textContent = '';
});

test('Gleicher Name: die eigene Übung vor der Bibliothek; ein Alias der Bibliothek verdrängt sie nicht', () => {
  const c = S.exercisesCustom;
  assert.equal(findExercise('Crunches', c).id, 'c-crunch');
  assert.equal(findExercise('  crunches ', c).id, 'c-crunch');
  assert.equal(findExercise('Shrugs', c).id, 'c-shrug');
  assert.equal(findExercise('EGYM Brustpresse', c).id, 'c-egym');
  assert.equal(findExercise('EGYM Brustpresse', c).autoLoad, undefined, 'kein Smart-Zirkel für die eigene Übung');
  /* Über die id bleibt die Bibliothek erreichbar, ohne eigene Übung auch über Name und Alias */
  assert.equal(findExercise('crunches', c).id, 'crunches');
  assert.equal(findExercise('kh-shrugs', c).id, 'kh-shrugs');
  assert.equal(findExercise('Crunches').id, 'crunches');
  assert.equal(findExercise('Shrugs').id, 'kh-shrugs');
  assert.equal(findExercise('EGYM Brustpresse').id, 'smart-brustpresse');
  /* Andere Aliase der Bibliothek wie bisher */
  assert.equal(findExercise('Lat-Pulldown', c).id, 'latzug');
  assert.equal(findExercise('c-row', c).name, 'Kabelrudern einarmig');
  /* Neue Plan-Einträge mit dem Namen nehmen die eigene Übung */
  assert.equal(exerciseIdFor('Shrugs', [], c), 'c-shrug');
});

test('nameClashes: Crunches, Shrugs und EGYM Brustpresse heißen wie Bibliotheksübungen, sonst keine', () => {
  const list = nameClashes(S.exercisesCustom);
  assert.deepEqual(list.map(x => [x.custom.id, x.lib.id]), [['c-crunch', 'crunches'], ['c-shrug', 'kh-shrugs'], ['c-egym', 'smart-brustpresse']]);
  assert.deepEqual(nameClashes([own('c1', 'Mein Zirkel')]), []);
  assert.deepEqual(nameClashes(undefined), []);
  /* Keine automatische Änderung */
  assert.deepEqual(S.exercisesCustom.map(e => e.name), CUSTOM.map(e => e.name));
});

test('Bibliothek: Hinweis einmal, „Verstanden“ merkt sich die Übungen, nichts wird geändert', () => {
  let html = lib.vLibrary();
  assert.match(html, /Diese eigenen Übungen heißen wie Übungen der Bibliothek: Crunches, Shrugs und EGYM Brustpresse\. Du kannst sie behalten oder löschen und die aus der Bibliothek nehmen\./);
  assert.match(html, /data-act="libshow" data-id="c-shrug">Shrugs</);
  lib.actions.libclashok();
  assert.deepEqual(S.settings.nameClashSeen, ['c-crunch', 'c-shrug', 'c-egym']);
  html = lib.vLibrary();
  assert.doesNotMatch(html, /lib-clash/);
  assert.equal(S.exercisesCustom.length, CUSTOM.length);
  /* Übersteht das Laden */
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(S))).settings.nameClashSeen, ['c-crunch', 'c-shrug', 'c-egym']);
  /* Eine einzelne: Einzahl */
  S.settings.nameClashSeen = ['c-crunch', 'c-shrug'];
  assert.match(lib.vLibrary(), /Diese eigene Übung heißt wie Übungen der Bibliothek: EGYM Brustpresse\./);
});

test('Bearbeiten: Speichern mit unverändertem Namen geht, Umbenennen auf einen belegten Namen nicht', () => {
  for (const id of ['c-crunch', 'c-shrug', 'c-egym']) {
    lib.editCustom(id);
    assert.ok(V.libDraft, id);
    V.sheet.actions[0].fn();
    assert.equal(V.libDraft, null, `${id} gespeichert`);
    assert.equal(toastEl.textContent, 'Änderungen gespeichert');
  }
  lib.editCustom('c-row');
  V.libDraft.name = 'Latzug';
  V.sheet.actions[0].fn();
  assert.ok(V.libDraft, 'nicht gespeichert');
  assert.equal(toastEl.textContent, 'Eine Übung mit diesem Namen gibt es schon.');
  V.libDraft.name = 'Lat-Pulldown';
  V.sheet.actions[0].fn();
  assert.equal(toastEl.textContent, 'Eine Übung mit diesem Namen gibt es schon.', 'auch ein Alias ist belegt');
  V.libDraft = null;
});
