import { S, V, activePlan } from '../state.js';
import { esc, dShort } from '../util.js';
import { render } from '../render.js';
import { nextDay } from '../domain/progression.js';
import { plateSVG } from '../ui/plate.js';
import { vWorkout } from './workout.js';
import { vHistory } from './history.js';
import { vPlan, daySubview } from './planedit.js';
import * as library from './library.js';
import * as compare from './compare.js';
import * as knowledge from './knowledge.js';
import { suggestionCards } from '../ui/suggestion.js';
import { pendingSuggestions } from '../coach/index.js';
import { shiftTrainLine } from './shift-today.js';
import { ICON } from '../ui/icons.js';

/* Vier Reiter; „Wissen“ steht als Umschalter oben im Reiter „Übungen“ */
const SUBS = [['start', 'Einheit'], ['history', 'Verlauf'], ['plan', 'Plan'], ['library', 'Übungen']];
const LIB_MODES = [['list', 'Übungen'], ['knowledge', 'Wissen']];

/* Untermodule, deren actions und inputs app.js einsammelt */
export const modules = [library, compare, knowledge];

/* Reiterleiste; im laufenden Training steht sie unter der Kopfleiste der Einheit */
const subTabs = sub => `<div class="seg wide" role="tablist">${SUBS.map(([k, l]) =>
  `<button role="tab" aria-selected="${sub === k}" class="${sub === k ? 'on' : ''}" data-act="trainsub" data-sub="${k}">${l}</button>`).join('')}</div>`;

export function view() {
  /* „Vergleichen“ zeigt app.js über jedem Bereich, auch während eines Trainings */
  const sub = SUBS.some(([k]) => k === V.trainSub) ? V.trainSub : 'start';
  /* Laufendes Training: „Einheit“ ist die Einheit; Verlauf, Plan und Übungen samt Wissen bleiben erreichbar (4.6) */
  if (S.active && sub === 'start') return vWorkout(subTabs('start'));
  /* Unterseite „Tag bearbeiten“ (Stift an einer Tageskarte unter „Einheit“); im Training gibt es sie nicht (nav.js, Ebene planday) */
  const day = S.active ? null : daySubview();
  if (day) return day;
  const body = sub === 'history' ? vHistory() : sub === 'plan' ? vPlan() : sub === 'library' ? vExercises() : vStart();
  return `<div class="train-head">
      <h1 class="page-title">Training</h1>
      ${subTabs(sub)}
    </div>
    ${body}`;
}

/* Reiter „Übungen“: oben der Umschalter zwischen Übungsliste und Wissen-Karten */
function vExercises() {
  const mode = V.libMode === 'knowledge' ? 'knowledge' : 'list';
  return `<div class="seg wide lib-mode" role="tablist" aria-label="Übungen oder Wissen">${LIB_MODES.map(([k, l]) =>
    `<button role="tab" aria-selected="${mode === k}" class="${mode === k ? 'on' : ''}" data-act="libmode" data-v="${k}">${l}</button>`).join('')}</div>
    ${mode === 'knowledge' ? knowledge.vKnowledge() : library.vLibrary()}`;
}

export function dayFacts(d) {
  const sets = d.exercises.reduce((a, e) => a + e.sets, 0);
  const min = Math.round(d.exercises.reduce((a, e) => a + e.sets * (e.rest + 45), 0) / 60 + 10);
  return { sets, min };
}

function vStart() {
  const plan = activePlan();
  const next = nextDay(plan.order, S.sessions, plan.id);
  /* Offene Trainingsvorschläge (Deload, Volumen, Einschränkungen) aus coach/training.js, erst zwei, dann auf Wunsch alle */
  const open = pendingSuggestions(S, Date.now(), 'training').length;
  const sug = suggestionCards('training', V.histSugAll ? 99 : 2);
  const more = open > 2 && !V.histSugAll
    ? `<button class="link" data-act="histsugmore">${open - 2 === 1 ? 'Einen weiteren Vorschlag zeigen' : `${open - 2} weitere Vorschläge zeigen`}</button>` : '';
  return `${sug ? `<div class="stack train-sug">${sug}${more}</div>` : ''}
    <p class="plan-active">Plan: <b>${esc(plan.name)}</b>
      <button class="link" data-act="trainsub" data-sub="plan">${S.plans.length > 1 ? 'Wechseln oder bearbeiten' : 'Bearbeiten'}</button></p>
    ${shiftTrainLine()}
    ${compare.entryRow()}
    <div class="day-list">${plan.order.map(id => {
    const d = plan.days[id];
    const { sets, min } = dayFacts(d);
    const last = [...S.sessions].reverse().find(s => s.dayId === id && (!s.planId || s.planId === plan.id));
    const empty = !d.exercises.length;
    return `<section class="day-card day-${d.color} ${id === next ? 'next' : ''}">
      ${plateSVG(d.color, '', '', { small: true })}
      <div><h2>${esc(d.name)}${id === next ? '<span class="tag">Als Nächstes</span>' : ''}</h2>
        ${d.muscles ? `<p>${esc(d.muscles)}</p>` : ''}
        <p>${empty ? 'Noch keine Übungen.' : `${d.exercises.length} ${d.exercises.length === 1 ? 'Übung' : 'Übungen'}, ${sets} ${sets === 1 ? 'Satz' : 'Sätze'}, etwa ${min} Min.${last ? ` Zuletzt am ${esc(dShort(last.startedAt))}` : ''}`}</p></div>
      <button class="icon day-edit" data-act="planeditday" data-day="${id}" aria-label="${esc(d.name)} bearbeiten">${ICON.edit}</button>
      ${empty
        ? `<button class="btn" data-act="planeditday" data-day="${id}">Übungen eintragen</button>`
        : `<button class="btn ${id === next ? 'primary' : ''}" data-act="start" data-day="${id}">${esc(d.name)} starten</button>`}
    </section>`;
  }).join('')}</div>`;
}

export const actions = {
  trainsub: el => { V.trainSub = el.dataset.sub; render(); },
  libmode: el => { V.libMode = el.dataset.v === 'knowledge' ? 'knowledge' : 'list'; render(); },
};
