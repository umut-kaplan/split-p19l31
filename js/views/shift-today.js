/* Schichtplan auf „Heute“, im Training-Tab und in den Einstellungen. Die Planung selbst steht in domain/shift-plan.js. */
import { S, activePlan } from '../state.js';
import { esc, ymd } from '../util.js';
import { ICON } from '../ui/icons.js';
import { planTrainings, MAX_PER_WEEK, PLAN_RULES } from '../domain/shift-plan.js';
import { knowledgeLink } from './knowledge.js';
import {
  hasShiftPlan, shiftOn, dayShift, shiftClass, shortOf, typeOf, typeLong, typeTimes, fmtTimes, isTimedCat, addDays, mondayOf, dayNum,
} from '../domain/shifts.js';

/* ---------- Planung mit kleinem Zwischenspeicher ---------- */
const memo = new Map();
/* Ab heute wird nur geplant, was von jetzt an noch geht. Aufgerundet auf die nächste Viertelstunde,
   sonst läge der vorgeschlagene Beginn bis zu 14 Minuten in der Vergangenheit (#59). */
const nowMin = () => { const d = new Date(); return Math.ceil((d.getHours() * 60 + d.getMinutes()) / 15) * 15; };

export function planFor(from, days) {
  if (!hasShiftPlan(S.shifts)) return null;
  const last = S.sessions[S.sessions.length - 1];
  const now = from === ymd() ? nowMin() : null;
  const key = [from, days, now, S.activePlanId, S.profile.daysPerWeek, S.sessions.length, last ? last.startedAt : 0,
    S.active ? S.active.startedAt : 0, JSON.stringify(S.shifts), JSON.stringify(activePlan())].join('|');
  if (!memo.has(key)) {
    if (memo.size > 6) memo.clear();
    memo.set(key, planTrainings(S, from, days, now == null ? {} : { nowMin: now }));
  }
  return memo.get(key);
}
export const twoWeeks = () => planFor(ymd(), 14);

/* ---------- Texte ---------- */
export const dateText = (d, o) => new Date(d + 'T12:00').toLocaleDateString('de-DE', o);
export const dayLong = d => dateText(d, { weekday: 'long', day: 'numeric', month: 'long' });
export const dayShort = d => dateText(d, { weekday: 'short', day: '2-digit', month: '2-digit' });

/* Name einer Art ohne Uhrzeit, für Sätze: „frei“, „Urlaub“, „krank“ */
const plainName = t => (t.id === 'K' && t.name === 'Krank' ? 'krank' : t.name);

/* „Frühschicht, 06–14 Uhr“, „frei“, „Urlaub“ oder null ohne Angabe. Mit Datum gelten die Uhrzeiten dieses Tages. */
export function shiftText(code, date = null) {
  const t = typeOf(S.shifts, code);
  if (!t) return null;
  if (!isTimedCat(t.cat)) return plainName(t);
  const day = date ? dayShift(S.shifts, date) : null;
  const times = day && day.code === code ? day.times : typeTimes(S.shifts, code);
  return `${typeLong(t)}, ${fmtTimes(times)}`;
}

/* Kopfzeile der Karte auf „Heute“: „Frühschicht 06–14 Uhr“, „Heute frei“, „Urlaub“ */
export function shiftHead(day) {
  const t = day && day.type;
  if (!t) return 'Keine Schicht eingetragen';
  if (isTimedCat(t.cat)) return `${typeLong(t)} ${fmtTimes(day.times)}`;
  return t.cat === 'off' ? `Heute ${t.name}` : t.name;
}

/* „Heute Frühschicht, 06–14 Uhr“, „Heute frei“ */
export function shiftDayText(code, when = 'Heute', date = null) {
  const t = shiftText(code, date);
  return t ? `${when} ${t}` : `${when} ist keine Schicht eingetragen`;
}

/* „Push um 15:30, nach der Frühschicht“ */
export const trainingLine = t => `${t.name} um ${t.time}, ${t.reason}`;

