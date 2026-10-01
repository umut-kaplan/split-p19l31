/* Trainingsplanung um die Schichten. Reine Funktion, Tage als 'YYYY-MM-DD' in Ortszeit.
   Die Regeln P1 bis P9 sind aus Studien zu verwandten Fragen abgeleitet (Recherche vom 30.09.2026);
   direkte Studien zu Krafttraining bei Schichtarbeit gibt es nicht. Alle Werte stehen in PLAN_RULES.

   Regeln:
   1. Ohne Schichtplan (Muster oder Import) plant die App nichts.
   2. Ziel pro Kalenderwoche (Mo–So) sind profile.daysPerWeek Trainings. Einheiten der Woche, die schon im Verlauf
      stehen (bis einschließlich zum Starttag), zählen mit.
   3. Höchstens ein Training pro Tag. Zwei Trainingstage in Folge nur, wenn sich die Hauptmuskeln der beiden Einheiten
      nicht überschneiden (P5), auch über die Wochengrenze und zum letzten echten Training; sonst bleibt ein Ruhetag
      dazwischen. Höchstens 6 Tage in Folge, darum höchstens 6 Trainings pro Woche.
   4. Einheiten laufen in der Reihenfolge des Plans ab der nächsten fälligen (nextDay). Hat ein Hauptmuskel der Einheit
      zum geplanten Beginn noch keine 48 Stunden Pause (gleiche Regel wie der Tagesvorschlag), rückt die Uhrzeit
      innerhalb des erlaubten Fensters nach hinten. Reicht das nicht oder überschneidet sie sich mit der Einheit vom
      Vortag, kommt die nächste Einheit der Reihenfolge dran; die übersprungene bleibt vorn. Passt keine, fällt der Tag aus.
   5. Uhrzeit: die bevorzugte Zeit der Tagart, geschoben in das erlaubte Fenster. Es zählt die Kategorie der Schichtart
      mit den Uhrzeiten dieses Tages:
      Früh frühestens 60 Minuten nach Schichtende; Spät mit Ende mindestens 90 Minuten vor Schichtbeginn;
      Nacht (auch 12 h) mit Ende mindestens 3 Stunden vor Schichtbeginn;
      Tag (12 h) wie Früh nach Schichtende, bei einer späten Tagschicht auch davor wie Spät;
      24-h-Dienst und Krank: kein Training; Urlaub, frei und Dispo ohne Schicht; immer zwischen 06:00 und 22:00,
      auf Viertelstunden.
      P1: Beginnt am Folgetag eine frühe Schicht (Früh, oder Tag vor 09:00), endet das Training 3 Stunden vor der
          geschätzten Schlafenszeit, Schichtbeginn minus 8,5 Stunden. Bei Beginn 06:00 also um 18:30. Dispo hat keine
          Uhrzeiten und zählt darum nie als frühe Schicht.
      P2: Nach einer Nachtschicht und nach einem 24-h-Dienst frühestens 8 Stunden nach Schichtende.
      P3: Am Tag nach der letzten Nachtschicht einer Folge (heute keine Nacht) Ende spätestens 20:00.
      Dauer wie auf der Trainingsseite geschätzt (je Satz Pause plus 45 Sekunden, im Supersatz statt der Pause der
      Wechsel, dazu 10 Minuten; domain/plan-stats.js), auf 5 Minuten aufgerundet; ein Tag ohne Übungen zählt 75 Minuten.
      4.7: Passt keine volle Einheit in die Fenster des Tages, nimmt die App die Kurzversion (die ersten vier Übungen
      mit je zwei Sätzen), zuerst in der Reihenfolge des Plans. Jede Kurzversion zählt bei der Tagwahl wie shortRank
      Ränge mehr, damit ein Tag mit voller Einheit vorgeht.
   6. Tagwahl je Woche (P4): zuerst möglichst viele Trainings bis zum Ziel, dann die kleinste Summe aus den Rängen
      frei und Urlaub 0, Dispo 0,5, Spät 1, Früh und Tag 2, Nacht 3, je 1 dazu für kurze Ruhe (weniger als 11 Stunden
      zwischen der Schicht dieses Tages und der davor oder danach) und für einen Tag zwischen zwei Nachtschichten,
      je 1 für jeden zweiten Tag in Folge; bei Gleichstand weniger Tage in Folge, dann möglichst nah an den
      Wunschzeiten, dann früher in der Woche. Tage ohne Schichtangabe zählen wie frei.
   7. Hinweise am Plan-Eintrag (hints): Kurzversion (4.7); eine Regel, die die Uhrzeit verschoben hat, mit ihrer Wissen-Karte;
      P7 leichtere Einheit ab der zweiten Nachtschicht einer Folge und an Tagen mit kurzer Ruhe (light); vor der ersten
         Nacht ist man meist ausgeschlafen;
      P8 kein koffeinhaltiger Booster, wenn das Training weniger als 8 Stunden vor der geschätzten Schlafenszeit endet.
      Nur, wo der Schichtplan die Schlafenszeit vorgibt: vor einer frühen Schicht (wie P1) und am Tag nach der letzten
      Nacht, wenn der Rhythmus zurück muss. Mit der bloßen Annahme 23:00 stünde der Hinweis an fast jedem Nachmittag.
   8. Begründung (P9): „nach dem Ausschlafen“ vor einer Nachtschicht nur, wenn der Vortag auch eine Nacht war.
   Der Plan hängt vom Datum ab. Nur für den ersten Tag zählt mit opts.nowMin auch die Uhrzeit:
   Vorgeschlagen wird dort kein Beginn, der schon vorbei ist (#44). */
