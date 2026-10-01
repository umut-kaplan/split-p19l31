/* 4.7: neue Muskelgruppen, neue Zuordnung der Grundübungen, Wochenziele je Muskel */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSCLES, WEEKLY_SET_TARGET, WEEKLY_SET_TARGETS, UNRATED_MUSCLES, weeklyTarget, weeklyTargetText, muscleInText } from '../js/domain/muscles.js';
import { weekMuscleSets, volumeRating } from '../js/domain/volume.js';
import { weekStart } from '../js/domain/streaks.js';
import { findExercise } from '../js/domain/library.js';

const at = d => new Date(`${d}T18:00`).getTime();
const sets = n => Array.from({ length: n }, () => ({ w: 100, r: 5 }));
const resolve = n => findExercise(n);
const clone = o => JSON.parse(JSON.stringify(o));

test('Neue Muskelgruppen Nacken/Trapez und unterer Rücken', () => {
  assert.equal(MUSCLES.traps, 'Nacken/Trapez');
  assert.equal(MUSCLES.lower_back, 'Unterer Rücken');
  assert.equal(Object.keys(MUSCLES).length, 15);
});

test('Neue Zuordnung laut Recherche', () => {
  const m = id => findExercise(id).muscles;
  assert.deepEqual(m('kreuzheben'), { primary: ['glutes', 'hamstrings', 'lower_back'], secondary: ['quads', 'back', 'traps', 'forearms'] });
  assert.deepEqual(m('rumaenisches-kreuzheben').secondary, ['lower_back', 'forearms']);
  assert.ok(m('kniebeugen').secondary.includes('lower_back'));
  assert.ok(m('langhantelrudern').secondary.includes('lower_back'));
  assert.ok(m('face-pulls').secondary.includes('traps'));
  assert.ok(m('reverse-flys').secondary.includes('traps'));
});

test('Gespeicherte Trainings bleiben, das Wochenvolumen rechnet mit der neuen Zuordnung', () => {
  const sessions = [{ startedAt: at('2026-09-22'), ex: [{ exId: 'kreuz', name: 'Kreuzheben', unit: 'reps', sets: sets(3) }] }];
  const before = clone(sessions);
  const w = weekMuscleSets(sessions, weekStart(at('2026-09-22')), resolve);
  assert.deepEqual(sessions, before, 'Trainings unverändert');
  assert.equal(w.sets.lower_back, 3);
  assert.equal(w.sets.glutes, 3);
  assert.equal(w.sets.hamstrings, 3);
  assert.equal(w.sets.back, 1.5, 'Latissimus nur noch mitbeansprucht');
  assert.equal(w.sets.traps, 1.5);
  assert.equal(w.sets.quads, 1.5);
});

test('Wochenziele je Muskel: Waden und Bauch kleiner', () => {
  assert.deepEqual(WEEKLY_SET_TARGET, [10, 20]);
  assert.deepEqual(weeklyTarget('chest'), [10, 20]);
  assert.deepEqual(weeklyTarget('calves'), [4, 10]);
  assert.deepEqual(weeklyTarget('abs'), [4, 10]);
  assert.deepEqual(weeklyTarget(null), [10, 20]);
  Object.entries(WEEKLY_SET_TARGETS).forEach(([m, [lo, hi]]) => {
    assert.ok(m in MUSCLES, m);
    assert.ok(lo > 0 && lo < hi && hi <= WEEKLY_SET_TARGET[1], m);
  });
  assert.equal(volumeRating(6, 'calves'), 'ok');
  assert.equal(volumeRating(6, 'chest'), 'low');
  assert.equal(volumeRating(12, 'abs'), 'high');
  assert.equal(volumeRating(12), 'ok');
  assert.equal(weeklyTargetText(), 'Zielbereich 10 bis 20 Sätze pro Woche (Waden und Bauch: 4 bis 10). Nacken/Trapez und unterer Rücken ohne Zielbereich, sie arbeiten bei Grundübungen mit.');
});

test('Nacken/Trapez und unterer Rücken ohne Zielbereich und ohne Ampel, „unterer Rücken“ im Fließtext klein', () => {
  assert.deepEqual(UNRATED_MUSCLES, ['traps', 'lower_back']);
  UNRATED_MUSCLES.forEach(m => {
    assert.equal(weeklyTarget(m), null, m);
    [0, 3, 12, 30].forEach(v => assert.equal(volumeRating(v, m), 'none', `${m} ${v}`));
  });
  assert.equal(muscleInText('lower_back'), 'unterer Rücken');
  assert.equal(muscleInText('traps'), 'Nacken/Trapez');
  assert.equal(muscleInText('chest'), 'Brust');
  assert.equal(MUSCLES.lower_back, 'Unterer Rücken', 'als Bezeichnung in Listen groß');
});
