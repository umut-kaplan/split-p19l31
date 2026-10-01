/* Smart-Zirkel (z. B. EGYM), 4.7: eigene Übungen, Methode je Satz, Rekorde nur aus regulären Sätzen,
   keine kg-Steigerung, eine Zirkelrunde = ein Satz. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/data/exercises.js';
import { EXERCISES_SMART } from '../js/data/exercises-smart.js';
import { SET_METHODS, setMethod, isRecordSet, cleanSet, storedSet } from '../js/domain/settypes.js';
import { personalRecords, setRecords, sessionRecords, exerciseStats } from '../js/domain/prs.js';
import { suggest } from '../js/domain/progression.js';
import { weekMuscleSets } from '../js/domain/volume.js';
import { weekStart } from '../js/domain/streaks.js';
import { findExercise, defaultsFor, searchExercises } from '../js/domain/library.js';
import { canDo } from '../js/domain/equipment.js';
import { suggestions } from '../js/coach/training.js';
import { defaultState, normalize } from '../js/store/migrate.js';

const at = d => new Date(`${d}T18:00`).getTime();
const BP = 'Brustpresse (Smart-Zirkel)';

test('18 Geräte als eigene Übungen, neutral benannt, „EGYM …“ als Alias', () => {
  assert.equal(EXERCISES_SMART.length, 18);
  const devices = ['Brustpresse', 'Ruderzug', 'Latzug', 'Schulterpresse', 'Butterfly', 'Butterfly Reverse', 'Bizeps', 'Trizeps',
    'Beinpresse', 'Beinstrecker', 'Beinbeuger', 'Squat', 'Hip Thrust', 'Abduktor', 'Adduktor', 'Bauchtrainer', 'Rückentrainer', 'Rotator'];
  assert.deepEqual(EXERCISES_SMART.map(e => e.name).sort(), devices.map(d => `${d} (Smart-Zirkel)`).sort());
  EXERCISES_SMART.forEach(e => {
    assert.match(e.id, /^smart-/);
    assert.equal(e.autoLoad, 'smart');
    assert.deepEqual(e.equipment, ['smart-zirkel']);
    assert.ok(e.aliases.includes(`EGYM ${e.name.replace(' (Smart-Zirkel)', '')}`), e.id);
    assert.ok(EXERCISES.includes(e) || EXERCISES.some(x => x.id === e.id), e.id);
  });
  /* Kein Alias fällt auf die normale Maschine zurück */
  assert.equal(findExercise('EGYM Brustpresse').id, 'smart-brustpresse');
  assert.equal(findExercise('Brustpresse').id, 'brustpresse');
  assert.equal(findExercise('EGYM Kniebeuge').id, 'smart-squat');
  assert.equal(findExercise('EGYM Rudern').id, 'smart-ruderzug');
});

test('Smart-Zirkel nur mit dem Zusatzschalter; leere Auswahl erlaubt weiter alles', () => {
  const e = findExercise('smart-latzug');
  assert.ok(!canDo(e, ['latzug', 'kurzhanteln']));
  assert.ok(canDo(e, ['smart-zirkel']));
  assert.ok(canDo(e, []));
  assert.equal(searchExercises(EXERCISES, { q: 'egym' }).length, 18);
  assert.equal(searchExercises(EXERCISES, { have: ['smart-zirkel'] }).filter(x => x.autoLoad).length, 18);
});

test('Methoden je Satz: sechs Werte, unbekannte fallen beim Laden weg', () => {
  assert.deepEqual(Object.values(SET_METHODS), ['Regulär', 'Negativ', 'Adaptiv', 'Isokinetisch', 'Explonic', 'Max Out']);
  assert.equal(setMethod({ m: 'negative' }), 'negative');
  assert.equal(setMethod({ m: 'toString' }), null);
  assert.equal(setMethod({}), null);
  assert.deepEqual(cleanSet({ w: 50, r: 10, m: 'quatsch' }), { w: 50, r: 10 });
  assert.deepEqual(cleanSet({ w: 50, r: 10, m: 'adaptive', t: 'x' }), { w: 50, r: 10, m: 'adaptive' });
  const ok = { w: 50, r: 10, m: 'regular' };
  assert.equal(cleanSet(ok), ok, 'gültige Sätze bleiben dasselbe Objekt');
  assert.ok(isRecordSet({ w: 1, r: 1 }) && isRecordSet({ w: 1, r: 1, m: 'regular' }) && isRecordSet({ w: 1, r: 1, t: 'f' }));
  assert.ok(!isRecordSet({ w: 1, r: 1, m: 'negative' }) && !isRecordSet({ w: 1, r: 1, t: 'd' }));
});