import { REST_HOURS, dayProfile, lastTrained } from './today-plan.js';
import { nextDay } from './progression.js';
import { findExercise } from './library.js';
import { workSets } from './settypes.js';
import { dayMinutes, shortExercises, hasShortVersion, shortText } from './plan-stats.js';
import { ymd } from '../util.js';
import {
  hasShiftPlan, dayShift, addDays, dayNum, mondayOf, toMin, fromMin, localMs, shiftMinutes, DEFAULT_TYPES, DEFAULT_IDS, TYPE_TIMES, isTimedCat,
} from './shifts.js';

export const PLAN_RULES = {
  restHours: REST_HOURS,
  /* P5: höchstens so viele Trainingstage in Folge; jeder zweite Tag in Folge zählt bei der Tagwahl wie ein Rang mehr */
  maxInRow: 6,
  inRowRank: 1,
  afterEarly: 60,
  beforeLate: 90,
  beforeNight: 180,
  /* P2: frühester Beginn nach einer Nachtschicht und nach einem 24-h-Dienst, Minuten nach Schichtende */
  afterNight: 480,
  after24: 480,
  /* P3: Ende am Tag nach der letzten Nachtschicht einer Folge */
  afterLastNight: '20:00',
  /* P1: Schlafenszeit vor einer frühen Schicht = Schichtbeginn minus earlySleepLead, Training endet beforeSleep davor.
     Eine Tagschicht zählt als früh, wenn sie vor earlyStart beginnt. Dispo hat keine Uhrzeiten und zählt nie. */
  earlySleepLead: 510,
  beforeSleep: 180,
  earlyStart: '09:00',
  /* P4 und P7: kurze Ruhe zwischen zwei Schichten; Abschläge bei der Tagwahl */
  shortRestHours: 11,
  shortRestRank: 1,
  betweenNightsRank: 1,
  /* P8: Hinweis auf Koffein, wenn das Training weniger als so viele Stunden vor der Schlafenszeit endet */
  caffeineHours: 8,
  sleepDefault: '23:00',
  dayStart: '06:00',
  dayEnd: '22:00',
  step: 15,
  defaultMinutes: 75,
  /* 4.7: Kurzversion zählt bei der Tagwahl wie so viele Ränge mehr */
  shortRank: 1.5,
};
/* Höchstens so viele Trainings passen in eine Woche, wenn nach maxInRow Tagen in Folge ein Ruhetag kommt */
export const MAX_PER_WEEK = 7 - Math.floor(7 / (PLAN_RULES.maxInRow + 1));
/* Rang je Kategorie bei der Tagwahl (P4), kleiner ist lieber; none steht für einen Tag ohne Angabe */
export const CAT_RANK = { off: 0, vacation: 0, none: 0, dispo: 0.5, late: 1, early: 2, day: 2, night: 3 };
const H = 36e5;

