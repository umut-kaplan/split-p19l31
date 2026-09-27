import { S, V, save, dayOf, activePlan } from '../state.js';
import { esc, fmt, toNum, mmss, unitL, dShort, uid } from '../util.js';
import { render } from '../render.js';
import { suggest, lastLog } from '../domain/progression.js';
import { plateSVG } from '../ui/plate.js';
import { ICON } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/sheet.js';
import { startRest, unlockAudio, wake, release } from '../timer.js';
import { infoButton } from './library.js';
import { personalRecords, setRecords, sessionRecords, RECORD_LABEL, formatRecord } from '../domain/prs.js';
import { findExercise, limitationHits } from '../domain/library.js';

const keyOf = x => x.exId + '|' + x.name;
/* Angenommener Deload-Vorschlag für diese Übung, siehe coach/training.js */
const overrideFor = x => (S.trainingOverrides && S.trainingOverrides[keyOf(x)]) || null;
const recordText = recs => recs.map(r => `${RECORD_LABEL[r.kind]} ${formatRecord(r.kind, r.value)}`).join(', ');

const fmtSet = (s, unit) => {
  const r = s.r + (unit === 'sec' ? ' s' : '');
  return s.w ? `${fmt(s.w)} × ${r}` : r;
};
export { fmtSet };

/* ---------- Einheit anlegen ---------- */
function mkEx(e, v) {
  const name = e.names[v] || e.names[0];
  const x = {
    exId: e.id, names: e.names.slice(), v, name, unit: e.unit, sets: e.sets,
    repMin: e.repMin, repMax: e.repMax, rest: e.rest, inc: e.inc, log: [],
  };
  x.log = Array.from({ length: e.sets }, () => ({ w: '', r: '', rir: 2, done: false }));
  prefill(x);
  return x;
}

/* Graue Vorschläge: Gewicht aus der Progression oder einem angenommenen Deload, Wiederholungen vom letzten Mal */
function prefill(x) {
  const sug = suggest(S.sessions, { ...x, id: x.exId }, x.name);
  const L = lastLog(S.sessions, x.exId, x.name);
  const ov = overrideFor(x);
  x.deload = ov ? ov.weight : null;
  x.log.forEach((s, j) => {
    if (s.done) return;
    s.pw = x.deload != null ? fmt(x.deload) : sug.weight != null ? fmt(sug.weight) : '0';
    /* Beim Deload zählt das obere Ende des Bereichs, nicht die verfehlten Wiederholungen vom letzten Mal */
    s.pr = String(x.deload != null ? x.repMax
      : sug.kind === 'up' && x.unit !== 'sec' ? x.repMin
        : (L && L.sets[j] ? L.sets[j].r : x.repMin));
  });
}

export function startWorkout(dayId) {
  const d = dayOf(dayId);
  S.active = {
    planId: activePlan().id, dayId, name: d.name, color: d.color, startedAt: Date.now(), timer: null,
    ex: d.exercises.map(e => mkEx(e, 0)),
  };
  V.pick = null;
  V.tab = 'training';
  save(); wake(); render();
  window.scrollTo(0, 0);
}

/* ---------- Ansicht ---------- */
export function vWorkout() {
  const a = S.active;
  const total = a.ex.reduce((n, x) => n + x.log.length, 0);
  const done = a.ex.reduce((n, x) => n + x.log.filter(s => s.done).length, 0);
  return `<div class="day-${a.color}">
    <div class="wo-bar">
      <div class="wo-row">
        ${plateSVG(a.color, '', '', { small: true })}
        <div class="grow"><h1>${esc(a.name)}</h1><span class="elapsed num" id="elapsed">${mmss((Date.now() - a.startedAt) / 1000)}</span></div>
        <button class="btn small primary" data-act="finish">Beenden</button>
      </div>
      <div class="progress" aria-label="${done} von ${total} Sätzen"><i style="width:${total ? done / total * 100 : 0}%"></i></div>
    </div>
    <p class="wo-note">Erst aufwärmen, diese Sätze zählen nicht. Bei den Arbeitssätzen 1–2 Wiederholungen im Tank lassen. Leere Felder übernehmen beim Abhaken den grauen Vorschlag.</p>
    ${a.ex.map(exCard).join('')}
    <div class="wo-end">
      <button class="btn primary" data-act="finish">Training beenden</button>
      <button class="btn ghost" data-act="discard">Training verwerfen</button>
    </div>
  </div>`;
}

