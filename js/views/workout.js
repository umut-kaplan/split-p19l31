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
import { setType, nextType, isWarmup, isTop, workSets, topSets, tonnage, setLabels, setName, typePrefix } from '../domain/settypes.js';
import { groupsOf, groupAt, restAfter } from '../domain/superset.js';
import * as notes from './exercise-notes.js';
import * as warmup from './warmup.js';
import * as rating from './session-rating.js';
import * as plates from './plates.js';

/* Untermodule, deren actions und inputs app.js einsammelt */
export const modules = [notes, warmup, rating, plates];

const keyOf = x => x.exId + '|' + x.name;
/* Angenommener Deload-Vorschlag für diese Übung, siehe coach/training.js */
const overrideFor = x => (S.trainingOverrides && S.trainingOverrides[keyOf(x)]) || null;
const recordText = recs => recs.map(r => `${RECORD_LABEL[r.kind]} ${formatRecord(r.kind, r.value)}`).join(', ');

/* „80 × 8“, mit Satztyp davor: „A 40 × 10“, „D 60 × 12“ */
const fmtSet = (s, unit) => {
  const r = s.r + (unit === 'sec' ? ' s' : '');
  return typePrefix(s) + (s.w ? `${fmt(s.w)} × ${r}` : r);
};
export { fmtSet };

/* ---------- Einheit anlegen ---------- */
function mkEx(e, v) {
  const name = e.names[v] || e.names[0];
  const x = {
    exId: e.id, names: e.names.slice(), v, name, unit: e.unit, sets: e.sets,
    repMin: e.repMin, repMax: e.repMax, rest: e.rest, inc: e.inc, log: [],
  };
  /* Supersatz: mit der nächsten Übung verbunden (siehe domain/superset.js) */
  if (e.ss === true) x.ss = true;
  x.log = Array.from({ length: e.sets }, () => ({ w: '', r: '', rir: 2, done: false }));
  prefill(x);
  return x;
}

/* Graue Vorschläge: Gewicht aus der Progression oder einem angenommenen Deload, Wiederholungen vom letzten Mal.
   Aufwärmsätze behalten ihre eigenen Vorschläge. Normale Sätze und Sätze bis Versagen werden der Reihe nach
   mit denen vom letzten Mal verglichen, Dropsätze mit den Dropsätzen; Aufwärmsätze verschieben dabei nichts. */
