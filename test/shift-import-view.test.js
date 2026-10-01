process.env.TZ = 'Europe/Berlin';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { S, V, replaceState } from '../js/state.js';
import { defaultState } from '../js/store/migrate.js';
import { defaultShifts, DEFAULT_TYPES } from '../js/domain/shifts.js';
import { importSection, actions, inputs } from '../js/views/shift-import.js';

/* Kalender mit einer Frühschicht und zehn Titeln, die die App nicht kennt („Dienst A“ bis „Dienst J“) */
const ev = (i, d, title, a = '100000', b = '183000') => [
  'BEGIN:VEVENT', `UID:v${i}@t`, `DTSTART;TZID=Europe/Berlin:${d}T${a}`, `DTEND;TZID=Europe/Berlin:${d}T${b}`, `SUMMARY:${title}`, 'END:VEVENT',
];
const TITLES = 'ABCDEFGHIJ'.split('').map(c => `Dienst ${c}`);
const ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0',
  ...ev(0, '20261005', 'Frühdienst', '060000', '140000'),
  ...TITLES.flatMap((t, i) => ev(i + 1, `202610${String(6 + i).padStart(2, '0')}`, t)),
  'END:VCALENDAR', ''].join('\r\n');

/* Vorschau wie nach dem Wählen der Datei */
function preview(shifts = defaultShifts()) {
  const s = defaultState();
  s.shifts = shifts;
  replaceState(s);
  V.shiftImport = { name: 'dienste.ics', text: ICS, map: {}, titles: {}, gaps: false };
  inputs.shiftgaps({ checked: false }, 'change');
  return V.shiftImport;
}
const selects = html => [...html.matchAll(/data-in="shiftmap" data-k="([^"]+)"/g)].map(m => m[1]);
const pick = (k, v) => inputs.shiftmap({ dataset: { k }, value: v }, 'change');

test('Zuordnung: nicht zugeordnete Titel zuerst, „weitere Titel zeigen“ öffnet alle', () => {
  preview();
  let html = importSection();
  assert.deepEqual(selects(html), TITLES.slice(0, 8).map(t => t.toLowerCase()));
  assert.match(html, /data-act="shiftmapmore">2 weitere Titel zeigen</);
  /* Die ersten drei zugeordnet: sie rücken nach hinten, die Titel 9 und 10 kommen nach vorn */
  ['dienst a', 'dienst b', 'dienst c'].forEach(k => pick(k, 'S'));
  html = importSection();
  assert.deepEqual(selects(html), ['d', 'e', 'f', 'g', 'h', 'i', 'j', 'a'].map(c => `dienst ${c}`));
  assert.match(html, /2 weitere Titel zeigen/);
  /* Jeder Titel lässt sich erreichen */
  actions.shiftmapmore();
  html = importSection();
  assert.equal(selects(html).length, 10);
  assert.doesNotMatch(html, /weitere Titel zeigen/);
  TITLES.slice(3).forEach(t => pick(t.toLowerCase(), 'T'));
  assert.equal(V.shiftImport.res.unknown.length, 0);
  assert.equal(Object.keys(V.shiftImport.res.days).length, 11);
});

test('Tage ohne Eintrag werden zur Art mit Kategorie Urlaub, ohne solche Art gibt es den Haken nicht', () => {
  /* Voreinstellung: Urlaub 'U' */
  preview();
  assert.match(importSection(), /data-in="shiftgaps"/);
  /* Urlaub gelöscht, eigene Art mit Kategorie Urlaub */
  const own = defaultShifts();
  own.types = DEFAULT_TYPES.filter(t => t.id !== 'U').concat({ id: 'c1', short: 'GZ', name: 'Gleitzeit', cat: 'vacation', color: 'green' });
  const im = preview(own);
  /* Alle Titel zählen als Spät, nur „Dienst C“ am 08.10. nicht: dort bleibt eine Lücke */
  TITLES.filter(t => t !== 'Dienst C').forEach(t => pick(t.toLowerCase(), 'S'));
  inputs.shiftgaps({ checked: true }, 'change');
  assert.equal(im.res.days['2026-10-08'], 'c1');
  assert.equal(im.res.gapDays, 1);
  assert.match(importSection(), /Tage ohne Eintrag als Gleitzeit/);
  /* Keine Art mit Kategorie Urlaub: kein Haken, keine Lücken */
  const none = defaultShifts();
  none.types = DEFAULT_TYPES.filter(t => t.cat !== 'vacation');
  const im2 = preview(none);
  im2.gaps = true;
  inputs.shiftgaps({ checked: true }, 'change');
  assert.equal(im2.res.gapDays, 0);
  assert.doesNotMatch(importSection(), /data-in="shiftgaps"/);
  assert.equal(S.shifts.types.some(t => t.cat === 'vacation'), false);
});

test('Einzahl in der Vorschau: ein abgesagter Termin, ein weiterer Titel (#64)', () => {
  const s = defaultState();
  replaceState(s);
  const one = ['BEGIN:VCALENDAR', 'VERSION:2.0',
    ...ev(0, '20261005', 'Frühdienst', '060000', '140000'),
    ...ev(1, '20261006', 'Spätdienst', '140000', '220000').map(l => (l === 'END:VEVENT' ? 'STATUS:CANCELLED\r\nEND:VEVENT' : l)),
    ...TITLES.slice(0, 9).flatMap((t, i) => ev(i + 2, `202610${String(7 + i).padStart(2, '0')}`, t)),
    'END:VCALENDAR', ''].join('\r\n');
  V.shiftImport = { name: 'eins.ics', text: one, map: {}, titles: {}, gaps: false };
  inputs.shiftgaps({ checked: false }, 'change');
  const html = importSection();
  assert.match(html, /1 abgesagter Termin ausgelassen\./);
  assert.match(html, /Einen weiteren Titel zeigen/);
});
