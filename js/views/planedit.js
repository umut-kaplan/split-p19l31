import { S, V, save, activePlan } from '../state.js';
import { esc, fmt, toNum, mmss, unitL, exName, uid } from '../util.js';
import { render } from '../render.js';
import { defaultPlan } from '../plans.js';
import { plateSVG } from '../ui/plate.js';
import { ICON } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';

const curDay = () => {
  const plan = activePlan();
  if (!V.planDay || !plan.days[V.planDay]) V.planDay = plan.order[0];
  return plan.days[V.planDay];
};

export function vPlan() {
  const plan = activePlan();
  const d = curDay();
  return `<div class="day-${d.color}">
    <p class="page-sub">Änderungen gelten ab dem nächsten Training.</p>
    <div class="day-tabs" role="tablist">
      ${plan.order.map(o => { const od = plan.days[o]; return `
        <button class="day-${od.color} ${o === V.planDay ? 'on' : ''}" role="tab" aria-selected="${o === V.planDay}" data-act="planday" data-day="${o}">
          ${plateSVG(od.color, '', '', { small: true })}${esc(od.name)}</button>`; }).join('')}
    </div>
    <div class="fields" style="margin-top:16px">
      <label class="field">Name des Tages<input data-in="dayname" value="${esc(d.name)}" maxlength="20"></label>
      <label class="field">Muskelgruppen<input data-in="daymuscles" value="${esc(d.muscles)}" maxlength="60"></label>
    </div>
    <ul class="pe-list">
      ${d.exercises.map((e, i) => `
      <li class="pe">
        <div><b>${esc(exName(e))}</b>
          <span class="num">${e.sets} × ${e.repMin}–${e.repMax} ${unitL(e.unit)}, Pause ${mmss(e.rest)}</span></div>
        <div class="pe-tools">
          <button class="icon" data-act="mv" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="${esc(exName(e))} nach oben">${ICON.up}</button>
          <button class="icon" data-act="mv" data-i="${i}" data-d="1" ${i === d.exercises.length - 1 ? 'disabled' : ''} aria-label="${esc(exName(e))} nach unten">${ICON.down}</button>
          <button class="icon" data-act="edit" data-i="${i}" aria-label="${esc(exName(e))} bearbeiten">${ICON.edit}</button>
        </div>
      </li>`).join('')}
    </ul>
    <div class="stack"><button class="btn" data-act="addex">Übung hinzufügen</button></div>
  </div>`;
}

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
    <label>Steigerung in kg<input id="f-inc" inputmode="decimal" value="${fmt(e.inc)}"></label>
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
  const e = isNew ? { id: 'x' + uid(), names: [''], sets: 3, repMin: 8, repMax: 12, rest: 90, inc: 2.5, unit: 'reps' } : d.exercises[i];
  const actions = [{
    label: isNew ? 'Übung hinzufügen' : 'Änderungen speichern', kind: 'primary', fn: () => {
      const r = readForm();
      if (typeof r === 'string') { toast(r); return; }
      Object.assign(e, r);
      if (isNew) d.exercises.push(e);
      save(); closeSheet(); toast(isNew ? 'Übung hinzugefügt' : 'Änderungen gespeichert');
    },
  }];
  if (!isNew) actions.push({
    label: 'Übung löschen', kind: 'danger', fn: () =>
      confirmSheet(`${exName(e)} löschen?`, 'Die Übung verschwindet aus dem Plan. Bisherige Einträge im Verlauf bleiben.', 'Übung löschen', () => {
        d.exercises.splice(i, 1); save(); closeSheet(); toast('Übung gelöscht');
      }),
  });
  actions.push({ label: 'Abbrechen', kind: 'ghost', fn: closeSheet });
  openSheet({ title: isNew ? 'Neue Übung' : 'Übung bearbeiten', body: editForm(e), actions });
}

export function resetPlan() {
  confirmSheet('Plan zurücksetzen?', 'Der 3er-Split wird wieder so wie am Anfang. Dein Verlauf bleibt erhalten.', 'Plan zurücksetzen', () => {
    const fresh = defaultPlan();
    const i = S.plans.findIndex(p => p.id === fresh.id);
    if (i >= 0) S.plans[i] = fresh; else S.plans.unshift(fresh);
    S.activePlanId = fresh.id;
    V.planDay = null;
    save(); closeSheet(); toast('Plan zurückgesetzt');
  });
}

export const actions = {
  planday: el => { V.planDay = el.dataset.day; render(); },
  mv: el => {
    const list = curDay().exercises, i = +el.dataset.i, j = i + +el.dataset.d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]]; save(); render();
  },
  edit: el => editExercise(+el.dataset.i),
  addex: () => editExercise(null),
  resetplan: resetPlan,
};

export const inputs = {
  dayname: (el, type) => { curDay().name = el.value.trim() || 'Tag'; save(); if (type === 'change') render(); },
  daymuscles: (el, type) => { curDay().muscles = el.value.trim(); save(); if (type === 'change') render(); },
};
