/* Trainingsplanung um die Schichten. Reine Funktion, Tage als 'YYYY-MM-DD' in Ortszeit.

   Regeln:
   1. Ohne Schichtplan (Muster oder Import) plant die App nichts.
   2. Ziel pro Kalenderwoche (Mo–So) sind profile.daysPerWeek Trainings. Einheiten der Woche, die schon im Verlauf
      stehen (bis einschließlich zum Starttag), zählen mit.
   3. Zwischen zwei Trainingstagen liegt mindestens ein Kalendertag ohne Training, auch über die Wochengrenze
      und zum letzten echten Training. Darum passen höchstens 4 Trainings in eine Woche.
   4. Einheiten laufen in der Reihenfolge des Plans ab der nächsten fälligen (nextDay). Hat ein Hauptmuskel der Einheit
      zum geplanten Beginn noch keine 48 Stunden Pause (gleiche Regel wie der Tagesvorschlag), rückt die Uhrzeit
      innerhalb des erlaubten Fensters nach hinten. Reicht das nicht, kommt die nächste Einheit der Reihenfolge dran;
      die übersprungene bleibt vorn. Passt keine Einheit, fällt der Tag aus.
   5. Uhrzeit: die bevorzugte Zeit der Tagart, geschoben in das erlaubte Fenster:
      Früh frühestens 60 Minuten nach Schichtende; Spät mit Ende mindestens 90 Minuten vor Schichtbeginn;
      Nacht mit Ende mindestens 3 Stunden vor Schichtbeginn; am Tag nach einer Nachtschicht nicht vor 14:00;
      immer zwischen 06:00 und 22:00, auf Viertelstunden.
      Dauer wie auf der Trainingsseite geschätzt (je Satz Pause plus 45 Sekunden, dazu 10 Minuten),
      auf 5 Minuten aufgerundet; ein Tag ohne Übungen zählt 75 Minuten.
   6. Tagwahl je Woche: zuerst möglichst viele Trainings bis zum Ziel, dann die Vorlieben
      frei und Urlaub > Früh > Spät > Nacht (Summe der Ränge), dann möglichst nah an den Wunschzeiten,
      dann früher in der Woche. Tage ohne Schichtangabe zählen wie frei.
   Der Plan hängt vom Datum ab. Nur für den ersten Tag zählt mit opts.nowMin auch die Uhrzeit:
   Vorgeschlagen wird dort kein Beginn, der schon vorbei ist (#44). */
import { REST_HOURS, dayProfile, lastTrained } from './today-plan.js';
import { nextDay } from './progression.js';
import { findExercise } from './library.js';
import { ymd } from '../util.js';
import { hasShiftPlan, shiftOn, addDays, dayNum, mondayOf, toMin, fromMin, localMs } from './shifts.js';

export const PLAN_RULES = {
  restDays: 1,
  restHours: REST_HOURS,
  afterEarly: 60,
  beforeLate: 90,
  beforeNight: 180,
  afterNight: '14:00',
  dayStart: '06:00',
  dayEnd: '22:00',
  step: 15,
  defaultMinutes: 75,
};
/* Höchstens so viele Trainings passen mit einem Ruhetag dazwischen in eine Woche */
export const MAX_PER_WEEK = Math.ceil(7 / (PLAN_RULES.restDays + 1));
export const DAY_RANK = { '-': 0, U: 0, F: 1, S: 2, N: 3 };
const H = 36e5;

/* Dauer einer Einheit in Minuten, wie dayFacts auf der Trainingsseite, auf 5 Minuten aufgerundet */
export function sessionMinutes(day) {
  const ex = (day && day.exercises) || [];
  if (!ex.length) return PLAN_RULES.defaultMinutes;
  const min = Math.round(ex.reduce((a, e) => a + (e.sets || 0) * ((e.rest || 0) + 45), 0) / 60 + 10);
  return Math.ceil(min / 5) * 5;
}

/* Erlaubtes Fenster eines Tages: frühester Beginn lo und spätestes Ende hiEnd in Minuten, oder null */
export function dayWindow(code, prevCode, times) {
  const R = PLAN_RULES;
  let lo = toMin(R.dayStart);
  let hiEnd = toMin(R.dayEnd);
  if (prevCode === 'N') lo = Math.max(lo, toMin(R.afterNight));
  if (code === 'F') lo = Math.max(lo, toMin(times.F[1]) + R.afterEarly);
  if (code === 'S') hiEnd = Math.min(hiEnd, toMin(times.S[0]) - R.beforeLate);
  if (code === 'N') hiEnd = Math.min(hiEnd, toMin(times.N[0]) - R.beforeNight);
  lo = Math.ceil(lo / R.step) * R.step;
  return hiEnd > lo ? { lo, hiEnd } : null;
}

