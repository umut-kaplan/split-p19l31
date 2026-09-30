import { S, V, save } from '../state.js';
import { esc, fmt0, fmt1, fmtIn, toNum, ymd, dLong } from '../util.js';
import { render } from '../render.js';
import { targetsFromState, GOALS } from '../domain/energy.js';
import { dayTotals } from '../domain/nutrition.js';
import { dayNumber, dateFromDayNumber } from '../domain/body.js';
import { waterBlock } from '../ui/cards.js';
import { suggestionCards } from '../ui/suggestion.js';
import { openSheet, closeSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import * as log from './nutrition-log.js';

/* Untermodule, deren actions und inputs app.js einsammelt */
export const modules = [log];

/* ---------- Tag ---------- */
/* V.nutDate ist null für heute, sonst 'YYYY-MM-DD'. So springt die Ansicht nach Mitternacht von selbst weiter. */
const curDate = () => V.nutDate || ymd();
const shift = (date, d) => dateFromDayNumber(dayNumber(date) + d);
const noon = date => new Date(date + 'T12:00');
function dayLabel(date) {
  if (date === ymd()) return 'Heute';
  if (date === shift(ymd(), -1)) return 'Gestern';
  return noon(date).toLocaleDateString('de-DE', { weekday: 'long' });
}

const CHEV = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

function daySwitch(date) {
  const isToday = date === ymd();
  return `<div class="nut-day">
    <button class="icon" data-act="nutday" data-d="-1" aria-label="Einen Tag zurück">${CHEV('M15 6l-6 6 6 6')}</button>
    <div class="nut-day-t"><b>${esc(dayLabel(date))}</b><small>${esc(dLong(noon(date)))}</small></div>
    <button class="icon" data-act="nutday" data-d="1" aria-label="Einen Tag vor" ${isToday ? 'disabled' : ''}>${CHEV('M9 6l6 6-6 6')}</button>
  </div>
  ${isToday ? '' : '<div class="nut-back"><button class="link" data-act="nuttoday">Zu heute</button></div>'}`;
}

/* ---------- Bausteine ---------- */
function ring(eaten, goal) {
  const r = 52, C = 2 * Math.PI * r;
  const frac = goal > 0 ? Math.min(1, eaten / goal) : 0;
  const over = goal > 0 && eaten > goal;
  return `<div class="nut-ring">
    <svg viewBox="0 0 128 128" aria-hidden="true">
      <circle cx="64" cy="64" r="${r}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="13"/>
      <circle cx="64" cy="64" r="${r}" fill="none" stroke="${over ? '#FF8A86' : 'var(--c)'}" stroke-width="13" stroke-linecap="round"
        transform="rotate(-90 64 64)" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(2)}"/>
    </svg>
    <div class="nut-ring-c"><b class="num">${fmt0(eaten)}</b><span>von ${goal > 0 ? fmt0(goal) : '–'} kcal</span></div>
  </div>`;
}

function bar(label, eaten, goal, unit, manual) {
  const pct = goal > 0 ? Math.min(100, eaten / goal * 100) : 0;
  return `<div class="nut-mb">
    <div class="nut-mb-top"><span>${label}${manual ? ' <small>von Hand</small>' : ''}</span>
      <span class="num"><b>${fmt0(eaten)}</b> / ${goal != null ? fmt0(goal) : '–'} ${unit}</span></div>
    <div class="bar" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${goal || 0}" aria-valuenow="${Math.round(eaten)}"><i style="width:${pct}%"></i></div>
  </div>`;
}

function restLine(eaten, goal) {
  if (!(goal > 0)) return '';
  const d = goal - eaten;
  if (d >= 0) return `<p class="nut-rest">Noch <b class="num">${fmt0(d)}</b> kcal bis zum Ziel</p>`;
  return `<p class="nut-rest over"><b class="num">${fmt0(-d)}</b> kcal über dem Ziel</p>`;
}

function summaryCard(t, tot) {
  return `<section class="block card nut-sum">
    <div class="nut-sum-row">
      ${ring(tot.kcal, t.kcal)}
      <div class="nut-bars">
        ${bar('Protein', tot.protein, t.protein, 'g', t.manual.protein)}
        ${bar('Fett', tot.fat, t.fat, 'g', t.manual.fat)}
        ${bar('Kohlenhydrate', tot.carbs, t.carbs, 'g', t.manual.carbs)}
      </div>
    </div>
    ${restLine(tot.kcal, t.kcal)}
  </section>`;
}

function missingCard(t) {
  return `<section class="block card">
    <h2>Tagesziel</h2>
    <p class="muted" style="margin:4px 0 12px">Für die Rechnung fehlt noch: ${esc(t.missing.join(', '))}. Du kannst die Ziele auch von Hand setzen.</p>
    <div class="sug-btns" style="margin-top:0">
      <button class="btn small" data-act="tab" data-tab="profile">Profil ergänzen</button>
      <button class="btn small ghost" data-act="nutgoals">Ziele von Hand setzen</button>
    </div>
  </section>`;
}

/* ---------- Woche ---------- */
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function weekData(logData, endDate) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = shift(endDate, i - 6);
    const entries = logData[date] || [];
    return { date, has: entries.length > 0, tot: dayTotals(logData, date) };
  });
}

