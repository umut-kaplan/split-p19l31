import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickHints, ampelIsHint, HINT_ORDER, MAX_HINTS } from '../js/domain/today-hints.js';

const kinds = list => list.map(h => h.id || h.kind);

test('Höchstens zwei Hinweise oben, der Rest darunter', () => {
  assert.equal(MAX_HINTS, 2);
  const r = pickHints([{ kind: 'suggestion', id: 's1' }, { kind: 'checkin' }, { kind: 'backup' }, { kind: 'photo' }]);
  assert.deepEqual(kinds(r.shown), ['backup', 'checkin']);
  assert.deepEqual(kinds(r.more), ['photo', 's1']);
});

test('Montag mit allen Karten: Wochenbericht und Backup zuerst', () => {
  const r = pickHints([
    { kind: 'checkin' }, { kind: 'backup' }, { kind: 'suggestion', id: 's1' }, { kind: 'suggestion', id: 's2' }, { kind: 'photo' }, { kind: 'report' },
  ]);
  assert.deepEqual(kinds(r.shown), ['report', 'backup']);
  assert.deepEqual(kinds(r.more), ['checkin', 'photo', 's1', 's2']);
});

test('Die Reihenfolge ist fest und vollständig', () => {
  const all = [...HINT_ORDER].reverse().map(kind => ({ kind }));
  assert.deepEqual(kinds(pickHints(all, 99).shown), HINT_ORDER);
  assert.deepEqual(HINT_ORDER.filter(k => k !== 'gear').slice(0, 4), ['disclaimer', 'report', 'ampel', 'backup']);
});

test('Mehrere Vorschläge bleiben in ihrer Reihenfolge, Unbekanntes kommt zuletzt', () => {
  const r = pickHints([{ kind: 'neu' }, { kind: 'suggestion', id: 'a' }, { kind: 'suggestion', id: 'b' }, { kind: 'birth' }], 99);
  assert.deepEqual(kinds(r.shown), ['birth', 'a', 'b', 'neu']);
});

test('Leere Listen und Lücken', () => {
  assert.deepEqual(pickHints([]), { shown: [], more: [] });
  assert.deepEqual(pickHints(null), { shown: [], more: [] });
  assert.deepEqual(kinds(pickHints([null, { kind: 'photo' }, false]).shown), ['photo']);
  assert.deepEqual(kinds(pickHints([{ kind: 'report' }, { kind: 'disclaimer' }], 1).more), ['report']);
});

test('Ampel braucht nur eine Karte, wenn sie etwas anderes rät als die Scheibe', () => {
  assert.equal(ampelIsHint({ kind: 'train', dayId: 'pull' }, 'pull'), false, 'dieselbe Einheit wie oben');
  assert.equal(ampelIsHint({ kind: 'train', dayId: 'legs' }, 'pull'), true, 'anderer Tag');
  assert.equal(ampelIsHint({ kind: 'rest', dayId: null }, 'pull'), true, 'Pause wegen Erholung');
  assert.equal(ampelIsHint({ kind: 'rest', dayId: null }, 'pull', { shiftRest: true }), false, 'Pause laut Schichtplan steht schon in der Schichtzeile');
  assert.equal(ampelIsHint({ kind: 'done', dayId: 'pull' }, 'legs'), false, 'heute schon trainiert');
  assert.equal(ampelIsHint(null, 'pull'), false);
});

test('Geräte prüfen (4.7): einmal nach dem Update, darum oben, auch vor Wochenbericht und Backup', () => {
  const r = pickHints([{ kind: 'checkin' }, { kind: 'backup' }, { kind: 'report' }, { kind: 'gear' }]);
  assert.deepEqual(kinds(r.shown), ['gear', 'report']);
  assert.equal(HINT_ORDER[1], 'gear');
});