/* Dauer einer Einheit in Minuten, wie dayFacts auf der Trainingsseite (Supersätze ohne Pause dazwischen),
   auf 5 Minuten aufgerundet */
export function sessionMinutes(day) {
  const ex = (day && day.exercises) || [];
  if (!ex.length) return PLAN_RULES.defaultMinutes;
  return Math.ceil(dayMinutes(ex) / 5) * 5;
}
/* Dauer der Kurzversion oder null, wenn sie nicht kürzer ist */
export function shortMinutes(day) {
  const ex = (day && day.exercises) || [];
  return hasShortVersion(ex) ? sessionMinutes({ exercises: shortExercises(ex) }) : null;
}

/* ---------- Schichten eines Tages und seiner Nachbarn ---------- */
/* Tage wie aus dayShift: { cat, times }. Lage der Schicht in Minuten ab Mitternacht ihres Tages, [Beginn, Ende]
   mit Ende nach Beginn, auch über Mitternacht; null ohne Arbeitszeit. */
const span = d => {
  if (!d || !isTimedCat(d.cat) || !d.times) return null;
  const a = toMin(d.times[0]);
  return [a, a + shiftMinutes(d.times)];
};

/* P1: Schlafenszeit vor einer frühen Schicht am Folgetag in Minuten ab heute 00:00, sonst null */
export function earlySleepAt(next) {
  const s = span(next);
  if (!s) return null;
  const early = next.cat === 'early' || (next.cat === 'day' && s[0] < toMin(PLAN_RULES.earlyStart));
  return early ? 1440 + s[0] - PLAN_RULES.earlySleepLead : null;
}

/* P8: geschätzte Schlafenszeit in Minuten ab heute 00:00: vor einer frühen Schicht wie P1, sonst 23:00. Endet die
   Schicht von heute später, deren Ende; vor dem Schichtende schläft niemand, auch nicht vor einer frühen Schicht. */
export function sleepAt(cur, next) {
  const early = earlySleepAt(next);
  const s = span(cur);
  return Math.max(early != null ? early : toMin(PLAN_RULES.sleepDefault), s ? s[1] : 0);
}

/* P4 und P7: weniger als 11 Stunden zwischen der Schicht dieses Tages und der vom Vortag oder vom Folgetag */
export function shortRest(cur, prev, next) {
  const c = span(cur);
  if (!c) return false;
  const p = span(prev);
  const n = span(next);
  const min = PLAN_RULES.shortRestHours * 60;
  return !!((p && c[0] - (p[1] - 1440) < min) || (n && n[0] + 1440 - c[1] < min));
}
const betweenNights = (cur, prev) => !!cur && !!prev && cur.cat === 'night' && prev.cat === 'night';

/* P4: Rang eines Tages bei der Tagwahl, kleiner ist lieber */
export function dayRank(cur, prev = null, next = null) {
  const R = PLAN_RULES;
  return (CAT_RANK[cur ? cur.cat : 'none'] ?? 0)
    + (shortRest(cur, prev, next) ? R.shortRestRank : 0)
    + (betweenNights(cur, prev) ? R.betweenNightsRank : 0);
}

