/* Wochenbericht (Stufe 5): jeden Montag auf der Startseite, als Bild teilbar. */
import { S, V, save } from '../state.js';
import { esc, fmt0, fmt1, ymd, dMid } from '../util.js';
import { render } from '../render.js';
import { weeklyReport, reportWeekStart, reportKey, reportHeadline, nextWeekStart } from '../domain/report.js';
import { prevWeekStart } from '../domain/volume.js';
import { recoveryFromState, LEVEL_LABEL } from '../domain/recovery.js';
import { targetsFromState } from '../domain/energy.js';
import { findExercise } from '../domain/library.js';
import { formatRecord, RECORD_LABEL } from '../domain/prs.js';
import { WEEKLY_SET_TARGET } from '../domain/muscles.js';
import { plateSVG } from '../ui/plate.js';
import { suggestionCards } from '../ui/suggestion.js';
import { reportImageFile } from '../ui/report-image.js';
import { toast } from '../ui/toast.js';
import { shareFile, SHARE_FAILED } from '../ui/share-file.js';

const resolve = n => findExercise(n, S.exercisesCustom);
const mot = () => {
  if (!S.motivation) S.motivation = { goals: [], weekly: { proteinDays: 5, waterDays: 5 }, badges: {}, reportSeen: null };
  return S.motivation;
};

const month = d => d.toLocaleDateString('de-DE', { month: 'long' });

