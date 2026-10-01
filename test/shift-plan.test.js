process.env.TZ = 'Europe/Berlin';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTrainings, sessionMinutes, dayWindow, reasonFor, MAX_PER_WEEK } from '../js/domain/shift-plan.js';
import { defaultShifts, TEMPLATE_28, localMs, toMin, dayNum, mondayOf } from '../js/domain/shifts.js';
import { defaultState } from '../js/store/migrate.js';
import { dayProfile } from '../js/domain/today-plan.js';
import { findExercise } from '../js/domain/library.js';
import { planFromTemplate } from '../js/plans.js';
import { PLAN_TEMPLATES } from '../js/data/plan-templates.js';

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
/* Aktiven Plan durch eine Vorlage ersetzen */
const withPlan = (s, id) => {
  const p = planFromTemplate(PLAN_TEMPLATES.find(t => t.id === id), [], []);
  s.plans = [p];
  s.activePlanId = p.id;
  return s;
};
const brief = r => r.trainings.map(t => `${t.date.slice(5)} ${t.time} ${t.name}`);
/* Überschneiden sich die Hauptmuskeln zweier Plantage? */
const mainOf = (s, id) => dayProfile((s.plans.find(p => p.id === s.activePlanId) || s.plans[0]).days[id], n => findExercise(n, [])).main;
const mainOverlap = (s, a, b) => mainOf(s, a).some(m => mainOf(s, b).includes(m));
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
  /* Zweite Woche (P4, P5): die beiden freien Tage in Folge und Spät statt zweimal Früh */
  assert.deepEqual(brief(r), [
    '10-05 15:30 Push', '10-07 10:00 Pull', '10-09 10:00 Legs',
    '10-12 14:00 Push', '10-13 11:00 Pull', '10-17 10:00 Legs',
  ]);
  assert.deepEqual(r.trainings.map(t => t.reason), [
    'nach der Frühschicht', 'vor der Spätschicht', 'vor der Spätschicht',
    'frei, nach der Nachtschicht ausgeschlafen', 'frei', 'vor der Spätschicht',
  ]);
  const t = r.trainings[0];
  assert.deepEqual([t.end, t.minutes, t.dayId, t.color, t.shift], ['16:45', 75, 'push', 'red', 'F']);
});

test('Vorlage über vier Wochen: Wochenziel erreicht, zwei Tage in Folge nur mit verschiedenen Hauptmuskeln', () => {
  const s = state({ pattern: TEMPLATE_28.days });
  const r = planTrainings(s, '2026-10-05', 28);
  assert.equal(r.trainings.length, 12);
  r.weeks.forEach(w => { assert.equal(w.planned, 3); assert.equal(w.short, false); });
  r.trainings.slice(1).forEach((t, i) => {
    const prev = r.trainings[i];
    assert.ok(dayNum(t.date) > dayNum(prev.date), t.date);
    if (dayNum(t.date) - dayNum(prev.date) === 1) assert.ok(!mainOverlap(s, prev.dayId, t.dayId), `${prev.name} → ${t.name} am ${t.date}`);
  });
  /* Reihenfolge des Plans läuft durch */
  assert.deepEqual(r.trainings.map(x => x.dayId).slice(0, 6), ['push', 'pull', 'legs', 'push', 'pull', 'legs']);
});

