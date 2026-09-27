import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EXERCISES } from '../js/data/exercises.js';
import { MUSCLES } from '../js/domain/muscles.js';
import { EQUIPMENT, LIMIT_TAGS } from '../js/domain/profile-options.js';
import { findExercise } from '../js/domain/library.js';
import { DEFAULT_PLAN } from '../js/plans.js';

const root = new URL('..', import.meta.url).pathname;
const byId = new Map(EXERCISES.map(e => [e.id, e]));
const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();

test('Genug Übungen und eindeutige ids', () => {
  assert.ok(EXERCISES.length >= 48, 'nur ' + EXERCISES.length);
  assert.equal(byId.size, EXERCISES.length, 'doppelte id');
  EXERCISES.forEach(e => assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, e.id));
});

test('Namen und Aliase sind über alle Übungen eindeutig', () => {
  const seen = new Map();
  EXERCISES.forEach(e => [e.name, ...e.aliases].forEach(n => {
    const k = norm(n);
    assert.ok(!seen.has(k), `„${n}“ bei ${e.id} und ${seen.get(k)}`);
    seen.set(k, e.id);
  }));
});

test('Pflichtfelder und erlaubte Werte', () => {
  EXERCISES.forEach(e => {
    const at = ' bei ' + e.id;
    assert.ok(e.name && typeof e.name === 'string', 'name' + at);
    assert.ok(Array.isArray(e.aliases), 'aliases' + at);
    assert.ok(['compound', 'isolation'].includes(e.type), 'type' + at);
    assert.ok(['reps', 'sec'].includes(e.unit), 'unit' + at);
    assert.ok(e.muscles.primary.length >= 1, 'primäre Muskeln' + at);
    [...e.muscles.primary, ...e.muscles.secondary].forEach(m => assert.ok(m in MUSCLES, `Muskel ${m}${at}`));
    e.muscles.secondary.forEach(m => assert.ok(!e.muscles.primary.includes(m), `Muskel ${m} doppelt${at}`));
    e.equipment.forEach(q => assert.ok(EQUIPMENT.includes(q), `Gerät ${q}${at}`));
    e.stresses.forEach(t => assert.ok(LIMIT_TAGS.includes(t), `Einschränkung ${t}${at}`));
    assert.ok(e.steps.length >= 3 && e.steps.length <= 6, 'Schritte 3 bis 6' + at);
    assert.ok(e.mistakes.length >= 2 && e.mistakes.length <= 4, 'Fehler 2 bis 4' + at);
    [...e.steps, ...e.mistakes].forEach(s => assert.ok(s.trim().length > 5 && /[.!?]$/.test(s), `Satz „${s}“${at}`));
    assert.equal(e.media, null, 'media' + at);
  });
});

test('Alternativen existieren und zeigen nicht auf sich selbst', () => {
  EXERCISES.forEach(e => e.alternatives.forEach(a => {
    assert.ok(byId.has(a), `Alternative ${a} bei ${e.id} fehlt`);
    assert.notEqual(a, e.id, 'selbst als Alternative: ' + e.id);
  }));
});

test('Für jede Belastung gibt es eine Alternative, die sie nicht hat', () => {
  EXERCISES.filter(e => e.stresses.length).forEach(e => {
    assert.ok(e.alternatives.length, 'keine Alternative bei ' + e.id);
    e.stresses.forEach(t => {
      const ok = e.alternatives.some(a => !byId.get(a).stresses.includes(t));
      assert.ok(ok, `${e.id}: keine Alternative ohne Belastung „${t}“`);
    });
  });
});

test('Bilder existieren, sind klein und haben eine Quelle', () => {
  let total = 0;
  EXERCISES.filter(e => e.image).forEach(e => {
    const p = join(root, e.image);
    assert.ok(existsSync(p), 'Bild fehlt: ' + e.image);
    assert.equal(e.image, `data/img/exercises/${e.id}.jpg`);
    total += statSync(p).size;
    assert.ok(e.credit && e.credit.author && e.credit.license && e.credit.url, 'Quelle fehlt bei ' + e.id);
    assert.match(e.credit.license, /^CC BY-SA [34]\.0$/);
    assert.match(e.credit.url, /^https:\/\/wger\.de\/de\/exercise\/\d+\/view\/$/);
  });
  EXERCISES.filter(e => !e.image).forEach(e => assert.equal(e.credit, null, 'Quelle ohne Bild bei ' + e.id));
  assert.ok(total < 3 * 1024 * 1024, 'Bilder zu groß: ' + total);
});

test('Jeder Name aus dem 3er-Split ist in der Bibliothek auffindbar', () => {
  Object.values(DEFAULT_PLAN.days).forEach(d => d.exercises.forEach(x => x.names.forEach(n => {
    const e = findExercise(n);
    assert.ok(e, `„${n}“ nicht gefunden`);
    assert.equal(e.unit, x.unit, `Einheit bei ${n}`);
  })));
});