test('Satz speichern: w, r, rir wie bisher, t und m nur wenn gesetzt', () => {
  assert.deepEqual(storedSet({ w: '42,5', r: '10', rir: 2, done: true, pw: '40' }), { w: 42.5, r: 10, rir: 2 });
  assert.deepEqual(storedSet({ w: '', r: '8', rir: 1, t: 'f', m: 'isokinetic' }), { w: 0, r: 8, rir: 1, t: 'f', m: 'isokinetic' });
  assert.deepEqual(storedSet({ w: '20', r: '12', rir: 2, m: 'gibtsnicht' }), { w: 20, r: 12, rir: 2 });
});

const sx = (sets, name = BP, exId = 'smart-brustpresse') => ({ exId, name, unit: 'reps', sets });
const sess = (d, ...ex) => ({ id: d, startedAt: at(d), ex });

test('Rekorde aus Smart-Zirkel-Übungen nur aus regulären Sätzen oder Sätzen ohne Methode', () => {
  const sessions = [
    sess('2026-09-21', sx([{ w: 60, r: 10 }, { w: 90, r: 10, m: 'negative' }])),
    sess('2026-09-24', sx([{ w: 62, r: 10, m: 'regular' }, { w: 40, r: 30, m: 'adaptive' }])),
  ];
  const r = personalRecords(sessions).get('smart-brustpresse|' + BP);
  assert.equal(r.count, 2);
  assert.equal(r.weight.value, 62);
  assert.equal(r.volume.value, 620, 'Volumen-Rekord nur aus regulären Sätzen');
  assert.equal(exerciseStats([{ w: 90, r: 10, m: 'negative' }]).weight, 0);
  /* Ein Satz mit anderer Methode ist nie ein Rekord, auch beim Abhaken nicht */
  assert.deepEqual(setRecords(r, [], { w: 100, r: 10, m: 'explonic' }), []);
  assert.deepEqual(setRecords(r, [{ w: 100, r: 10, m: 'maxout' }], { w: 65, r: 10 }).map(x => x.kind), ['weight', 'e1rm']);
  assert.deepEqual(sessionRecords(sessions, [sx([{ w: 99, r: 10, m: 'negative' }])]), []);
});

test('Progression: Das Gerät stellt das Gewicht ein, kein kg-Vorschlag', () => {
  const sessions = [sess('2026-09-21', sx([{ w: 60, r: 15, rir: 2 }, { w: 60, r: 15, rir: 2 }]))];
  const plan = { id: 'smart-brustpresse', sets: 2, repMin: 10, repMax: 15, inc: 1, unit: 'reps' };
  const s = suggest(sessions, plan, BP, findExercise(BP));
  assert.equal(s.kind, 'auto');
  assert.equal(s.weight, null);
  assert.equal(suggest(sessions, { ...plan, autoLoad: 'smart' }, BP).kind, 'auto', 'auch über den Plan-Eintrag');
  /* Normale Maschine: Doppelprogression wie bisher */
  const normal = suggest([sess('2026-09-21', sx([{ w: 60, r: 15, rir: 2 }, { w: 60, r: 15, rir: 2 }], 'Brustpresse', 'brustpresse'))],
    { ...plan, id: 'brustpresse' }, 'Brustpresse', findExercise('Brustpresse'));
  assert.equal(normal.kind, 'up');
  assert.equal(normal.weight, 61);
});