function exCard(x, i) {
  const sug = suggest(S.sessions, { ...x, id: x.exId }, x.name);
  const L = lastLog(S.sessions, x.exId, x.name);
  const doneN = x.log.filter(s => s.done).length;
  const complete = doneN >= x.log.length;
  const hits = limitationHits(findExercise(x.name, S.exercisesCustom), (S.profile.limitations && S.profile.limitations.tags) || []);
  const hint = x.deload != null
    ? `<div class="hint deload"><strong>Deload: ${esc(fmt(x.deload))} kg</strong><span>Vorschlag angenommen: diese Einheit etwa 10&nbsp;% leichter und ${x.repMax} Wdh. pro Satz, danach geht es wieder aufwärts.</span></div>`
    : `<div class="hint ${sug.kind}"><strong>${esc(sug.text)}</strong><span>${esc(sug.sub)}</span></div>`;
  return `<section class="ex ${complete ? 'complete' : ''}" id="ex${i}">
    <div class="ex-title"><h2>${esc(x.name)}</h2><span class="ex-count num">${doneN}/${x.log.length}</span></div>
    ${infoButton(x.name)}
    ${x.names.length > 1 ? `<div class="seg" role="group" aria-label="Variante">${x.names.map((n, v) =>
      `<button data-act="variant" data-i="${i}" data-v="${v}" class="${v === x.v ? 'on' : ''}" aria-pressed="${v === x.v}">${esc(n)}</button>`).join('')}</div>` : ''}
    <div class="ex-meta">
      <span><b class="num">${x.sets}</b> Sätze</span>
      <span><b class="num">${x.repMin}–${x.repMax}</b> ${unitL(x.unit)}</span>
      <span>Pause <b class="num">${mmss(x.rest)}</b></span>
    </div>
    ${L ? `<p class="last">Letztes Mal am ${esc(dShort(L.date))}: <span class="num">${L.sets.map(s => fmtSet(s, x.unit)).join(', ')}</span></p>` : ''}
    ${hits.length ? `<p class="ex-warn">Belastet ${esc(hits.join(' und '))}, das du als Einschränkung eingetragen hast. Bei Beschwerden leichter gehen oder unter „Anleitung“ eine Alternative wählen.</p>` : ''}
    ${hint}
    <div class="sets">
      <div class="set-h"><span>Satz</span><span>kg</span><span>${unitL(x.unit)}</span><span>RIR</span><span></span></div>
      ${x.log.map((s, j) => `
      <div class="set ${s.done ? 'done' : ''} ${s.done && s.rec ? 'pr' : ''} ${V.prFlash === `${i}:${j}` ? 'pr-new' : ''}">
        <span class="set-n num">${j + 1}</span>
        <input class="num" inputmode="decimal" enterkeyhint="next" data-in="w" data-i="${i}" data-j="${j}" value="${esc(s.w)}" placeholder="${esc(s.pw || '0')}" aria-label="Satz ${j + 1} Gewicht in kg">
        <input class="num" inputmode="numeric" enterkeyhint="done" data-in="r" data-i="${i}" data-j="${j}" value="${esc(s.r)}" placeholder="${esc(s.pr)}" aria-label="Satz ${j + 1} ${unitL(x.unit)}">
        <button class="rir num" data-act="rir" data-i="${i}" data-j="${j}" aria-label="RIR ${s.rir}, tippen zum Ändern">${s.rir}</button>
        <button class="check" data-act="check" data-i="${i}" data-j="${j}" aria-pressed="${s.done}" aria-label="Satz ${j + 1} abhaken">${ICON.check}</button>
        ${s.done && s.rec ? `<span class="pr-badge">Neuer Rekord: ${esc(recordText(s.rec))}</span>` : ''}
      </div>`).join('')}
    </div>
    <div class="ex-foot">
      <button class="link" data-act="addset" data-i="${i}">Satz hinzufügen</button>
      ${x.log.length > 1 ? `<button class="link" data-act="rmset" data-i="${i}">Letzten Satz entfernen</button>` : ''}
    </div>
  </section>`;
}