/* Hinweise eines geplanten Trainings (Uhrzeit-Regel, leichter, Koffein), jeder mit „Warum?“ zur Wissen-Karte */
export const planHints = t => (t && Array.isArray(t.hints) ? t.hints : []);
export const hintHtml = h => `${esc(h.text)} ${knowledgeLink(h.card)}`;

/* „Pull am Freitag, 2. Oktober, um 10:00, vor der Spätschicht“ */
export function trainingWhen(t, today = ymd()) {
  const day = t.date === addDays(today, 1) ? 'morgen' : `am ${dayLong(t.date)},`;
  return `${t.name} ${day} um ${t.time}, ${t.reason}`;
}

/* Das laufende Training gilt als Training von heute, auch wenn es vor Mitternacht oder noch früher begonnen hat (#59).
   Solange es läuft, zeigt die Scheibe es ohnehin an; Karte, Liste und Kalender sagen dasselbe. */
export function runningToday() {
  const a = S.active;
  return a && a.startedAt ? { ...a, running: true } : null;
}

/* Trainings je Tag für Liste und Kalender: der Verlauf und dazu das laufende Training unter heute */
export function sessionsByDay(keep = () => true) {
  const today = ymd();
  const byDay = new Map();
  S.sessions.forEach(s => { const d = ymd(s.startedAt); if (keep(d)) byDay.set(d, [...(byDay.get(d) || []), s]); });
  const run = runningToday();
  if (run && keep(today)) byDay.set(today, [...(byDay.get(today) || []), run]);
  return byDay;
}

export const shiftBadge = (code, extra = '') =>
  `<span class="sh-code ${shiftClass(S.shifts, code)} ${extra}" aria-hidden="true">${esc(shortOf(S.shifts, code))}</span>`;

/* ---------- Was gilt heute? ---------- */
/* null ohne Schichtplan, sonst { today, shift, planned, next, done, weekDone, target }; shift wie aus dayShift */
export function plannedToday() {
  if (!hasShiftPlan(S.shifts)) return null;
  const today = ymd();
  const p = twoWeeks();
  const planned = p ? p.trainings.find(t => t.date === today) || null : null;
  const next = p ? p.trainings.find(t => t.date > today) || null : null;
  /* Ein laufendes Training zählt als erledigt, sonst zeigt die Karte „Pause“ mitten im Training (#44, #59) */
  const running = runningToday();
  const done = running || [...S.sessions].reverse().find(s => ymd(s.startedAt) === today) || null;
  const week = p && p.weeks.find(w => w.monday === mondayOf(today));
  return {
    today, shift: dayShift(S.shifts, today), planned, next, done,
    weekDone: week ? week.done : 0, target: p ? p.target : S.profile.daysPerWeek,
  };
}

/* Einheit, die die Hantelscheibe auf „Heute“ zeigen soll: heute geplant oder die nächste geplante */
export function plannedNextId(plan) {
  const p = plannedToday();
  if (!p) return null;
  const t = p.planned || p.next;
  return t && t.dayId && plan.days[t.dayId] ? t.dayId : null;
}

/* Tagesvorschlag aus today-plan.js an den Schichtplan anpassen. Ampel und 48-Stunden-Regel bleiben wirksam:
   Rot und Ruhetag kommen weiter aus dem Vorschlag, der Plan ersetzt nur die Frage, ob heute ein Trainingstag ist. */
export function withShiftPlan(sug) {
  const p = plannedToday();
  if (!p || !sug || sug.kind !== 'train') return sug;
  /* Uhrzeit und Grund stehen schon auf der Schichtkarte darüber */
  if (p.planned) return sug;
  const plan = activePlan();
  const name = plan.days[sug.dayId] ? plan.days[sug.dayId].name : '';
  const goal = p.weekDone >= p.target ? 'Dein Wochenziel ist erreicht. ' : '';
  return {
    kind: 'rest', dayId: null,
    title: 'Heute Pause laut Schichtplan',
    reason: `${goal}${p.next ? `Nächstes Training: ${trainingWhen(p.next, p.today)}.` : 'In den nächsten zwei Wochen ist kein weiteres Training geplant.'}`,
    hint: null,
    alt: { kind: 'train', dayId: sug.dayId, title: `Wenn du trotzdem trainierst: ${name}`, reason: sug.reason },
    muscles: sug.muscles,
  };
}