test('Eine Zirkelrunde ist ein Satz: zwei Runden zählen zwei Sätze, jede Methode', () => {
  const sessions = [sess('2026-09-22', sx([{ w: 60, r: 12 }, { w: 80, r: 10, m: 'negative' }]),
    sx([{ w: 50, r: 12 }, { w: 50, r: 12 }], 'Latzug (Smart-Zirkel)', 'smart-latzug'))];
  const w = weekMuscleSets(sessions, weekStart(at('2026-09-22')), n => findExercise(n));
  assert.equal(w.sets.chest, 2);
  assert.equal(w.sets.back, 2);
  assert.equal(w.sets.triceps, 1);
  assert.equal(w.total, 4);
});

test('Startwerte im Plan: zwei Runden, keine Steigerung', () => {
  assert.deepEqual(defaultsFor(findExercise('smart-beinpresse')), { sets: 2, repMin: 10, repMax: 15, rest: 60, inc: 0, unit: 'reps' });
});

test('Coach: kein Deload am Smart-Zirkel, an der normalen Maschine schon', () => {
  const deloadsFor = (name, exId) => {
    const S = defaultState();
    S.plans = [{ id: 't', name: 'Zirkel', order: ['a'], days: { a: { id: 'a', name: 'Zirkel', muscles: '', color: 'red', exercises: [
      { id: exId, names: [name], sets: 2, repMin: 10, repMax: 15, rest: 35, inc: 1, unit: 'reps' },
    ] } } }];
    S.activePlanId = 't';
    const miss = [{ w: 60, r: 6, rir: 0 }, { w: 60, r: 5, rir: 0 }];
    S.sessions = ['2026-09-21', '2026-09-24', '2026-09-28'].map(d => ({ ...sess(d, { ...sx(miss, name, exId), target: { sets: 2, repMin: 10, repMax: 15 } }), planId: 't', dayId: 'a' }));
    return suggestions(S, new Date('2026-09-30T12:00').getTime()).filter(s => s.id.startsWith('deload'));
  };
  assert.deepEqual(deloadsFor(BP, 'smart-brustpresse'), []);
  assert.equal(deloadsFor('Brustpresse', 'brustpresse').length, 1);
});

test('Coach: Volumenlücke schlägt Smart-Zirkel-Übungen nur mit Zusatzschalter vor', () => {
  const S = defaultState();
  S.plans = [{ id: 't', name: 'Test', order: ['a'], days: { a: { id: 'a', name: 'Tag A', muscles: '', color: 'red', exercises: [
    { id: 'sq', names: ['Kniebeugen'], sets: 6, repMin: 6, repMax: 8, rest: 150, inc: 2.5, unit: 'reps' },
  ] } } }];
  S.activePlanId = 't';
  S.sessions = ['2026-09-08', '2026-09-15', '2026-09-22'].map(d => ({ ...sess(d, { exId: 'sq', name: 'Kniebeugen', unit: 'reps', sets: [{ w: 100, r: 6 }] }), planId: 't', dayId: 'a' }));
  /* Nur der Smart-Zirkel: Für Oberschenkel vorne bleibt dann nur ein Smart-Gerät */
  const NOW = new Date('2026-09-30T12:00').getTime();
  S.profile.equipment = ['smart-zirkel'];
  const withSmart = suggestions(S, NOW).find(s => s.id.startsWith('volume:quads'));
  assert.ok(withSmart && /Smart-Zirkel/.test(withSmart.reason), withSmart && withSmart.reason);
  S.profile.equipment = ['kurzhanteln'];
  const without = suggestions(S, NOW).find(s => s.id.startsWith('volume:quads'));
  assert.ok(!without || !/Smart-Zirkel/.test(without.reason));
});

test('Methode übersteht Laden und Backup', () => {
  const S = defaultState();
  S.sessions = [{ ...sess('2026-09-22', sx([{ w: 60, r: 12, rir: 2, m: 'negative' }, { w: 60, r: 12, rir: 2, m: 'nope' }])), planId: 'split', dayId: 'push' }];
  const n = normalize(JSON.parse(JSON.stringify(S)));
  assert.deepEqual(n.sessions[0].ex[0].sets, [{ w: 60, r: 12, rir: 2, m: 'negative' }, { w: 60, r: 12, rir: 2 }]);
});