function weekCard(t, date) {
  const days = weekData(S.nutrition.log, date);
  const filled = days.filter(d => d.has);
  const goal = t.ok ? t.kcal : 0;
  const max = Math.max(goal * 1.15, ...days.map(d => d.tot.kcal), 1);
  const avg = k => filled.reduce((a, d) => a + d.tot[k], 0) / filled.length;
  /* Die Ziel-Markierung sitzt in jedem Balken auf derselben Höhe und ergibt so eine gestrichelte Linie */
  const goalMark = goal > 0 ? `<i class="nut-goal" style="bottom:${(goal / max * 100).toFixed(1)}%"></i>` : '';
  return `<section class="block card">
    <h2>Letzte 7 Tage</h2>
    <div class="nut-week" role="list">
      ${days.map(d => `
        <button class="nut-wd ${d.has ? '' : 'empty'} ${d.date === date ? 'on' : ''}" role="listitem" data-act="nutgo" data-date="${d.date}"
          aria-label="${esc(dLong(noon(d.date)))}: ${d.has ? fmt0(d.tot.kcal) + ' kcal' : 'keine Einträge'}">
          <span class="nut-wd-bar"><i style="height:${d.has ? Math.max(3, d.tot.kcal / max * 100).toFixed(1) : 100}%" class="${goal > 0 && d.tot.kcal > goal ? 'over' : ''}"></i>${goalMark}</span>
          <span class="nut-wd-v num">${d.has ? fmt0(d.tot.kcal) : '–'}</span>
          <span class="nut-wd-d">${WD[noon(d.date).getDay()]}</span>
        </button>`).join('')}
    </div>
    ${goal > 0 ? `<p class="small-print nut-legend"><span class="nut-goal-sw"></span>Kalorienziel ${fmt0(goal)} kcal</p>` : ''}
    ${filled.length
      ? `<p class="muted nut-avg">Schnitt an ${filled.length} von 7 Tagen: <b class="num">${fmt0(avg('kcal'))} kcal</b> und <b class="num">${fmt0(avg('protein'))} g</b> Protein.${filled.length < 7 ? ' Tage ohne Einträge zählen nicht mit.' : ''}</p>`
      : '<p class="muted nut-avg">In diesen 7 Tagen ist noch nichts eingetragen.</p>'}
  </section>`;
}

