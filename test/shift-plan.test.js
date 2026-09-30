process.env.TZ = 'Europe/Berlin';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTrainings, sessionMinutes, dayWindow, reasonFor, MAX_PER_WEEK } from '../js/domain/shift-plan.js';
import { defaultShifts, TEMPLATE_28, localMs, toMin, dayNum, mondayOf } from '../js/domain/shifts.js';
import { defaultState } from '../js/store/migrate.js';

const H = 36e5;
/* Zustand mit Muster ab `start`; sessions als [Plantag, Datum, Uhrzeit] */
function state({ pattern = null, start = '2026-10-05', perWeek = 3, sessions = [], prefer = null, order = null } = {}) {
  const s = defaultState();
  s.profile.daysPerWeek = perWeek;
  s.shifts = defaultShifts();
  if (pattern) s.shifts.pattern = { start, days: [...pattern], template: null };
  if (prefer) Object.assign(s.shifts.prefer, prefer);
  if (order) s.plans[0].order = order;
  s.sessions = sessions.map(([dayId, date, time = '10:00']) => {
    const d = s.plans[0].days[dayId];
    const t = localMs(date, toMin(time));
    return {
      id: dayId + date, planId: 'split', dayId, name: d.name, color: d.color, startedAt: t, endedAt: t + sessionMinutes(d) * 60000,
      ex: d.exercises.map(e => ({ exId: e.id, name: e.names[0], unit: e.unit, sets: Array.from({ length: e.sets }, () => ({ w: 50, r: 10 })) })),
    };
  });
  return s;
}
const brief = r => r.trainings.map(t => `${t.date.slice(5)} ${t.time} ${t.name}`);
const FREE = '-------';

test('Ohne Schichtplan plant die App nichts', () => {
  assert.equal(planTrainings(defaultState(), '2026-10-05'), null);
  const s = state();
  s.shifts.overrides = { '2026-10-06': 'F' };
  assert.equal(planTrainings(s, '2026-10-05'), null);
});

test('Dauer einer Einheit wie auf der Trainingsseite, auf 5 Minuten aufgerundet', () => {
  const { days } = defaultState().plans[0];
  assert.equal(sessionMinutes(days.push), 75);
  assert.equal(sessionMinutes(days.pull), 65);
  assert.equal(sessionMinutes(days.legs), 80);
  assert.equal(sessionMinutes({ exercises: [] }), 75);
});

test('Vorlage 28 Tage: zwei Wochen mit Uhrzeit, Einheit und Begründung', () => {
  const s = state({ pattern: TEMPLATE_28.days });
  const r = planTrainings(s, '2026-10-05', 14);
  assert.deepEqual(brief(r), [
    '10-05 15:30 Push', '10-07 10:00 Pull', '10-09 10:00 Legs',
    '10-12 14:00 Push', '10-14 15:30 Pull', '10-16 15:30 Legs',
  ]);
  assert.deepEqual(r.trainings.map(t => t.reason), [
    'nach der Frühschicht', 'vor der Spätschicht', 'vor der Spätschicht',
    'frei, nach der Nachtschicht ausgeschlafen', 'nach der Frühschicht', 'nach der Frühschicht',
  ]);
  const t = r.trainings[0];
  assert.deepEqual([t.end, t.minutes, t.dayId, t.color, t.shift], ['16:45', 75, 'push', 'red', 'F']);
});

test('Vorlage über vier Wochen: Wochenziel erreicht, immer ein Ruhetag dazwischen', () => {
  const s = state({ pattern: TEMPLATE_28.days });
  const r = planTrainings(s, '2026-10-05', 28);
  assert.equal(r.trainings.length, 12);
  r.weeks.forEach(w => { assert.equal(w.planned, 3); assert.equal(w.short, false); });
  r.trainings.slice(1).forEach((t, i) => assert.ok(dayNum(t.date) - dayNum(r.trainings[i].date) >= 2, t.date));
  /* Reihenfolge des Plans läuft durch */
  assert.deepEqual(r.trainings.map(x => x.dayId).slice(0, 6), ['push', 'pull', 'legs', 'push', 'pull', 'legs']);
});

