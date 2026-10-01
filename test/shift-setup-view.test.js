process.env.TZ = 'Europe/Berlin';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { S, V, replaceState } from '../js/state.js';
import { defaultState } from '../js/store/migrate.js';
import { defaultShifts, TEMPLATE_28 } from '../js/domain/shifts.js';
import { templateById } from '../js/domain/shift-templates.js';
import { draft, vSetup, actions } from '../js/views/shift-setup.js';

/* Toast und Hochscrollen brauchen sonst ein DOM */
globalThis.window = { scrollTo() {} };
globalThis.document = {
  querySelector: () => null, body: { appendChild() {} },
  createElement: () => ({ setAttribute() {}, remove() {} }),
};
mock.timers.enable({ apis: ['setTimeout'] });

/* Muster t28 mit eigener Frühschicht 05:45–13:45 */
function withOwnTimes() {
  const s = defaultState();
  s.shifts = defaultShifts();
  s.shifts.pattern = { start: '2026-09-28', days: [...TEMPLATE_28.days], template: 't28' };
  s.shifts.times.F = ['05:45', '13:45'];
  replaceState(s);
  V.shiftDraft = null; V.sheet = null;
}

test('Dieselbe Vorlage neu speichern: eigene Zeiten bleiben ohne Rückfrage', () => {
  withOwnTimes();
  const d = draft();
  assert.equal(d.tpl, 't28');
  d.pick = d.chosen = 3;   // heute ein anderer Tag
  actions.shiftsave();
  assert.equal(V.sheet, null);
  assert.deepEqual(S.shifts.times.F, ['05:45', '13:45']);
  assert.equal(S.shifts.pattern.template, 't28');
  assert.equal(S.shifts.pattern.days.length, 28);
});

test('Andere Vorlage: Rückfrage mit „Meine Zeiten behalten“ als Hauptknopf', () => {
  withOwnTimes();
  draft();
  actions.shifttpl({ dataset: { id: 'k4' } });
  const d = draft();
  d.pick = d.chosen = 0;
  actions.shiftsave();
  assert.ok(V.sheet, 'Rückfrage offen');
  const [first, second] = V.sheet.actions;
  assert.deepEqual([first.label, first.kind], ['Meine Zeiten behalten', 'primary']);
  assert.equal(second.label, 'Zeiten der Vorlage nehmen');
  first.fn();
  assert.deepEqual(S.shifts.times.F, ['05:45', '13:45']);
  assert.equal(S.shifts.pattern.template, 'k4');
  /* Noch einmal mit der anderen Wahl */
  withOwnTimes();
  draft();
  actions.shifttpl({ dataset: { id: 'k4' } });
  Object.assign(draft(), { pick: 0, chosen: 0 });
  actions.shiftsave();
  V.sheet.actions[1].fn();
  assert.deepEqual(S.shifts.times.F, templateById('k4').times.F);
});

test('„Welcher Tag ist heute?“: der gewählte Tag ist als gedrückt markiert', () => {
  withOwnTimes();
  const d = draft();
  const html = vSetup(true);
  const pressed = [...html.matchAll(/data-act="shiftpick" data-i="(\d+)" aria-pressed="(true|false)"/g)];
  assert.equal(pressed.length, 28);
  assert.deepEqual(pressed.filter(m => m[2] === 'true').map(m => Number(m[1])), [d.chosen]);
  /* Im Editor sind die Tage keine Umschaltknöpfe */
  actions.shiftcustomize();
  assert.doesNotMatch(vSetup(true), /aria-pressed="(true|false)"\s+aria-label="Tag/);
});
