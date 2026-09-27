import { S, V, save, activePlan } from '../state.js';
import { esc, fmt, dShort, dMid } from '../util.js';
import { render } from '../render.js';
import { lineChart } from '../ui/chart.js';
import { toast } from '../ui/toast.js';
import { confirmSheet, closeSheet } from '../ui/sheet.js';
import { fmtSet } from './workout.js';

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

const hasData = k => S.sessions.some(s => s.ex.some(x => x.exId + '|' + x.name === k && x.sets.length));

export function vHistory() {
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
  const sessions = [...S.sessions].reverse();

  return `<div class="day-${color}">
    <p class="page-sub">Schwerster Satz pro Training, je Übung.</p>
    <label class="field" style="margin-top:12px">Übung
      <select id="histSel" data-in="hist">${groups}${other.length ? `<optgroup label="Andere">${other.map(o =>
        `<option value="${esc(o.k)}" ${o.k === V.histKey ? 'selected' : ''}>${esc(o.n)}</option>`).join('')}</optgroup>` : ''}</select></label>
    <div class="card chart">${chart(V.histKey)}</div>

    <section class="block">
      <h2>Alle Trainings</h2>
      ${sessions.length ? `<ul class="sess">${sessions.map(s => `
        <li class="day-${s.color}"><details>
          <summary><span class="dot"></span><span><b>${esc(s.name)}</b><br><small>${esc(dMid(s.startedAt))}</small></span>
            <small class="num">${Math.round((s.endedAt - s.startedAt) / 60000)} Min.</small></summary>
          <div class="body"><dl>${s.ex.filter(x => x.sets.length).map(x => `
            <div><dt>${esc(x.name)}</dt><dd class="num">${x.sets.map(st => fmtSet(st, x.unit)).join(', ')}</dd></div>`).join('')}</dl>
            <button class="link" data-act="delsession" data-id="${s.id}">Training löschen</button></div>
        </details></li>`).join('')}</ul>`
        : '<p class="empty">Nach dem ersten Training stehen hier deine Einheiten.</p>'}
    </section>
  </div>`;
}

function chart(key) {
  if (!key) return '<p class="empty">Keine Übung gewählt.</p>';
  const [exId, name] = key.split('|');
  let unit = 'reps';
  const pts = [];
  S.sessions.forEach(s => {
    const x = s.ex.find(x => x.exId === exId && x.name === name && x.sets.length);
    if (!x) return;
    unit = x.unit;
    const maxW = Math.max(...x.sets.map(st => st.w || 0));
    const byReps = unit === 'sec' || maxW === 0;
    pts.push({ t: s.startedAt, v: byReps ? Math.max(...x.sets.map(st => st.r || 0)) : maxW, byReps });
  });
  if (!pts.length) return '<p class="empty">Für diese Übung gibt es noch keine Einträge. Nach dem ersten Training erscheint hier dein Wert.</p>';
  const suffix = pts[pts.length - 1].byReps ? (unit === 'sec' ? 's' : 'Wdh.') : 'kg';
  const last = pts[pts.length - 1].v, first = pts[0].v, best = Math.max(...pts.map(p => p.v));
  const diff = last - first;
  const head = `<div class="chart-head"><div class="big num">${fmt(last)}<small>${suffix}</small></div>
    <div class="delta">${pts.length > 1 ? `seit ${esc(dShort(pts[0].t))}: <b class="num">${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff))} ${suffix}</b><br>` : ''}Bestwert <span class="num">${fmt(best)} ${suffix}</span></div></div>`;
  if (pts.length < 2) return head + '<p class="empty" style="padding:0 4px 6px">Ab dem zweiten Training wird hier eine Kurve daraus.</p>';
  return head + lineChart(pts, 'Verlauf ' + name);
}

export const actions = {
  delsession: el => confirmSheet('Training löschen?', 'Dieses Training verschwindet aus dem Verlauf.', 'Training löschen', () => {
    S.sessions = S.sessions.filter(s => s.id !== el.dataset.id); save(); closeSheet(); toast('Training gelöscht');
  }),
};

export const inputs = {
  hist: (el, type) => { if (type === 'change') { V.histKey = el.value; render(); } },
};