test('Erlaubtes Fenster je Tagart', () => {
  const T = defaultShifts().times;
  assert.deepEqual(dayWindow('F', 'F', T), { lo: 900, hiEnd: 1320 });     // frühestens 15:00
  assert.deepEqual(dayWindow('S', 'S', T), { lo: 360, hiEnd: 750 });      // Ende spätestens 12:30
  assert.deepEqual(dayWindow('N', 'S', T), { lo: 360, hiEnd: 1140 });     // Ende spätestens 19:00
  assert.deepEqual(dayWindow('N', 'N', T), { lo: 840, hiEnd: 1140 });     // nach einer Nacht nicht vor 14:00
  assert.deepEqual(dayWindow('-', 'N', T), { lo: 840, hiEnd: 1320 });
  assert.deepEqual(dayWindow('U', '-', T), { lo: 360, hiEnd: 1320 });
  assert.deepEqual(dayWindow(null, null, T), { lo: 360, hiEnd: 1320 });
  assert.equal(dayWindow('S', 'N', T), null);                             // Spät direkt nach Nacht: kein Fenster
  assert.deepEqual(dayWindow('F', '-', { ...T, F: ['05:45', '13:50'] }), { lo: 900, hiEnd: 1320 });   // 14:50 auf Viertelstunden
});

test('Uhrzeiten je Tagart: Wunschzeit, sonst an den Rand des Fensters geschoben', () => {
  const at = (pattern, prefer) => planTrainings(state({ pattern, prefer }), '2026-10-05', 7).trainings[0];
  assert.deepEqual([at('FFFFFFF').time, at('FFFFFFF').reason], ['15:30', 'nach der Frühschicht']);
  assert.equal(at('FFFFFFF', { F: '13:00' }).time, '15:00');
  assert.equal(at('SSSSSSS').time, '10:00');
  const late = at('SSSSSSS', { S: '12:00' });
  assert.deepEqual([late.time, late.end], ['11:15', '12:30']);           // Ende 90 Minuten vor 14:00
  const night = at('NNNNNNN', { N: '19:00' });
  assert.deepEqual([night.time, night.end], ['17:45', '19:00']);         // 3 Stunden vor 22:00
  assert.equal(night.reason, 'vor der Nachtschicht, nach dem Ausschlafen');
  assert.equal(at('NNNNNNN', { N: '09:00' }).time, '14:00');             // zwischen zwei Nächten nicht vor 14:00
  const r = planTrainings(state({ pattern: 'N-N-N-N', prefer: { '-': '09:00' } }), '2026-10-05', 7);
  assert.deepEqual(brief(r), ['10-06 14:00 Push', '10-08 14:00 Pull', '10-10 14:00 Legs']);
  assert.ok(r.trainings.every(t => t.reason === 'frei, nach der Nachtschicht ausgeschlafen'));
});

test('Spätschicht direkt nach einer Nachtschicht lässt keinen Platz, dann trainiert die App vor einer Nacht', () => {
  const r = planTrainings(state({ pattern: 'NSNSNSN', perWeek: 2 }), '2026-10-05', 7);
  assert.deepEqual(brief(r), ['10-05 17:00 Push', '10-07 17:00 Pull']);
  assert.ok(r.trainings.every(t => t.shift === 'N'));
});

test('Vorlieben: frei vor Früh vor Spät vor Nacht, Urlaub zählt wie frei', () => {
  const r = planTrainings(state({ pattern: 'NSF-NSF', perWeek: 2 }), '2026-10-05', 7);
  assert.deepEqual(r.trainings.map(t => [t.date, t.shift]), [['2026-10-08', '-'], ['2026-10-11', 'F']]);
  const s = state({ pattern: TEMPLATE_28.days });
  s.shifts.overrides = { '2026-10-10': 'U' };                             // Samstag wäre Nachtschicht
  const u = planTrainings(s, '2026-10-05', 7);
  assert.deepEqual(u.trainings.map(t => [t.date.slice(5), t.shift, t.reason]), [
    ['10-05', 'F', 'nach der Frühschicht'], ['10-07', 'S', 'vor der Spätschicht'], ['10-10', 'U', 'Urlaub'],
  ]);
});

test('Erledigte Einheiten der laufenden Woche zählen mit', () => {
  /* Mo Push, Mi Pull erledigt, heute Donnerstag: noch eine Einheit, frühestens Freitag */
  const s = state({ pattern: FREE, sessions: [['push', '2026-10-05'], ['pull', '2026-10-07']] });
  const r = planTrainings(s, '2026-10-08', 11);
  assert.deepEqual(r.weeks[0], { monday: '2026-10-05', target: 3, done: 2, planned: 1, short: false });
  assert.deepEqual(brief(r).slice(0, 2), ['10-09 11:00 Legs', '10-12 11:00 Push']);
  /* Drei erledigt: diese Woche nichts mehr */
  const full = state({ pattern: FREE, sessions: [['push', '2026-10-05'], ['pull', '2026-10-07'], ['legs', '2026-10-09']] });
  const f = planTrainings(full, '2026-10-10', 9);
  assert.equal(f.weeks[0].planned, 0);
  assert.equal(f.trainings[0].date, '2026-10-12');
});

