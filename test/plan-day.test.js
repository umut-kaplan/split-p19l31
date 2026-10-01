import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, V } from '../js/state.js';
import { defaultState } from '../js/store/migrate.js';
import { vPlan, daySubview } from '../js/views/planedit.js';
import { backLink, navRow, compareRow, COMPARE_TITLE } from '../js/ui/navlinks.js';

beforeEach(() => {
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, defaultState());
  V.planEdit = null;
  V.planDay = null;
});

test('Ohne Stift-Tipp gibt es keine Unterseite „Tag bearbeiten“', () => {
  assert.equal(daySubview(), null);
});

test('Stift an der Tageskarte: genau dieser Tag, mit Zurück und „Übung hinzufügen“ über der Liste', () => {
  const plan = S.plans[0];
  const id = plan.order[2];
  V.planDay = id;
  V.planEdit = true;
  const html = daySubview();
  assert.match(html, /data-act="back"/);
  assert.match(html, new RegExp(`<h1 class="page-title">${plan.days[id].name}</h1>`));
  const add = html.indexOf('data-act="addex"');
  const list = html.indexOf('class="pe-list"');
  const edit = html.indexOf('data-act="edit"');
  assert.ok(add > 0 && list > add && edit > list, '„Übung hinzufügen“ steht über der Liste');
  /* Name und Farbe des Tages kommen nach den Übungen */
  assert.ok(html.indexOf('data-in="dayname"') > edit);
  /* Kein Plankopf, keine Tag-Reiter */
  assert.doesNotMatch(html, /data-act="planday"|data-act="plannew"/);
});

test('Reiter „Plan“: „Übung hinzufügen“ ebenfalls über der Liste', () => {
  const html = vPlan();
  const add = html.indexOf('data-act="addex"');
  assert.ok(add > html.indexOf('data-act="planday"') && add < html.indexOf('class="pe-list"'));
});

test('Zurück-Knopf und Zeilen sind überall gleich gebaut', () => {
  assert.equal(backLink(), '<div class="back-row"><button type="button" class="link back-link" data-act="back">Zurück</button></div>');
  assert.match(backLink('foodback'), /data-act="foodback">Zurück</);
  const row = navRow('A & B', 'kurz <b>', 'data-act="x"');
  assert.match(row, /<b>A &amp; B<\/b><small>kurz &lt;b&gt;<\/small>/);
  assert.match(compareRow(), new RegExp(`data-act="cmpopen"[\\s\\S]*${COMPARE_TITLE.replace(/[()]/g, '\\$&')}`));
  assert.equal(COMPARE_TITLE, 'Mit Trainingspartner vergleichen (QR-Code)');
  /* In der laufenden Einheit die kurze Fassung, einzeilig ohne Erklärung */
  assert.match(compareRow('', 'Mit Partner vergleichen'), /<b>Mit Partner vergleichen<\/b><\/span>/);
});
