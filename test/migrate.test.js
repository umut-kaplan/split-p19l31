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