/* Erlaubte Fenster eines Tages mit der Regel, die Beginn (loBy) und Ende (hiBy) begrenzt; null heißt Tagesrahmen */
function windowsOf(cur, prev, next) {
  const R = PLAN_RULES;
  const cat = cur ? cur.cat : null;
  if (cat === 'h24' || cat === 'sick') return [];
  let lo = toMin(R.dayStart);
  let loBy = null;
  let hiEnd = toMin(R.dayEnd);
  let hiBy = null;
  const pc = prev ? prev.cat : null;
  const ps = span(prev);
  /* Ende der Vortagsschicht in Minuten ab heute 00:00; ohne Uhrzeit wie eine Nacht bis 06:00 */
  const prevEnd = ps ? ps[1] - 1440 : 360;
  const raise = (v, by) => { if (v > lo) { lo = v; loBy = by; } };
  const lower = (v, by) => { if (v < hiEnd) { hiEnd = v; hiBy = by; } };
  if (pc === 'night') raise(prevEnd + R.afterNight, 'afterNight');
  if (pc === 'h24' && ps) raise(prevEnd + R.after24, 'after24');
  if (pc === 'night' && cat !== 'night') lower(toMin(R.afterLastNight), 'lastNight');
  const sleep = earlySleepAt(next);
  if (sleep != null) lower(sleep - R.beforeSleep, 'earlySleep');
  const t = span(cur);
  const wins = [];
  const before = (gap, by) => {
    const v = t[0] - gap;
    wins.push(v < hiEnd ? { lo, loBy, hiEnd: v, hiBy: by, kind: 'before' } : { lo, loBy, hiEnd, hiBy, kind: 'before' });
  };
  /* Ende einer Schicht am selben Tag; endet sie erst morgen, bleibt danach heute nichts */
  const after = () => {
    const v = Math.min(t[1], 1440) + R.afterEarly;
    wins.push(v > lo ? { lo: v, loBy: 'afterEarly', hiEnd, hiBy, kind: 'after' } : { lo, loBy, hiEnd, hiBy, kind: 'after' });
  };
  if (t && cat === 'early') after();
  else if (t && cat === 'late') before(R.beforeLate, 'beforeLate');
  else if (t && cat === 'night') before(R.beforeNight, 'beforeNight');
  else if (t && cat === 'day') { before(R.beforeLate, 'beforeLate'); after(); }
  else wins.push({ lo, loBy, hiEnd, hiBy, kind: null });
  return wins.map(w => ({ ...w, lo: Math.ceil(w.lo / R.step) * R.step })).filter(w => w.hiEnd > w.lo);
}

/* Erlaubte Fenster eines Tages als Liste { lo, hiEnd, kind }: frühester Beginn und spätestes Ende in Minuten,
   kind 'before' oder 'after' der Schicht. cur, prev und next sind Tage wie aus dayShift: { cat, times }. */
export function dayWindows(cur, prev, next = null) {
  return windowsOf(cur, prev, next).map(({ lo, hiEnd, kind }) => ({ lo, hiEnd, kind }));
}

/* Tag aus Code und Uhrzeiten, für Tests und Aufrufer ohne vollständigen Schichtplan */
const plainDay = (code, times, types) => {
  const t = code == null ? null : types.find(x => x.id === code);
  if (!t) return null;
  return { code, cat: t.cat, times: isTimedCat(t.cat) ? (times && times[code]) || TYPE_TIMES[code] || null : null, name: t.name, custom: !DEFAULT_IDS.includes(code) };
};

/* Erstes erlaubtes Fenster { lo, hiEnd } eines Tages oder null. times: Uhrzeiten je Code. */
export function dayWindow(code, prevCode, times, types = DEFAULT_TYPES, nextCode = null) {
  const w = dayWindows(plainDay(code, times, types), plainDay(prevCode, times, types), plainDay(nextCode, times, types))[0];
  return w ? { lo: w.lo, hiEnd: w.hiEnd } : null;
}