function prefill(x) {
  const sug = suggest(S.sessions, { ...x, id: x.exId }, x.name);
  const L = lastLog(S.sessions, x.exId, x.name);
  const prevTop = L ? topSets(L.sets) : [];
  const prevDrop = L ? L.sets.filter(s => setType(s) === 'd') : [];
  const ov = overrideFor(x);
  x.deload = ov ? ov.weight : null;
  let kt = 0, kd = 0;
  x.log.forEach(s => {
    if (isWarmup(s)) return;
    const p = setType(s) === 'd' ? prevDrop[kd++] : prevTop[kt++];
    if (s.done) return;
    s.pw = x.deload != null ? fmt(x.deload) : sug.weight != null ? fmt(sug.weight) : '0';
    /* Beim Deload zählt das obere Ende des Bereichs, nicht die verfehlten Wiederholungen vom letzten Mal */
    s.pr = String(x.deload != null ? x.repMax
      : sug.kind === 'up' && x.unit !== 'sec' ? x.repMin
        : (p ? p.r : x.repMin));
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
  /* Aufwärmsätze zählen im Fortschritt nicht mit */
  const total = a.ex.reduce((n, x) => n + workSets(x.log).length, 0);
  const done = a.ex.reduce((n, x) => n + workSets(x.log).filter(s => s.done).length, 0);
  return `<div class="day-${a.color}">
    <div class="wo-bar">
      <div class="wo-row">
        ${plateSVG(a.color, '', '', { small: true })}
        <div class="grow"><h1>${esc(a.name)}</h1><span class="elapsed num" id="elapsed">${mmss((Date.now() - a.startedAt) / 1000)}</span></div>
        <button class="btn small primary" data-act="finish">Beenden</button>
      </div>
      <div class="progress" aria-label="${done} von ${total} Sätzen"><i style="width:${total ? done / total * 100 : 0}%"></i></div>
    </div>
    <p class="wo-note">Erst aufwärmen, Aufwärmsätze zählen nicht. Bei den Arbeitssätzen 1–2 Wiederholungen im Tank lassen. Leere Felder übernehmen beim Abhaken den grauen Vorschlag. Ein Tipp auf die Satznummer wechselt den Typ: A Aufwärmen, D Drop, V bis Versagen.</p>
    ${groupsOf(a.ex).map(g => (g.length > 1 ? ssGroup(g) : exCard(a.ex[g[0]], g[0]))).join('')}
    <div class="wo-end">
      <button class="btn primary" data-act="finish">Training beenden</button>
      <button class="btn ghost" data-act="discard">Training verwerfen</button>
    </div>
  </div>`;
}

/* Supersatz: gemeinsamer Rahmen um die Übungen der Gruppe */
function ssGroup(g) {
  const ex = S.active.ex;
  const names = g.map(k => ex[k].name);
  return `<div class="ss-group" role="group" aria-label="Supersatz: ${esc(names.join(' und '))}">
    <p class="ss-head"><span class="ss-tag">Supersatz</span><span>Im Wechsel je ein Satz, ohne Pause dazwischen. Die Pause startet nach ${esc(names[names.length - 1])}.</span></p>
    ${g.map(k => exCard(ex[k], k)).join('')}
  </div>`;
}

function exCard(x, i) {
  const sug = suggest(S.sessions, { ...x, id: x.exId }, x.name);
  const L = lastLog(S.sessions, x.exId, x.name);
  /* Satzzähler x/y ohne Aufwärmsätze */
  const work = workSets(x.log);
  const doneN = work.filter(s => s.done).length;
  const complete = work.length > 0 && doneN >= work.length;
  const g = groupAt(S.active.ex, i);
  const direct = g.length > 1 && i !== g[g.length - 1];
  const labels = setLabels(x.log);
  const hits = limitationHits(findExercise(x.name, S.exercisesCustom), (S.profile.limitations && S.profile.limitations.tags) || []);
  /* Langhantel oder SZ-Stange: Scheiben-Symbol neben dem Gewichtsfeld */
  const bar = plates.barInfo(x);
  const hint = x.deload != null
    ? `<div class="hint deload"><strong>Deload: ${esc(fmt(x.deload))} kg</strong><span>Vorschlag angenommen: diese Einheit etwa 10&nbsp;% leichter und ${x.repMax} Wdh. pro Satz, danach geht es wieder aufwärts.</span></div>`
    : `<div class="hint ${sug.kind}"><strong>${esc(sug.text)}</strong><span>${esc(sug.sub)}</span></div>`;
  return `<section class="ex ${complete ? 'complete' : ''}" id="ex${i}">
    <div class="ex-title"><h2>${esc(x.name)}</h2><span class="ex-count num">${doneN}/${work.length}</span></div>
    ${infoButton(x.name)}
    ${notes.exerciseNote(x, i)}
    ${x.names.length > 1 ? `<div class="seg" role="group" aria-label="Variante">${x.names.map((n, v) =>
      `<button data-act="variant" data-i="${i}" data-v="${v}" class="${v === x.v ? 'on' : ''}" aria-pressed="${v === x.v}">${esc(n)}</button>`).join('')}</div>` : ''}
    <div class="ex-meta">
      <span><b class="num">${x.sets}</b> Sätze</span>
      <span><b class="num">${x.repMin}–${x.repMax}</b> ${unitL(x.unit)}</span>
      ${direct ? '<span>Danach ohne Pause weiter</span>' : `<span>Pause <b class="num">${mmss(x.rest)}</b></span>`}
    </div>
    ${L ? `<p class="last">Letztes Mal am ${esc(dShort(L.date))}: <span class="num">${L.sets.map(s => fmtSet(s, x.unit)).join(', ')}</span></p>` : ''}
    ${hits.length ? `<p class="ex-warn">Belastet ${esc(hits.join(' und '))}, das du als Einschränkung eingetragen hast. Bei Beschwerden leichter gehen oder unter „Anleitung“ eine Alternative wählen.</p>` : ''}
    ${hint}
    ${warmup.warmupLine(x, i)}
    <div class="sets ${bar ? 'with-plates' : ''}">
      <div class="set-h"><span>Satz</span><span>kg</span>${bar ? '<span></span>' : ''}<span>${unitL(x.unit)}</span><span>RIR</span><span></span></div>
      ${x.log.map((s, j) => {
        const t = setType(s);
        const name = setName(x.log, j);
        return `
      <div class="set ${t ? `st-${t}` : ''} ${s.done ? 'done' : ''} ${s.done && s.rec ? 'pr' : ''} ${V.prFlash === `${i}:${j}` ? 'pr-new' : ''}">
        <button class="set-n num" data-act="settype" data-i="${i}" data-j="${j}" aria-label="${esc(name)}, tippen wechselt den Satztyp">${labels[j]}</button>
        <input class="num" inputmode="decimal" enterkeyhint="next" data-in="w" data-i="${i}" data-j="${j}" value="${esc(s.w)}" placeholder="${esc(s.pw || '0')}" aria-label="${esc(name)} Gewicht in kg">
        ${bar ? plates.plateButton(i, j) : ''}
        <input class="num" inputmode="numeric" enterkeyhint="done" data-in="r" data-i="${i}" data-j="${j}" value="${esc(s.r)}" placeholder="${esc(s.pr)}" aria-label="${esc(name)} ${unitL(x.unit)}">
        <button class="rir num" data-act="rir" data-i="${i}" data-j="${j}" aria-label="RIR ${s.rir}, tippen zum Ändern">${s.rir}</button>
        <button class="check" data-act="check" data-i="${i}" data-j="${j}" aria-pressed="${s.done}" aria-label="${esc(name)} abhaken">${ICON.check}</button>
        ${s.done && s.rec ? `<span class="pr-badge">Neuer Rekord: ${esc(recordText(s.rec))}</span>` : ''}
      </div>`;
      }).join('')}
    </div>
    <div class="ex-foot">
      <button class="link" data-act="addset" data-i="${i}">Satz hinzufügen</button>
      ${x.log.length > 1 ? `<button class="link" data-act="rmset" data-i="${i}">Letzten Satz entfernen</button>` : ''}
    </div>
  </section>`;
}

/* ---------- Sätze ---------- */
/* Rekord gegen alle früheren Einheiten und die schon abgehakten Sätze dieser Einheit.
   Aufwärm- und Dropsätze sind nie ein Rekord (domain/prs.js). */
function recordsFor(x, j) {
  const s = x.log[j];
  if (!isTop(s)) return null;
  const before = x.log.filter((b, k) => b.done && k !== j).map(b => ({ w: toNum(b.w) || 0, r: toNum(b.r), t: setType(b) }));
  const recs = setRecords(personalRecords(S.sessions).get(keyOf(x)), before, { w: toNum(s.w) || 0, r: toNum(s.r) }, x.unit);
  return recs.length ? recs : null;
}

function toggleSet(i, j) {
  const x = S.active.ex[i], s = x.log[j];
  if (s.done) { s.done = false; s.rec = null; save(); render(); return; }
  const w = s.w === '' ? toNum(s.pw) : toNum(s.w);
  const r = s.r === '' ? toNum(s.pr) : toNum(s.r);
  if (!isFinite(r) || r <= 0) { toast(`Bitte ${unitL(x.unit)} eintragen`); return; }
  if (!isFinite(w) || w < 0) { toast('Gewicht als Zahl eintragen, z. B. 42,5'); return; }
  s.w = fmt(w);
  s.r = String(Math.round(r));
  s.rec = recordsFor(x, j);
  s.done = true;
  if (document.activeElement) document.activeElement.blur();
  unlockAudio();
  /* Pause nach Satztyp und Supersatz: vor einem Dropsatz und innerhalb der Runde keine */
  const rest = restAfter(S.active.ex, i, j);
  startRest(rest.seconds, rest.label);
  if (rest.why === 'superset') toast(`Supersatz: weiter mit ${S.active.ex[rest.next].name}`);
  else if (rest.why === 'drop') toast('Dropsatz: direkt weiter, ohne Pause');
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
    /* t nur bei Aufwärm-, Drop- und Versagenssätzen; normale Sätze bleiben wie bisher { w, r, rir } */
    sets: x.log.filter(s => s.done).map(s => {
      const t = setType(s);
      return t ? { w: toNum(s.w) || 0, r: toNum(s.r), rir: s.rir, t } : { w: toNum(s.w) || 0, r: toNum(s.r), rir: s.rir };
    }),
  })).filter(x => x.sets.length);
  if (!ex.some(x => workSets(x.sets).length)) {
    confirmSheet(ex.length ? 'Nur Aufwärmsätze abgehakt' : 'Noch kein Satz abgehakt',
      ex.length ? 'Gespeichert wird ein Training erst mit mindestens einem Arbeitssatz.' : 'Ohne abgehakte Sätze gibt es nichts zu speichern.',
      'Training verwerfen', discardWorkout);
    return;
  }
  const prs = sessionRecords(S.sessions, ex);
  /* Ein angenommener Deload gilt für genau eine Einheit */
  a.ex.forEach(x => {
    if (x.deload != null && x.log.some(s => s.done && !isWarmup(s)) && S.trainingOverrides) delete S.trainingOverrides[keyOf(x)];
  });
  const session = {
    id: uid(), planId: a.planId, dayId: a.dayId, name: a.name, color: a.color,
    startedAt: a.startedAt, endedAt: Date.now(), ex,
  };
  S.sessions.push(session);
  S.active = null;
  const saved = save(); release();
  V.summary = {
    sessionId: session.id,
    name: a.name, color: a.color,
    minutes: Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000)),
    /* Ohne Aufwärmsätze; Dropsätze zählen mit */
    sets: ex.reduce((n, x) => n + workSets(x.sets).length, 0),
    volume: Math.round(ex.filter(x => x.unit !== 'sec').reduce((n, x) => n + tonnage(x.sets), 0)),
    prs,
  };
  V.sheet = null;
  render(); window.scrollTo(0, 0);
  if (!saved) toast('Der Speicher ist voll. Das Training ist nur bis zum Schließen der App da. Speichere jetzt ein Backup.');
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
    ${rating.ratingBlock(s.sessionId)}
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
  /* Satztyp wechseln: normal, Aufwärmen, Drop, Versagen, wieder normal */
  settype: el => {
    const x = S.active.ex[+el.dataset.i], j = +el.dataset.j, s = x.log[j];
    if (!s) return;
    const t = nextType(setType(s));
    if (t) s.t = t; else delete s.t;
    if (s.done) s.rec = recordsFor(x, j);
    save(); render();
  },
  check: el => toggleSet(+el.dataset.i, +el.dataset.j),
  addset: el => {
    const x = S.active.ex[+el.dataset.i];
    const work = workSets(x.log);
    const prev = work[work.length - 1] || x.log[x.log.length - 1];
    x.log.push({ w: '', r: '', rir: 2, done: false, pw: prev ? (prev.w || prev.pw) : '0', pr: prev ? (prev.r || prev.pr) : String(x.repMin) });
    save(); render();
  },
  rmset: el => {
    const x = S.active.ex[+el.dataset.i];
    if (x.log.length > 1) { x.log.pop(); save(); render(); }
  },
  finish: () => {
    const open = S.active.ex.reduce((n, x) => n + workSets(x.log).filter(s => !s.done).length, 0);
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
