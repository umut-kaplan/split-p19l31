import { S, V, save, activePlan } from '../state.js';
import { esc, fmt, fmt1, dShort, dMid, dLong, ymd, plural } from '../util.js';
import { render } from '../render.js';
import { lineChart } from '../ui/chart.js';
import { toast } from '../ui/toast.js';
import { confirmSheet, closeSheet } from '../ui/sheet.js';
import { fmtSet, shortBadge } from './workout.js';
import { personalRecords, exerciseSeries, RECORD_LABEL, formatRecord, assistText } from '../domain/prs.js';
import { muscleWeeks, volumeRating } from '../domain/volume.js';
import { findExercise } from '../domain/library.js';
import { MUSCLES, weeklyTarget, weeklyTargetText } from '../domain/muscles.js';
import { ratingSummary, ratingBadge } from './session-rating.js';
import { workSets } from '../domain/settypes.js';

const VIEWS = [['sessions', 'Einheiten'], ['exercise', 'Übung'], ['records', 'Rekorde'], ['muscles', 'Muskeln']];
const CHEV = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const LEFT = CHEV('M15 6l-6 6 6 6'), RIGHT = CHEV('M9 6l6 6-6 6');
const minutes = s => Math.round((s.endedAt - s.startedAt) / 60000);
const clock = t => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

export function vHistory() {
  const view = VIEWS.some(v => v[0] === V.histView) ? V.histView : 'sessions';
  const body = view === 'exercise' ? vExercise() : view === 'records' ? vRecords() : view === 'muscles' ? vMuscles() : vSessions();
  return `<div class="hist">
    <div class="chips hist-chips" role="tablist" aria-label="Verlauf">${VIEWS.map(([k, l]) =>
      `<button role="tab" class="chip ${view === k ? 'on' : ''}" aria-selected="${view === k}" data-act="histview" data-v="${k}">${l}</button>`).join('')}</div>
    ${body}
  </div>`;
}

/* ---------- Einheiten: Kalender und Liste ---------- */
function sessionBody(s) {
  return `${ratingSummary(s)}
    <dl>${s.ex.filter(x => x.sets.length).map(x => `
    <div><dt>${esc(x.name)}</dt><dd class="num">${x.sets.map(st => fmtSet(st, x.unit)).join(', ')}</dd></div>`).join('')}</dl>
    <button class="link" data-act="delsession" data-id="${s.id}">Training löschen</button>`;
}

function vSessions() {
  const mode = V.histMode === 'list' ? 'list' : 'calendar';
  return `<div class="seg hist-mode" role="group" aria-label="Darstellung">${[['calendar', 'Kalender'], ['list', 'Liste']].map(([k, l]) =>
      `<button class="${mode === k ? 'on' : ''}" aria-pressed="${mode === k}" data-act="histmode" data-v="${k}">${l}</button>`).join('')}</div>
    ${mode === 'list' ? vList() : vCalendar()}`;
}

function vList() {
  const sessions = [...S.sessions].reverse();
  if (!sessions.length) return '<p class="empty" style="margin-top:16px">Nach dem ersten Training stehen hier deine Einheiten.</p>';
  return `<ul class="sess" style="margin-top:14px">${sessions.map(s => `
    <li class="day-${s.color}"><details>
      <summary><span class="dot"></span><span><b>${esc(s.name)}</b> ${shortBadge(s)}${ratingBadge(s)}<br><small>${esc(dMid(s.startedAt))}</small></span>
        <small class="num">${minutes(s)} Min.</small></summary>
      <div class="body">${sessionBody(s)}</div>
    </details></li>`).join('')}</ul>`;
}

