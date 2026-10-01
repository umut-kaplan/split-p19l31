import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromV1, fromBackup, toBackup, normalize, defaultState, SCHEMA } from '../js/store/migrate.js';
import { defaultPlan } from '../js/plans.js';

const v1 = () => {
  const p = defaultPlan();
  return {
    plan: { order: p.order, days: p.days },
    sessions: [{ id: 'a', dayId: 'push', name: 'Push', color: 'red', startedAt: 1, endedAt: 2, ex: [{ exId: 'bank', name: 'Bankdrücken', unit: 'reps', sets: [{ w: 80, r: 8, rir: 2 }] }] }],
    active: null,
    lastBackup: 123,
  };
};

test('split.v1 wird zu Schema 2 ohne Datenverlust', () => {
  const s = fromV1(v1());
  assert.equal(s.schema, SCHEMA);
  assert.equal(s.plans[0].id, 'split');
  assert.equal(s.plans[0].days.push.exercises[0].names[0], 'Bankdrücken');
  assert.equal(s.sessions.length, 1);
  assert.equal(s.sessions[0].planId, 'split');
  assert.equal(s.sessions[0].ex[0].sets[0].w, 80);
  assert.equal(s.settings.lastBackup, 123);
  assert.equal(s.settings.onboardingDone, false);
});

test('Laufendes Training der ersten Version bleibt erhalten', () => {
  const d = v1();
  d.active = { dayId: 'pull', name: 'Pull', color: 'blue', startedAt: 5, ex: [] };
  assert.equal(fromV1(d).active.planId, 'split');
});

test('Backup der ersten Version lässt sich importieren', () => {
  const s = fromBackup({ app: 'split', version: 1, exportedAt: 'x', ...v1() });
  assert.equal(s.sessions.length, 1);
});

test('Backup im neuen Format: hin und zurück', () => {
  const s = fromV1(v1());
  s.profile.name = 'Alex';
  s.active = { dayId: 'push' };
  const b = toBackup(s, new Date('2026-09-27T10:00:00Z'));
  assert.equal(b.app, 'fit');
  assert.equal(b.version, 2);
  assert.equal(b.data.active, null);
  const back = fromBackup(JSON.parse(JSON.stringify(b)));
  assert.equal(back.profile.name, 'Alex');
  assert.equal(back.sessions.length, 1);
});

test('Fremde oder kaputte Dateien werden abgelehnt', () => {
  assert.throws(() => fromBackup({ foo: 1 }), /kein Backup/);
  assert.throws(() => fromBackup({ app: 'fit', version: 9, data: {} }), /neueren Version/);
  assert.throws(() => normalize({ plans: [] }));
});

test('normalize ergänzt fehlende Felder', () => {
  const s = defaultState();
  delete s.water;
  delete s.profile.limitations;
  s.activePlanId = 'gibtsnicht';
  const n = normalize(s);
  assert.deepEqual(n.water, {});
  assert.deepEqual(n.profile.limitations, { text: '', tags: [] });
  assert.equal(n.activePlanId, 'split');
});

test('4.7: Geräte im Profil und an eigenen Übungen ziehen auf die neue Liste um, alles andere bleibt', () => {
  const s = defaultState();
  s.profile.equipment = ['Langhantel', 'Kurzhanteln', 'Hantelbank'];
  s.exercisesCustom = [
    { id: 'c1', name: 'Kabelrudern einarmig', custom: true, equipment: ['Kabelzug'], muscles: { primary: ['back'], secondary: [] }, steps: ['A.'] },
    { id: 'c2', name: 'Maschinenrudern', custom: true, equipment: ['Maschinen'], muscles: { primary: ['back'], secondary: [] } },
    { id: 'c3', name: 'Ohne Geräte', custom: true },
  ];
  const n = normalize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(n.profile.equipment, ['langhantel', 'kurzhanteln', 'flachbank', 'schraegbank', 'bankdrueckstation', 'schraegbankstation', 'kniebeugenstaender']);
  assert.deepEqual(n.exercisesCustom[0], { ...s.exercisesCustom[0], equipment: ['kabelturm'] });
  assert.equal(n.exercisesCustom[1].equipment.length, 1);
  assert.ok(n.exercisesCustom[1].equipment[0].includes('beinstrecker'));
  assert.deepEqual(n.exercisesCustom[2], s.exercisesCustom[2]);
  /* Zweimal laden ändert nichts mehr */
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(n))), n);
});

test('4.7: Leere Geräteauswahl bleibt leer (alles erlaubt), Unsinn fällt weg', () => {
  const s = defaultState();
  assert.deepEqual(normalize(s).profile.equipment, []);
  s.profile.equipment = 'Langhantel';
  assert.deepEqual(normalize(s).profile.equipment, []);
  s.profile.equipment = ['smart-zirkel', 'Quatsch', 'kurzhanteln'];
  assert.deepEqual(normalize(s).profile.equipment, ['kurzhanteln', 'smart-zirkel']);
});

test('4.7: Kurzhantel-Steigerung in den Einstellungen, Standard 2 kg, unbekannte Werte fallen zurück', () => {
  const s = defaultState();
  assert.equal(s.settings.dumbbellInc, 2);
  delete s.settings.dumbbellInc;
  assert.equal(normalize(s).settings.dumbbellInc, 2, 'Stand ohne Einstellung');
  [1, 2, 2.5].forEach(v => { s.settings.dumbbellInc = v; assert.equal(normalize(s).settings.dumbbellInc, v); });
  ['2', 3, null, 0].forEach(v => { s.settings.dumbbellInc = v; assert.equal(normalize(s).settings.dumbbellInc, 2, String(v)); });
  const b = fromBackup(JSON.parse(JSON.stringify(toBackup({ ...defaultState(), settings: { ...defaultState().settings, dumbbellInc: 2.5 } }))));
  assert.equal(b.settings.dumbbellInc, 2.5, 'übersteht das Backup');
});