test('Erlaubtes Fenster je Tagart', () => {
  const T = defaultShifts().times;
  assert.deepEqual(dayWindow('F', 'F', T), { lo: 900, hiEnd: 1320 });     // frühestens 15:00
  assert.deepEqual(dayWindow('S', 'S', T), { lo: 360, hiEnd: 750 });      // Ende spätestens 12:30
  assert.deepEqual(dayWindow('N', 'S', T), { lo: 360, hiEnd: 1140 });     // Ende spätestens 19:00
  assert.deepEqual(dayWindow('N', 'N', T), { lo: 840, hiEnd: 1140 });     // nach einer Nacht nicht vor 14:00
  assert.deepEqual(dayWindow('-', 'N', T), { lo: 840, hiEnd: 1200 });     // P3: nach der letzten Nacht Ende bis 20:00
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
  /* P4: Montag liegt zwischen zwei Nächten, Mittwoch und Freitag vor einer Spätschicht mit 8 Stunden Ruhe; Sonntag hat keinen Abschlag */
  const r = planTrainings(state({ pattern: 'NSNSNSN', perWeek: 2 }), '2026-10-05', 7);
  assert.deepEqual(brief(r), ['10-07 17:00 Push', '10-11 17:00 Pull']);
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

test('P5: höchstens sechs Trainings pro Woche, ein Tag bleibt frei', () => {
  assert.equal(MAX_PER_WEEK, 6);
  const six = planTrainings(state({ pattern: FREE, perWeek: 6 }), '2026-10-05', 14);
  six.weeks.forEach(w => assert.deepEqual([w.planned, w.short], [6, false]));
  const r = planTrainings(state({ pattern: FREE, perWeek: 7 }), '2026-10-05', 28);
  r.weeks.forEach(w => assert.deepEqual([w.planned, w.short], [6, true]));
  /* Nie mehr als 6 Tage in Folge */
  let run = 1;
  r.trainings.slice(1).forEach((t, i) => {
    run = dayNum(t.date) - dayNum(r.trainings[i].date) === 1 ? run + 1 : 1;
    assert.ok(run <= 6, t.date);
  });
});

test('Ruhetag gilt auch über die Wochengrenze, wenn sich die Einheiten überschneiden', () => {
  /* Ganzkörper: jede Einheit trainiert dieselben Muskeln, also nie zwei Tage in Folge */
  const s = withPlan(state({ pattern: FREE, perWeek: 4 }), 'fullbody2');
  const r = planTrainings(s, '2026-10-05', 14);
  assert.ok(r.trainings.some(t => t.date === '2026-10-11'));
  assert.ok(!r.trainings.some(t => t.date === '2026-10-12'));
  /* Push/Pull/Legs: Sonntag Push, Montag Pull geht */
  const ppl = planTrainings(state({ pattern: FREE, perWeek: 4 }), '2026-10-05', 14);
  assert.deepEqual(ppl.trainings.filter(t => t.date === '2026-10-11' || t.date === '2026-10-12').map(t => t.name), ['Push', 'Pull']);
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

/* ---------- Kategorien der Schichtarten ---------- */
import { dayWindows, CAT_RANK } from '../js/domain/shift-plan.js';
import { templateById } from '../js/domain/shift-templates.js';
import { setOverride } from '../js/domain/shifts.js';

const day = (cat, times = null) => ({ cat, times });
const withTimes = (s, times) => { Object.assign(s.shifts.times, times); return s; };
const full = r => r.trainings.map(t => `${t.date.slice(5)} ${t.shift} ${t.time}–${t.end} ${t.reason}`);

test('Fenster je Kategorie: Tag, 24 h, Krank, Dispo', () => {
  /* Tagschicht 06–18: nur danach, ab 19:00 */
  assert.deepEqual(dayWindows(day('day', ['06:00', '18:00']), null), [{ lo: 1140, hiEnd: 1320, kind: 'after' }]);
  /* Späte Tagschicht 10–22: davor wie Spät (Ende 90 Minuten vor Beginn), danach bleibt nichts */
  assert.deepEqual(dayWindows(day('day', ['10:00', '22:00']), null), [{ lo: 360, hiEnd: 510, kind: 'before' }]);
  /* Tagschicht 09–17: beides möglich */
  assert.deepEqual(dayWindows(day('day', ['09:00', '17:00']), null).map(w => w.kind), ['before', 'after']);
  /* 24-h-Dienst und Krank: kein Training */
  assert.deepEqual(dayWindows(day('h24', ['07:00', '07:00']), null), []);
  assert.deepEqual(dayWindows(day('sick'), null), []);
  /* Am Tag nach dem 24-h-Dienst frühestens 8 Stunden nach Dienstende */
  assert.deepEqual(dayWindows(day('off'), day('h24', ['07:00', '07:00'])), [{ lo: 900, hiEnd: 1320, kind: null }]);
  assert.deepEqual(dayWindows(day('off'), day('h24', ['08:30', '08:30'])), [{ lo: 990, hiEnd: 1320, kind: null }]);
  /* Dispo wie frei; Nacht 12 h (18–06) nach einer Nacht: 14:00 bis 15:00 */
  assert.deepEqual(dayWindows(day('dispo'), null), [{ lo: 360, hiEnd: 1320, kind: null }]);
  assert.deepEqual(dayWindows(day('night', ['18:00', '06:00']), day('night', ['18:00', '06:00'])), [{ lo: 840, hiEnd: 900, kind: 'before' }]);
  /* Rangfolge (P4): frei vor Dispo vor Spät vor Früh und Tag vor Nacht */
  assert.ok(CAT_RANK.off < CAT_RANK.dispo && CAT_RANK.dispo < CAT_RANK.late && CAT_RANK.late < CAT_RANK.early
    && CAT_RANK.early === CAT_RANK.day && CAT_RANK.day < CAT_RANK.night);
});

test('12 h Tag, Nacht, 2 frei: die freien Tage, nach der Nacht ab 14 Uhr', () => {
  /* P4 und P5: zwei freie Tage in Folge statt Training nach der Tagschicht */
  const r = planTrainings(withTimes(state({ pattern: templateById('h12').days }), { T: ['06:00', '18:00'], N: ['18:00', '06:00'] }), '2026-10-05', 7);
  assert.deepEqual(full(r), [
    '10-07 - 14:00–15:15 frei, nach der Nachtschicht ausgeschlafen',
    '10-08 - 11:00–12:05 frei',
    '10-11 - 14:00–15:20 frei, nach der Nachtschicht ausgeschlafen',
  ]);
  assert.equal(r.trainings[0].shiftCat, 'off');
  /* Nach der Tagschicht, wenn freie Tage fehlen; vor der nächsten Tagschicht um 06:00 Ende bis 18:30 (P1) */
  const t = planTrainings(withTimes(state({ pattern: 'TTTTTTT', perWeek: 1 }), { T: ['06:00', '16:00'] }), '2026-10-05', 7);
  assert.deepEqual(full(t), ['10-05 T 17:00–18:15 nach der Tagschicht']);
});

test('12 h 2 Tag, 2 Nacht: Nacht bis 07:00, danach frühestens 15 Uhr', () => {
  const s = withTimes(state({ pattern: templateById('h12b').days }), { T: ['07:00', '19:00'], N: ['19:00', '07:00'] });
  const r = planTrainings(s, '2026-10-05', 14);
  /* P1: vor der zweiten Tagschicht (Beginn 07:00) endet ein Training bis 19:30, nach der ersten passt keins mehr.
     P2: nach der Nacht bis 07:00 frühestens 15:00; zwischen zwei Nächten bleibt bis 16:00 zu wenig Zeit. */
  assert.deepEqual(full(r), [
    '10-06 T 20:00–21:15 nach der Tagschicht',
    '10-09 - 15:00–16:05 frei, nach der Nachtschicht ausgeschlafen',
    '10-11 - 11:00–12:20 frei',
    '10-12 - 11:00–12:15 frei',
    '10-17 - 15:00–16:05 frei, nach der Nachtschicht ausgeschlafen',
    '10-18 - 11:00–12:20 frei',
  ]);
  assert.ok(!r.trainings.some(t => t.shift === 'N'));
});

test('Späte Tagschicht: Training davor wie vor der Spätschicht', () => {
  const r = planTrainings(withTimes(state({ pattern: 'TTTTTTT' }), { T: ['10:00', '22:00'] }), '2026-10-05', 7);
  assert.deepEqual(full(r), [
    '10-05 T 07:15–08:30 vor der Tagschicht',
    '10-07 T 07:15–08:20 vor der Tagschicht',
    '10-09 T 07:00–08:20 vor der Tagschicht',
  ]);
});

test('24-h-Dienst: am Diensttag nie, am Folgetag frühestens 8 Stunden nach Dienstende', () => {
  const r = planTrainings(state({ pattern: 'X-' }), '2026-10-05', 7);
  assert.deepEqual(full(r), [
    '10-06 - 15:00–16:15 frei, nach dem 24-h-Dienst ausgeschlafen',
    '10-08 - 15:00–16:05 frei, nach dem 24-h-Dienst ausgeschlafen',
    '10-10 - 15:00–16:20 frei, nach dem 24-h-Dienst ausgeschlafen',
  ]);
  /* Feuerwehr 24/48 und Bremer Modell über drei Wochen: nie an einem Diensttag */
  ['fw24', 'fwb'].forEach(id => {
    const s = state({ pattern: templateById(id).days });
    const p = planTrainings(s, '2026-10-05', 21);
    assert.ok(p.trainings.length >= 6, id);
    p.trainings.forEach(t => assert.notEqual(t.shift, 'X', `${id} ${t.date}`));
  });
  /* Dienstbeginn 08:00: am Folgetag ab 16:00 */
  const late = planTrainings(withTimes(state({ pattern: 'X-' }), { X: ['08:00', '08:00'] }), '2026-10-05', 7);
  assert.equal(late.trainings[0].time, '16:00');
});

test('Krank: kein Training; Urlaub und frei wie bisher', () => {
  const s = state({ pattern: FREE });
  s.shifts.overrides = { '2026-10-05': 'K', '2026-10-06': 'K' };
  const r = planTrainings(s, '2026-10-05', 7);
  assert.ok(r.trainings.every(t => t.date >= '2026-10-07'));
  assert.deepEqual(r.trainings.map(t => t.date.slice(5)), ['10-07', '10-09', '10-11']);
});

test('Dispo zählt wie frei, kommt aber nach frei und vor Früh dran', () => {
  const free = planTrainings(state({ pattern: 'D-D-D-D', perWeek: 2 }), '2026-10-05', 7);
  assert.deepEqual(full(free), ['10-06 - 11:00–12:15 frei', '10-08 - 11:00–12:05 frei']);
  const early = planTrainings(state({ pattern: 'DFDFDFD', perWeek: 2 }), '2026-10-05', 7);
  assert.deepEqual(full(early), ['10-05 D 11:00–12:15 Dispo', '10-07 D 11:00–12:05 Dispo']);
});

test('Eigene Schichtart: Kategorie und eigene Zeiten zählen, die Begründung nennt den Namen', () => {
  const s = state({ pattern: ['c1', 'c1', 'c1', 'c1', 'c1', '-', '-'], prefer: { F: '13:00' } });
  s.shifts.types.push({ id: 'c1', short: 'Z', name: 'Zwischendienst', cat: 'early', color: 'teal' });
  s.shifts.times.c1 = ['07:30', '12:30'];
  const r = planTrainings(s, '2026-10-05', 3);
  assert.deepEqual(full(r)[0], '10-05 c1 13:30–14:45 nach der Schicht „Zwischendienst“');
});

test('Einzeltag mit eigener Uhrzeit verschiebt das Fenster nur an diesem Tag', () => {
  const s = state({ pattern: 'FFFFFFF', prefer: { F: '13:00' } });
  s.shifts.overrides = setOverride(s.shifts, '2026-10-05', 'F', ['05:00', '12:00']);
  const r = planTrainings(s, '2026-10-05', 7);
  assert.deepEqual(r.trainings.map(t => `${t.date.slice(5)} ${t.time}`), ['10-05 13:00', '10-07 15:00', '10-09 15:00']);
});

test('Alle Vorlagen lassen sich planen, ohne Training im Dienst', () => {
  ['w2', 'w3v', 'w3v-so', 'w3r', 'k4', 't28', 'k4w', 'k5', 'k5d', 'h12', 'h12-3', 'h12b', 'fw24', 'fwb', 'dn', 'dn-so'].forEach(id => {
    const t = templateById(id);
    const s = withTimes(state({ pattern: t.days }), t.times);
    const r = planTrainings(s, '2026-10-05', 28);
    assert.ok(r.trainings.length >= 6, `${id}: ${r.trainings.length}`);
    r.trainings.forEach(x => {
      const times = s.shifts.times[x.shift];
      if (!times) return;
      /* Training und Schicht überschneiden sich nicht (Schichten über Mitternacht bis Tagesende gerechnet) */
      const [a, b] = [toMin(times[0]), toMin(times[1]) > toMin(times[0]) ? toMin(times[1]) : 1440];
      assert.ok(toMin(x.end) <= a || toMin(x.time) >= b, `${id} ${x.date} ${x.shift} ${x.time}`);
    });
  });
});

/* ---------- Planer-Regeln P1 bis P9 ---------- */
import { earlySleepAt, sleepAt, shortRest, dayRank, PLAN_RULES } from '../js/domain/shift-plan.js';
import { findKnowledge } from '../js/data/knowledge.js';

const hintIds = t => (t.hints || []).map(h => h.id);
const hint = (t, id) => (t.hints || []).find(h => h.id === id);
const first = (opts, days = 7, from = '2026-10-05') => planTrainings(state(opts), from, days).trainings[0];

test('P1: vor einer frühen Schicht endet das Training 3 Stunden vor der Schlafenszeit (Beginn minus 8,5 Stunden)', () => {
  const T = defaultShifts().times;
  assert.equal(PLAN_RULES.earlySleepLead, 510);
  assert.equal(PLAN_RULES.beforeSleep, 180);
  /* Früh 06:00 am Folgetag: Schlafen 21:30, Ende 18:30 */
  assert.equal(earlySleepAt(day('early', ['06:00', '14:00'])), 1440 + 360 - 510);
  assert.deepEqual(dayWindow('F', 'F', T, undefined, 'F'), { lo: 900, hiEnd: 1110 });
  assert.deepEqual(dayWindow('-', '-', T, undefined, 'F'), { lo: 360, hiEnd: 1110 });
  /* Frühschicht 05:00: Ende 17:30; 07:00: Ende 19:30 */
  assert.deepEqual(dayWindow('-', '-', { ...T, F: ['05:00', '13:00'] }, undefined, 'F'), { lo: 360, hiEnd: 1050 });
  assert.deepEqual(dayWindow('-', '-', { ...T, F: ['07:00', '15:00'] }, undefined, 'F'), { lo: 360, hiEnd: 1170 });
  /* Tagschicht vor 09:00 zählt als früh, ab 09:00 nicht; Spät und Nacht am Folgetag nie */
  assert.deepEqual(dayWindow('-', '-', { ...T, T: ['08:00', '20:00'] }, undefined, 'T'), { lo: 360, hiEnd: 1230 });
  assert.deepEqual(dayWindow('-', '-', { ...T, T: ['09:00', '21:00'] }, undefined, 'T'), { lo: 360, hiEnd: 1320 });
  assert.deepEqual(dayWindow('-', '-', T, undefined, 'S'), { lo: 360, hiEnd: 1320 });
  assert.deepEqual(dayWindow('-', '-', T, undefined, 'N'), { lo: 360, hiEnd: 1320 });
  /* Dispo und 24-h-Dienst: Dispo hat in der App keine Uhrzeit, der 24-h-Dienst zählt nicht als frühe Schicht */
  assert.equal(earlySleepAt(day('dispo')), null);
  assert.equal(earlySleepAt(day('h24', ['07:00', '07:00'])), null);
  assert.equal(earlySleepAt(null), null);
});

test('P1 im Plan: Wunschzeit 18:00 vor einer Frühschicht rückt nach vorn, mit Hinweis und Wissen-Karte', () => {
  const t = first({ pattern: 'FFFFFFF', perWeek: 1, prefer: { F: '18:00' } });
  assert.deepEqual([t.time, t.end], ['17:15', '18:30']);
  const h = hint(t, 'earlySleep');
  assert.equal(h.text, 'Ende bis 18:30, damit vor dem frühen Schichtbeginn genug Schlaf bleibt.');
  assert.deepEqual([h.short, h.card], ['Ende bis 18:30', 'nach-fruehschicht-fertig']);
  /* Frühschicht 05:00 und 07:00 */
  const s5 = withTimes(state({ pattern: 'FFFFFFF', perWeek: 1, prefer: { F: '18:00' } }), { F: ['05:00', '13:00'] });
  const t5 = planTrainings(s5, '2026-10-05', 7).trainings[0];
  assert.deepEqual([t5.time, t5.end, hint(t5, 'earlySleep').short], ['16:15', '17:30', 'Ende bis 17:30']);
  const s7 = withTimes(state({ pattern: 'FFFFFFF', perWeek: 1, prefer: { F: '18:00' } }), { F: ['07:00', '15:00'] });
  const t7 = planTrainings(s7, '2026-10-05', 7).trainings[0];
  assert.deepEqual([t7.time, t7.end], ['18:00', '19:15']);
  assert.ok(!hint(t7, 'earlySleep'), 'passt ohne Verschieben, also kein Hinweis');
  /* Passt die Wunschzeit, gibt es keinen Hinweis */
  assert.ok(!hint(first({ pattern: 'FFFFFFF', perWeek: 1 }), 'earlySleep'));
});

test('P2: nach einer Nachtschicht frühestens 8 Stunden nach Schichtende, auch 12 h und 24 h', () => {
  assert.equal(PLAN_RULES.afterNight, 480);
  const off = day('off');
  assert.deepEqual(dayWindows(off, day('night', ['22:00', '06:00'])), [{ lo: 840, hiEnd: 1200, kind: null }]);
  assert.deepEqual(dayWindows(off, day('night', ['18:00', '06:00'])), [{ lo: 840, hiEnd: 1200, kind: null }]);
  assert.deepEqual(dayWindows(off, day('night', ['19:00', '07:00'])), [{ lo: 900, hiEnd: 1200, kind: null }]);
  assert.deepEqual(dayWindows(off, day('night', ['20:00', '08:00'])), [{ lo: 960, hiEnd: 1200, kind: null }]);
  /* 24-h-Dienst wie bisher; ohne Abend-Grenze, die gilt nur nach Nachtschichten */
  assert.deepEqual(dayWindows(off, day('h24', ['07:00', '07:00'])), [{ lo: 900, hiEnd: 1320, kind: null }]);
  /* Im Plan: Nacht bis 07:00, Wunschzeit 11:00, Beginn 15:00 mit Hinweis */
  const s = withTimes(state({ pattern: 'N-', perWeek: 1 }), { N: ['19:00', '07:00'] });
  const t = planTrainings(s, '2026-10-05', 7).trainings[0];
  assert.deepEqual([t.date, t.time, t.reason], ['2026-10-06', '15:00', 'frei, nach der Nachtschicht ausgeschlafen']);
  assert.equal(hint(t, 'afterNight').text, 'Frühestens 8 Stunden nach Ende der Nachtschicht, erst schlafen.');
  assert.equal(hint(t, 'afterNight').card, 'nach-nachtschicht-schlafen');
  const x = planTrainings(state({ pattern: 'X-', perWeek: 1 }), '2026-10-05', 7).trainings[0];
  assert.deepEqual([x.time, hint(x, 'after24').card], ['15:00', 'nach-nachtschicht-schlafen']);
});

test('P3: am Tag nach der letzten Nachtschicht Ende bis 20:00, zwischen zwei Nächten nicht', () => {
  const T = defaultShifts().times;
  assert.deepEqual(dayWindow('-', 'N', T), { lo: 840, hiEnd: 1200 });
  assert.deepEqual(dayWindow('U', 'N', T), { lo: 840, hiEnd: 1200 });
  assert.deepEqual(dayWindow('N', 'N', T), { lo: 840, hiEnd: 1140 });
  /* Mit Frühschicht am Folgetag gilt die frühere Grenze (P1) */
  assert.deepEqual(dayWindow('-', 'N', T, undefined, 'F'), { lo: 840, hiEnd: 1110 });
  const t = first({ pattern: 'N-NNNNN', perWeek: 1, prefer: { '-': '19:30' } });
  assert.deepEqual([t.date, t.time, t.end], ['2026-10-06', '18:45', '20:00']);
  assert.deepEqual([hint(t, 'lastNight').short, hint(t, 'lastNight').card], ['Ende bis 20:00', 'nach-nachtschicht-schlafen']);
});

test('P4: Rang je Tag, Spät vor Früh, Abschläge für kurze Ruhe und für Tage zwischen zwei Nächten', () => {
  const F = day('early', ['06:00', '14:00']);
  const S = day('late', ['14:00', '22:00']);
  const N = day('night', ['22:00', '06:00']);
  const off = day('off');
  assert.equal(dayRank(off, N, F), 0);
  assert.equal(dayRank(day('dispo')), 0.5);
  assert.equal(dayRank(S, S, S), 1);
  assert.equal(dayRank(F, F, F), 2);
  assert.equal(dayRank(N, off, off), 3);
  assert.equal(dayRank(N, N, off), 4);                       // zwischen zwei Nächten
  assert.equal(dayRank(S, off, F), 2);                       // Spät, dann Früh: 8 Stunden Ruhe
  assert.equal(dayRank(F, S, off), 3);                       // Früh nach Spät
  assert.equal(dayRank(N, off, S), 4);                       // Nacht bis 06:00, Spät ab 14:00
  assert.equal(shortRest(day('day', ['06:00', '18:00']), null, day('night', ['18:00', '06:00'])), false);   // 24 Stunden
  assert.equal(shortRest(day('night', ['18:00', '06:00']), null, day('day', ['06:00', '18:00'])), true);    // keine Pause
  assert.equal(shortRest(off, S, F), false);                 // nur Tage mit eigener Schicht
  /* Im Plan: bei einem Training pro Woche die Spätschicht statt Früh */
  assert.equal(first({ pattern: 'FFFSSFF', perWeek: 1 }).date, '2026-10-08');
  /* Spät vor einer Frühschicht (Montag) hat Abschlag, der Mittwoch nicht */
  assert.equal(first({ pattern: 'SFSSSSS', perWeek: 1 }).date, '2026-10-07');
  /* Zwischen zwei Nächten nur, wenn nichts anderes geht: Montag (Spät nach der Nacht) hat kein Fenster,
     Dienstag ist die erste Nacht der Folge, die Tage danach liegen zwischen zwei Nächten */
  assert.equal(first({ pattern: 'NNNNNNN', perWeek: 1 }).date, '2026-10-05');
  assert.equal(first({ pattern: 'SNNNNNN', perWeek: 1 }).date, '2026-10-06');
});

test('P5: Wochenziel 5 mit Push/Pull/Legs, nie zwei Tage in Folge mit gleichen Hauptmuskeln', () => {
  const s = state({ pattern: FREE, perWeek: 5 });
  const r = planTrainings(s, '2026-10-05', 28);
  r.weeks.forEach(w => assert.deepEqual([w.planned, w.short], [5, false], w.monday));
  r.trainings.slice(1).forEach((t, i) => {
    const prev = r.trainings[i];
    if (dayNum(t.date) - dayNum(prev.date) !== 1) return;
    assert.ok(!mainOverlap(s, prev.dayId, t.dayId), `${prev.name} → ${t.name} am ${t.date}`);
    /* Pull trainiert die Schultern mit (Face Pulls), Push braucht sie: 48-Stunden-Regel */
    assert.ok(!(prev.dayId === 'pull' && t.dayId === 'push'), t.date);
  });
  /* 48 Stunden je Muskel bleiben */
  const ends = {};
  r.trainings.forEach(t => {
    const d = s.plans[0].days[t.dayId];
    const main = dayProfile(d, n => findExercise(n, [])).main;
    const start = localMs(t.date, toMin(t.time));
    main.forEach(m => assert.ok(!ends[m] || start - ends[m] >= 48 * H, `${t.name} ${t.date} ${m}`));
    d.exercises.forEach(ex => ((findExercise(ex.names[0], []) || {}).muscles?.primary || []).forEach(m => { ends[m] = localMs(t.date, toMin(t.end)); }));
  });
  /* Bei Ziel 3 bleibt zwischen den Trainings weiter ein Ruhetag, wenn es ohne Abschlag geht */
  assert.deepEqual(planTrainings(state({ pattern: FREE }), '2026-10-05', 7).trainings.map(t => t.date.slice(5)), ['10-05', '10-07', '10-09']);
});

test('P5: Wochenziel 5 mit Oberkörper/Unterkörper; Ganzkörper bleibt bei einem Ruhetag', () => {
  const s = withPlan(state({ pattern: FREE, perWeek: 5 }), 'upperlower4');
  const r = planTrainings(s, '2026-10-05', 28);
  r.weeks.forEach(w => assert.equal(w.planned, 5, w.monday));
  r.trainings.slice(1).forEach((t, i) => {
    if (dayNum(t.date) - dayNum(r.trainings[i].date) === 1) assert.ok(!mainOverlap(s, r.trainings[i].dayId, t.dayId), t.date);
  });
  const fb = planTrainings(withPlan(state({ pattern: FREE, perWeek: 5 }), 'fullbody2'), '2026-10-05', 14);
  assert.deepEqual(fb.weeks.map(w => [w.planned, w.short]), [[4, true], [3, true]]);
  fb.trainings.slice(1).forEach((t, i) => assert.ok(dayNum(t.date) - dayNum(fb.trainings[i].date) >= 2, t.date));
});

test('P5: Training von gestern zählt mit, ohne bekannte Muskeln bleibt ein Ruhetag', () => {
  /* Gestern Pull: heute kein Push (Schultern), aber Legs */
  const s = state({ pattern: FREE, perWeek: 5, order: ['pull', 'push', 'legs'], sessions: [['pull', '2026-10-06', '10:00']] });
  const t = planTrainings(s, '2026-10-07', 7).trainings[0];
  assert.deepEqual([t.date, t.name], ['2026-10-07', 'Legs']);
  assert.equal(t.note, 'Push braucht noch Pause, darum zuerst Legs.');
  /* Plan ohne Übungen: Muskeln unbekannt, also nie zwei Tage in Folge */
  const e = state({ pattern: FREE, perWeek: 5 });
  Object.values(e.plans[0].days).forEach(d => { d.exercises = []; });
  const r = planTrainings(e, '2026-10-05', 14);
  r.trainings.slice(1).forEach((x, i) => assert.ok(dayNum(x.date) - dayNum(r.trainings[i].date) >= 2, x.date));
});

test('P7: leichtere Einheit ab der zweiten Nacht einer Folge und an Tagen mit kurzer Ruhe', () => {
  const night = first({ pattern: 'NNNNNNN', perWeek: 1 });
  assert.equal(night.light, true);
  const h = hint(night, 'light');
  assert.equal(h.text, 'Leichter trainieren: je Übung ein Satz weniger, 2–3 Wiederholungen Reserve.');
  assert.deepEqual([h.short, h.card], ['leichter', 'kurze-nacht-leichter']);
  /* Vor der ersten Nacht einer Folge ist man ausgeschlafen: kein Hinweis (die Tage danach krank, damit die App den Montag nimmt) */
  const firstNight = first({ pattern: 'NKKKKKK', perWeek: 1 });
  assert.deepEqual([firstNight.date, firstNight.light, hintIds(firstNight).includes('light')], ['2026-10-05', false, false]);
  /* Zweite Nacht einer Folge leichter, die erste der nächsten Folge nicht */
  const two = planTrainings(state({ pattern: 'NNKKKKK', perWeek: 2, start: '2026-10-04' }), '2026-10-05', 7).trainings;
  assert.deepEqual(two.map(t => [t.date, t.shift, t.light]), [['2026-10-05', 'N', true], ['2026-10-11', 'N', false]]);
  /* Erste Nacht, am Morgen danach um 14:00 schon die Spätschicht: kurze Ruhe bleibt Grund */
  const quick = first({ pattern: 'NSKKKKK', perWeek: 1 });
  assert.deepEqual([quick.date, quick.shift, quick.light, hintIds(quick).includes('light')], ['2026-10-05', 'N', true, true]);
  /* Spät vor einer Frühschicht: kurze Ruhe */
  const sf = first({ pattern: 'SF', perWeek: 1 });
  assert.deepEqual([sf.shift, sf.light, hintIds(sf).includes('light')], ['S', true, true]);
  /* Frei, Früh nach Früh, Spät nach Spät: normal */
  assert.equal(first({ pattern: FREE }).light, false);
  assert.equal(first({ pattern: 'FFFFFFF' }).light, false);
  assert.equal(first({ pattern: 'SSSSSSS' }).light, false);
});

test('P8: Booster mit Koffein weglassen, wenn das Training weniger als 8 Stunden vor dem Schlafen endet', () => {
  /* Schlafenszeit: vor Frühschicht wie P1, nach einer Schicht bis nach 23:00 deren Ende, sonst 23:00 */
  assert.equal(sleepAt(day('off'), day('early', ['06:00', '14:00'])), 1290);
  assert.equal(sleepAt(day('off'), day('late', ['14:00', '22:00'])), 1380);
  assert.equal(sleepAt(day('night', ['22:00', '06:00']), day('night', ['22:00', '06:00'])), 1800);
  /* Vor einer frühen Schicht, aber die Schicht von heute endet später: deren Ende */
  assert.equal(sleepAt(day('late', ['14:00', '22:00']), day('early', ['06:00', '14:00'])), 1320);
  assert.equal(sleepAt(day('late', ['16:00', '00:00']), day('early', ['06:00', '14:00'])), 1440);
  assert.equal(sleepAt(day('early', ['06:00', '14:00']), day('early', ['06:00', '14:00'])), 1290);
  /* Früh vor Früh: 15:30–16:45, Schlafen 21:30 */
  const f = first({ pattern: 'FFFFFFF', perWeek: 1 });
  const c = hint(f, 'caffeine');
  assert.equal(c.text, 'Koffeinhaltigen Booster vor dem Training weglassen, bis zum Schlafen bleiben weniger als 8 Stunden.');
  assert.deepEqual([c.short, c.card], ['ohne Booster', 'koffein-wirkdauer']);
  /* Frei 11:00–12:15, Schlafen 23:00: kein Hinweis; nach der Nacht 14:00–15:15: Hinweis */
  assert.ok(!hint(first({ pattern: FREE }), 'caffeine'));
  assert.ok(hint(first({ pattern: 'N-NNNNN', perWeek: 1 }), 'caffeine'));
  /* 15:00 Ende bei Schlafen 23:00 sind genau 8 Stunden: kein Hinweis */
  const edge = first({ pattern: FREE, perWeek: 1, prefer: { '-': '13:45' } });
  assert.deepEqual([edge.end, !!hint(edge, 'caffeine')], ['15:00', false]);
  /* Vor der Nachtschicht: geschlafen wird erst nach der Schicht */
  assert.ok(!hint(first({ pattern: 'NNNNNNN', perWeek: 1 }), 'caffeine'));
});

test('P9: „nach dem Ausschlafen“ vor der Nachtschicht nur, wenn der Vortag auch eine Nacht war', () => {
  assert.equal(reasonFor('N', 'N'), 'vor der Nachtschicht, nach dem Ausschlafen');
  assert.equal(reasonFor('N', 'S'), 'vor der Nachtschicht');
  assert.equal(reasonFor('N', '-'), 'vor der Nachtschicht');
  assert.equal(reasonFor('N', null), 'vor der Nachtschicht');
  const types = [...defaultShifts().types, { id: 'c1', short: 'L', name: 'Lange Nacht', cat: 'night', color: 'violet' }];
  assert.equal(reasonFor('c1', 'c1', types), 'vor der Schicht „Lange Nacht“, nach dem Ausschlafen');
  assert.equal(reasonFor('c1', '-', types), 'vor der Schicht „Lange Nacht“');
  assert.equal(first({ pattern: 'NKKKKKK', perWeek: 1 }).reason, 'vor der Nachtschicht');
  assert.equal(first({ pattern: 'NNNNNNN', perWeek: 1 }).reason, 'vor der Nachtschicht, nach dem Ausschlafen');
});

test('Jeder Hinweis verweist auf eine vorhandene Wissen-Karte', () => {
  const plans = [
    ['FFFFFFF', { F: '18:00' }], ['N-NNNNN', { '-': '19:30' }], ['N-', null], ['X-', null], ['NNNNNNN', { N: '20:00' }], ['SF', null],
  ].map(([pattern, prefer]) => planTrainings(state({ pattern, prefer, perWeek: 4 }), '2026-10-05', 14));
  const ids = new Set();
  plans.forEach(r => r.trainings.forEach(t => t.hints.forEach(h => {
    ids.add(h.id);
    assert.ok(findKnowledge(h.card), `${h.id}: ${h.card}`);
    assert.ok(h.text && h.short, h.id);
  })));
  assert.deepEqual([...ids].sort(), ['afterNight', 'after24', 'beforeNight', 'caffeine', 'earlySleep', 'lastNight', 'light'].sort());
});

test('P8: ohne Vorgabe aus dem Schichtplan kein Koffein-Hinweis, auch nicht am Nachmittag', () => {
  /* Frühschicht, am Folgetag Spätschicht: Training 15:30–16:45, Schlafenszeit nur geschätzt */
  const all = planTrainings(state({ pattern: 'FS', perWeek: 7 }), '2026-10-05', 14).trainings;
  const f = all.find(t => t.shift === 'F' && t.time === '15:30');
  assert.ok(f, 'ein Training an einem Frühschicht-Tag');
  assert.ok(f.end > '16:00' && !hint(f, 'caffeine'));
});