/* Kurze Begründung je Tagart */
export function reasonFor(code, prevCode) {
  if (code === 'F') return 'nach der Frühschicht';
  if (code === 'S') return 'vor der Spätschicht';
  if (code === 'N') return 'vor der Nachtschicht, nach dem Ausschlafen';
  const base = code === 'U' ? 'Urlaub' : code === '-' ? 'frei' : 'keine Schicht eingetragen';
  return prevCode === 'N' ? `${base}, nach der Nachtschicht ausgeschlafen` : base;
}

const preferFor = (sh, code) => (sh.prefer && sh.prefer[code in { F: 1, S: 1, N: 1 } ? code : '-']) || '11:00';

/* Eine Einheit auf einen Tag legen: erste Einheit der Warteschlange, deren Hauptmuskeln zum Beginn 48 Stunden Pause haben */
function assign(c, queue, last, ctx) {
  const R = PLAN_RULES;
  for (let i = 0; i < queue.length; i++) {
    const u = ctx.units[queue[i]];
    const hi = Math.floor((c.win.hiEnd - u.minutes) / R.step) * R.step;
    if (hi < c.win.lo) continue;
    const want = Math.min(Math.max(Math.round(c.pref / R.step) * R.step, c.win.lo), hi);
    for (let t = want; t <= hi; t += R.step) {
      const start = localMs(c.date, t);
      if (u.main.every(m => !last[m] || start - last[m] >= R.restHours * H)) {
        return { i, u, t, want, end: localMs(c.date, t + u.minutes) };
      }
    }
  }
  return null;
}

function simulate(picks, ctx, state) {
  let queue = [...state.queue];
  const last = { ...state.last };
  const items = [];
  let dev = 0;
  for (const c of picks) {
    const a = assign(c, queue, last, ctx);
    if (!a) return null;
    const skipped = a.i > 0 ? ctx.units[queue[0]] : null;
    queue = [...queue.slice(0, a.i), ...queue.slice(a.i + 1), queue[a.i]];
    a.u.primary.forEach(m => { last[m] = a.end; });
    dev += Math.abs(a.t - c.pref);
    let note = null;
    if (skipped) note = `${skipped.name} braucht noch Pause, darum zuerst ${a.u.name}.`;
    else if (a.t > a.want) note = 'Später als sonst, damit die Muskeln 48 Stunden Pause haben.';
    items.push({
      date: c.date,
      time: fromMin(a.t),
      end: fromMin(a.t + a.u.minutes),
      minutes: a.u.minutes,
      dayId: a.u.id,
      name: a.u.name,
      color: a.u.color,
      muscles: a.u.muscles,
      shift: c.code,
      reason: reasonFor(c.code, c.prev),
      note,
    });
  }
  return { items, queue, last, dev };
}

/* Beste Auswahl an Tagen einer Woche. Kandidaten sind nach Datum sortiert; höchstens 7. */
function chooseWeek(cands, need, ctx, state) {
  const R = PLAN_RULES;
  let best = { items: [], queue: state.queue, last: state.last, count: 0, rank: 0, dev: 0, key: '' };
  if (!need || !cands.length) return best;
  const n = cands.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const picks = cands.filter((_, i) => mask & (1 << i));
    if (picks.length > need) continue;
    let ok = true;
    let prev = state.lastDay;
    for (const p of picks) {
      if (prev && dayNum(p.date) - dayNum(prev) <= R.restDays) { ok = false; break; }
      prev = p.date;
    }
    if (!ok) continue;
    const count = picks.length;
    const rank = picks.reduce((a, p) => a + (DAY_RANK[p.code] ?? 0), 0);
    if (count < best.count) continue;
    const sim = simulate(picks, ctx, state);
    if (!sim) continue;
    const key = picks.map(p => p.date).join(',');
    const better = count > best.count
      || (count === best.count && (rank < best.rank
        || (rank === best.rank && (sim.dev < best.dev || (sim.dev === best.dev && key < best.key)))));
    if (better) best = { ...sim, count, rank, key };
  }
  return best;
}

/* Plant die Trainings ab fromYmd für `days` Tage.
   Liefert null ohne Schichtplan, sonst
   { trainings: [{ date, time, end, minutes, dayId, name, color, muscles, shift, reason, note }],
     weeks: [{ monday, target, done, planned, short }], target } */
