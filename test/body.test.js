import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bmi, bmiCategory, bmiScalePos, currentWeight } from '../js/domain/body.js';

test('BMI und Einteilung', () => {
  assert.equal(Math.round(bmi(80, 180) * 10) / 10, 24.7);
  assert.equal(bmi(80, null), null);
  assert.equal(bmiCategory(18.4), 'Untergewicht');
  assert.equal(bmiCategory(18.5), 'Normalgewicht');
  assert.equal(bmiCategory(24.99), 'Normalgewicht');
  assert.equal(bmiCategory(25), 'Übergewicht');
  assert.equal(bmiCategory(30), 'Adipositas');
  assert.equal(bmiCategory(null), null);
});

test('Skala 15 bis 35', () => {
  assert.equal(bmiScalePos(25), 50);
  assert.equal(bmiScalePos(10), 0);
  assert.equal(bmiScalePos(40), 100);
});

test('Aktuelles Gewicht: jüngster Eintrag, sonst Profil', () => {
  const w = [{ date: '2026-09-20', kg: 83 }, { date: '2026-09-27', kg: 82 }, { date: '2026-09-10', kg: 84 }];
  assert.equal(currentWeight({ weightKg: 90 }, w), 82);
  assert.equal(currentWeight({ weightKg: 90 }, []), 90);
  assert.equal(currentWeight({ weightKg: null }, []), null);
});