/* ---------- Ziele und Rechnung ---------- */
function macroLines(t) {
  const m = t.macro;
  if (!m) return [];
  const range = `${m.proteinRange[0]}–${m.proteinRange[1]} g`;
  const lines = [
    m.proteinBasis === 'lean'
      ? `Protein 2,2 g pro kg fettfreier Masse (${fmt1(m.basisKg)} kg): ${m.protein} g. Sinnvoll sind 1,8–2,2 g pro kg fettfreier Masse, also ${range}.`
      : `Protein 2 g pro kg Körpergewicht: ${m.protein} g. Sinnvoll sind 1,8–2,2 g pro kg Körpergewicht, also ${range}.`,
    `Fett 0,8 g pro kg Körpergewicht: ${m.fat} g.`,
    'Kohlenhydrate sind der Rest bis zum Kalorienziel, 4 kcal pro g Protein und Kohlenhydrate, 9 kcal pro g Fett.',
  ];
  if (Object.values(t.manual).some(Boolean)) lines.push('Von Hand gesetzte Werte gehen vor; ohne eigenen Wert rechnen sich die Kohlenhydrate aus dem Rest.');
  return lines;
}

function goalsCard(t) {
  if (!t.ok) return '';
  const goal = GOALS[S.profile.goal] || GOALS.recomp;
  const tag = k => (t.manual[k] ? '<small class="nut-tag">von Hand</small>' : '');
  return `<section class="block card">
    <h2>Deine Tagesziele</h2>
    <p class="kcal-big num">${fmt0(t.kcal)}<small>kcal</small></p>
    <p class="muted" style="margin-top:6px">${t.manual.kcal ? 'Von Hand gesetzt.' : `Berechnet für „${esc(goal.label)}“.`}</p>
    <div class="macros">
      <div class="macro"><b class="num">${t.protein != null ? fmt0(t.protein) + ' g' : '–'}</b><span>Protein ${tag('protein')}</span></div>
      <div class="macro"><b class="num">${t.fat != null ? fmt0(t.fat) + ' g' : '–'}</b><span>Fett ${tag('fat')}</span></div>
      <div class="macro"><b class="num">${t.carbs != null ? fmt0(t.carbs) + ' g' : '–'}</b><span>Kohlenhydrate ${tag('carbs')}</span></div>
    </div>
    ${t.calc.ok ? `<details class="more" style="margin-top:8px">
      <summary>So rechnet die App</summary>
      <ol class="calc">
        ${t.calc.lines.map(l => `<li>${esc(l)}</li>`).join('')}
        ${macroLines(t).map(l => `<li>${esc(l)}</li>`).join('')}
      </ol>
    </details>` : ''}
    <div class="stack" style="margin-top:8px"><button class="btn" data-act="nutgoals">Ziele anpassen</button></div>
  </section>`;
}

function waterCard(date) {
  if (date === ymd()) return `<section class="block card"><h2>Getrunken</h2>${waterBlock()}</section>`;
  const ml = S.water[date] || 0;
  return `<section class="block card"><h2>Getrunken</h2><p class="muted">An diesem Tag: <b class="num">${fmt1(ml / 1000)} l</b>. Wasser trägst du immer für heute ein.</p></section>`;
}

/* ---------- Ansicht ---------- */
export function view() {
  const sub = log.subview();
  if (sub) return sub;
  const date = curDate();
  const t = targetsFromState(S);
  const tot = dayTotals(S.nutrition.log, date);
  const sugg = suggestionCards('nutrition');
  return `<div class="day-yellow">
    <h1 class="page-title">Ernährung</h1>
    ${daySwitch(date)}
    ${t.ok ? summaryCard(t, tot) : missingCard(t)}
    ${sugg ? `<section class="block"><div class="stack" style="margin-top:0">${sugg}</div></section>` : ''}
    ${log.vMealsSection(date)}
    ${waterCard(date)}
    ${weekCard(t, date)}
    ${goalsCard(t)}
    <p class="small-print" style="margin-top:18px">Alle Werte sind Schätzungen aus Formeln und Nährwertangaben. Sie ersetzen keine Ernährungsberatung.</p>
  </div>`;
}