function vCalendar() {
  const today = ymd();
  const month = /^\d{4}-\d{2}$/.test(V.histMonth || '') ? V.histMonth : today.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const byDay = new Map();
  S.sessions.forEach(s => { const k = ymd(s.startedAt); byDay.set(k, [...(byDay.get(k) || []), s]); });
  const inMonth = S.sessions.filter(s => ymd(s.startedAt).startsWith(month)).length;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span class="cal-empty" aria-hidden="true"></span>');
  for (let d = 1; d <= days; d++) {
    const key = `${month}-${String(d).padStart(2, '0')}`;
    const ss = byDay.get(key) || [];
    const label = `${dLong(new Date(y, m - 1, d))}: ${ss.length ? ss.map(s => s.name).join(', ') : 'kein Training'}`;
    cells.push(`<button class="cal-day ${ss.length ? 'has' : ''} ${key === today ? 'today' : ''} ${key === V.histDay ? 'sel' : ''}"
      data-act="histday" data-d="${key}" aria-label="${esc(label)}" aria-pressed="${key === V.histDay}">
      <span class="num">${d}</span><span class="cal-dots">${ss.map(s => `<i class="day-${esc(s.color)}"></i>`).join('')}</span></button>`);
  }
  const atNow = month >= today.slice(0, 7);
  const sel = V.histDay && V.histDay.startsWith(month) ? V.histDay : null;
  const selSessions = sel ? byDay.get(sel) || [] : [];
  return `<section class="card cal">
      <div class="cal-nav">
        <button class="icon" data-act="histmonth" data-d="-1" aria-label="Voriger Monat">${LEFT}</button>
        <div><h2>${esc(first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }))}</h2>
          <p class="small-print">${inMonth === 1 ? '1 Einheit' : `${inMonth} Einheiten`}</p></div>
        <button class="icon" data-act="histmonth" data-d="1" aria-label="Nächster Monat" ${atNow ? 'disabled' : ''}>${RIGHT}</button>
      </div>
      <div class="cal-grid">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(w => `<span class="cal-wd" aria-hidden="true">${w}</span>`).join('')}${cells.join('')}</div>
    </section>
    ${sel ? (selSessions.length ? selSessions.map(s => `
      <section class="card cal-detail day-${esc(s.color)}">
        <div class="cal-detail-h"><span class="dot"></span><div><h2>${esc(s.name)} ${shortBadge(s)}${ratingBadge(s)}</h2>
          <p class="small-print">${esc(dLong(s.startedAt))}, ${clock(s.startedAt)} Uhr, ${minutes(s)} Min.</p></div></div>
        ${sessionBody(s)}
      </section>`).join('')
      : `<p class="empty cal-hint">Am ${esc(dLong(new Date(sel + 'T12:00')))} hast du nicht trainiert.</p>`)
      : '<p class="small-print cal-hint">Tippe auf einen Tag, um die Einheit zu sehen.</p>'}`;
}

/* ---------- Übung: Diagramm nach Gewicht, 1RM oder Volumen ---------- */
function exerciseKeys() {
  const plan = activePlan();
  const keys = [];
  const seen = new Set();
  plan.order.forEach(did => plan.days[did].exercises.forEach(e => e.names.forEach(n => {
    const k = e.id + '|' + n;
    if (!seen.has(k)) { seen.add(k); keys.push({ k, n, day: did }); }
  })));
  S.sessions.forEach(s => s.ex.forEach(x => {
    const k = x.exId + '|' + x.name;
    if (!seen.has(k)) { seen.add(k); keys.push({ k, n: x.name, day: s.dayId }); }
  }));
  return { keys, seen };
}

const hasData = k => S.sessions.some(s => s.ex.some(x => x.exId + '|' + x.name === k && workSets(x.sets).length));

/* Welche Kennzahlen hat diese Übung? */
function metricsOf(series) {
  if (!series.length) return [];
  if (series[0].unit === 'sec') return ['time'];
  const out = [];
  if (series.some(p => p.weight > 0)) out.push('weight', 'e1rm', 'volume');
  if (series.some(p => p.reps > 0)) out.push('reps');
  return out;
}
const METRIC_LABEL = { weight: 'Gewicht', e1rm: '1RM', volume: 'Volumen', reps: 'Wdh.', time: 'Zeit' };
const METRIC_NOTE = {
  weight: 'Schwerster Satz pro Training, ohne Aufwärm- und Dropsätze.',
  e1rm: 'Geschätztes Maximalgewicht für eine Wiederholung nach Epley, aus Sätzen mit bis zu 12 Wiederholungen.',
  volume: 'Gewicht mal Wiederholungen, alle Sätze eines Trainings zusammen, ohne Aufwärmsätze.',
  reps: 'Meiste Wiederholungen in einem Satz ohne Zusatzgewicht.',
  assisted: 'Meiste Wiederholungen in einem Satz. Die kg dieser Übung sind Unterstützung: Weniger Unterstützung ist auch Fortschritt, sie steht nicht in der Kurve.',
  time: 'Längste Zeit in einem Satz.',
};