/* Kurze Begründung je Tagart. Eigene Arten stehen mit ihrem Namen da. */
function reasonOf(cur, prev, kind) {
  const cat = cur ? cur.cat : null;
  const own = cur && cur.custom ? ` „${cur.name}“` : '';
  const pc = prev ? prev.cat : null;
  if (cat === 'early') return own ? `nach der Schicht${own}` : 'nach der Frühschicht';
  if (cat === 'late') return own ? `vor der Schicht${own}` : 'vor der Spätschicht';
  /* P9: ausgeschlafen hat nur, wer schon die Nacht davor gearbeitet hat */
  if (cat === 'night') return `vor der ${own ? `Schicht${own}` : 'Nachtschicht'}${pc === 'night' ? ', nach dem Ausschlafen' : ''}`;
  if (cat === 'day') return `${kind === 'before' ? 'vor' : 'nach'} der ${own ? `Schicht${own}` : 'Tagschicht'}`;
  const base = cat === 'vacation' ? 'Urlaub' : cat === 'off' ? 'frei' : cat === 'dispo' ? 'Dispo' : 'keine Schicht eingetragen';
  if (pc === 'night') return `${base}, nach der Nachtschicht ausgeschlafen`;
  if (pc === 'h24') return `${base}, nach dem 24-h-Dienst ausgeschlafen`;
  return base;
}
export function reasonFor(code, prevCode, types = DEFAULT_TYPES, kind = null) {
  return reasonOf(plainDay(code, null, types), plainDay(prevCode, null, types), kind);
}

/* ---------- Hinweise am Plan-Eintrag ---------- */
/* { id, text, short, card }: text für Liste und Tages-Sheet, short für die Karte auf „Heute“ (dort öffnet short selbst
   die Karte), card ist die id der Wissen-Karte hinter „Warum?“ (js/data/knowledge.js) */
const hours = m => `${m / 60} Stunden`.replace('.', ',');
const LIGHT_TEXT = 'Leichter trainieren: je Übung ein Satz weniger, 2–3 Wiederholungen Reserve.';
const RULE_HINTS = {
  earlySleep: w => ({
    text: `Ende bis ${fromMin(w.hiEnd)}, damit vor dem frühen Schichtbeginn genug Schlaf bleibt.`,
    short: `Ende bis ${fromMin(w.hiEnd)}`, card: 'nach-fruehschicht-fertig',
  }),
  afterNight: () => ({
    text: `Frühestens ${hours(PLAN_RULES.afterNight)} nach Ende der Nachtschicht, erst schlafen.`,
    short: 'erst ausschlafen', card: 'nach-nachtschicht-schlafen',
  }),
  after24: () => ({
    text: `Frühestens ${hours(PLAN_RULES.after24)} nach Ende des 24-h-Dienstes, erst schlafen.`,
    short: 'erst ausschlafen', card: 'nach-nachtschicht-schlafen',
  }),
  lastNight: w => ({
    text: `Ende bis ${fromMin(w.hiEnd)}, damit du abends zur gewohnten Zeit schlafen kannst.`,
    short: `Ende bis ${fromMin(w.hiEnd)}`, card: 'nach-nachtschicht-schlafen',
  }),
  beforeNight: () => ({
    text: `Ende ${hours(PLAN_RULES.beforeNight)} vor der Nachtschicht, für Essen und ein Nickerchen.`,
    short: 'Zeit bis zur Nacht', card: 'vor-nachtschicht-nachmittag',
  }),
};