/* ---------- Sätze ---------- */
function toggleSet(i, j) {
  const x = S.active.ex[i], s = x.log[j];
  if (s.done) { s.done = false; s.rec = null; save(); render(); return; }
  const w = s.w === '' ? toNum(s.pw) : toNum(s.w);
  const r = s.r === '' ? toNum(s.pr) : toNum(s.r);
  if (!isFinite(r) || r <= 0) { toast(`Bitte ${unitL(x.unit)} eintragen`); return; }
  if (!isFinite(w) || w < 0) { toast('Gewicht als Zahl eintragen, z. B. 42,5'); return; }
  s.w = fmt(w);
  s.r = String(Math.round(r));
  /* Rekord gegen alle früheren Einheiten und die schon abgehakten Sätze dieser Einheit */
  const before = x.log.filter((b, k) => b.done && k !== j).map(b => ({ w: toNum(b.w) || 0, r: toNum(b.r) }));
  const recs = setRecords(personalRecords(S.sessions).get(keyOf(x)), before, { w, r: Math.round(r) }, x.unit);
  s.rec = recs.length ? recs : null;
  s.done = true;
  if (document.activeElement) document.activeElement.blur();
  unlockAudio();
  startRest(x.rest, x.name);
  save();
  if (s.rec) {
    V.prFlash = `${i}:${j}`;
    if (navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 120]);
    toast(`Neuer Rekord bei ${x.name}: ${recordText(s.rec)}`);
  }
  render();
  V.prFlash = null;
}

/* ---------- Abschluss ---------- */
function finishWorkout() {
  const a = S.active;
  /* target: das Ziel, das beim Training galt. Die Deload-Regel misst daran, auch wenn der Plan sich später ändert. */
  const ex = a.ex.map(x => ({
    exId: x.exId, name: x.name, unit: x.unit,
    target: { sets: x.sets, repMin: x.repMin, repMax: x.repMax },
    sets: x.log.filter(s => s.done).map(s => ({ w: toNum(s.w) || 0, r: toNum(s.r), rir: s.rir })),
  })).filter(x => x.sets.length);
  if (!ex.length) {
    confirmSheet('Noch kein Satz abgehakt', 'Ohne abgehakte Sätze gibt es nichts zu speichern.', 'Training verwerfen', discardWorkout);
    return;
  }
  const prs = sessionRecords(S.sessions, ex);
  /* Ein angenommener Deload gilt für genau eine Einheit */
  a.ex.forEach(x => {
    if (x.deload != null && x.log.some(s => s.done) && S.trainingOverrides) delete S.trainingOverrides[keyOf(x)];
  });
  const session = {
    id: uid(), planId: a.planId, dayId: a.dayId, name: a.name, color: a.color,
    startedAt: a.startedAt, endedAt: Date.now(), ex,
  };
  S.sessions.push(session);
  S.active = null;
  save(); release();
  V.summary = {
    name: a.name, color: a.color,
    minutes: Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000)),
    sets: ex.reduce((n, x) => n + x.sets.length, 0),
    volume: Math.round(ex.filter(x => x.unit !== 'sec').reduce((n, x) => n + x.sets.reduce((m, s) => m + s.w * s.r, 0), 0)),
    prs,
  };
  V.sheet = null;
  render(); window.scrollTo(0, 0);
}

