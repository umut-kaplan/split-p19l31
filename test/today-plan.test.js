import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestToday, lastTrained, restText, REST_HOURS } from '../js/domain/today-plan.js';
import { defaultPlan } from '../js/plans.js';
import { findExercise } from '../js/domain/library.js';

const plan = defaultPlan();
const resolve = n => findExercise(n);
const NOW = new Date('2026-09-28T17:00').getTime();
const H = 36e5;
/* Eine Einheit eines Plan-Tages, die vor `hoursAgo` Stunden endete */
const done = (dayId, hoursAgo) => ({
  dayId, name: plan.days[dayId].name, startedAt: NOW - hoursAgo * H - 3600e3, endedAt: NOW - hoursAgo * H,
  ex: plan.days[dayId].exercises.map(e => ({ exId: e.id, name: e.names[0], unit: e.unit, sets: Array.from({ length: e.sets }, () => ({ w: 50, r: 10 })) })),
});
const run = (o = {}) => suggestToday({ plan, sessions: [], resolve, level: 'green', nextId: 'push', now: NOW, ...o });

test('Ruhezeit als Text', () => {
  assert.equal(restText(30), 'seit 30 Stunden');
  assert.equal(restText(80), 'seit 3 Tagen');
  /* Einzahl (4.6) */
  assert.equal(restText(1.2), 'seit 1 Stunde');
  assert.equal(restText(0.2), 'seit 1 Stunde');
  assert.equal(restText(Infinity), 'noch nie trainiert');
  assert.equal(REST_HOURS, 48);
});

test('Zuletzt trainiert: nur primäre Muskeln, jüngste Einheit zählt', () => {
  const last = lastTrained([done('push', 80), done('push', 30)], resolve);
  assert.equal(last.chest, NOW - 30 * H);
  assert.equal(last.back, undefined);
});

test('Ohne Verlauf: die erste Einheit der Reihenfolge, mit Alternative', () => {
  const s = run();
  assert.equal(s.kind, 'train');
  assert.equal(s.dayId, 'push');
  assert.equal(s.hint, null);
  assert.equal(s.alt.dayId, 'pull');
  assert.match(s.reason, /^Push ist in der Reihenfolge dran/);
});

test('Nächste Einheit mit erholten Muskeln bleibt der Vorschlag', () => {
  const s = run({ sessions: [done('push', 20)], nextId: 'pull' });
  assert.equal(s.dayId, 'pull');
  assert.match(s.reason, /Pull ist in der Reihenfolge dran, und Rücken und Bizeps ruhen noch nie trainiert|Pull ist in der Reihenfolge dran/);
});

test('48-Stunden-Regel: Hauptmuskeln zu frisch, anderer Tag passt besser', () => {
  /* Push vor 30 Stunden, Pull vor 5 Tagen, Legs vor 3 Tagen; Push wäre wieder dran */
  const s = run({ sessions: [done('pull', 120), done('legs', 72), done('push', 30)], nextId: 'push' });
  assert.equal(s.kind, 'train');
  assert.equal(s.dayId, 'pull');
  assert.match(s.reason, /^Eigentlich wäre Push dran, aber .* vor 30 Stunden trainiert\. Pull passt besser: Rücken und Bizeps ruhen seit 5 Tagen\.$/);
  assert.equal(s.alt.dayId, 'legs');
});

test('Gelb: trainieren mit Hinweis', () => {
  const s = run({ level: 'yellow' });
  assert.equal(s.kind, 'train');
  assert.match(s.hint, /einen Satz weniger/);
  assert.match(s.hint, /RIR 3/);
});

test('Rot: Ruhetag, Alternative ist die leichteste erholte Einheit', () => {
  const s = run({ level: 'red', sessions: [done('pull', 20)] });
  assert.equal(s.kind, 'rest');
  assert.equal(s.dayId, null);
  assert.match(s.reason, /Cardio oder Mobilität/);
  /* Pull wäre die leichteste (20 Sätze), ist aber nicht erholt. Push auch nicht:
     Face Pulls am Pull-Tag belasten die Schultern primär, und die sind ein Hauptmuskel von Push. Bleibt Legs. */
  assert.equal(s.alt.dayId, 'legs');
  const s2 = run({ level: 'red', sessions: [done('legs', 20)] });
  assert.equal(s2.alt.dayId, 'pull');   // von den erholten Tagen die leichteste Einheit
});

test('Heute schon trainiert', () => {
  const s = run({ sessions: [done('push', 2)], trainedToday: { dayId: 'push', name: 'Push' } });
  assert.equal(s.kind, 'done');
  assert.match(s.title, /Heute schon erledigt: Push/);
  assert.equal(s.alt.dayId, 'pull');
});

test('Plan ohne Übungen liefert nichts', () => {
  const empty = { order: ['a'], days: { a: { id: 'a', name: 'A', exercises: [] } } };
  assert.equal(suggestToday({ plan: empty, sessions: [], resolve, nextId: 'a', now: NOW }), null);
});
