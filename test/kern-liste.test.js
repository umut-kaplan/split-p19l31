/* Arbeitsliste der Kern-Übungen (docs/kern-uebungen.json), reservierte ids, Alias-Umzüge und Zusammenführen
   der Bibliothek. Die Tests gelten vor, während und nach dem Füllen von data/exercises-kern.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EXERCISES, EXERCISES_BASE, RESERVED_IDS, ALIAS_MOVES, assembleLibrary,
} from '../js/data/exercises.js';
import { EXERCISES_KERN, ALTERNATIVES_ADD } from '../js/data/exercises-kern.js';
import { EXERCISES_SMART } from '../js/data/exercises-smart.js';
import { MUSCLES } from '../js/domain/muscles.js';
import { isEquipmentId } from '../js/domain/equipment.js';
import { exercise } from '../js/data/exercise-schema.js';

const LIST = JSON.parse(readFileSync(new URL('../docs/kern-uebungen.json', import.meta.url), 'utf8'));
const byId = new Map(EXERCISES.map(e => [e.id, e]));
const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();

test('Arbeitsliste und reservierte ids stimmen überein', () => {
  const ids = LIST.uebungen.map(e => e.id);
  assert.equal(LIST.anzahl, ids.length);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...RESERVED_IDS].sort(), [...ids].sort());
});

test('Reservierte ids vergibt nur exercises-kern.js', () => {
  [...EXERCISES_BASE, ...EXERCISES_SMART].forEach(e => assert.ok(!RESERVED_IDS.includes(e.id), e.id));
});

test('Arbeitsliste: gültige Muskeln, Geräte und Alternativen, keine Kollision mit fremden Namen', () => {
  const known = new Set([...EXERCISES.map(e => e.id), ...RESERVED_IDS]);
  const names = new Map();
  EXERCISES.forEach(e => [e.name, ...e.aliases].forEach(n => names.set(norm(n), e.id)));
  const moved = new Map(ALIAS_MOVES.map(m => [norm(m.alias), m.to]));
  LIST.uebungen.forEach(e => {
    const at = ' bei ' + e.id;
    assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(['compound', 'isolation'].includes(e.type), 'type' + at);
    assert.ok(['reps', 'sec'].includes(e.unit), 'unit' + at);
    [...e.muscles.primary, ...e.muscles.secondary].forEach(m => assert.ok(m in MUSCLES, m + at));
    e.equipment.flat().forEach(id => assert.ok(isEquipmentId(id), id + at));
    e.alternatives.forEach(a => assert.ok(known.has(a) && a !== e.id, a + at));
    [e.name, ...e.aliases].forEach(n => {
      const owner = names.get(norm(n));
      assert.ok(!owner || owner === e.id || moved.get(norm(n)) === e.id, `„${n}“${at} schon bei ${owner}`);
    });
  });
  Object.entries(LIST.alternativen_ergaenzen).forEach(([id, alts]) => {
    assert.ok(byId.has(id), id);
    alts.forEach(a => assert.ok(RESERVED_IDS.includes(a), a));
  });
});

test('ALTERNATIVES_ADD zeigt auf vorhandene Übungen', () => {
  Object.entries(ALTERNATIVES_ADD).forEach(([id, alts]) => {
    assert.ok(byId.has(id), id);
    alts.forEach(a => assert.ok(byId.has(a), `${id} → ${a}`));
  });
  EXERCISES_KERN.forEach(e => assert.ok(byId.has(e.id)));
});

const mk = (id, name, aliases = []) => exercise(id, name, {
  aliases, type: 'isolation', primary: ['shoulders'], steps: ['a.', 'b.', 'c.'], mistakes: ['a.', 'b.'], alternatives: [],
});

test('Zusammenführen: Aliase wandern zur Maschine, sobald es sie gibt; Alternativen werden angehängt', () => {
  const base = [mk('reverse-flys', 'Reverse Flys', ['Reverse Butterfly', 'Hintere Schulter']), mk('brustgestuetztes-rudern', 'Brustgestütztes Rudern', ['Rudern an der Brustauflage'])];
  /* Ohne die Maschinen bleibt alles, wie es ist */
  const before = assembleLibrary(base, [], {}, ALIAS_MOVES);
  assert.deepEqual(before.map(e => e.aliases), base.map(e => e.aliases));
  /* Mit den Maschinen: Alias zieht um, auch wenn er im neuen Eintrag schon steht (nie doppelt) */
  const kern = [mk('reverse-butterfly', 'Reverse Butterfly (Maschine)', ['Reverse Butterfly']), mk('rudermaschine', 'Rudern an der Maschine')];
  const after = assembleLibrary(base, kern, { 'reverse-flys': ['reverse-butterfly', 'reverse-flys', 'reverse-butterfly'] }, ALIAS_MOVES);
  const get = id => after.find(e => e.id === id);
  assert.deepEqual(get('reverse-flys').aliases, ['Hintere Schulter']);
  assert.deepEqual(get('reverse-butterfly').aliases, ['Reverse Butterfly']);
  assert.deepEqual(get('brustgestuetztes-rudern').aliases, []);
  assert.deepEqual(get('rudermaschine').aliases, ['Rudern an der Brustauflage']);
  assert.deepEqual(get('reverse-flys').alternatives, ['reverse-butterfly'], 'angehängt, ohne sich selbst und ohne Doppelte');
  /* Eingaben bleiben unverändert */
  assert.deepEqual(base[0].aliases, ['Reverse Butterfly', 'Hintere Schulter']);
  assert.deepEqual(base[0].alternatives, []);
});

test('Heute stehen die Aliase noch bei den Übungen bis 4.6', () => {
  ALIAS_MOVES.forEach(m => {
    const owner = byId.has(m.to) ? m.to : m.from;
    assert.ok(byId.get(owner).aliases.includes(m.alias), m.alias);
    assert.equal(EXERCISES.filter(e => e.aliases.includes(m.alias)).length, 1, m.alias);
  });
});
