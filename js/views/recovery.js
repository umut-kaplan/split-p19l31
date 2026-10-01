/* Erholung und Tagesvorschlag (Stufe 5): Ampel aus Belastung, Schlaf, Gefühl und Ruhepuls;
   „Was soll ich heute trainieren?“ mit Begründung und Alternative; kurzer Check-in vor dem Training. */
import { S, V, save, activePlan } from '../state.js';
import { esc, fmt1, ymd } from '../util.js';
import { render } from '../render.js';
import { nextDay } from '../domain/progression.js';
import { findExercise } from '../domain/library.js';
import { recoveryFromState, LEVEL_LABEL, FEELING_LABEL } from '../domain/recovery.js';
import { suggestToday, restText } from '../domain/today-plan.js';
import { plateSVG } from '../ui/plate.js';
import { toast } from '../ui/toast.js';
import { ampelIsHint } from '../domain/today-hints.js';
import { plannedNextId, withShiftPlan } from './shift-today.js';

const resolve = n => findExercise(n, S.exercisesCustom);

/* Welche Einheit zeigt die Hantelscheibe oben gerade? Gleiche Regel wie auf der Startseite. */
function heroDayId(plan) {
  return V.pick && plan.days[V.pick] ? V.pick : plannedNextId(plan) || nextDay(plan.order, S.sessions, plan.id);
}

/* ---------- Ampel und Tagesvorschlag ---------- */
/* Ampel, Vorschlag und Tag auf der Scheibe. shiftRest: Pause nur, weil der Schichtplan heute kein Training vorsieht. */
function ampel() {
  const plan = activePlan();
  const today = ymd();
  const rec = recoveryFromState(S, today);
  const done = [...S.sessions].reverse().find(s => ymd(s.startedAt) === today && (!s.planId || s.planId === plan.id));
  /* Mit Schichtplan ist die geplante Einheit der Kandidat; an Tagen ohne Plan rät die Karte zur Pause */
  const base = suggestToday({
    plan, sessions: S.sessions, resolve, level: rec.level,
    nextId: plannedNextId(plan) || nextDay(plan.order, S.sessions, plan.id),
    trainedToday: done ? { dayId: done.dayId, name: done.name } : null,
  });
  const sug = withShiftPlan(base);
  return { plan, rec, sug, heroId: heroDayId(plan), shiftRest: !!sug && sug !== base && sug.kind === 'rest' };
}

/* Auf „Heute“: Rät die Ampel etwas anderes als die Scheibe, steht sie als Hinweis-Karte oben (hint).
   Sonst reicht eine Zeile unter der Schnellzeile, die die ganze Karte aufklappt (line). */
export function ampelOnToday() {
  const a = ampel();
  if (!a.sug) return { hint: '', line: '' };
  if (ampelIsHint(a.sug, a.heroId, { shiftRest: a.shiftRest })) return { hint: trainTodayCard(a) + checkinPart(), line: '' };
  const open = !!V.recOpen;
  const line = `<section class="block rec-line rec-${a.rec.level}">
    <button class="rec-line-btn" data-act="recline" aria-expanded="${open}">
      <span class="rec-light" aria-hidden="true">${plateSVG(a.rec.level, '', '', { small: true })}</span>
      <span class="rec-line-t"><b>Ampel ${esc(LEVEL_LABEL[a.rec.level].toLowerCase())}</b><small>${esc(a.sug.title)}</small></span>
      <span class="rec-line-more">${open ? 'Weniger' : 'Warum?'}</span>
    </button>
  </section>
  ${open ? trainTodayCard(a) + checkinPart() : ''}`;
  return { hint: '', line };
}