function vExercise() {
  const plan = activePlan();
  const { keys, seen } = exerciseKeys();
  if (!V.histKey || !seen.has(V.histKey)) V.histKey = (keys.find(o => hasData(o.k)) || keys[0] || {}).k;
  const cur = keys.find(o => o.k === V.histKey);
  const color = cur && plan.days[cur.day] ? plan.days[cur.day].color : 'red';
  const groups = plan.order.map(did => {
    const opts = keys.filter(o => o.day === did);
    return `<optgroup label="${esc(plan.days[did].name)}">${opts.map(o =>
      `<option value="${esc(o.k)}" ${o.k === V.histKey ? 'selected' : ''}>${esc(o.n)}${hasData(o.k) ? '' : ' (noch leer)'}</option>`).join('')}</optgroup>`;
  }).join('');
  const other = keys.filter(o => !plan.days[o.day]);
  let chartHtml = '<p class="empty">Keine Übung gewählt.</p>';
  let seg = '';
  if (V.histKey) {
    const [exId, name] = V.histKey.split('|');
    const series = exerciseSeries(S.sessions, exId, name);
    const metrics = metricsOf(series);
    const metric = metrics.includes(V.histMetric) ? V.histMetric : metrics[0];
    if (metrics.length > 1) {
      seg = `<div class="seg wide hist-metric" role="group" aria-label="Kennzahl">${metrics.map(k =>
        `<button class="${k === metric ? 'on' : ''}" aria-pressed="${k === metric}" data-act="histmetric" data-v="${k}">${METRIC_LABEL[k]}</button>`).join('')}</div>`;
    }
    chartHtml = metric ? chart(series, metric, name) : '<p class="empty">Für diese Übung gibt es noch keine Einträge. Nach dem ersten Training erscheint hier dein Wert.</p>';
  }
  return `<div class="day-${esc(color)}">
    <label class="field" style="margin-top:14px">Übung
      <select id="histSel" data-in="hist">${groups}${other.length ? `<optgroup label="Andere">${other.map(o =>
        `<option value="${esc(o.k)}" ${o.k === V.histKey ? 'selected' : ''}>${esc(o.n)}</option>`).join('')}</optgroup>` : ''}</select></label>
    ${seg}
    <div class="card chart">${chartHtml}</div>
  </div>`;
}

function chart(series, metric, name) {
  const pts = series.filter(p => p[metric] > 0).map(p => ({ t: p.t, v: p[metric] }));
  if (!pts.length) return `<p class="empty">Für ${esc(METRIC_LABEL[metric])} gibt es bei dieser Übung noch keinen Wert.</p>`;
  const f = v => formatRecord(metric === 'reps' ? 'reps' : metric, v);
  const last = pts[pts.length - 1].v, first = pts[0].v, best = Math.max(...pts.map(p => p.v));
  const diff = last - first;
  const [num, unit] = (() => { const t = f(last); const i = t.lastIndexOf(' '); return [t.slice(0, i), t.slice(i + 1)]; })();
  const head = `<div class="chart-head"><div class="big num">${esc(num)}<small>${esc(unit)}</small></div>
    <div class="delta">${pts.length > 1 ? `seit ${esc(dShort(pts[0].t))}: <b class="num">${diff >= 0 ? '+' : '−'}${esc(f(Math.abs(diff)))}</b><br>` : ''}Bestwert <span class="num">${esc(f(best))}</span></div></div>`;
  /* Gegengewicht (4.7): Die Kurve zeigt Wiederholungen, die Unterstützung steht nicht darin */
  const assisted = metric === 'reps' && series.some(p => p.assist != null);
  const note = `<p class="small-print hist-note">${esc(assisted ? METRIC_NOTE.assisted : METRIC_NOTE[metric])}</p>`;
  if (pts.length < 2) return head + '<p class="empty" style="padding:0 4px 6px">Ab dem zweiten Training wird hier eine Kurve daraus.</p>' + note;
  return head + lineChart(pts, `${METRIC_LABEL[metric]} ${name}`) + note;
}

