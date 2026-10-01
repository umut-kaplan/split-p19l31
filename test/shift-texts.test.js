process.env.TZ = 'Europe/Berlin';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { S, V, replaceState } from '../js/state.js';
import { defaultState } from '../js/store/migrate.js';
import { defaultShifts, TEMPLATE_28 } from '../js/domain/shifts.js';
import { actions as typeActions } from '../js/views/shift-types.js';
import { nextTwoWeeks } from '../js/views/shift-today.js';
import { view } from '../js/views/shifts.js';

globalThis.window = { scrollTo() {} };
globalThis.document = {
  querySelector: () => null, body: { appendChild() {} },
  createElement: () => ({ setAttribute() {}, remove() {} }),
};
/* Montag, 05.10.2026, 06:00 */
mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-10-05T06:00:00').getTime() });

function fresh(edit) {
  const s = defaultState();
  s.shifts = defaultShifts();
  edit(s);
  replaceState(s);
  V.sheet = null; V.shiftType = null;
}
const askDelete = id => {
  typeActions.shifttype({ dataset: { id } });
  typeActions.shifttdel();
  return V.sheet && V.sheet.text;
};

test('Löschfrage nennt nur, was mit den Tagen wirklich passiert', () => {
  /* Nur im Muster */
  fresh(s => { s.shifts.pattern = { start: '2026-09-28', days: [...TEMPLATE_28.days], template: 't28' }; });
  assert.equal(askDelete('F'), 'Die Art steht im Muster an 7 Tagen. Im Muster werden diese Tage frei.');
  /* Nur ein Tag von Hand */
  fresh(s => { s.shifts.overrides = { '2026-10-07': 'T' }; });
  assert.equal(askDelete('T'), 'Die Art steht an einem Tag von Hand. Der von Hand gesetzte Tag folgt wieder Import und Muster.');
  /* Import und von Hand, dazu eine gemerkte Zuordnung */
  fresh(s => {
    s.shifts.imported = { '2026-10-06': 'D', '2026-10-08': 'D' };
    s.shifts.overrides = { '2026-10-09': 'D', '2026-10-10': 'D' };
    s.shifts.importMap = { reserve: 'D' };
  });
  assert.equal(askDelete('D'), 'Die Art steht im Import an 2 Tagen, an 2 Tagen von Hand. Im Import werden diese Tage frei. '
    + 'Die von Hand gesetzten Tage folgen wieder Import und Muster. Gemerkte Zuordnungen von Titeln zu dieser Art vergisst die App.');
  /* Nirgends benutzt: ohne Rückfrage gelöscht */
  fresh(() => {});
  assert.equal(askDelete('X'), null);
  assert.equal(S.shifts.types.some(t => t.id === 'X'), false);
});

test('Ziel 7: die Woche nennt die Grenze von 6 Tagen in Folge als Grund', () => {
  fresh(s => { s.profile.daysPerWeek = 7; s.shifts.pattern = { start: '2026-10-05', days: [...'-------'], template: null }; });
  const html = nextTwoWeeks();
  assert.match(html, /Nur 6 von 7 Trainings passen in diese Woche\. Mehr als 6 Tage in Folge plant die App nicht, darum höchstens 6 Trainings pro Woche\./);
  assert.doesNotMatch(html, /verschiedene Muskeln/);
  /* Ziel 5 mit Ganzkörper an zwei Tagen in Folge nicht möglich: Grund sind die Muskeln */
  fresh(s => {
    s.profile.daysPerWeek = 5;
    s.shifts.pattern = { start: '2026-10-05', days: [...'-------'], template: null };
    Object.values(s.plans[0].days).forEach(d => { d.exercises = []; });
  });
  assert.match(nextTwoWeeks(), /Nur 4 von 5 Trainings passen in diese Woche\. Zwei Tage in Folge plant die App nur mit Einheiten für verschiedene Muskeln\./);
});

test('„Schon übernommen am 4.10.“ ohne doppelten Punkt', () => {
  fresh(s => {
    s.shifts.pattern = { start: '2026-10-05', days: [...'-------'], template: null };
    s.shifts.exported = { '2026-10-05': new Date('2026-10-04T20:00:00').getTime() };
  });
  V.shiftView = 'plan';
  const html = view();
  assert.match(html, /Schon übernommen am 4\.10\. <button/);
  assert.doesNotMatch(html, /\d\.\.\s/);
  V.shiftView = null;
});