export function planTrainings(state, fromYmd, days = 14, opts = {}) {
  const sh = state && state.shifts;
  if (!hasShiftPlan(sh)) return null;
  const plans = state.plans || [];
  const plan = plans.find(p => p.id === state.activePlanId) || plans[0];
  if (!plan) return null;
  const resolve = opts.resolve || (name => findExercise(name, state.exercisesCustom || []));
  const target = Math.max(1, Math.min(7, Math.round((state.profile && state.profile.daysPerWeek) || 3)));

  /* Verlauf bis einschließlich zum Starttag; ein laufendes Training zählt mit */
  const all = [...(state.sessions || [])];
  /* Das laufende Training zählt wie ein Verlaufseintrag: Dort steht in x.sets die geplante Satzzahl, die Sätze liegen in x.log (#30) */
  if (state.active && state.active.startedAt) {
    all.push({ ...state.active, ex: (state.active.ex || []).map(x => ({ ...x, sets: (x.log || []).filter(s => s && s.done) })) });
  }
  const past = all.filter(s => s && s.startedAt && ymd(s.startedAt) <= fromYmd);

  /* Einheiten mit Übungen; ohne Übungen eine allgemeine Einheit */
  const units = {};
  plan.order.filter(id => plan.days[id] && (plan.days[id].exercises || []).length).forEach(id => {
    const d = plan.days[id];
    const prof = dayProfile(d, resolve);
    const primary = new Set();
    d.exercises.forEach(ex => {
      const e = resolve(ex.names[0]);
      ((e && e.muscles && e.muscles.primary) || []).forEach(m => primary.add(m));
    });
    units[id] = { id, name: d.name, color: d.color, muscles: d.muscles || '', main: prof.main, primary: [...primary], minutes: sessionMinutes(d) };
  });
  let ids = Object.keys(units);
  if (!ids.length) {
    units._ = { id: null, name: 'Training', color: 'red', muscles: '', main: [], primary: [], minutes: PLAN_RULES.defaultMinutes };
    ids = ['_'];
  }
  const ordered = plan.order.filter(id => units[id]);
  const start = nextDay(plan.order, past, plan.id);
  const at = ordered.indexOf(start);
  const queue = ordered.length ? (at > 0 ? [...ordered.slice(at), ...ordered.slice(0, at)] : ordered) : ['_'];

  const lastDay = past.reduce((a, s) => { const d = ymd(s.startedAt); return !a || d > a ? d : a; }, null);
  let st = { queue, last: lastTrained(past, resolve), lastDay };
  const ctx = { units };

  const endDay = addDays(fromYmd, Math.max(1, days) - 1);
  const trainings = [];
  const weeks = [];
  for (let mon = mondayOf(fromYmd); mon <= endDay; mon = addDays(mon, 7)) {
    const sun = addDays(mon, 6);
    const done = past.filter(s => { const d = ymd(s.startedAt); return d >= mon && d <= sun; }).length;
    const need = Math.max(0, target - done);
    const cands = [];
    for (let d = mon < fromYmd ? fromYmd : mon; d <= sun; d = addDays(d, 1)) {
      if (st.lastDay && dayNum(d) - dayNum(st.lastDay) <= PLAN_RULES.restDays) continue;
      const code = shiftOn(sh, d).code;
      const prev = shiftOn(sh, addDays(d, -1)).code;
      let win = dayWindow(code, prev, sh.times);
      /* Heute nur, was noch möglich ist: Beginn frühestens jetzt, auf den nächsten Schritt gerundet (#44) */
      if (win && d === fromYmd && Number.isFinite(opts.nowMin)) {
        const lo = Math.max(win.lo, Math.ceil(opts.nowMin / PLAN_RULES.step) * PLAN_RULES.step);
        win = win.hiEnd > lo ? { ...win, lo } : null;
      }
      if (win) cands.push({ date: d, code, prev, win, pref: toMin(preferFor(sh, code)) });
    }
    const best = chooseWeek(cands, need, ctx, st);
    trainings.push(...best.items);
    const lastPick = best.items.length ? best.items[best.items.length - 1].date : st.lastDay;
    st = { queue: best.queue, last: best.last, lastDay: lastPick };
    weeks.push({ monday: mon, target, done, planned: best.items.length, short: done + best.items.length < target });
  }
  return {
    trainings: trainings.filter(t => t.date >= fromYmd && t.date <= endDay),
    weeks,
    target,
  };
}