test('Heute schon trainiert: heute und morgen kein Training', () => {
  const s = state({ pattern: FREE, sessions: [['push', '2026-10-07', '07:00']] });
  const r = planTrainings(s, '2026-10-07', 7);
  assert.ok(r.trainings.every(t => t.date >= '2026-10-09'));
  assert.equal(r.trainings[0].name, 'Pull');
  /* Ein laufendes Training zählt wie ein erledigtes */
  const a = state({ pattern: FREE });
  a.active = { planId: 'split', dayId: 'push', name: 'Push', color: 'red', startedAt: localMs('2026-10-07', 600), ex: [] };
  const ra = planTrainings(a, '2026-10-07', 7);
  assert.ok(ra.trainings.every(t => t.date >= '2026-10-09'));
  assert.equal(ra.trainings[0].name, 'Pull');
});

test('Reihenfolge des Plans ab der nächsten fälligen Einheit', () => {
  const s = state({ pattern: FREE, sessions: [['push', '2026-10-02']] });
  const r = planTrainings(s, '2026-10-05', 14);
  assert.deepEqual(r.trainings.map(t => t.name), ['Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Push']);
});

test('48-Stunden-Regel: Uhrzeit rückt nach hinten', () => {
  /* Plan nur Pull und Push. Pull am Montag bis 16:35 belastet die Schultern (Face Pulls), Push braucht sie.
     Vier pro Woche verlangen Mittwoch, Freitag und Sonntag. */
  const s = state({ pattern: FREE, perWeek: 4, order: ['pull', 'push'], sessions: [['pull', '2026-10-05', '15:30']] });
  const r = planTrainings(s, '2026-10-06', 6);
  assert.deepEqual(brief(r), ['10-07 16:45 Push', '10-09 11:00 Pull', '10-11 12:15 Push']);
  assert.match(r.trainings[0].note, /48 Stunden/);
  assert.equal(r.trainings[1].note, null);
  /* Zwischen Pull am Freitag (Ende 12:05) und Push am Sonntag liegen so volle 48 Stunden */
  assert.ok(localMs('2026-10-11', toMin('12:15')) - localMs('2026-10-09', toMin('12:05')) >= 48 * H);
});

test('48-Stunden-Regel: passt die Uhrzeit nicht, kommt die nächste Einheit dran', () => {
  const s = state({ pattern: '--S----', perWeek: 4, order: ['pull', 'push', 'legs'], sessions: [['pull', '2026-10-05', '15:30']] });
  const r = planTrainings(s, '2026-10-06', 6);
  assert.deepEqual(brief(r), ['10-07 10:00 Legs', '10-09 11:00 Push', '10-11 11:00 Pull']);
  assert.equal(r.trainings[0].note, 'Push braucht noch Pause, darum zuerst Legs.');
});

test('48-Stunden-Regel: passt keine Einheit, fällt der Tag aus', () => {
  const s = state({ pattern: '--S----', perWeek: 4, order: ['push'], sessions: [['push', '2026-10-05', '15:30']] });
  const r = planTrainings(s, '2026-10-06', 6);
  assert.ok(!r.trainings.some(t => t.date === '2026-10-07'));
  assert.deepEqual(brief(r), ['10-08 11:00 Push', '10-11 11:00 Push']);
  assert.deepEqual(r.weeks[0], { monday: '2026-10-05', target: 4, done: 1, planned: 2, short: true });
});

test('Mehr als vier pro Woche gehen mit einem Ruhetag dazwischen nicht', () => {
  assert.equal(MAX_PER_WEEK, 4);
  const r = planTrainings(state({ pattern: FREE, perWeek: 6 }), '2026-10-05', 7);
  assert.deepEqual(r.trainings.map(t => t.date.slice(5)), ['10-05', '10-07', '10-09', '10-11']);
  assert.equal(r.weeks[0].short, true);
});

test('Ruhetag gilt auch über die Wochengrenze', () => {
  const r = planTrainings(state({ pattern: FREE, perWeek: 4 }), '2026-10-05', 14);
  assert.ok(r.trainings.some(t => t.date === '2026-10-11'));
  assert.ok(!r.trainings.some(t => t.date === '2026-10-12'));
});

test('Tage ohne Schichtangabe zählen wie frei und sagen es', () => {
  const s = state();
  s.shifts.imported = { '2026-10-01': 'F', '2026-10-02': 'F' };
  s.shifts.importInfo = { at: 1, from: '2026-10-01', to: '2026-10-07', shifts: 2, unknown: 0 };
  const r = planTrainings(s, '2026-10-08', 7);
  assert.ok(r.trainings.length > 0);
  assert.ok(r.trainings.every(t => t.shift === null && t.reason === 'keine Schicht eingetragen'));
});

