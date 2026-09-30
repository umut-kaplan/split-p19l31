/* Schichtplan auf „Heute“, im Training-Tab und in den Einstellungen. Die Planung selbst steht in domain/shift-plan.js. */
import { S, activePlan } from '../state.js';
import { esc, ymd } from '../util.js';
import { ICON } from '../ui/icons.js';
import { planTrainings } from '../domain/shift-plan.js';
import {
  hasShiftPlan, shiftOn, shiftClass, SHIFT_NAME, SHIFT_SHORT, timesText, addDays, mondayOf, dayNum,
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
const dateText = (d, o) => new Date(d + 'T12:00').toLocaleDateString('de-DE', o);
export const dayLong = d => dateText(d, { weekday: 'long', day: 'numeric', month: 'long' });
export const dayShort = d => dateText(d, { weekday: 'short', day: '2-digit', month: '2-digit' });

/* „Frühschicht, 06–14 Uhr“, „frei“, „Urlaub“ oder null ohne Angabe */
export function shiftText(code) {
  if (code === 'F' || code === 'S' || code === 'N') return `${SHIFT_NAME[code]}, ${timesText(S.shifts.times, code)}`;
  return code === '-' ? 'frei' : code === 'U' ? 'Urlaub' : null;
}

/* „Heute Frühschicht, 06–14 Uhr“, „Heute frei“ */
export function shiftDayText(code, when = 'Heute') {
  const t = shiftText(code);
  return t ? `${when} ${t}` : `${when} ist keine Schicht eingetragen`;
}

/* „Push um 15:30, nach der Frühschicht“ */
export const trainingLine = t => `${t.name} um ${t.time}, ${t.reason}`;

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
  `<span class="sh-code ${shiftClass(code)} ${extra}" aria-hidden="true">${code ? esc(SHIFT_SHORT[code]) : '?'}</span>`;

/* ---------- Was gilt heute? ---------- */
/* null ohne Schichtplan, sonst { today, shift, planned, next, done, weekDone, target } */
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
    today, shift: shiftOn(S.shifts, today), planned, next, done,
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
      rows.push(`<li class="sh-row ${t ? 'train day-' + esc(t.color) : ''} ${d === today ? 'today' : ''}">
        <span class="sh-date">${esc(dayShort(d))}</span>
        ${shiftBadge(code, source === 'override' ? 'ov' : '')}
        <span class="sh-what">${what}</span></li>`);
    }
    const items = p.trainings.filter(t => t.date >= mon && t.date <= sun);
    const week = p.weeks.find(w => w.monday === mon);
    const title = mon <= today ? 'Diese Woche' : dayNum(mon) - dayNum(mondayOf(today)) === 7 ? 'Nächste Woche' : 'Übernächste Woche';
    const fit = week ? week.done + week.planned : 0;
    const short = week && week.short
      ? `<p class="small-print sh-short">Nur ${fit} von ${week.target} Trainings ${fit === 1 ? 'passt' : 'passen'} in diese Woche${week.done ? `, ${week.done} davon erledigt` : ''}. Zwischen zwei Trainings bleibt ein Ruhetag.</p>` : '';
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
   die Liste der nächsten zwei Wochen und der Kalender-Export liegen dort unter „2 Wochen“. */
export function shiftTodayCard() {
  const p = plannedToday();
  if (!p) return '';
  const code = p.shift.code;
  const head = code === 'F' || code === 'S' || code === 'N' ? `${SHIFT_NAME[code]} ${timesText(S.shifts.times, code)}`
    : code === '-' ? 'Heute frei' : code === 'U' ? 'Urlaub' : 'Keine Schicht eingetragen';
  const next = p.next ? `, nächstes: ${esc(p.next.name)} ${p.next.date === addDays(p.today, 1) ? 'morgen' : esc(dayShort(p.next.date))} um ${esc(p.next.time)}` : '';
  let line;
  if (p.done) line = `<b>${esc(p.done.name)}</b> ${p.done.running ? 'läuft' : 'erledigt'}${p.done.running ? '' : next}`;
  else if (p.planned) {
    /* Ohne Schichtangabe stünde „keine Schicht eingetragen“ sonst zweimal auf der Karte */
    const why = code ? `, ${esc(p.planned.reason)}` : '';
    line = `<b>${esc(p.planned.name)} um ${esc(p.planned.time)}</b>${why}${p.planned.note ? `. ${esc(p.planned.note)}` : ''}`;
  } else line = `Heute Pause${next}`;
  return `<section class="sh-today ${shiftClass(code)}">
    <button class="sh-today-row" data-act="shiftopen" data-sub="calendar">
      ${shiftBadge(code)}
      <span class="sh-today-txt"><b>${esc(head)}</b><small>${line}</small><span class="vh">. Schichtplan öffnen</span></span>
      ${ICON.chevron}
    </button>
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
      ? `${esc(shiftDayText(p.shift.code))}. Die App plant ${S.profile.daysPerWeek}-mal pro Woche ein Training um deine Schichten.`
      : 'Arbeitest du in Wechselschicht? Trag deinen Schichtplan ein oder importiere ihn aus deinem Kalender. Die App plant dann, an welchen Tagen und zu welcher Uhrzeit du trainierst.'}</p>
    <div class="stack" style="margin-top:0">
      <button class="btn ${on ? '' : 'primary'}" data-act="shiftopen" data-sub="${on ? 'calendar' : 'setup'}">${on ? 'Schichtkalender öffnen' : 'Schichtplan einrichten'}</button>
    </div>
  </section>`;
}