/* Für die Kurzversion gibt es keine eigene Wissen-Karte; die zum Wochenvolumen sagt, dass weniger Sätze den Stand halten */
export const SHORT_CARD = 'saetze-pro-woche';
function hintsFor(c, a) {
  const R = PLAN_RULES;
  const out = [];
  if (a.short) {
    out.push({
      id: 'short', short: 'Kurzversion', card: SHORT_CARD,
      text: `Kurzversion: ${a.u.shortText}, etwa ${a.minutes} Minuten. Für die ganze Einheit (${a.u.minutes} Minuten) reicht das Zeitfenster nicht.`,
    });
  }
  /* Die Regel, die die Wunschzeit verschoben hat: nach hinten der Beginn, nach vorn das Ende des Fensters */
  const by = a.want > a.pref ? a.w.loBy : a.want < a.pref ? a.w.hiBy : null;
  if (RULE_HINTS[by]) out.push({ id: by, ...RULE_HINTS[by](a.w) });
  if (c.light) out.push({ id: 'light', text: LIGHT_TEXT, short: 'leichter', card: 'kurze-nacht-leichter' });
  if (c.sleepKnown && c.sleep - (a.t + a.minutes) < R.caffeineHours * 60) {
    out.push({
      id: 'caffeine', card: 'koffein-wirkdauer', short: 'ohne Booster',
      text: `Koffeinhaltigen Booster vor dem Training weglassen, bis zum Schlafen bleiben weniger als ${hours(R.caffeineHours * 60)}.`,
    });
  }
  return out;
}

/* ---------- Einheiten auf Tage legen ---------- */
/* Wunschzeit je Kategorie: nach Früh- und Tagschicht wie Früh, vor der Spätschicht, vor der Nacht, sonst wie frei */
const PREFER_KEY = { early: 'F', day: 'F', late: 'S', night: 'N' };
const preferFor = (sh, cat) => (sh.prefer && sh.prefer[PREFER_KEY[cat] || '-']) || '11:00';
/* P5: Überschneiden sich die Hauptmuskeln zweier Einheiten? Ohne bekannte Muskeln gilt das sicherheitshalber als ja. */
const overlaps = (a, b) => !a.length || !b.length || a.some(m => b.includes(m));

/* Eine Einheit auf einen Tag legen: erste Einheit der Warteschlange, deren Hauptmuskeln zum Beginn 48 Stunden Pause haben
   und sich nicht mit der Einheit vom Vortag überschneiden (block, null ohne Training am Vortag).
   Hat der Tag zwei Fenster (vor und nach einer Tagschicht), kommt zuerst das, in dem die Wunschzeit besser liegt.
   Passt keine volle Einheit, dann dasselbe noch einmal mit den Kurzversionen (4.7). */
