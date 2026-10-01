/* Geräte-Ersatz beim Anlegen eines Plans (Prüfung H3): nur Übungen der Bibliothek, nie eigene;
   eingetragene Einschränkungen meidet der Ersatz, wenn eine schonende Übung passt. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptPlan, templatePlan } from '../js/plans.js';
import { findTemplate } from '../js/data/plan-templates.js';
import { findExercise } from '../js/domain/library.js';
import { choosePlan } from '../js/domain/plan-choice.js';
import { defaultState } from '../js/store/migrate.js';

const plan = names => ({ id: 'p', name: 'Test', order: ['a'], days: { a: { id: 'a', name: 'A', exercises: names.map((n, i) => ({ id: 'e' + i, names: [n], sets: 3, repMin: 8, repMax: 12, rest: 90, inc: 2.5, unit: 'reps' })) } } });
const own = (id, name, primary) => ({ id, name, aliases: [], type: 'compound', unit: 'reps', muscles: { primary, secondary: [] }, equipment: [], steps: [], mistakes: [], stresses: [], alternatives: [], custom: true });

test('Ersatz nie aus eigenen Übungen, auch wenn eine eigene ohne Geräte dieselben Muskeln trainiert', () => {
  const custom = [own('c1', 'Mein Rudern', ['back']), own('c2', 'Meine Kniebeuge', ['quads', 'glutes'])];
  const p = plan(['Latzug', 'Kniebeugen']);
  const swaps = adaptPlan(p, { equipment: ['kurzhanteln'], custom });
  const names = p.days.a.exercises.map(e => e.names[0]);
  assert.ok(!names.includes('Mein Rudern') && !names.includes('Meine Kniebeuge'), names.join(', '));
  swaps.filter(s => s.to).forEach(s => assert.ok(!findExercise(s.to, custom).custom, s.to));
  /* Vorlagen genauso */
  const r = templatePlan(findTemplate('fullbody3'), { equipment: ['kurzhanteln', 'widerstandsband'], custom });
  r.swaps.filter(s => s.to).forEach(s => assert.ok(!findExercise(s.to, custom).custom, s.to));
});

test('Heißt eine eigene Übung wie ein möglicher Ersatz, nimmt der Plan ihn nicht (der Eintrag fände die eigene)', () => {
  const custom = [own('c1', 'Brustpresse', ['chest'])];
  const p = plan(['Bankdrücken']);
  adaptPlan(p, { equipment: ['brustpresse', 'kurzhanteln', 'flachbank'], custom, tags: ['Schulter'] });
  assert.notEqual(p.days.a.exercises[0].names[0], 'Brustpresse');
});

test('Einschränkungen: belastende Übungen meiden, wenn eine schonende passt; sonst wie bisher', () => {
  /* Ohne Einschränkung zuerst die erste Alternative */
  let p = plan(['Bankdrücken']);
  adaptPlan(p, { equipment: ['kurzhanteln', 'flachbank', 'brustpresse'] });
  assert.equal(p.days.a.exercises[0].names[0], 'Kurzhantel-Bankdrücken');
  /* Schulter eingetragen: Kurzhantel-Bankdrücken belastet sie, die Brustpresse nicht */
  p = plan(['Bankdrücken']);
  const sw = adaptPlan(p, { equipment: ['kurzhanteln', 'flachbank', 'brustpresse'], tags: ['Schulter'] });
  assert.equal(p.days.a.exercises[0].names[0], 'Brustpresse');
  assert.deepEqual(sw, [{ day: 'A', from: 'Bankdrücken', to: 'Brustpresse' }]);
  assert.deepEqual(findExercise('Brustpresse').stresses.includes('Schulter'), false);
  /* Keine schonende da: dann doch die belastende statt gar keiner */
  p = plan(['Bankdrücken']);
  adaptPlan(p, { equipment: ['kurzhanteln', 'flachbank'], tags: ['Schulter'] });
  assert.equal(p.days.a.exercises[0].names[0], 'Kurzhantel-Bankdrücken');
});

test('Einrichtung: Einschränkungen aus dem Profil gelten für den Ersatz', () => {
  const s = defaultState();
  s.profile.equipment = ['kurzhanteln', 'flachbank', 'schraegbank', 'brustpresse', 'schulterpresse', 'latzug', 'ruderzug', 'kabelturm', 'beinpresse'];
  s.profile.limitations.tags = ['Schulter'];
  const r = choosePlan(s, 'fullbody3');
  const bench = r.swaps.find(x => x.from === 'Bankdrücken');
  assert.ok(bench && bench.to, JSON.stringify(r.swaps));
  assert.ok(!findExercise(bench.to).stresses.includes('Schulter'), bench.to);
});
