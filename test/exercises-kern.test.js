/* Inhalt der Kern-Übungen (data/exercises-kern.js) gegen die Arbeitsliste docs/kern-uebungen.json.
   Form und Regeln für alle Übungen prüft test/exercises-data.test.js, Liste und Zusammenführen test/kern-liste.test.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXERCISES } from '../js/data/exercises.js';
import { EXERCISES_KERN } from '../js/data/exercises-kern.js';
import { findExercise } from '../js/domain/library.js';

const LIST = JSON.parse(readFileSync(new URL('../docs/kern-uebungen.json', import.meta.url), 'utf8'));
const byId = new Map(EXERCISES.map(e => [e.id, e]));
const kernById = new Map(EXERCISES_KERN.map(e => [e.id, e]));

/* Übungen, die bei üblichem Gewicht kaum ein Gelenk fordern und darum keine Belastung tragen.
   Wer hier eine Übung ergänzt oder streicht, entscheidet das bewusst. */
const OHNE_BELASTUNG = [
  'reverse-butterfly', 'aussenrotation-kabel', 'trizeps-kickbacks', 'bizepsmaschine', 'kabel-curls',
  'konzentrationscurls', 'rudermaschine', 'hohes-rudern', 'invertiertes-rudern', 'dead-bug', 'pallof-press',
  'glute-bridge', 'kabel-kickbacks', 'gesaessmaschine',
];

test('Kern-Übungen: alle 55 aus der Arbeitsliste, in ihrer Reihenfolge', () => {
  assert.equal(EXERCISES_KERN.length, LIST.anzahl);
  assert.deepEqual(EXERCISES_KERN.map(e => e.id), LIST.uebungen.map(u => u.id));
});

test('Name, Art, Einheit, Muskeln und Geräte wie in der Liste; Aliase und Alternativen mindestens die der Liste', () => {
  LIST.uebungen.forEach(u => {
    const e = kernById.get(u.id);
    const at = ' bei ' + u.id;
    assert.equal(e.name, u.name, 'Name' + at);
    assert.equal(e.type, u.type, 'Art' + at);
    assert.equal(e.unit, u.unit, 'Einheit' + at);
    assert.deepEqual(e.muscles, u.muscles, 'Muskeln' + at);
    assert.deepEqual(e.equipment, u.equipment, 'Geräte' + at);
    /* Aliase in der zusammengeführten Bibliothek, dort sind die Umzüge schon passiert */
    u.aliases.forEach(a => assert.ok(byId.get(u.id).aliases.includes(a), `Alias „${a}“${at}`));
    u.alternatives.forEach(a => assert.ok(e.alternatives.includes(a), `Alternative ${a}${at}`));
  });
});

test('Alle Rückverweise aus alternativen_ergaenzen sind angehängt', () => {
  Object.entries(LIST.alternativen_ergaenzen).forEach(([id, alts]) => {
    alts.forEach(a => assert.ok(byId.get(id).alternatives.includes(a), `${id} → ${a}`));
  });
});

test('Jede Kern-Übung trägt Belastungen, außer den bewusst leeren', () => {
  OHNE_BELASTUNG.forEach(id => assert.ok(kernById.has(id), id));
  EXERCISES_KERN.forEach(e => {
    assert.ok(Array.isArray(e.stresses), e.id);
    assert.equal(e.stresses.length === 0, OHNE_BELASTUNG.includes(e.id), `Belastungen bei ${e.id}: ${e.stresses.join(', ') || 'keine'}`);
  });
});

test('Jede Kern-Übung taucht bei einer anderen Übung als Alternative auf', () => {
  const linked = new Set(EXERCISES.flatMap(e => e.alternatives.filter(a => a !== e.id)));
  EXERCISES_KERN.forEach(e => assert.ok(linked.has(e.id), e.id));
});

test('Alias-Umzüge: „Reverse Butterfly“ und „Rudern an der Brustauflage“ finden die Maschinen', () => {
  assert.equal(findExercise('Reverse Butterfly').id, 'reverse-butterfly');
  assert.equal(findExercise('Rudern an der Brustauflage').id, 'rudermaschine');
  assert.ok(!byId.get('reverse-flys').aliases.includes('Reverse Butterfly'));
  assert.ok(!byId.get('brustgestuetztes-rudern').aliases.includes('Rudern an der Brustauflage'));
});

test('Anleitungen: keine Platzhalter, keine Heilversprechen, kein Satz doppelt', () => {
  const PROMISE = /\b(heilt|heilen|geheilt|schmerzfrei|garantiert|therapie|beseitigt|verhindert verletzungen)\b/i;
  EXERCISES_KERN.forEach(e => {
    const texts = [...e.steps, ...e.mistakes];
    texts.forEach(t => {
      assert.ok(!/…|\.\.\.|TODO|xxx/i.test(t), `Platzhalter „${t}“ bei ${e.id}`);
      assert.ok(!PROMISE.test(t), `„${t}“ bei ${e.id}`);
      assert.ok(t.length <= 200, `zu lang: „${t}“ bei ${e.id}`);
    });
    assert.equal(new Set(texts).size, texts.length, 'doppelter Satz bei ' + e.id);
  });
});

test('Anleitungen nach der Prüfung 4.7: Sicherung, T-Bar an der Maschine, Hüfte einheitlich, keine missverständlichen Aliase', () => {
  /* Pendel-Kniebeuge: Sicherung nach jedem Satz, nicht erst nach dem letzten */
  const pendel = byId.get('pendel-kniebeuge').steps.join(' ');
  assert.match(pendel, /Nach jedem Satz oben die Sicherung wieder einlegen/);
  assert.doesNotMatch(pendel, /letzten Satz/);
  /* T-Bar: zuerst die Maschine mit Brustpolster, die Landmine als Hinweis am Ende */
  const tbar = byId.get('t-bar-rudern').steps;
  assert.match(tbar[0], /Brustpolster/);
  assert.ok(tbar.slice(0, -1).every(t => !/Landmine/.test(t)));
  assert.match(tbar[tbar.length - 1], /^Ohne Maschine geht es an der Landmine/);
  /* Brustgestütztes Rudern: nur Kurzhanteln auf der Schrägbank, keine Maschine */
  assert.doesNotMatch(byId.get('brustgestuetztes-rudern').steps.join(' '), /Maschine|Griffe/);
  /* Hüfte: Kniebeugen-, Ausfallschritt-, Kreuzheben- und Hip-Thrust-Muster mit Gewicht belasten sie alle */
  ['kniebeugen', 'multipresse-kniebeugen', 'frontkniebeugen', 'goblet-squat', 'ausfallschritte', 'bulgarian-split-squat', 'step-ups',
    'kreuzheben', 'rumaenisches-kreuzheben', 'kh-rumaenisches-kreuzheben', 'trapbar-kreuzheben', 'kettlebell-swing',
    'hip-thrust', 'hip-thrust-maschine', 'smart-hip-thrust'].forEach(id => assert.ok(byId.get(id).stresses.includes('Hüfte'), id));
  /* Gleiche Belastungen in gleicher Reihenfolge */
  assert.deepEqual(byId.get('trapbar-kreuzheben').stresses, byId.get('kniebeugen').stresses);
  /* Aliase, die eine andere Übung meinen, sind weg */
  assert.equal(findExercise('Knieliegestütze'), null);
  assert.equal(findExercise('Nackendrücken Kurzhantel'), null);
  assert.equal(findExercise('Rudern mit Brustauflage'), null, 'mehrdeutig: Maschine oder Kurzhanteln');
  assert.equal(findExercise('Rudern an der Brustauflage').id, 'rudermaschine');
});