export function trainTodayCard(a = ampel()) {
  const { plan, rec, sug, heroId } = a;
  if (!sug) return '';
  const day = sug.dayId && plan.days[sug.dayId];
  const color = sug.kind === 'rest' ? rec.level : day ? day.color : 'steel';
  let buttons = '';
  if (sug.kind === 'train' && sug.dayId !== heroId) {
    buttons = `<div class="sug-btns">
      <button class="btn small primary" data-act="start" data-day="${sug.dayId}">${esc(day.name)} starten</button>
      <button class="btn small ghost" data-act="pick" data-day="${sug.dayId}">Oben zeigen</button></div>`;
  } else if (sug.kind === 'train') {
    buttons = '<p class="small-print rec-same">Das ist die Einheit auf der Scheibe oben.</p>';
  }
  const alt = sug.alt && sug.kind !== 'done' ? `<div class="rec-alt">
      <div><b>${esc(sug.alt.title)}</b><span>${esc(sug.alt.reason)}</span></div>
      ${sug.alt.dayId && sug.alt.dayId !== heroId ? `<button class="btn small" data-act="pick" data-day="${sug.alt.dayId}">Wählen</button>` : ''}
    </div>` : sug.alt ? `<div class="rec-alt"><div><b>${esc(sug.alt.title)}</b><span>${esc(sug.alt.reason)}</span></div></div>` : '';
  const muscles = sug.muscles.slice(0, 8);
  return `<section class="block card rec-card rec-${rec.level}">
    <div class="rec-head">
      <span class="rec-light" aria-hidden="true">${plateSVG(rec.level, '', '', { small: true })}</span>
      <div><h2>Was soll ich heute trainieren?</h2>
        <p class="rec-level">Ampel ${esc(LEVEL_LABEL[rec.level].toLowerCase())}</p></div>
    </div>
    <p class="rec-summary">${esc(rec.summary)}</p>
    <div class="rec-pick day-${color}">
      <h3>${esc(sug.title)}</h3>
      <p>${esc(sug.reason)}</p>
      ${sug.hint ? `<p class="rec-hint">${esc(sug.hint)}</p>` : ''}
      ${buttons}
    </div>
    ${alt}
    <details class="more rec-more">
      <summary>So entsteht die Ampel</summary>
      <ul class="rec-reasons">
        ${rec.reasons.map(r => `<li><span class="rec-dot ${r.level}" aria-label="${esc(LEVEL_LABEL[r.level])}"></span><span>${esc(r.text)}</span></li>`).join('')}
        ${rec.notes.map(n => `<li class="rec-note"><span class="rec-dot none" aria-hidden="true"></span><span>${esc(n)}</span></li>`).join('')}
      </ul>
      ${muscles.length ? `<p class="label" style="margin-top:12px">Zuletzt trainiert</p>
        <ul class="rec-muscles">${muscles.map(m => `<li class="${m.hours < 48 ? 'tired' : ''}"><span>${esc(m.label)}</span><span>${esc(restText(m.hours))}</span></li>`).join('')}</ul>` : ''}
      <p class="small-print" style="margin-top:10px">Die Ampel ist eine Faustregel aus deinen Einträgen, keine medizinische Einschätzung.</p>
    </details>
  </section>`;
}

/* ---------- Check-in ---------- */
const FEELINGS = [1, 2, 3, 4, 5];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* Schlaf, der für heute schon bekannt ist (Import oder Eintrag unter Aktivität) */
function knownSleep(today) {
  const vals = ((S.activity && S.activity.sleep) || []).filter(s => s && s.date === today && s.hours > 0).map(s => s.hours);
  return vals.length ? Math.max(...vals) : null;
}

function draft(today) {
  const ci = S.checkins[today] || {};
  if (!V.recDraft || V.recDraft.date !== today) {
    const known = knownSleep(today);
    V.recDraft = {
      date: today,
      sleepH: ci.sleepH > 0 ? ci.sleepH : known != null ? Math.round(known * 2) / 2 : 7,
      feeling: ci.feeling || null,
    };
  }
  return V.recDraft;
}