/* ---------- Liste „Die nächsten 2 Wochen“ ---------- */
/* Zeilen je Woche ab heute. exportRow(monday, items) liefert optional Knöpfe unter einer Woche. */
export function nextTwoWeeks(exportRow = null) {
  const p = twoWeeks();
  if (!p) return '';
  const today = ymd();
  const byDate = new Map(p.trainings.map(t => [t.date, t]));
  const doneDays = sessionsByDay(d => d >= today);
  const last = addDays(today, 13);
  const out = [];
  for (let mon = mondayOf(today); mon <= last; mon = addDays(mon, 7)) {
    const sun = addDays(mon, 6);
    const rows = [];
    for (let d = mon < today ? today : mon; d <= sun && d <= last; d = addDays(d, 1)) {
      const { code, source } = shiftOn(S.shifts, d);
      const t = byDate.get(d);
      const done = (doneDays.get(d) || []).slice(-1)[0];
      const what = done
        ? `<span><b>${esc(done.name)}</b> ${done.running ? 'läuft' : 'erledigt'}</span>`
        : t ? `<span><b>${esc(t.name)}</b> <span class="num">${esc(t.time)}–${esc(t.end)}</span></span><small>${esc(t.reason)}${t.note ? `. ${esc(t.note)}` : ''}</small>`
          : '<span class="muted">Pause</span>';
      /* Hinweise in eigener Zeile über die ganze Breite, sonst wird die Zeile auf schmalen Geräten sehr hoch */
      const tips = !done && t ? planHints(t).map(h => `<small>${hintHtml(h)}</small>`).join('') : '';
      rows.push(`<li class="sh-row ${t ? 'train day-' + esc(t.color) : ''} ${d === today ? 'today' : ''}">
        <span class="sh-date">${esc(dayShort(d))}</span>
        ${shiftBadge(code, source === 'override' ? 'ov' : '')}
        <span class="sh-what">${what}</span>${tips ? `<span class="sh-tips">${tips}</span>` : ''}</li>`);
    }
    const items = p.trainings.filter(t => t.date >= mon && t.date <= sun);
    const week = p.weeks.find(w => w.monday === mon);
    const title = mon <= today ? 'Diese Woche' : dayNum(mon) - dayNum(mondayOf(today)) === 7 ? 'Nächste Woche' : 'Übernächste Woche';
    const fit = week ? week.done + week.planned : 0;
    /* Grund: bei Ziel 7 die Grenze von 6 Tagen in Folge, sonst meist die Muskeln an zwei Tagen in Folge */
    const why = week && week.target > MAX_PER_WEEK && fit >= MAX_PER_WEEK
      ? `Mehr als ${PLAN_RULES.maxInRow} Tage in Folge plant die App nicht, darum höchstens ${MAX_PER_WEEK} Trainings pro Woche.`
      : 'Zwei Tage in Folge plant die App nur mit Einheiten für verschiedene Muskeln.';
    const short = week && week.short
      ? `<p class="small-print sh-short">Nur ${fit} von ${week.target} Trainings ${fit === 1 ? 'passt' : 'passen'} in diese Woche${week.done ? `, ${week.done} davon erledigt` : ''}. ${why}</p>` : '';
    out.push(`<section class="sh-week">
      <h3>${title} <small>${esc(dateText(mon, { day: '2-digit', month: '2-digit' }))}–${esc(dateText(sun, { day: '2-digit', month: '2-digit' }))}</small></h3>
      <ul class="sh-list">${rows.join('')}</ul>${short}
      ${exportRow ? exportRow(mon, items) : ''}
    </section>`);
  }
  return out.join('');
}

