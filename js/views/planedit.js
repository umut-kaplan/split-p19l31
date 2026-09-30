import { S, V, save, activePlan } from '../state.js';
import { esc, fmtIn, toNum, mmss, unitL, exName } from '../util.js';
import { render } from '../render.js';
import { defaultPlan, emptyPlan, planFromTemplate, newDay } from '../plans.js';
import { PLAN_TEMPLATES, PLAN_COLORS, COLOR_NAMES } from '../data/plan-templates.js';
import {
  allExercises, findExercise, searchExercises, matchesQuery, limitationHits, safeAlternatives, exerciseIdFor, defaultsFor,
} from '../domain/library.js';
import { MUSCLES } from '../domain/muscles.js';
import { plateSVG } from '../ui/plate.js';
import { ICON } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';
import { exImage } from './library.js';
import { groupsOf, swapKeepLinks, removeKeepLinks, tidyLinks, setLink } from '../domain/superset.js';

const custom = () => S.exercisesCustom || [];
const tags = () => (S.profile.limitations && S.profile.limitations.tags) || [];

const curDay = () => {
  const plan = activePlan();
  if (!V.planDay || !plan.days[V.planDay]) V.planDay = plan.order[0];
  return plan.days[V.planDay];
};

/* Ein Name, den es in den Plänen noch nicht gibt */
function uniquePlanName(base) {
  const names = new Set(S.plans.map(p => p.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} (${i})`)) return `${base} (${i})`;
}

/* Welche eingetragenen Einschränkungen belastet ein Plan-Eintrag, und was wäre schonender? */
function limitInfo(e) {
  const t = tags();
  if (!t.length) return null;
  for (const n of e.names) {
    const lib = findExercise(n, custom());
    const hits = limitationHits(lib, t);
    if (hits.length) return { hits, alts: safeAlternatives(lib, custom(), t) };
  }
  return null;
}

/* Schalter zwischen zwei Übungen: „Mit nächster Übung als Supersatz“ */
function ssLink(d, i) {
  const on = d.exercises[i].ss === true;
  const pair = `${exName(d.exercises[i])} und ${exName(d.exercises[i + 1])}`;
  return `<li class="pe-link ${on ? 'on' : ''}"><button class="pe-link-btn" data-act="plss" data-i="${i}" aria-pressed="${on}"
      aria-label="${esc(on ? `${pair} sind ein Supersatz. Tippen löst die Verbindung.` : `${pair} als Supersatz verbinden`)}">${on ? 'Supersatz' : 'Mit nächster Übung als Supersatz'}</button></li>`;
}

export function vPlan() {
  const plan = activePlan();
  const d = curDay();
  const groups = groupsOf(d.exercises);
  const total = plan.order.reduce((n, id) => n + plan.days[id].exercises.length, 0);
  return `<div class="plan day-${d.color}">
    <section class="card plan-head">
      <h2>${esc(plan.name)}</h2>
      <p class="muted">${plan.order.length} ${plan.order.length === 1 ? 'Tag' : 'Tage'}, ${total} Übungen. ${S.plans.length > 1 ? `Einer von ${S.plans.length} Plänen, dieser ist aktiv.` : 'Dein aktiver Plan.'}</p>
      <div class="sug-btns">
        ${S.plans.length > 1 ? '<button class="btn small" data-act="planswitch">Plan wechseln</button>' : ''}
        <button class="btn small" data-act="plannew">Neuer Plan</button>
        <button class="btn small ghost" data-act="planrename">Umbenennen</button>
      </div>
    </section>
    <p class="page-sub" style="margin-top:14px">Änderungen gelten ab dem nächsten Training.</p>
    <div class="day-tabs" role="tablist">
      ${plan.order.map(o => { const od = plan.days[o]; return `
        <button class="day-${od.color} ${o === V.planDay ? 'on' : ''}" role="tab" aria-selected="${o === V.planDay}" data-act="planday" data-day="${o}">
          ${plateSVG(od.color, '', '', { small: true })}<span class="plan-dayname">${esc(od.name)}</span></button>`; }).join('')}
      <button class="plan-addday" data-act="planaddday" aria-label="Tag hinzufügen">
        ${plateSVG('steel', '', '', { ghost: true })}<span>Tag dazu</span></button>
    </div>
    <div class="fields" style="margin-top:16px">
      <label class="field">Name des Tages<input data-in="dayname" value="${esc(d.name)}" maxlength="20"></label>
      <label class="field">Muskelgruppen<input data-in="daymuscles" value="${esc(d.muscles)}" maxlength="60"></label>
      <div><p class="label">Farbe der Scheibe</p>
        <div class="plan-colors" role="group" aria-label="Farbe">${PLAN_COLORS.map(c => `
          <button class="plan-color ${d.color === c ? 'on' : ''}" aria-pressed="${d.color === c}" aria-label="${COLOR_NAMES[c]}" data-act="plancolor" data-v="${c}">
            ${plateSVG(c, '', '', { small: true })}</button>`).join('')}</div></div>
    </div>
    ${d.exercises.length ? `<ul class="pe-list">
      ${d.exercises.map((e, i) => {
        const lim = limitInfo(e);
        const g = groups.find(x => x.includes(i));
        const ss = g.length > 1 ? 'pe-ss' : '';
        return `
      <li class="pe ${lim ? 'pe-limit' : ''} ${ss}">
        <div><b>${esc(exName(e))}</b>
          <span class="num">${e.sets} × ${e.repMin}–${e.repMax} ${unitL(e.unit)}, Pause ${mmss(e.rest)}</span>
          ${lim ? `<span class="plan-warn">Belastet ${esc(lim.hits.join(', '))}.${lim.alts.length ? ` Schonender: ${esc(lim.alts.slice(0, 3).map(a => a.name).join(', '))}.` : ''}</span>` : ''}</div>
        <div class="pe-tools">
          <button class="icon" data-act="mv" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="${esc(exName(e))} nach oben">${ICON.up}</button>
          <button class="icon" data-act="mv" data-i="${i}" data-d="1" ${i === d.exercises.length - 1 ? 'disabled' : ''} aria-label="${esc(exName(e))} nach unten">${ICON.down}</button>
          <button class="icon" data-act="edit" data-i="${i}" aria-label="${esc(exName(e))} bearbeiten">${ICON.edit}</button>
        </div>
      </li>${i < d.exercises.length - 1 ? ssLink(d, i) : ''}`; }).join('')}
    </ul>` : '<p class="empty" style="margin-top:18px">Dieser Tag hat noch keine Übungen.</p>'}
    <div class="stack">
      <button class="btn primary" data-act="addex">Übung hinzufügen</button>
      ${plan.order.length > 1 ? `<button class="btn ghost" data-act="planrmday">${esc(d.name)} entfernen</button>` : ''}
      ${S.plans.length > 1 ? `<button class="btn danger" data-act="plandelete">Plan „${esc(plan.name)}“ löschen</button>` : ''}
    </div>
  </div>`;
}

/* ---------- Übung bearbeiten ---------- */
function editForm(e) {
  return `<div class="form">
    <label>Name<input id="f-name" value="${esc(e.names.join(' / '))}" placeholder="z. B. Bankdrücken" autocomplete="off"></label>
    <p class="help">Mehrere Varianten mit Schrägstrich trennen, z. B. „Latzug / Klimmzüge“. Im Training wählst du dann per Schalter.</p>
    <div class="row3">
      <label>Sätze<input id="f-sets" inputmode="numeric" value="${e.sets}"></label>
      <label>Von<input id="f-min" inputmode="numeric" value="${e.repMin}"></label>
      <label>Bis<input id="f-max" inputmode="numeric" value="${e.repMax}"></label>
    </div>
    <div class="row2">
      <label>Einheit<select id="f-unit">
        <option value="reps" ${e.unit !== 'sec' ? 'selected' : ''}>Wiederholungen</option>
        <option value="sec" ${e.unit === 'sec' ? 'selected' : ''}>Sekunden</option></select></label>
      <label>Pause in Sek.<input id="f-rest" inputmode="numeric" value="${e.rest}"></label>
    </div>
    <label>Steigerung in kg<input id="f-inc" inputmode="decimal" value="${fmtIn(e.inc)}"></label>
    <p class="help">Um so viel schlägt die App mehr Gewicht vor, wenn alle Sätze das obere Ende erreichen.</p>
  </div>`;
}

function readForm() {
  const g = id => document.getElementById(id).value.trim();
  const names = g('f-name').split('/').map(s => s.trim()).filter(Boolean);
  const sets = parseInt(g('f-sets'), 10), repMin = parseInt(g('f-min'), 10), repMax = parseInt(g('f-max'), 10);
  const rest = parseInt(g('f-rest'), 10), inc = toNum(g('f-inc') || '0');
  if (!names.length) return 'Gib der Übung einen Namen.';
  if (!(sets >= 1 && sets <= 10)) return 'Sätze: eine Zahl von 1 bis 10.';
  if (!(repMin >= 1) || !(repMax >= repMin)) return '„Bis“ muss mindestens so groß sein wie „Von“.';
  if (!(rest >= 0 && rest <= 900)) return 'Pause: 0 bis 900 Sekunden.';
  if (!(inc >= 0)) return 'Steigerung als Zahl eintragen, z. B. 2,5.';
  return { names, sets, repMin, repMax, rest, inc, unit: g('f-unit') };
}

function editExercise(i) {
  const d = curDay();
  const isNew = i == null;
  const e = isNew ? { id: null, names: [''], sets: 3, repMin: 8, repMax: 12, rest: 90, inc: 2.5, unit: 'reps' } : d.exercises[i];
  const actions = [{
    label: isNew ? 'Übung hinzufügen' : 'Änderungen speichern', kind: 'primary', fn: () => {
      const r = readForm();
      if (typeof r === 'string') { toast(r); return; }
      Object.assign(e, r);
      if (isNew) {
        e.id = exerciseIdFor(r.names[0], S.plans, custom());
        if (d.exercises.some(x => x.id === e.id)) { toast('Diese Übung steht schon in diesem Tag.'); return; }
        tidyLinks(d.exercises);
        d.exercises.push(e);
      }
      save(); closeSheet(); toast(isNew ? 'Übung hinzugefügt' : 'Änderungen gespeichert');
    },
  }];
  if (!isNew) actions.push({
    label: 'Übung löschen', kind: 'danger', fn: () =>
      confirmSheet(`${exName(e)} löschen?`, 'Die Übung verschwindet aus dem Plan. Bisherige Einträge im Verlauf bleiben.', 'Übung löschen', () => {
        removeKeepLinks(d.exercises, i); save(); closeSheet(); toast('Übung gelöscht');
      }),
  });
  actions.push({ label: 'Abbrechen', kind: 'ghost', fn: closeSheet });
  openSheet({ title: isNew ? 'Neue Übung' : 'Übung bearbeiten', body: editForm(e), actions });
}

/* ---------- Übung aus der Bibliothek wählen ---------- */
function pickExercise() {
  const t = tags();
  const list = searchExercises(allExercises(custom()));
  const body = `<label class="field plan-pick-search"><span class="vh">Übung suchen</span>
      <input type="search" data-in="planpickq" placeholder="Übung suchen" autocomplete="off" enterkeyhint="search"></label>
    <ul class="lib-list plan-pick">${list.map(e => {
      const hits = limitationHits(e, t);
      const prim = (e.muscles && e.muscles.primary || []).map(m => MUSCLES[m]).filter(Boolean).join(', ');
      return `<li data-pickid="${esc(e.id)}"><button class="lib-item" data-act="planpick" data-id="${esc(e.id)}">
        ${exImage(e, 'lib-thumb')}
        <span class="lib-txt"><b>${esc(e.name)}</b><span>${esc(prim)}</span>
          ${hits.length ? `<span class="lib-warn">Belastet ${esc(hits.join(', '))}</span>` : ''}</span></button></li>`;
    }).join('')}</ul>
    <p class="empty plan-pick-none" hidden>Nichts gefunden. Trag die Übung mit eigenem Namen ein.</p>`;
  openSheet({
    title: 'Übung hinzufügen',
    body,
    actions: [
      { label: 'Eigenen Namen eintragen', kind: '', fn: () => editExercise(null) },
      { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
    ],
  });
}

function addFromLibrary(id) {
  const lib = findExercise(id, custom());
  if (!lib) return;
  const d = curDay();
  const exId = exerciseIdFor(lib.name, S.plans, custom());
  if (d.exercises.some(x => x.id === exId || x.names.includes(lib.name))) { toast('Diese Übung steht schon in diesem Tag.'); return; }
  tidyLinks(d.exercises);
  d.exercises.push({ id: exId, names: [lib.name], ...defaultsFor(lib) });
  save(); closeSheet(); toast(`${lib.name} hinzugefügt`);
}

/* ---------- Pläne ---------- */
function usePlan(id) {
  if (!S.plans.some(p => p.id === id)) return;
  S.activePlanId = id;
  V.planDay = null;
  V.pick = null;
  save();
}

function switchSheet() {
  openSheet({
    title: 'Plan wechseln',
    text: 'Der gewählte Plan wird aktiv. Die Startseite schlägt dann seine Einheiten vor.',
    body: `<div class="choices">${S.plans.map(p => `
      <button class="choice ${p.id === S.activePlanId ? 'on' : ''}" aria-pressed="${p.id === S.activePlanId}" data-act="planuse" data-id="${esc(p.id)}">
        <b>${esc(p.name)}</b><span>${p.order.map(o => esc(p.days[o].name)).join(', ')}</span></button>`).join('')}</div>`,
    actions: [{ label: 'Schließen', kind: 'ghost', fn: closeSheet }],
  });
}

function newPlanSheet() {
  openSheet({
    title: 'Neuer Plan',
    text: 'Wähle eine Vorlage. Der neue Plan wird gleich aktiv und lässt sich danach frei anpassen.',
    body: `<div class="choices">${PLAN_TEMPLATES.map(t => `
      <button class="choice" data-act="plantpl" data-id="${t.id}"><b>${esc(t.name)}</b><span>${esc(t.hint)}</span></button>`).join('')}
      <button class="choice" data-act="planempty"><b>Leerer Plan</b><span>Ein Tag ohne Übungen. Du stellst alles selbst zusammen.</span></button></div>`,
    actions: [{ label: 'Abbrechen', kind: 'ghost', fn: closeSheet }],
  });
}

function addPlan(p) {
  p.name = uniquePlanName(p.name);
  S.plans.push(p);
  usePlan(p.id);
  closeSheet();
  toast(`„${p.name}“ angelegt und aktiv`);
}

function renameSheet() {
  const plan = activePlan();
  openSheet({
    title: 'Plan umbenennen',
    body: `<div class="form"><label>Name<input id="plan-name" value="${esc(plan.name)}" maxlength="30" autocomplete="off"></label></div>`,
    actions: [
      { label: 'Speichern', kind: 'primary', fn: () => {
        const v = document.getElementById('plan-name').value.trim();
        if (!v) { toast('Gib dem Plan einen Namen.'); return; }
        plan.name = v; save(); closeSheet(); toast('Plan umbenannt');
      } },
      { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
    ],
  });
}

function deletePlan() {
  const plan = activePlan();
  if (S.plans.length <= 1) return;
  const next = S.plans.find(p => p.id !== plan.id);
  confirmSheet(`„${plan.name}“ löschen?`, `Der Plan verschwindet, dein Verlauf bleibt. Danach ist „${next.name}“ aktiv.`, 'Plan löschen', () => {
    S.plans = S.plans.filter(p => p.id !== plan.id);
    usePlan(next.id);
    closeSheet();
    toast('Plan gelöscht');
  });
}

function addDay() {
  const plan = activePlan();
  const used = new Set(plan.order.map(o => plan.days[o].color));
  const color = PLAN_COLORS.find(c => !used.has(c)) || PLAN_COLORS[plan.order.length % PLAN_COLORS.length];
  const d = newDay(`Tag ${plan.order.length + 1}`, color);
  plan.days[d.id] = d;
  plan.order.push(d.id);
  V.planDay = d.id;
  save(); render();
  toast('Tag hinzugefügt');
}

function removeDay() {
  const plan = activePlan();
  const d = curDay();
  if (plan.order.length <= 1) return;
  const go = () => {
    plan.order = plan.order.filter(o => o !== d.id);
    delete plan.days[d.id];
    V.planDay = plan.order[0];
    if (V.pick === d.id) V.pick = null;
    save();
  };
  confirmSheet(`${d.name} entfernen?`, d.exercises.length
    ? `Der Tag mit ${d.exercises.length} Übungen verschwindet aus dem Plan. Dein Verlauf bleibt.`
    : 'Der leere Tag verschwindet aus dem Plan.', 'Tag entfernen', () => { go(); closeSheet(); toast('Tag entfernt'); });
}

export function resetPlan() {
  confirmSheet('Plan zurücksetzen?', 'Der 3er-Split wird wieder so wie am Anfang und ist danach aktiv. Dein Verlauf bleibt erhalten.', 'Plan zurücksetzen', () => {
    const fresh = defaultPlan();
    const i = S.plans.findIndex(p => p.id === fresh.id);
    if (i >= 0) S.plans[i] = fresh; else S.plans.unshift(fresh);
    usePlan(fresh.id);
    closeSheet(); toast('Plan zurückgesetzt');
  });
}

export const actions = {
  planday: el => { V.planDay = el.dataset.day; render(); },
  /* Verschieben: Supersatz-Verbindungen bleiben an ihrem Platz, so lässt sich die Reihenfolge im Supersatz tauschen */
  mv: el => {
    const list = curDay().exercises, i = +el.dataset.i, j = i + +el.dataset.d;
    if (j < 0 || j >= list.length) return;
    swapKeepLinks(list, i, j); save(); render();
  },
  /* Übung i mit der nächsten als Supersatz verbinden oder lösen */
  plss: el => {
    const list = curDay().exercises, i = +el.dataset.i;
    if (!list[i] || i >= list.length - 1) return;
    const on = list[i].ss !== true;
    setLink(list[i], on);
    save(); render();
    toast(on ? `Supersatz: ${exName(list[i])} und ${exName(list[i + 1])}` : 'Supersatz gelöst');
  },
  edit: el => editExercise(+el.dataset.i),
  addex: pickExercise,
  planpick: el => addFromLibrary(el.dataset.id),
  resetplan: resetPlan,
  planswitch: switchSheet,
  planuse: el => { usePlan(el.dataset.id); closeSheet(); toast(`„${activePlan().name}“ ist jetzt aktiv`); },
  plannew: newPlanSheet,
  plantpl: el => {
    const tpl = PLAN_TEMPLATES.find(t => t.id === el.dataset.id);
    if (tpl) addPlan(planFromTemplate(tpl, S.plans, custom()));
  },
  planempty: () => addPlan(emptyPlan('Eigener Plan')),
  planrename: renameSheet,
  plandelete: deletePlan,
  planaddday: addDay,
  planrmday: removeDay,
  plancolor: el => { curDay().color = el.dataset.v; save(); render(); },
};

export const inputs = {
  dayname: (el, type) => { curDay().name = el.value.trim() || 'Tag'; save(); if (type === 'change') render(); },
  daymuscles: (el, type) => { curDay().muscles = el.value.trim(); save(); if (type === 'change') render(); },
  planpickq: el => {
    let n = 0;
    document.querySelectorAll('.plan-pick li[data-pickid]').forEach(li => {
      const hit = matchesQuery(findExercise(li.dataset.pickid, custom()) || { name: '' }, el.value);
      li.hidden = !hit;
      if (hit) n++;
    });
    const none = document.querySelector('.plan-pick-none');
    if (none) none.hidden = n > 0;
  },
};
