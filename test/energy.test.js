import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bmrMifflin, calorieGoal, macros, waterGoal, missingForCalories } from '../js/domain/energy.js';

test('Grundumsatz nach Mifflin-St Jeor', () => {
  // 10*80 + 6,25*180 - 5*30 + 5 = 1780
  assert.equal(bmrMifflin({ kg: 80, cm: 180, age: 30, sex: 'm' }), 1780);
  // 10*60 + 6,25*165 - 5*25 - 161 = 1345,25
  assert.equal(bmrMifflin({ kg: 60, cm: 165, age: 25, sex: 'f' }), 1345.25);
});

test('Kalorienziel mit Aktivität und Ziel', () => {
  const p = { weightKg: 80, heightCm: 180, age: 30, sex: 'm', activity: 'moderate', goal: 'gain' };
  const r = calorieGoal(p);
  assert.equal(r.ok, true);
  assert.equal(Math.round(r.tdee), 2759);           // 1780 * 1,55
  assert.equal(r.kcal, 3030);                        // 2759 * 1,1 = 3034,9, auf 10 gerundet
  assert.equal(r.lines.length, 3);
  assert.equal(calorieGoal({ ...p, goal: 'lose' }).kcal, 2210);   // 2759 * 0,8
  assert.equal(calorieGoal({ ...p, goal: 'recomp' }).kcal, 2760);
});

test('Ohne Angaben rechnet die App mit mäßig aktiv und Beides', () => {
  const r = calorieGoal({ weightKg: 80, heightCm: 180, age: 30, sex: 'm', activity: null, goal: null });
  assert.equal(r.kcal, 2760);
  assert.match(r.lines[1], /Standardwert/);
});

test('Fehlende Werte werden benannt statt geraten', () => {
  assert.deepEqual(missingForCalories({ weightKg: 80, heightCm: null, age: null, sex: null }), ['Größe', 'Alter', 'Geschlecht']);
  assert.equal(calorieGoal({ weightKg: null, heightCm: 180, age: 30, sex: 'm' }).ok, false);
});

test('Makros: 2 g Protein, 0,8 g Fett, Rest Kohlenhydrate', () => {
  const m = macros(2760, 80);
  assert.equal(m.protein, 160);
  assert.equal(m.fat, 64);
  assert.equal(m.carbs, Math.round((2760 - 640 - 576) / 4));
  assert.deepEqual(m.proteinRange, [144, 176]);
  assert.equal(macros(500, 80).carbs, 0);
});

test('Wasserziel 35 ml pro kg', () => {
  assert.equal(waterGoal(80), 2800);
  assert.equal(waterGoal(82.4), 2900);
  assert.equal(waterGoal(null), 2500);
});