/* ---------- Rekorde ---------- */
/* Ohne Bestwert: am Smart-Zirkel liegt das an den Methoden, Rekorde zählen nur aus „Regulär“ */
const noBest = r => ((findExercise(r.name, S.exercisesCustom) || {}).autoLoad ? 'Bestwert nur aus regulären Sätzen' : 'Noch kein Bestwert');
function vRecords() {
  const recs = [...personalRecords(S.sessions).values()];
  if (!recs.length) return '<p class="empty" style="margin-top:16px">Nach dem ersten Training stehen hier deine Bestwerte.</p>';
  const plan = activePlan();
  const order = [];
  plan.order.forEach(did => plan.days[did].exercises.forEach(e => e.names.forEach(n => order.push(e.id + '|' + n))));
  const rank = r => { const i = order.indexOf(r.key); return i < 0 ? 1e6 : i; };
  recs.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'de'));
  const cell = (r, k) => (r[k] ? `<span class="rec-cell"><small>${RECORD_LABEL[k]}</small>
      <b class="num">${esc(k === 'reps' && r.assisted ? assistText(r[k]) : formatRecord(k, r[k].value))}</b><small class="num">${esc(dShort(r[k].date))}</small></span>` : '');
  return `<ul class="rec-list">${recs.map(r => {
    const kinds = r.unit === 'sec' ? ['time'] : ['weight', 'e1rm', 'volume', 'reps'];
    const cells = kinds.map(k => cell(r, k)).join('');
    return `<li><button class="rec" data-act="histrec" data-k="${esc(r.key)}" aria-label="${esc(r.name)}, Verlauf zeigen">
      <span class="rec-name"><b>${esc(r.name)}</b><small>${r.count} ${r.count === 1 ? 'Training' : 'Trainings'}</small></span>
      <span class="rec-grid">${cells || `<small class="muted">${noBest(r)}</small>`}</span></button></li>`;
  }).join('')}</ul>
  <p class="small-print hist-note">1RM ist das geschätzte Maximalgewicht für eine Wiederholung nach Epley, gerechnet aus Sätzen mit bis zu 12 Wiederholungen. Volumen ist Gewicht mal Wiederholungen eines Trainings. Aufwärmsätze zählen nie, Dropsätze nur beim Volumen.</p>`;
}