/* Erledigter Check-in als Zeile mit „Ändern“, sonst leer */
export function checkinLine() {
  const today = ymd();
  const ci = S.checkins[today];
  if (!ci || ci.skipped || V.recEdit === today || !(ci.sleepH > 0 || ci.feeling)) return '';
  const parts = [];
  if (ci.sleepH > 0) parts.push(`${fmt1(ci.sleepH)} h Schlaf`);
  if (ci.feeling) parts.push(`Gefühl ${FEELING_LABEL[ci.feeling]}`);
  return `<section class="block rec-ci-done">
    <p><span class="muted">Check-in:</span> ${esc(parts.join(', '))}</p>
    <button class="link" data-act="recedit">Ändern</button>
  </section>`;
}

/* Unter der Ampel: der erledigte Check-in als Zeile, nach „Ändern“ die Karte an derselben Stelle */
const checkinPart = () => (V.recEdit === ymd() ? checkinCard() : checkinLine());

/* Die Karte zum Ausfüllen, solange der Check-in für heute offen ist (oder geändert wird), sonst leer */
export function checkinCard() {
  const today = ymd();
  const ci = S.checkins[today];
  const editing = V.recEdit === today;
  if (ci && !editing && (ci.skipped || ci.sleepH > 0 || ci.feeling)) return '';
  const d = draft(today);
  return `<section class="block card rec-ci">
    <div class="rec-ci-head">
      <div><h2>Kurzer Check-in</h2><p class="small-print">Freiwillig. Schlaf und Gefühl machen die Ampel genauer.</p></div>
      <button class="link" data-act="recskip">Heute nicht</button>
    </div>
    <div class="rec-ci-row">
      <span class="label" style="margin:0">Schlaf letzte Nacht</span>
      <div class="stepper">
        <button class="icon" data-act="recsleep" data-d="-0.5" aria-label="Eine halbe Stunde weniger" ${d.sleepH <= 0 ? 'disabled' : ''}>−</button>
        <b class="num" aria-live="polite">${esc(fmt1(d.sleepH))} h</b>
        <button class="icon" data-act="recsleep" data-d="0.5" aria-label="Eine halbe Stunde mehr" ${d.sleepH >= 14 ? 'disabled' : ''}>+</button>
      </div>
    </div>
    <div class="chips rec-feel" role="group" aria-label="Wie fühlst du dich? Gefühl von 1 bis 5">${FEELINGS.map(n =>
      `<button class="chip ${d.feeling === n ? 'on' : ''}" aria-pressed="${d.feeling === n}" data-act="recfeel" data-v="${n}">${esc(cap(FEELING_LABEL[n]))}</button>`).join('')}
      <button class="btn small primary" data-act="recsave">Speichern</button></div>
  </section>`;
}

export const actions = {
  recsleep: el => {
    const d = draft(ymd());
    d.sleepH = Math.max(0, Math.min(14, Math.round((d.sleepH + Number(el.dataset.d)) * 2) / 2));
    render();
  },
  recfeel: el => {
    const d = draft(ymd());
    const n = Number(el.dataset.v);
    d.feeling = d.feeling === n ? null : n;
    render();
  },
  recsave: () => {
    const today = ymd();
    const d = draft(today);
    S.checkins[today] = { sleepH: d.sleepH, feeling: d.feeling || null };
    V.recDraft = null;
    V.recEdit = null;
    save(); render(); toast('Check-in gespeichert');
  },
  recskip: () => {
    const today = ymd();
    S.checkins[today] = { skipped: true };
    V.recDraft = null;
    V.recEdit = null;
    save(); render();
  },
  recedit: () => {
    V.recEdit = ymd();
    V.recDraft = null;
    render();
  },
  /* Zuklappen bricht ein angefangenes „Ändern“ beim Check-in ab, sonst bliebe die Karte unsichtbar offen */
  recline: () => { V.recOpen = !V.recOpen; if (!V.recOpen) { V.recEdit = null; V.recDraft = null; } render(); },
};

export const inputs = {};