/* „21.–27. September“ oder „28. September – 4. Oktober“, mit Jahr, wenn es nicht das laufende ist */
export function rangeText(start) {
  const a = new Date(start);
  const b = new Date(start);
  b.setDate(b.getDate() + 6);
  const yr = b.getFullYear() !== new Date().getFullYear() ? ` ${b.getFullYear()}` : '';
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}.–${b.getDate()}. ${month(b)}${yr}`
    : `${a.getDate()}. ${month(a)} – ${b.getDate()}. ${month(b)}${yr}`;
}
const weekLabel = key => `KW ${Number(key.slice(-2))}`;

function build(start) {
  const t = targetsFromState(S);
  return weeklyReport(S, start, { resolve, targets: t.ok ? { kcal: t.kcal, protein: t.protein } : null });
}

/* Ampel gibt es nur für den jüngsten Bericht, sie gilt für die Woche, die gerade beginnt */
const isLatest = start => start === reportWeekStart(Date.now());

function markSeen(start) {
  if (!isLatest(start)) return;
  const key = reportKey(start);
  if (mot().reportSeen !== key) { mot().reportSeen = key; save(); }
}

/* ---------- Startseite ---------- */
export function reportCard() {
  if (V.repHidden) return '';
  const start = reportWeekStart(Date.now());
  if (mot().reportSeen === reportKey(start)) return '';
  const r = build(start);
  if (!r.hasData) return '';
  return `<section class="block card rep-card">
    <div class="rep-card-head">
      <span class="rep-card-plate" aria-hidden="true">${plateSVG('yellow', '', '', { small: true })}</span>
      <div><h2>Dein Wochenbericht</h2><p class="muted">${esc(rangeText(start))}</p></div>
    </div>
    <p class="rep-card-line">${esc(reportHeadline(r))}</p>
    <div class="sug-btns">
      <button class="btn small primary" data-act="repopen" data-week="${start}">Bericht ansehen</button>
      <button class="btn small ghost" data-act="repdismiss">Später</button>
    </div>
  </section>`;
}

/* ---------- Ganzer Bericht ---------- */
const ARROW = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const SCALE = 25;

function trainingSection(r) {
  const t = r.training;
  const miss = t.target - t.count;
  return `<section class="block card">
    <h2>Training</h2>
    <div class="stats rep-stats">
      <div><b class="num">${t.count}/${t.target}</b><span>Einheiten</span></div>
      <div><b class="num">${fmt0(t.sets)}</b><span>harte Sätze</span></div>
      <div><b class="num">${fmt0(t.minutes)}</b><span>Minuten</span></div>
    </div>
    <p class="${t.met ? 'rep-good' : 'muted'}">${t.met ? 'Wochenziel geschafft.' : `Zum Wochenziel ${miss === 1 ? 'fehlte eine Einheit' : `fehlten ${miss} Einheiten`}.`}${t.tonnage > 0 ? ` Bewegt: ${t.tonnage >= 1000 ? `${fmt1(t.tonnage / 1000)} t` : `${fmt0(t.tonnage)} kg`}.` : ''}</p>
    ${t.sessions.length ? `<ul class="rep-sessions">${t.sessions.map(s => `
      <li class="day-${esc(s.color || 'red')}"><span class="dot"></span><span>${esc(s.name)}</span><small>${esc(dMid(s.date))}</small></li>`).join('')}</ul>` : ''}
  </section>`;
}

function muscleSection(r) {
  if (!r.muscles.length) return '';
  const [lo, hi] = WEEKLY_SET_TARGET;
  const rate = { low: 'unter dem Zielbereich', ok: 'im Zielbereich', high: 'über dem Zielbereich' };
  return `<section class="block card">
    <h2>Sätze pro Muskelgruppe</h2>
    <p class="small-print">Zielbereich ${lo} bis ${hi} Sätze pro Woche, mitbeanspruchte Muskeln zählen halb. ${r.musclesOk} von ${r.muscles.length} im Ziel.</p>
    <ul class="vol-list">${r.muscles.map(m => `
      <li class="vol-row ${m.rating}" aria-label="${esc(m.label)}: ${esc(fmt1(m.sets))} Sätze, ${rate[m.rating]}">
        <div class="vol-top"><span>${esc(m.label)}</span><span><b class="num">${esc(fmt1(m.sets))}</b> ${m.sets === 1 ? 'Satz' : 'Sätze'}</span></div>
        <div class="vol-bar" aria-hidden="true"><span class="vol-zone" style="left:${lo / SCALE * 100}%;width:${(hi - lo) / SCALE * 100}%"></span><i style="width:${Math.min(100, m.sets / SCALE * 100).toFixed(0)}%"></i></div>
      </li>`).join('')}</ul>
    ${r.unknown.length ? `<p class="small-print" style="margin-top:10px">Nicht gezählt, weil die Bibliothek sie nicht kennt: ${esc(r.unknown.join(', '))}.</p>` : ''}
  </section>`;
}

const MAX_RECORDS = 8;
function recordSection(r) {
  const g = r.recordGroups;
  const shown = g.slice(0, MAX_RECORDS);
  return `<section class="block card">
    <h2>Neue Rekorde</h2>
    ${g.length ? `<ul class="rep-records">${shown.map(x => `
      <li><b class="rep-rec-name">${esc(x.name)}</b>
        <span class="rep-rec-items">${x.items.map(it => `<span><small>${esc(RECORD_LABEL[it.kind])}</small> <b class="num">${esc(formatRecord(it.kind, it.value))}</b></span>`).join('')}</span></li>`).join('')}</ul>
      ${g.length > MAX_RECORDS ? `<p class="small-print" style="margin-top:8px">Und ${g.length - MAX_RECORDS} weitere Übungen mit neuem Rekord.</p>` : ''}`
      : '<p class="muted">In dieser Woche kein neuer Rekord.</p>'}
  </section>`;
}

function bodySection(r) {
  const w = r.weight;
  const signed = v => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt1(Math.abs(v))} kg`;
  return `<section class="block card">
    <h2>Gewicht</h2>
    ${w.ok
      ? `<p class="rep-big num">${esc(signed(w.delta))}</p>
         <p class="small-print">7-Tage-Schnitt von ${esc(fmt1(w.start))} auf ${esc(fmt1(w.end))} kg, aus ${w.entries} ${w.entries === 1 ? 'Eintrag' : 'Einträgen'} dieser Woche.</p>`
      : `<p class="muted">${esc(w.reason)}</p>`}
  </section>`;
}

function foodSection(r) {
  const n = r.nutrition;
  const t = r.targets;
  if (!n.days) return `<section class="block card"><h2>Ernährung</h2><p class="muted">In dieser Woche ist kein Essen eingetragen.</p></section>`;
  const row = (label, val, target, unit) => `<div class="rep-row"><span>${label}</span><span><b class="num">${fmt0(val)}</b> ${unit}${target ? ` <small>von ${fmt0(target)}</small>` : ''}</span></div>`;
  return `<section class="block card">
    <h2>Ernährung</h2>
    ${row('Kalorien im Schnitt', n.avgKcal, t && t.kcal, 'kcal')}
    ${row('Protein im Schnitt', n.avgProtein, t && t.protein, 'g')}
    <p class="small-print">Nur Tage mit Einträgen zählen, hier ${n.days} von 7.${t ? ' Ziele wie heute berechnet.' : ''}</p>
  </section>`;
}

