/* Angebot zum überarbeiteten 3er-Split, Ansicht (Prüfung 4.7): „Behalten, nicht mehr fragen“ mit Hinweis auf „Neuer Plan“ */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const el = () => ({ textContent: '', hidden: false, style: {}, setAttribute() {}, appendChild() {}, remove() {}, querySelector: () => null, addEventListener() {} });
const toastEl = el();
globalThis.document = { querySelector: s => (s === '.toast' ? toastEl : null), querySelectorAll: () => [], getElementById: () => null, createElement: el, body: el(), addEventListener() {} };
globalThis.window = { addEventListener() {}, scrollTo() {}, scrollBy() {} };
after(() => { delete globalThis.document; delete globalThis.window; });

const { S } = await import('../js/state.js');
const { defaultState } = await import('../js/store/migrate.js');
const { LEGACY_SPLIT } = await import('../js/plans.js');
const view = await import('../js/views/plan-update.js');

test('Knopf „Behalten, nicht mehr fragen“, Hinweis auf „Neuer Plan“, danach kein Angebot mehr', () => {
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, defaultState());
  S.plans = [JSON.parse(JSON.stringify(LEGACY_SPLIT))];
  const html = view.offerCard();
  assert.match(html, /data-act="planofferno">Behalten, nicht mehr fragen<\/button>/);
  assert.doesNotMatch(html, /Nicht jetzt/);
  assert.match(html, /findest du den neuen 3er-Split jederzeit unter „Neuer Plan“/);
  view.actions.planofferno();
  assert.equal(view.offerCard(), '');
  assert.equal(toastEl.textContent, 'Dein Plan bleibt. Den neuen 3er-Split findest du unter „Neuer Plan“.');
  assert.equal(S.plans.length, 1);
});
