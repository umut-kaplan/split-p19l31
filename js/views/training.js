import { S, V, activePlan } from '../state.js';
import { esc, dShort } from '../util.js';
import { render } from '../render.js';
import { nextDay } from '../domain/progression.js';
import { plateSVG } from '../ui/plate.js';
import { vWorkout } from './workout.js';
import { vHistory } from './history.js';
import { vPlan } from './planedit.js';

const SUBS = [['start', 'Einheit'], ['history', 'Verlauf'], ['plan', 'Plan']];

export function view() {
  if (S.active) return vWorkout();
  const sub = V.trainSub;
  const body = sub === 'history' ? vHistory() : sub === 'plan' ? vPlan() : vStart();
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
  return `<div class="day-list">${plan.order.map(id => {
    const d = plan.days[id];
    const { sets, min } = dayFacts(d);
    const last = [...S.sessions].reverse().find(s => s.dayId === id && (!s.planId || s.planId === plan.id));
    return `<section class="day-card day-${d.color} ${id === next ? 'next' : ''}">
      ${plateSVG(d.color, '', '', { small: true })}
      <div><h2>${esc(d.name)}${id === next ? '<span class="tag">Als Nächstes</span>' : ''}</h2>
        <p>${esc(d.muscles)}</p>
        <p>${d.exercises.length} Übungen, ${sets} Sätze, etwa ${min} Min.${last ? ` Zuletzt am ${esc(dShort(last.startedAt))}` : ''}</p></div>
      <button class="btn ${id === next ? 'primary' : ''}" data-act="start" data-day="${id}">${esc(d.name)} starten</button>
    </section>`;
  }).join('')}</div>`;
}

export const actions = {
  trainsub: el => { V.trainSub = el.dataset.sub; render(); },
};