function recoverySection() {
  const rec = recoveryFromState(S, ymd());
  return `<section class="block card rec-card rec-${rec.level}">
    <div class="rec-head">
      <span class="rec-light" aria-hidden="true">${plateSVG(rec.level, '', '', { small: true })}</span>
      <div><h2>Erholung für die neue Woche</h2><p class="rec-level">Ampel ${esc(LEVEL_LABEL[rec.level].toLowerCase())}</p></div>
    </div>
    <p class="rec-summary">${esc(rec.summary)}</p>
  </section>`;
}

/* Der Bericht schließt sich, sobald jemand über die Navigation zu Heute wechselt:
   app.js setzt dabei V.roll. Beim Öffnen setzen wir es zurück. */
export function subview() {
  if (V.repView == null) return null;
  if (V.roll) { V.repView = null; return null; }
  const start = V.repView;
  const latest = reportWeekStart(Date.now());
  const r = build(start);
  const sug = isLatest(start) ? suggestionCards(null, 5) : '';
  return `<div class="day-yellow rep">
    <div class="rep-top"><button class="link" data-act="repclose">Zurück zu Heute</button></div>
    <h1 class="page-title">Wochenbericht</h1>
    <div class="rep-week">
      <button class="icon" data-act="repweek" data-d="-1" aria-label="Woche davor">${ARROW('M15 6l-6 6 6 6')}</button>
      <div><b>${esc(rangeText(start))}</b><span>${esc(weekLabel(r.key))}</span></div>
      <button class="icon" data-act="repweek" data-d="1" aria-label="Woche danach" ${start >= latest ? 'disabled' : ''}>${ARROW('M9 6l6 6-6 6')}</button>
    </div>
    ${r.hasData ? `
      <p class="rep-lead">${esc(reportHeadline(r))}</p>
      ${trainingSection(r)}
      ${muscleSection(r)}
      ${recordSection(r)}
      ${bodySection(r)}
      ${foodSection(r)}
      ${isLatest(start) ? recoverySection() : ''}
      ${sug ? `<section class="block"><h2>Vorschläge der Woche</h2><div class="stack" style="margin-top:0">${sug}</div></section>` : ''}
      <section class="block card rep-share">
        <h2>Teilen</h2>
        <p class="muted" style="margin:4px 0 12px">Das Bild zeigt die Zahlen dieser Woche, ohne deinen Namen.</p>
        <button class="btn primary" data-act="repshare">Als Bild teilen</button>
      </section>`
    : '<p class="empty rep-lead">In dieser Woche gibt es keine Einträge.</p>'}
  </div>`;
}

/* ---------- Teilen ---------- */
function share(start) {
  const r = build(start);
  const rec = isLatest(start) ? recoveryFromState(S, ymd()) : null;
  let file;
  try { file = reportImageFile(r, rec, rangeText(start)); }
  catch (e) { toast('Das Bild ließ sich nicht erzeugen.'); return; }
  /* Muss direkt aus dem Tipp laufen, sonst verweigert Safari das Teilen-Menü */
  shareFile(file, file.name || `wochenbericht-${r.key}.png`, file.type || 'image/png', `Wochenbericht ${weekLabel(r.key)}`).then(res => {
    if (res === 'downloaded' || res === 'unsure') toast('Bild heruntergeladen. Prüfe, ob es in Dateien liegt.');
    else if (res === 'failed') toast(SHARE_FAILED);
  });
}

export const actions = {
  repopen: el => {
    const start = Number(el.dataset.week) || reportWeekStart(Date.now());
    V.repView = start;
    V.roll = false;
    markSeen(start);
    render(); window.scrollTo(0, 0);
  },
  repclose: () => { V.repView = null; render(); window.scrollTo(0, 0); },
  repweek: el => {
    const latest = reportWeekStart(Date.now());
    const cur = V.repView == null ? latest : V.repView;
    const next = Number(el.dataset.d) < 0 ? prevWeekStart(cur) : nextWeekStart(cur);
    if (next > latest) return;
    V.repView = next;
    markSeen(next);
    render(); window.scrollTo(0, 0);
  },
  repdismiss: () => { V.repHidden = true; render(); },
  repshare: () => { if (V.repView != null) share(V.repView); },
};

export const inputs = {};
