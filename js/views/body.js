import { S, V, save } from '../state.js';
import { esc, fmt1, fmtIn, toNum, ymd, dMid, dShort } from '../util.js';
import { render } from '../render.js';
import {
  weightTrend, forecastGoal, goalProgress, firstWeight, currentWeight, photoReminderDue,
} from '../domain/body.js';
import { bmiCard } from '../ui/cards.js';
import { weightChart } from '../ui/chart-weight.js';
import { toast } from '../ui/toast.js';
import { closeSheet, confirmSheet } from '../ui/sheet.js';
import * as measures from './body-measures.js';
import * as photos from './body-photos.js';
import * as activity from './activity.js';

/* Untermodule, deren actions und inputs app.js einsammelt */
export const modules = [measures, photos, activity];

const SOURCE = { manual: 'eingetragen', profile: 'aus dem Profil', onboarding: 'bei der Einrichtung' };
const SUBS = [['weight', 'Gewicht'], ['measures', 'Maße'], ['photos', 'Fotos'], ['activity', 'Aktivität']];
const RANGES = [['4w', '4 Wochen'], ['3m', '3 Monate'], ['all', 'Alles']];

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const dayOf = d => new Date(d + 'T12:00');
const longDate = d => {
  const opts = { day: 'numeric', month: 'long' };
  if (d.slice(0, 4) !== ymd().slice(0, 4)) opts.year = 'numeric';
  return dayOf(d).toLocaleDateString('de-DE', opts);
};
export const signedKg = v => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt1(Math.abs(v))} kg`;

/* Ein Eintrag pro Tag. Ein zweiter Wert am selben Tag ersetzt den ersten. */
export function recordWeight(kg, source = 'manual', date = ymd()) {
  const list = S.body.weights;
  const i = list.findIndex(w => w.date === date);
  const entry = { date, kg, source, method: 'scale' };
  if (i >= 0) list[i] = entry; else list.push(entry);
  list.sort(byDate);
  S.profile.weightKg = list[list.length - 1].kg;
}

export function view() {
  const sub = V.bodySub || 'weight';
  const body = sub === 'measures' ? measures.vMeasures() : sub === 'photos' ? photos.vPhotos() : sub === 'activity' ? activity.vActivity() : vWeight();
  return `<div class="day-white">
    <h1 class="page-title">Körper</h1>
    <p class="page-sub">Alles bleibt auf diesem Gerät.</p>
    <div class="seg wide" role="tablist" style="margin-top:14px">${SUBS.map(([k, l]) =>
      `<button role="tab" aria-selected="${sub === k}" class="${sub === k ? 'on' : ''}" data-act="bodysub" data-sub="${k}">${l}</button>`).join('')}</div>
    ${body}
  </div>`;
}

/* ---------- Gewicht ---------- */
function vWeight() {
  const today = ymd();
  const all = [...S.body.weights].sort(byDate);
  const range = V.bodyRange || '4w';
  const list = [...all].reverse();
  const shown = V.bodyAllWeights ? list : list.slice(0, 7);
  const tr = weightTrend(all, today);
  const chart = weightChart(all, { today, range, target: S.profile.targetWeightKg });
  return `
    <section class="block card">
      <h2>Gewicht</h2>
      <div class="weigh">
        <label class="field">Gewicht
          <span class="unit-wrap"><input id="w-today" inputmode="decimal" placeholder="z. B. 82,4" enterkeyhint="done"><span>kg</span></span></label>
        <label class="field">Datum<input id="w-date" type="date" value="${today}" max="${today}"></label>
      </div>
      <div class="stack" style="margin-top:10px"><button class="btn primary" data-act="addweight">Eintragen</button></div>
      <p class="small-print" style="margin-top:8px">Am besten morgens nach dem Aufstehen wiegen, dann sind die Werte vergleichbar. Täglich oder einmal pro Woche, beides geht.</p>
    </section>

    ${all.length ? `<section class="block card w-chart">
      <div class="w-head">
        <div><p class="w-now num">${fmt1(all[all.length - 1].kg)}<small>kg</small></p>
          <p class="small-print">zuletzt am ${esc(dShort(dayOf(all[all.length - 1].date)))}</p></div>
        <p class="w-trend">${tr.ok
          ? `Trend <b class="num">${esc(signedKg(tr.perWeek))}</b> pro Woche`
          : '<span class="dim">Trend ab 5 Einträgen über 2 Wochen</span>'}</p>
      </div>
      <div class="seg wide" role="group" aria-label="Zeitraum" style="margin:10px 0 6px">${RANGES.map(([k, l]) =>
        `<button class="${k === range ? 'on' : ''}" aria-pressed="${k === range}" data-act="bodyrange" data-range="${k}">${l}</button>`).join('')}</div>
      ${chart || '<p class="empty" style="padding:14px 0">In diesem Zeitraum gibt es keine Einträge.</p>'}
      <p class="small-print w-legend"><span class="sw sw-dot"></span>Einzelwerte <span class="sw sw-line"></span>Schnitt der letzten 7 Tage</p>
      <ul class="b-list" style="margin-top:10px">${shown.map(w => `
        <li><span>${esc(dMid(dayOf(w.date)))} <small>${esc(SOURCE[w.source] || '')}</small></span>
          <span><b class="num">${fmt1(w.kg)} kg</b>
          <button class="icon b-del" data-act="bodywdel" data-date="${w.date}" aria-label="Eintrag vom ${esc(dShort(dayOf(w.date)))} löschen">×</button></span></li>`).join('')}</ul>
      ${list.length > 7 ? `<button class="link" data-act="bodywall">${V.bodyAllWeights ? 'Weniger zeigen' : `Alle ${list.length} Einträge zeigen`}</button>` : ''}
    </section>` : ''}

    ${goalCard(all, tr)}
    <section class="block">${bmiCard()}</section>`;
}

function goalCard(all, tr) {
  const target = S.profile.targetWeightKg;
  const start = firstWeight(all);
  const now = currentWeight(S.profile, all);
  const prog = target && start ? goalProgress(start.kg, now, target) : null;
  let forecast = '';
  if (target && all.length) {
    const f = forecastGoal(all, target, ymd());
    if (prog && prog.reached) forecast = '<p class="w-fc"><b>Ziel erreicht.</b> Setz dir ein neues oder halte das Gewicht.</p>';
    else if (f.ok && f.reached) forecast = '<p class="w-fc"><b>Der Trend liegt schon am Ziel.</b></p>';
    else if (f.ok) {
      const range = f.earliest && f.latest
        ? ` Je nach Tempo zwischen ${esc(longDate(f.earliest))} und ${esc(longDate(f.latest))}.`
        : f.earliest ? ` Frühestens am ${esc(longDate(f.earliest))}, bei langsamerem Tempo ist das Datum offen.` : '';
      forecast = `<p class="w-fc">Ziel voraussichtlich erreicht am <b>${esc(longDate(f.date))}</b>.${range}</p>
        <p class="small-print">Aus dem Gewichtstrend der letzten 4 Wochen (${esc(signedKg(f.trend.perWeek))} pro Woche). Eine Prognose, kein Versprechen.</p>`;
    } else forecast = `<p class="w-fc dim">${esc(f.reason)}</p>`;
  }
  return `<section class="block card">
    <h2>Zielgewicht</h2>
    <label class="field" style="margin-top:8px">Ziel
      <span class="unit-wrap"><input data-in="bodytarget" inputmode="decimal" value="${target ? esc(fmtIn(Math.round(target * 10) / 10)) : ''}" placeholder="z. B. 80"><span>kg</span></span></label>
    ${target && start ? `
      <div class="w-goal">
        <div><span>Start</span><b class="num">${fmt1(start.kg)}</b></div>
        <div><span>Jetzt</span><b class="num">${fmt1(now)}</b></div>
        <div><span>Ziel</span><b class="num">${fmt1(target)}</b></div>
      </div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(prog.pct * 100)}" aria-label="Fortschritt zum Zielgewicht"><i style="width:${Math.round(prog.pct * 100)}%"></i></div>
      <p class="small-print" style="margin-top:6px">${prog.reached ? 'Geschafft.' : `Noch ${esc(fmt1(Math.abs(prog.remaining)))} kg bis zum Ziel, ${Math.round(prog.pct * 100)} % des Weges seit ${esc(dShort(dayOf(start.date)))}`}</p>
      ${forecast}`
      : `<p class="small-print" style="margin-top:8px">${target ? 'Trag dein Gewicht ein, dann zeigt die App den Fortschritt.' : 'Mit einem Ziel zeigt die App Fortschritt und eine Prognose.'}</p>`}
  </section>`;
}

/* ---------- Startseite ---------- */
/* Hinweis-Karte, solange diese Woche noch kein Foto existiert und sie nicht weggetippt ist */
export function photoReminderCard() {
  const today = ymd();
  if (photoReminderDue(S.body.photos, today, S.settings.lastPhotoPrompt)) {
    return `<section class="block card day-white b-remind">
      <h2>Fortschrittsfoto</h2>
      <p class="muted" style="margin:4px 0 12px">Diese Woche fehlt noch dein Foto. Drei Posen, eine Minute. Die Fotos bleiben auf dem Handy.</p>
      <div class="sug-btns">
        <button class="btn small primary" data-act="bodygophotos">Fotos machen</button>
        <button class="btn small ghost" data-act="bodyphotolater">Diese Woche nicht</button>
      </div>
    </section>`;
  }
  return '';
}

/* Gewichtstrend unter „Alles zeigen“ im Überblick, ohne Trend nichts */
export function weightTrendCard() {
  const tr = weightTrend(S.body.weights, ymd());
  if (!tr.ok) return '';
  return `<section class="block card day-white">
    <h2>Gewichtstrend</h2>
    <p class="muted" style="margin-top:4px"><b class="num">${esc(signedKg(tr.perWeek))}</b> pro Woche, im Schnitt der letzten ${tr.spanDays} Tage.</p>
    <button class="link" data-act="tab" data-tab="body">Zum Verlauf</button>
  </section>`;
}

export const actions = {
  bodysub: el => { V.bodySub = el.dataset.sub; render(); },
  bodyrange: el => { V.bodyRange = el.dataset.range; render(); },
  bodywall: () => { V.bodyAllWeights = !V.bodyAllWeights; render(); },
  addweight: () => {
    const kg = toNum(document.getElementById('w-today').value);
    const date = (document.getElementById('w-date') || {}).value || ymd();
    if (!(kg >= 30 && kg <= 300)) { toast('Gewicht in kg eintragen, z. B. 82,4'); return; }
    if (date > ymd()) { toast('Das Datum liegt in der Zukunft.'); return; }
    recordWeight(kg, 'manual', date);
    save(); render(); toast('Gewicht eingetragen');
  },
  bodywdel: el => confirmSheet('Eintrag löschen?', `Das Gewicht vom ${dShort(dayOf(el.dataset.date))} wird gelöscht.`, 'Löschen', () => {
    S.body.weights = S.body.weights.filter(w => w.date !== el.dataset.date);
    if (S.body.weights.length) S.profile.weightKg = [...S.body.weights].sort(byDate).pop().kg;
    save(); closeSheet(); toast('Eintrag gelöscht');
  }),
};

export const inputs = {
  bodytarget: (el, type) => {
    if (type !== 'change') return;
    const raw = el.value.trim();
    if (!raw) { S.profile.targetWeightKg = null; save(); render(); return; }
    const kg = toNum(raw);
    if (!(kg >= 30 && kg <= 300)) { toast('Zielgewicht in kg eintragen, z. B. 80'); return; }
    S.profile.targetWeightKg = Math.round(kg * 10) / 10;
    save(); render();
  },
};