function assign(c, queue, last, ctx, block) {
  const R = PLAN_RULES;
  const pref = Math.round(c.pref / R.step) * R.step;
  for (const short of [false, true]) {
    for (let i = 0; i < queue.length; i++) {
      const u = ctx.units[queue[i]];
      if (block && overlaps(block, u.main)) continue;
      const minutes = short ? u.shortMinutes : u.minutes;
      if (!minutes) continue;
      const wins = c.wins.map(w => {
        const hi = Math.floor((w.hiEnd - minutes) / R.step) * R.step;
        return { w, hi, want: Math.min(Math.max(pref, w.lo), hi) };
      }).filter(x => x.hi >= x.w.lo).sort((a, b) => Math.abs(a.want - c.pref) - Math.abs(b.want - c.pref));
      for (const x of wins) {
        for (let t = x.want; t <= x.hi; t += R.step) {
          const start = localMs(c.date, t);
          if (u.main.every(m => !last[m] || start - last[m] >= R.restHours * H)) {
            return { i, u, t, want: x.want, pref, w: x.w, kind: x.w.kind, minutes, short, end: localMs(c.date, t + minutes) };
          }
        }
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
  let shorts = 0;
  let prevDay = state.lastDay;
  let prevMain = state.lastMain;
  for (const c of picks) {
    const block = prevDay && dayNum(c.date) - dayNum(prevDay) === 1 ? prevMain || [] : null;
    const a = assign(c, queue, last, ctx, block);
    if (!a) return null;
    const skipped = a.i > 0 ? ctx.units[queue[0]] : null;
    queue = [...queue.slice(0, a.i), ...queue.slice(a.i + 1), queue[a.i]];
    a.u.primary.forEach(m => { last[m] = a.end; });
    prevDay = c.date;
    prevMain = a.u.main;
    dev += Math.abs(a.t - c.pref);
    if (a.short) shorts++;
    let note = null;
    if (skipped) note = `${skipped.name} braucht noch Pause, darum zuerst ${a.u.name}.`;
    else if (a.t > a.want) note = 'Später als sonst, damit die Muskeln 48 Stunden Pause haben.';
    items.push({
      date: c.date,
      time: fromMin(a.t),
      end: fromMin(a.t + a.minutes),
      minutes: a.minutes,
      /* 4.7: Kurzversion, weil die volle Einheit nicht ins Fenster passt */
      shortVersion: a.short,
      dayId: a.u.id,
      name: a.u.name,
      color: a.u.color,
      muscles: a.u.muscles,
      shift: c.code,
      shiftCat: c.cur ? c.cur.cat : null,
      reason: reasonOf(c.cur, c.prev, a.kind),
      note,
      light: c.light,
      hints: hintsFor(c, a),
    });
  }
  return { items, queue, last, dev, shorts, lastMain: prevMain };
}

/* Beste Auswahl an Tagen einer Woche. Kandidaten sind nach Datum sortiert; höchstens 7. */
function chooseWeek(cands, need, ctx, state) {
  const R = PLAN_RULES;
  let best = { items: [], queue: state.queue, last: state.last, lastMain: state.lastMain, count: 0, cost: 0, pairs: 0, dev: 0, key: '' };
  if (!need || !cands.length) return best;
  const n = cands.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const picks = cands.filter((_, i) => mask & (1 << i));
    if (picks.length > need) continue;
    const count = picks.length;
    if (count < best.count) continue;
    /* Tage in Folge, auch zum letzten Training vor dieser Woche */
    let prev = state.lastDay;
    let run = state.run;
    let pairs = 0;
    let ok = true;
    for (const p of picks) {
      if (prev && dayNum(p.date) - dayNum(prev) === 1) {
        pairs++;
        if (++run > R.maxInRow) { ok = false; break; }
      } else run = 1;
      prev = p.date;
    }
    if (!ok) continue;
    const cost = picks.reduce((a, p) => a + p.rank, 0) + pairs * R.inRowRank;
    if (count === best.count && (cost > best.cost || (cost === best.cost && pairs > best.pairs))) continue;
    const sim = simulate(picks, ctx, state);
    if (!sim) continue;
    /* Kurzversionen kosten erst nach der Simulation; cost oben ist darum eine untere Schranke */
    const total = cost + sim.shorts * R.shortRank;
    const key = picks.map(p => p.date).join(',');
    const better = count > best.count
      || total < best.cost
      || (total === best.cost && (pairs < best.pairs
        || (pairs === best.pairs && (sim.dev < best.dev || (sim.dev === best.dev && key < best.key)))));
    if (better) best = { ...sim, count, cost: total, pairs, key, run };
  }
  return best;
}

/* Tage in Folge mit Training, die mit `day` enden */
function runUntil(days, day) {
  let n = 0;
  for (let d = day; days.has(d); d = addDays(d, -1)) n++;
  return n;
}

/* Plant die Trainings ab fromYmd für `days` Tage.
   Liefert null ohne Schichtplan, sonst
   { trainings: [{ date, time, end, minutes, dayId, name, color, muscles, shift, shiftCat, reason, note, light, shortVersion, hints }],
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
    units[id] = {
      id, name: d.name, color: d.color, muscles: d.muscles || '', main: prof.main, primary: [...primary],
      minutes: sessionMinutes(d), shortMinutes: shortMinutes(d), shortText: shortText(d.exercises, { first: true }),
    };
  });
  let ids = Object.keys(units);
  if (!ids.length) {
    units._ = { id: null, name: 'Training', color: 'red', muscles: '', main: [], primary: [], minutes: PLAN_RULES.defaultMinutes, shortMinutes: null };
    ids = ['_'];
  }
  const ordered = plan.order.filter(id => units[id]);
  const start = nextDay(plan.order, past, plan.id, plan.days);
  const at = ordered.indexOf(start);
  const queue = ordered.length ? (at > 0 ? [...ordered.slice(at), ...ordered.slice(0, at)] : ordered) : ['_'];

  /* Letzter Trainingstag im Verlauf, seine Hauptmuskeln (für P5) und wie viele Tage in Folge bis dahin */
  const pastDays = new Set(past.map(s => ymd(s.startedAt)));
  const lastDay = [...pastDays].reduce((a, d) => (!a || d > a ? d : a), null);
  const mainOf = s => (units[s.dayId] && s.planId === plan.id ? units[s.dayId].main
    : dayProfile({ exercises: (s.ex || []).map(x => ({ names: [x.name], sets: workSets(x.sets).length })) }, resolve).main);
  const lastMain = lastDay ? [...new Set(past.filter(s => ymd(s.startedAt) === lastDay).flatMap(mainOf))] : null;
  let st = { queue, last: lastTrained(past, resolve), lastDay, lastMain, run: lastDay ? runUntil(pastDays, lastDay) : 0 };
  const ctx = { units };

  /* Tag für die Planung: Kategorie und Uhrzeiten dieses Tages, null ohne Angabe */
  const dayOf = d => {
    const x = dayShift(sh, d);
    return x.code == null ? null : { code: x.code, cat: x.cat, times: x.times, name: x.type ? x.type.name : '', custom: !DEFAULT_IDS.includes(x.code) };
  };
  const endDay = addDays(fromYmd, Math.max(1, days) - 1);
  const trainings = [];
  const weeks = [];
  for (let mon = mondayOf(fromYmd); mon <= endDay; mon = addDays(mon, 7)) {
    const sun = addDays(mon, 6);
    const done = past.filter(s => { const d = ymd(s.startedAt); return d >= mon && d <= sun; }).length;
    const need = Math.max(0, target - done);
    const cands = [];
    for (let d = mon < fromYmd ? fromYmd : mon; d <= sun; d = addDays(d, 1)) {
      if (st.lastDay && d <= st.lastDay) continue;
      const cur = dayOf(d);
      const prev = dayOf(addDays(d, -1));
      const next = dayOf(addDays(d, 1));
      let wins = windowsOf(cur, prev, next);
      /* Heute nur, was noch möglich ist: Beginn frühestens jetzt, auf den nächsten Schritt gerundet (#44) */
      if (d === fromYmd && Number.isFinite(opts.nowMin)) {
        const now = Math.ceil(opts.nowMin / PLAN_RULES.step) * PLAN_RULES.step;
        wins = wins.map(w => (now > w.lo ? { ...w, lo: now, loBy: 'now' } : w)).filter(w => w.hiEnd > w.lo);
      }
      if (wins.length) {
        cands.push({
          date: d, code: cur ? cur.code : null, cur, prev, wins,
          pref: toMin(preferFor(sh, cur ? cur.cat : null)),
          rank: dayRank(cur, prev, next),
          /* P7: ab der zweiten Nacht einer Folge; vor der ersten ist man meist ausgeschlafen */
          light: betweenNights(cur, prev) || shortRest(cur, prev, next),
          sleep: sleepAt(cur, next),
          sleepKnown: earlySleepAt(next) != null || (!!prev && prev.cat === 'night' && (!cur || cur.cat !== 'night')),
        });
      }
    }
    const best = chooseWeek(cands, need, ctx, st);
    trainings.push(...best.items);
    if (best.items.length) {
      const lastPick = best.items[best.items.length - 1].date;
      st = { queue: best.queue, last: best.last, lastDay: lastPick, lastMain: best.lastMain, run: best.run };
    }
    weeks.push({ monday: mon, target, done, planned: best.items.length, short: done + best.items.length < target });
  }
  return {
    trainings: trainings.filter(t => t.date >= fromYmd && t.date <= endDay),
    weeks,
    target,
  };
}
