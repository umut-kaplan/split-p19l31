import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteKey, findNote, setNote, cleanNote, NOTE_MAX } from '../js/domain/notes.js';
import { recentRating, makeRating, validRpe } from '../js/domain/rating.js';
import { recoveryStatus } from '../js/domain/recovery.js';

const H = 36e5;
const NOW = new Date(2026, 8, 28, 18, 0).getTime();   // Mo 28.9.2026, 18 Uhr Ortszeit
const TODAY = '2026-09-28';
const sess = (hoursAgo, rpe, extra = {}) => ({
  id: 's' + hoursAgo, startedAt: NOW - hoursAgo * H - H, endedAt: NOW - hoursAgo * H,
  ex: [{ exId: 'bank', name: 'Bankdrücken', unit: 'reps', sets: [{ w: 80, r: 8, rir: 2 }] }],
  ...(rpe != null ? { rating: { rpe, note: '', at: NOW - hoursAgo * H } } : {}),
  ...extra,
});

/* ---------- Notizen ---------- */
test('Notiz-Schlüssel trennt Varianten', () => {
  assert.notEqual(noteKey('latzug', 'Latzug'), noteKey('latzug', 'Klimmzüge'));
  const notes = {};
  setNote(notes, noteKey('latzug', 'Klimmzüge'), ['Klimmzüge'], 'Band grün');
  assert.equal(findNote(notes, noteKey('latzug', 'Latzug'), ['Latzug']), null);
  assert.equal(findNote(notes, noteKey('latzug', 'Klimmzüge'), ['Klimmzüge']).text, 'Band grün');
});

test('Bibliothek und Training finden dieselbe Notiz über den Namen', () => {
  const notes = {};
  setNote(notes, noteKey('bank', 'Bankdrücken'), ['Bankdrücken'], 'Griff 81 cm');
  // Bibliothek kennt die Plan-id nicht, nur Name und Aliasse
  assert.equal(findNote(notes, null, ['Bankdrücken', 'Bankdrücken Langhantel']).text, 'Griff 81 cm');
  // Ändern in der Bibliothek ändert den Eintrag des Trainings mit
  setNote(notes, null, ['Bankdrücken'], 'Griff 80 cm', 'lib:bankdruecken|Bankdrücken');
  assert.deepEqual(notes, { 'bank|Bankdrücken': 'Griff 80 cm' });
  // Ohne vorhandene Notiz entsteht der Ersatzschlüssel, den das Training über den Namen findet
  setNote(notes, null, ['Beinpresse'], 'Sitz 5', 'lib:beinpresse|Beinpresse');
  assert.equal(findNote(notes, noteKey('presse', 'Beinpresse'), ['Beinpresse']).text, 'Sitz 5');
});

test('Löschen und Kürzen', () => {
  const notes = { 'bank|Bankdrücken': 'a', 'lib:bankdruecken|Bankdrücken': 'a' };
  setNote(notes, noteKey('bank', 'Bankdrücken'), ['Bankdrücken'], '   ');
  assert.deepEqual(notes, {});
  assert.equal(cleanNote('x'.repeat(300)).length, NOTE_MAX);
  assert.equal(cleanNote('  Sitz   Stufe 4\n Griff eng '), 'Sitz Stufe 4 Griff eng');
});

/* ---------- Bewertung ---------- */
test('Bewertung anlegen', () => {
  assert.equal(validRpe(9), true);
  assert.equal(validRpe(11), false);
  assert.equal(validRpe(7.5), false);
  assert.deepEqual(makeRating(8, ' zäh ', 5), { rpe: 8, note: 'zäh', at: 5 });
  assert.deepEqual(makeRating(null, 'nur Notiz', 5), { rpe: null, note: 'nur Notiz', at: 5 });
  assert.equal(makeRating(null, '', 5), null);
});

test('Härteste Bewertung der letzten 48 Stunden', () => {
  assert.equal(recentRating([sess(50, 10)], NOW), null);
  const r = recentRating([sess(40, 10), sess(10, 6)], NOW);
  assert.equal(r.rpe, 10);
  assert.equal(r.latest, false);
  assert.equal(recentRating([sess(10, 9), sess(5)], NOW).latest, false);   // danach kam noch eine unbewertete Einheit
  assert.equal(recentRating([sess(5, 9)], NOW).latest, true);
});

/* ---------- Ampel ---------- */
test('Sehr harte Einheit macht die Ampel gelb, 8 bleibt grün', () => {
  const lv = list => recoveryStatus({ sessions: list, now: NOW }, TODAY);
  assert.equal(lv([sess(20, 8)]).level, 'green');
  const nine = lv([sess(20, 9)]);
  assert.equal(nine.level, 'yellow');
  assert.equal(nine.summary, 'Gelb, weil die letzte Einheit sehr hart war (9 von 10).');
  assert.ok(nine.reasons.some(r => r.signal === 'rating' && r.text === 'Die letzte Einheit war sehr hart (9 von 10).'));
  assert.equal(lv([sess(20, 10)]).level, 'yellow');
  assert.match(lv([sess(20, 10)]).summary, /am Limit war \(10 von 10\)/);
});

test('48-Stunden-Grenze', () => {
  const lv = h => recoveryStatus({ sessions: [sess(h, 10)], now: NOW }, TODAY).level;
  assert.equal(lv(47.9), 'yellow');
  assert.equal(lv(48), 'yellow');
  assert.equal(lv(48.1), 'green');
});

test('Bewertung allein macht nie rot, andere Signale bleiben stärker', () => {
  const both = recoveryStatus({ sessions: [sess(20, 10)], checkins: { [TODAY]: { feeling: 1 } }, now: NOW }, TODAY);
  assert.equal(both.level, 'red');
  assert.match(both.summary, /^Rot, weil du dich heute schlecht fühlst\.$/);
  const mild = recoveryStatus({ sessions: [sess(20, 9)], checkins: { [TODAY]: { sleepH: 5.5 } }, now: NOW }, TODAY);
  assert.equal(mild.level, 'yellow');
  assert.match(mild.summary, /letzte Nacht nur 5,5 Stunden.* und die letzte Einheit sehr hart war \(9 von 10\)/);
});

test('Ohne Zeitpunkt zählt das Ende des Tages', () => {
  const s = sess(0, 9);   // endet um 18 Uhr am 28.9.
  assert.equal(recoveryStatus({ sessions: [s] }, TODAY).level, 'yellow');
  assert.equal(recoveryStatus({ sessions: [s] }, '2026-09-30').level, 'green');   // mehr als 48 Stunden später
});