function discardWorkout() {
  S.active = null; V.sheet = null; save(); release(); V.roll = true;
  render(); window.scrollTo(0, 0);
}

export function vSummary() {
  const s = V.summary;
  const tons = s.volume >= 1000;
  return `<div class="summary day-${s.color}">
    <div class="plate-btn roll">${plateSVG(s.color, 'Geschafft', s.name + ' erledigt')}</div>
    <h1>${esc(s.name)} erledigt</h1>
    <div class="stats">
      <div><b>${s.minutes}</b><span>${s.minutes === 1 ? 'Minute' : 'Minuten'}</span></div>
      <div><b>${s.sets}</b><span>Sätze</span></div>
      <div><b>${tons ? fmt(Math.round(s.volume / 100) / 10) : fmt(s.volume)}</b><span>${tons ? 'Tonnen bewegt' : 'kg bewegt'}</span></div>
    </div>
    ${s.prs.length ? `<div class="card prs"><h2 style="font-size:18px">Neue Rekorde</h2><ul class="rules">
      ${s.prs.map(p => `<li>${esc(p.name)}: ${p.items.map(it =>
        `${esc(RECORD_LABEL[it.kind])} <b class="num">${esc(formatRecord(it.kind, it.value))}</b>`).join(', ')}</li>`).join('')}</ul>
      <p class="small-print" style="margin-top:8px">1RM geschätzt nach Epley aus Sätzen mit bis zu 12 Wiederholungen.</p></div>` : ''}
    <button class="btn primary" data-act="closesummary">Fertig</button>
  </div>`;
}

export const actions = {
  start: el => { unlockAudio(); startWorkout(el.dataset.day); },
  resume: () => { V.tab = 'training'; render(); window.scrollTo(0, 0); },
  variant: el => {
    const x = S.active.ex[+el.dataset.i], v = +el.dataset.v;
    if (x.v === v) return;
    x.v = v; x.name = x.names[v];
    x.log.forEach(s => { if (!s.done) s.w = ''; });
    prefill(x); save(); render();
  },
  rir: el => { const s = S.active.ex[+el.dataset.i].log[+el.dataset.j]; s.rir = (s.rir + 1) % 5; save(); render(); },
  check: el => toggleSet(+el.dataset.i, +el.dataset.j),
  addset: el => {
    const x = S.active.ex[+el.dataset.i];
    const prev = x.log[x.log.length - 1];
    x.log.push({ w: '', r: '', rir: 2, done: false, pw: prev ? (prev.w || prev.pw) : '0', pr: prev ? (prev.r || prev.pr) : String(x.repMin) });
    save(); render();
  },
  rmset: el => {
    const x = S.active.ex[+el.dataset.i];
    if (x.log.length > 1) { x.log.pop(); save(); render(); }
  },
  finish: () => {
    const open = S.active.ex.reduce((n, x) => n + x.log.filter(s => !s.done).length, 0);
    if (open === 0) { finishWorkout(); return; }
    confirmSheet('Training beenden?', `${open} Sätze sind noch offen. Gespeichert werden nur die abgehakten.`, 'Training beenden', finishWorkout, 'primary');
  },
  discard: () => confirmSheet('Training verwerfen?', 'Alle Einträge dieses Trainings gehen verloren.', 'Training verwerfen', discardWorkout),
  closesummary: () => { V.summary = null; V.tab = 'today'; V.roll = true; render(); window.scrollTo(0, 0); },
};

export const inputs = {
  w: (el, type) => setField(el, 'w', type),
  r: (el, type) => setField(el, 'r', type),
};
function setField(el, k, type) {
  if (type !== 'input') return;
  const x = S.active && S.active.ex[+el.dataset.i];
  const s = x && x.log[+el.dataset.j];
  if (s) { s[k] = el.value.trim(); save(); }
}