/* ---------- Karte auf „Heute“ ---------- */
/* Eine Zeile: Schicht und was heute ansteht. Ein Tipp öffnet den Schichtplan im Reiter „Kalender“;
   die Liste der nächsten zwei Wochen und der Kalender-Export liegen dort unter „2 Wochen“.
   Hinweise zum geplanten Training stehen kurz darunter, außerhalb des Knopfs. Damit die Karte klein bleibt, ist dort
   jeder Hinweis selbst der „Warum?“-Knopf zu seiner Wissen-Karte; Liste und Tages-Sheet zeigen den ganzen Satz. */
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export function shiftTodayCard() {
  const p = plannedToday();
  if (!p) return '';
  const code = p.shift.code;
  const head = shiftHead(p.shift);
  const next = p.next ? `, nächstes: ${esc(p.next.name)} ${p.next.date === addDays(p.today, 1) ? 'morgen' : esc(dayShort(p.next.date))} um ${esc(p.next.time)}` : '';
  let line;
  if (p.done) line = `<b>${esc(p.done.name)}</b> ${p.done.running ? 'läuft' : 'erledigt'}${p.done.running ? '' : next}`;
  else if (p.planned) {
    /* Ohne Schichtangabe stünde „keine Schicht eingetragen“ sonst zweimal auf der Karte */
    const why = code ? `, ${esc(p.planned.reason)}` : '';
    line = `<b>${esc(p.planned.name)} um ${esc(p.planned.time)}</b>${why}${p.planned.note ? `. ${esc(p.planned.note)}` : ''}`;
  } else line = `Heute Pause${next}`;
  const hints = !p.done && p.planned ? planHints(p.planned) : [];
  return `<section class="sh-today ${shiftClass(S.shifts, code)}">
    <button class="sh-today-row" data-act="shiftopen" data-sub="calendar">
      ${shiftBadge(code)}
      <span class="sh-today-txt"><b>${esc(head)}</b><small>${line}</small><span class="vh">. Schichtplan öffnen</span></span>
      ${ICON.chevron}
    </button>
    ${hints.length ? `<p class="sh-today-hints">${hints.map(h => knowledgeLink(h.card, cap(h.short))).join('<span class="sh-sep" aria-hidden="true">·</span>')}</p>` : ''}
  </section>`;
}

/* ---------- Training-Tab und Einstellungen ---------- */
export function shiftTrainLine() {
  if (!hasShiftPlan(S.shifts)) {
    return `<p class="plan-active sh-train-line">Arbeitest du in Schichten? <button class="link" data-act="shiftopen" data-sub="setup">Schichtplan einrichten</button></p>`;
  }
  const p = plannedToday();
  const t = p && (p.done ? p.next : p.planned || p.next);
  return `<p class="plan-active sh-train-line">Schichtplan: ${t ? `nächstes Training <b>${esc(t.name)}</b> ${t.date === p.today ? 'heute' : esc(dayShort(t.date))} um ${esc(t.time)}` : 'kein Training geplant'}
    <button class="link" data-act="shiftopen" data-sub="plan">Nächste 2 Wochen</button></p>`;
}

export function shiftProfileSection() {
  const on = hasShiftPlan(S.shifts);
  const p = on ? plannedToday() : null;
  return `<section class="p-section card"><h2>Schichtplan</h2>
    <p class="muted" style="margin:6px 0 14px">${on
      ? `${esc(shiftDayText(p.shift.code, 'Heute', p.today))}. Die App plant ${S.profile.daysPerWeek}-mal pro Woche ein Training um deine Schichten.`
      : 'Arbeitest du in Wechselschicht? Trag deinen Schichtplan ein oder importiere ihn aus deinem Kalender. Die App plant dann, an welchen Tagen und zu welcher Uhrzeit du trainierst.'}</p>
    <div class="stack" style="margin-top:0">
      <button class="btn ${on ? '' : 'primary'}" data-act="shiftopen" data-sub="${on ? 'calendar' : 'setup'}">${on ? 'Schichtkalender öffnen' : 'Schichtplan einrichten'}</button>
    </div>
  </section>`;
}