/* ---------- Muskeln: Sätze pro Woche ---------- */
const SCALE = 25;
function vMuscles() {
  const resolve = n => findExercise(n, S.exercisesCustom);
  const weeks = muscleWeeks(S.sessions, Date.now(), 6, resolve);
  const back = Math.max(0, Math.min(weeks.length - 1, V.histWeekBack || 0));
  const w = weeks[weeks.length - 1 - back];
  const thisWeek = back === 0;
  const plan = activePlan();
  const planMuscles = new Set();
  plan.order.forEach(did => plan.days[did].exercises.forEach(e => e.names.forEach(n => {
    const lib = resolve(n);
    if (lib && lib.muscles) (lib.muscles.primary || []).forEach(m => planMuscles.add(m));
  })));
  const shown = Object.keys(MUSCLES).filter(m => planMuscles.has(m) || weeks.some(x => (x.sets[m] || 0) > 0));
  const weekLabel = thisWeek ? 'diese Woche' : `in der Woche ab ${dShort(w.start)}`;
  const rateText = { low: 'unter dem Ziel', ok: 'im Zielbereich', high: 'über dem Ziel', none: 'ohne Zielbereich' };
  const rows = shown.map(m => {
    const v = w.sets[m] || 0;
    const r = volumeRating(v, m);
    const t = weeklyTarget(m);
    const spark = weeks.map((x, i) => {
      const val = x.sets[m] || 0;
      return `<i class="${volumeRating(val, m)} ${i === weeks.length - 1 - back ? 'cur' : ''}" style="height:${Math.max(6, Math.min(100, val / SCALE * 100)).toFixed(0)}%"></i>`;
    }).join('');
    return `<li class="vol-row ${r}" aria-label="${esc(MUSCLES[m])}: ${esc(fmt1(v))} ${v === 1 ? 'Satz' : 'Sätze'} ${esc(weekLabel)}, ${rateText[r]}">
      <div class="vol-top"><span>${esc(MUSCLES[m])}</span><span><b class="num">${esc(fmt1(v))}</b> ${v === 1 ? 'Satz' : 'Sätze'}</span></div>
      <div class="vol-line">
        <div class="vol-bar" aria-hidden="true">${t ? `<span class="vol-zone" style="left:${t[0] / SCALE * 100}%;width:${(t[1] - t[0]) / SCALE * 100}%"></span>` : ''}<i style="width:${Math.min(100, v / SCALE * 100).toFixed(1)}%"></i></div>
        <span class="vol-spark" aria-hidden="true" title="Letzte ${weeks.length} Wochen">${spark}</span>
      </div>
    </li>`;
  }).join('');
  const inRange = shown.filter(m => volumeRating(w.sets[m] || 0, m) === 'ok').length;
  /* Gruppen ohne Zielbereich zählen bei „x von y im Ziel“ nicht mit */
  const rated = shown.filter(m => weeklyTarget(m)).length;
  return `<section class="card vol">
      <div class="cal-nav">
        <button class="icon" data-act="histweek" data-d="1" aria-label="Woche davor" ${back >= weeks.length - 1 ? 'disabled' : ''}>${LEFT}</button>
        <div><h2>${thisWeek ? 'Diese Woche' : `Woche ab ${esc(dShort(w.start))}`}</h2>
          <p class="small-print">${w.total ? `${fmt(w.total)} ${plural(fmt(w.total), 'Satz', 'Sätze')}, ${inRange} von ${rated} ${plural(rated, 'Muskelgruppe', 'Muskelgruppen')} im Ziel`
            : thisWeek ? 'Noch kein Training diese Woche. Mit dem Pfeil links siehst du die Vorwoche.' : 'Kein Training in dieser Woche'}</p></div>
        <button class="icon" data-act="histweek" data-d="-1" aria-label="Woche danach" ${thisWeek ? 'disabled' : ''}>${RIGHT}</button>
      </div>
      ${shown.length ? `<ul class="vol-list">${rows}</ul>` : '<p class="empty">Sobald Übungen aus der Bibliothek im Plan stehen, zeigt die App hier die Sätze pro Muskelgruppe.</p>'}
      <p class="small-print vol-legend"><span class="vol-sw"></span>${esc(weeklyTargetText())} Hauptsächlich beanspruchte Muskeln zählen einen Satz voll, mitbeanspruchte einen halben, Aufwärmsätze gar nicht. Rechts die letzten ${weeks.length} Wochen.</p>
      ${w.unknown.length ? `<p class="small-print vol-unknown">Nicht zugeordnet: ${esc(w.unknown.join(', '))}. Diese Übungen kennt die Bibliothek nicht, sie zählen nicht mit.</p>` : ''}
    </section>`;
}

/* ---------- Aktionen ---------- */
function shiftMonth(month, d) {
  const [y, m] = month.split('-').map(Number);
  const x = new Date(y, m - 1 + d, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

export const actions = {
  histview: el => { V.histView = el.dataset.v; render(); },
  histmode: el => { V.histMode = el.dataset.v; render(); },
  histmonth: el => {
    const cur = /^\d{4}-\d{2}$/.test(V.histMonth || '') ? V.histMonth : ymd().slice(0, 7);
    const next = shiftMonth(cur, Number(el.dataset.d));
    if (next > ymd().slice(0, 7)) return;
    V.histMonth = next; render();
  },
  histday: el => { V.histDay = V.histDay === el.dataset.d ? null : el.dataset.d; render(); },
  histmetric: el => { V.histMetric = el.dataset.v; render(); },
  histrec: el => { V.histKey = el.dataset.k; V.histView = 'exercise'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  histweek: el => { V.histWeekBack = Math.max(0, (V.histWeekBack || 0) + Number(el.dataset.d)); render(); },
  /* Alle offenen Trainingsvorschläge über der Einheit-Liste zeigen (training.js) */
  histsugmore: () => { V.histSugAll = true; render(); },
  delsession: el => confirmSheet('Training löschen?', 'Dieses Training verschwindet aus dem Verlauf.', 'Training löschen', () => {
    S.sessions = S.sessions.filter(s => s.id !== el.dataset.id); save(); closeSheet(); toast('Training gelöscht');
  }),
};

export const inputs = {
  hist: (el, type) => { if (type === 'change') { V.histKey = el.value; render(); } },
};