/* Karte „Tagesziele“ auf der Startseite */
export function todayGoalsCard() {
  const t = targetsFromState(S);
  if (!t.ok) {
    return `<section class="block card"><h2>Tagesziele</h2>
      <div class="goal-row"><div class="goal-top"><span>Kalorienziel</span></div>
        <p class="muted" style="margin-bottom:10px">Dafür fehlt noch: ${esc(t.missing.join(', '))}.</p>
        <button class="btn small" data-act="tab" data-tab="profile">Profil ergänzen</button></div>
      ${waterBlock()}</section>`;
  }
  const tot = dayTotals(S.nutrition.log, ymd());
  const row = (label, eaten, goal, unit) => `<div class="goal-row day-yellow">
    <div class="goal-top"><span>${label}</span><span><b class="num">${fmt0(eaten)}</b> <small>von ${goal != null ? fmt0(goal) : '–'} ${unit}</small></span></div>
    <div class="bar"><i style="width:${goal > 0 ? Math.min(100, eaten / goal * 100) : 0}%"></i></div>
  </div>`;
  return `<section class="block card"><h2>Tagesziele</h2>
    ${row('Kalorien', tot.kcal, t.kcal, 'kcal')}
    ${row('Protein', tot.protein, t.protein, 'g')}
    <div class="day-yellow" style="margin-top:12px"><button class="btn small" data-act="nutopen">Essen eintragen</button></div>
    ${waterBlock()}
  </section>`;
}

/* ---------- Ziele von Hand ---------- */
function goalsForm() {
  const ov = S.nutrition.overrides || {};
  const auto = targetsFromState({ ...S, nutrition: { ...S.nutrition, overrides: null } });
  const ph = k => (auto.ok && auto[k] != null ? fmt0(auto[k]) : '–');
  const field = (k, label, unit) => `<label>${label}
    <span class="unit-wrap nut-unit"><input id="nut-ov-${k}" inputmode="numeric" value="${ov[k] != null ? esc(fmtIn(Math.round(ov[k]))) : ''}" placeholder="${ph(k)}"><span>${unit}</span></span></label>`;
  return `<div class="form">
    ${field('kcal', 'Kalorien', 'kcal')}
    <div class="row3">${field('protein', 'Protein', 'g')}${field('fat', 'Fett', 'g')}${field('carbs', 'Kohlenhydrate', 'g')}</div>
    <p class="help">Grau steht der berechnete Wert. Leere Felder rechnet die App selbst aus, ohne eigenen Wert sind die Kohlenhydrate der Rest bis zum Kalorienziel.</p>
  </div>`;
}

const LIMITS = { kcal: [800, 6000], protein: [20, 400], fat: [15, 300], carbs: [0, 900] };
const NAMES = { kcal: 'Kalorien', protein: 'Protein', fat: 'Fett', carbs: 'Kohlenhydrate' };

function readGoals() {
  const out = {};
  for (const k of Object.keys(LIMITS)) {
    const raw = document.getElementById('nut-ov-' + k).value.trim();
    if (raw === '') continue;
    const n = toNum(raw);
    const [lo, hi] = LIMITS[k];
    if (!(n >= lo && n <= hi)) return `${NAMES[k]}: bitte eine Zahl von ${fmt0(lo)} bis ${fmt0(hi)}.`;
    out[k] = Math.round(n);
  }
  return out;
}

function openGoals() {
  openSheet({
    title: 'Tagesziele anpassen',
    body: goalsForm(),
    actions: [
      {
        label: 'Ziele speichern', kind: 'primary', fn: () => {
          const r = readGoals();
          if (typeof r === 'string') { toast(r); return; }
          S.nutrition.overrides = Object.keys(r).length ? r : null;
          save(); closeSheet(); toast('Ziele gespeichert');
        },
      },
      { label: 'Berechnung wieder nutzen', kind: 'ghost', fn: () => { S.nutrition.overrides = null; save(); closeSheet(); toast('Die App rechnet die Ziele wieder selbst'); } },
      { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
    ],
  });
}

export const actions = {
  nutday: el => {
    const next = shift(curDate(), Number(el.dataset.d));
    if (dayNumber(next) > dayNumber(ymd())) return;
    V.nutDate = next === ymd() ? null : next;
    render();
  },
  nuttoday: () => { V.nutDate = null; render(); },
  nutgo: el => { const d = el.dataset.date; V.nutDate = d === ymd() ? null : d; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  nutgoals: openGoals,
  nutopen: () => { V.nutDate = null; V.tab = 'nutrition'; render(); window.scrollTo(0, 0); },
};
