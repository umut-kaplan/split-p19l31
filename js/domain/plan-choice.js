/* Planwahl in der Einrichtung. Überschreibt nie Pläne oder Verlauf:
   ein passender Plan wird aktiviert, sonst ein neuer angelegt. */
import { DEFAULT_PLAN, defaultPlan, emptyPlan, planFromTemplate } from '../plans.js';
import { PLAN_TEMPLATES } from '../data/plan-templates.js';

const tpl = id => PLAN_TEMPLATES.find(t => t.id === id);

/* Die Vorlage Push/Pull/Legs fehlt absichtlich, sie ist eine Kopie des 3er-Splits */
export const PLAN_CHOICES = [
  { id: 'split', name: DEFAULT_PLAN.name, hint: 'Push, Pull und Legs, drei Einheiten pro Woche.', days: 3 },
  { id: 'fullbody2', name: tpl('fullbody2').name, hint: tpl('fullbody2').hint, days: 2 },
  { id: 'upperlower4', name: tpl('upperlower4').name, hint: tpl('upperlower4').hint, days: 4 },
  { id: 'empty', name: 'Eigener Plan', hint: 'Ein leerer Tag. Die Übungen trägst du unter Training, Plan selbst ein.', days: 3 },
];

/* Ein Name, den es in den Plänen noch nicht gibt */
function uniqueName(plans, base) {
  const names = new Set(plans.map(p => p.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} (${i})`)) return `${base} (${i})`;
}

/* Vorhandener Plan zu einer Wahl. Pläne aus dem Plan-Editor tragen keine Markierung, dort zählt der Name der Vorlage. */
export function findPlanFor(state, choice) {
  if (choice === 'split') return state.plans.find(p => p.id === DEFAULT_PLAN.id) || null;
  if (choice === 'empty') return state.plans.find(p => p.template === 'empty') || null;
  const t = tpl(choice);
  if (!t) return null;
  return state.plans.find(p => p.template === choice) || state.plans.find(p => !p.template && p.name === t.name) || null;
}

/* Welche Wahl passt zum aktiven Plan? null, wenn er aus keiner der vier stammt. */
export function currentChoice(state) {
  const p = state.plans.find(x => x.id === state.activePlanId) || state.plans[0];
  if (!p) return null;
  if (p.id === DEFAULT_PLAN.id) return 'split';
  if (p.template && PLAN_CHOICES.some(c => c.id === p.template)) return p.template;
  const t = PLAN_TEMPLATES.find(x => !x.fromDefault && x.name === p.name);
  return t && PLAN_CHOICES.some(c => c.id === t.id) ? t.id : null;
}

/* Einen in diesem Durchgang angelegten Plan wieder entfernen, solange er nie benutzt wurde */
function discardUnused(state, id) {
  if (!id || id === DEFAULT_PLAN.id || id === state.activePlanId) return;
  const used = (state.sessions || []).some(s => s.planId === id) || (state.active && state.active.planId === id);
  if (used) return;
  const i = state.plans.findIndex(p => p.id === id);
  if (i >= 0 && state.plans.length > 1) state.plans.splice(i, 1);
}

/* Wendet eine Wahl an und belegt die Trainingstage vor, wenn sich der aktive Plan ändert.
   opts.discardId: in diesem Durchgang angelegter Plan, der bei einer anderen Wahl wieder weg darf.
   Liefert { planId, created, changed }. */
export function choosePlan(state, choice, opts = {}) {
  const c = PLAN_CHOICES.find(x => x.id === choice);
  if (!c) throw new Error('Unbekannte Planwahl: ' + choice);
  const before = state.activePlanId;
  let plan = findPlanFor(state, choice);
  let created = false;
  if (!plan) {
    if (choice === 'split') plan = defaultPlan();
    else if (choice === 'empty') { plan = emptyPlan(c.name); plan.template = 'empty'; }
    else { plan = planFromTemplate(tpl(choice), state.plans, state.exercisesCustom || []); plan.template = choice; }
    if (plan.id !== DEFAULT_PLAN.id) plan.name = uniqueName(state.plans, plan.name);
    state.plans.push(plan);
    created = true;
  }
  state.activePlanId = plan.id;
  if (opts.discardId && opts.discardId !== plan.id) discardUnused(state, opts.discardId);
  const changed = plan.id !== before;
  if (changed) state.profile.daysPerWeek = c.days;
  return { planId: plan.id, created, changed };
}