test('Zeitumstellung: Uhrzeiten bleiben Ortszeit', () => {
  const r = planTrainings(state({ pattern: 'FFFFFFF', perWeek: 4 }), '2026-10-19', 7);
  const sun = r.trainings.find(t => t.date === '2026-10-25');
  assert.deepEqual([sun.time, sun.end], ['15:30', '16:45']);
  assert.equal(new Date(localMs(sun.date, toMin(sun.time))).getHours(), 15);
  const spring = planTrainings(state({ pattern: 'FFFFFFF', perWeek: 4, start: '2027-03-22' }), '2027-03-22', 7);
  assert.deepEqual(spring.trainings.find(t => t.date === '2027-03-28').time, '15:30');
});

test('Plan ohne Übungen: allgemeines Training mit 75 Minuten', () => {
  const s = state({ pattern: FREE });
  Object.values(s.plans[0].days).forEach(d => { d.exercises = []; });
  const t = planTrainings(s, '2026-10-05', 7).trainings[0];
  assert.deepEqual([t.name, t.minutes, t.dayId, t.time, t.end], ['Training', 75, null, '11:00', '12:15']);
});

test('Der Plan für zwei Wochen ist der Anfang des längeren Plans', () => {
  const s = state({ pattern: TEMPLATE_28.days, sessions: [['legs', '2026-10-03']] });
  const short = planTrainings(s, '2026-10-06', 14).trainings;
  const long = planTrainings(s, '2026-10-06', 60).trainings.filter(t => t.date <= '2026-10-19');
  assert.deepEqual(short, long);
  assert.equal(mondayOf(short[0].date) <= short[0].date, true);
});

test('Begründungen', () => {
  assert.equal(reasonFor('F', 'F'), 'nach der Frühschicht');
  assert.equal(reasonFor('U', 'N'), 'Urlaub, nach der Nachtschicht ausgeschlafen');
  assert.equal(reasonFor('-', 'S'), 'frei');
});

test('#30: laufendes Training (x.sets ist die Satzzahl, Sätze in x.log) bringt die Planung nicht zum Absturz', () => {
  const s = state({ pattern: TEMPLATE_28.days });
  const d = s.plans[0].days.push;
  /* So legt startWorkout ein Training an: sets ist eine Zahl, die Sätze stehen in log */
  s.active = {
    planId: 'split', dayId: 'push', name: d.name, color: d.color, startedAt: localMs('2026-10-05', toMin('15:30')), timer: null,
    ex: d.exercises.map((e, i) => ({ exId: e.id, name: e.names[0], unit: e.unit, sets: e.sets,
      log: Array.from({ length: e.sets }, (_, j) => ({ w: '50', r: '10', rir: 2, done: i === 0 && j < 2, pw: '0', pr: '10' })) })),
  };
  let r;
  assert.doesNotThrow(() => { r = planTrainings(s, '2026-10-05', 14); });
  assert.ok(r.trainings.length > 0);
});

test('#30: workSets und topSets vertragen Nicht-Listen', async () => {
  const { workSets, topSets, tonnage } = await import('../js/domain/settypes.js');
  assert.deepEqual(workSets(3), []);
  assert.deepEqual(topSets(undefined), []);
  assert.equal(tonnage(4), 0);
});

test('#44: Ist das heutige Zeitfenster vorbei, plant die App heute nichts mehr', () => {
  /* Vorlage ab 05.10.: Mo F, Di F, Mi S … ; Mittwoch 07.10. ist Spätschicht (Fenster bis 12:30) */
  const s = state({ pattern: TEMPLATE_28.days });
  const morning = planTrainings(s, '2026-10-07', 7, { nowMin: 9 * 60 });
  const evening = planTrainings(s, '2026-10-07', 7, { nowMin: 18 * 60 + 10 });
  assert.ok(morning.trainings.some(t => t.date === '2026-10-07'), 'morgens vor der Spätschicht noch möglich');
  assert.ok(!evening.trainings.some(t => t.date === '2026-10-07'), 'abends während der Spätschicht nicht mehr');
});

test('#44: Heute beginnt ein Training frühestens jetzt', () => {
  /* Montag 05.10. Frühschicht, Wunschzeit 15:30 */
  const s = state({ pattern: TEMPLATE_28.days });
  const r = planTrainings(s, '2026-10-05', 7, { nowMin: 15 * 60 + 40 });
  const t = r.trainings.find(x => x.date === '2026-10-05');
  assert.ok(t, 'noch heute');
  assert.ok(toMin(t.time) >= 15 * 60 + 40, t.time);
});
