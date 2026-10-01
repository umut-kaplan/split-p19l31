import { S, V, activePlan } from '../state.js';
import { esc, dShort } from '../util.js';
import { render } from '../render.js';
import { nextDay } from '../domain/progression.js';
import { plateSVG } from '../ui/plate.js';
import { vWorkout } from './workout.js';
import { vHistory } from './history.js';
import { vPlan } from './planedit.js';
import * as library from './library.js';
import * as compare from './compare.js';
import * as knowledge from './knowledge.js';
import { suggestionCards } from '../ui/suggestion.js';
import { pendingSuggestions } from '../coach/index.js';
import { shiftTrainLine } from './shift-today.js';

const SUBS = [['start', 'Einheit'], ['history', 'Verlauf'], ['plan', 'Plan'], ['library', 'Übungen'], ['knowledge', 'Wissen']];

/* Untermodule, deren actions und inputs app.js einsammelt */
export const modules = [library, compare, knowledge];

export function view() {
  if (S.active) return vWorkout();
  /* Unterseite „Vergleichen“ ersetzt die Trainingsseite, bis sie geschlossen oder über die Navigation verlassen wird */
  const cmp = compare.subview();
  if (cmp) return cmp;
  const sub = V.trainSub;
  const body = sub === 'history' ? vHistory() : sub === 'plan' ? vPlan() : sub === 'library' ? library.vLibrary()
    : sub === 'knowledge' ? knowledge.vKnowledge() : vStart();
  return `<div class="train-head">
      <h1 class="page-title">Training</h1>
      <div class="seg wide" role="tablist">${SUBS.map(([k, l]) =>
        `<button role="tab" aria-selected="${sub === k}" class="${sub === k ? 'on' : ''}" data-act="trainsub" data-sub="${k}">${l}</button>`).join('')}</div>
    </div>
    ${body}`;
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
    <div class="day-list">${plan.order.map(id => {
    const d = plan.days[id];
    const { sets, min } = dayFacts(d);
    const last = [...S.sessions].reverse().find(s => s.dayId === id && (!s.planId || s.planId === plan.id));
    const empty = !d.exercises.length;
    return `<section class="day-card day-${d.color} ${id === next ? 'next' : ''}">
      ${plateSVG(d.color, '', '', { small: true })}
      <div><h2>${esc(d.name)}${id === next ? '<span class="tag">Als Nächstes</span>' : ''}</h2>
        ${d.muscles ? `<p>${esc(d.muscles)}</p>` : ''}
        <p>${empty ? 'Noch keine Übungen.' : `${d.exercises.length} Übungen, ${sets} Sätze, etwa ${min} Min.${last ? ` Zuletzt am ${esc(dShort(last.startedAt))}` : ''}`}</p></div>
      ${empty
        ? `<button class="btn" data-act="trainsub" data-sub="plan">Übungen eintragen</button>`
        : `<button class="btn ${id === next ? 'primary' : ''}" data-act="start" data-day="${id}">${esc(d.name)} starten</button>`}
    </section>`;
  }).join('')}</div>
    ${compare.entryCard()}`;
}

export const actions = {
  trainsub: el => { V.trainSub = el.dataset.sub; render(); },
};
