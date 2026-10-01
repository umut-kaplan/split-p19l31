/* Planwahl in der Einrichtung. Überschreibt nie Pläne oder Verlauf:
   ein passender Plan wird aktiviert, sonst ein neuer angelegt. Die Trainingstage pro Woche bleiben, wie der
   Schritt davor sie eingestellt hat; nach ihnen richtet sich die Empfehlung (4.7). */
import { DEFAULT_PLAN, defaultPlanFor, emptyPlan, templatePlan } from '../plans.js';
import { PLAN_TEMPLATES, findTemplate } from '../data/plan-templates.js';
import { hasSmartCircuit } from './equipment.js';

/* Alle sechs Vorlagen und der leere Plan. 'split' ist der 3er-Split mit seiner festen id. */
export const PLAN_CHOICES = [
  ...PLAN_TEMPLATES.map(t => ({ id: t.id, name: t.name, hint: t.hint, days: t.perWeek, smart: !!t.smart })),
  { id: 'empty', name: 'Eigener Plan', hint: 'Ein leerer Tag. Die Übungen trägst du unter Training, Plan selbst ein.', days: null },
];

/* Empfehlung nach Trainingstagen pro Woche (Entscheidung Q28): 2 → Ganzkörper 2×, 3 → Ganzkörper 3×,
   4 → Oberkörper/Unterkörper, 5 bis 7 → Push/Pull/Beine 6×; 1 wie 2. Mit Smart-Zirkel zusätzlich „Nur Smart-Zirkel“. */
export function recommendedChoices(daysPerWeek, equipment = []) {
  const n = Math.round(daysPerWeek) || 3;
  const base = n <= 2 ? 'fullbody2' : n === 3 ? 'fullbody3' : n === 4 ? 'upperlower4' : 'ppl6';
  return hasSmartCircuit(equipment) ? [base, 'smart'] : [base];
}

/* Wahlmöglichkeiten in der Reihenfolge der Anzeige: Empfehlungen zuerst, dann die übrigen Vorlagen, zuletzt der
   leere Plan. „Nur Smart-Zirkel“ erscheint nur mit angehaktem Smart-Zirkel (oder wenn er gerade aktiv ist). */
export function choicesFor(state, current = null) {
  const rec = recommendedChoices(state.profile.daysPerWeek, state.profile.equipment);
  const smart = hasSmartCircuit(state.profile.equipment) || current === 'smart';
  const list = PLAN_CHOICES.filter(c => !c.smart || smart);
  return [...rec.map(id => list.find(c => c.id === id)).filter(Boolean), ...list.filter(c => !rec.includes(c.id))]
    .map(c => ({ ...c, recommended: rec.includes(c.id) }));
}

/* Ein Name, den es in den Plänen noch nicht gibt */
function uniqueName(plans, base) {
  const names = new Set(plans.map(p => p.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} (${i})`)) return `${base} (${i})`;
}

/* Vorhandener Plan zu einer Wahl. Pläne aus dem Plan-Editor tragen keine Markierung, dort zählt der Name der Vorlage. */
export function findPlanFor(state, choice) {
  /* Der übernommene überarbeitete Split (domain/plan-update.js) geht dem mit der festen id vor */
  if (choice === 'split') return state.plans.find(p => p.template === 'split') || state.plans.find(p => p.id === DEFAULT_PLAN.id) || null;
  if (choice === 'empty') return state.plans.find(p => p.template === 'empty') || null;
  const t = findTemplate(choice);
  if (!t) return null;
  return state.plans.find(p => p.template === choice) || state.plans.find(p => !p.template && p.name === t.name) || null;
}

/* Welche Wahl passt zum aktiven Plan? null, wenn er aus keiner stammt. */
export function currentChoice(state) {
  const p = state.plans.find(x => x.id === state.activePlanId) || state.plans[0];
  if (!p) return null;
  if (p.id === DEFAULT_PLAN.id) return 'split';
  if (p.template && PLAN_CHOICES.some(c => c.id === p.template)) return p.template;
  const t = PLAN_TEMPLATES.find(x => !x.fromDefault && x.name === p.name);
  return t ? t.id : null;
}

/* Frische Einrichtung: nur der mitgelieferte 3er-Split, unverändert und nie benutzt. Dann darf die Einrichtung
   ihn gegen die Empfehlung tauschen oder an die Geräte anpassen, ohne etwas vom Nutzer zu verlieren. */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function untouchedDefault(state, plan) {
  if (!plan || plan.id !== DEFAULT_PLAN.id) return false;
  const used = (state.sessions || []).some(s => s.planId === plan.id) || (state.active && state.active.planId === plan.id);
  return !used && same(plan.order, DEFAULT_PLAN.order) && same(plan.days, DEFAULT_PLAN.days);
}
export const isFreshSetup = state => state.plans.length === 1 && untouchedDefault(state, state.plans[0]);

/* Einen in diesem Durchgang angelegten Plan wieder entfernen, solange er nie benutzt wurde */
function discardUnused(state, id) {
  if (!id || id === DEFAULT_PLAN.id || id === state.activePlanId) return;
  const used = (state.sessions || []).some(s => s.planId === id) || (state.active && state.active.planId === id);
  if (used) return;
  const i = state.plans.findIndex(p => p.id === id);
  if (i >= 0 && state.plans.length > 1) state.plans.splice(i, 1);
}

/* Wendet eine Wahl an. Neue Pläne passen sich an die Geräte im Profil an (fehlende Geräte → nächste Alternative).
   opts.discardId: in diesem Durchgang angelegter Plan, der bei einer anderen Wahl wieder weg darf.
   Frische Einrichtung ohne jeden Verlauf: Wer eine andere Wahl trifft als den 3er-Split, behält den mitgelieferten,
   nie benutzten 3er-Split nicht als zweiten Plan (Prüfung 4.7, Punkt A). Wählt er ihn später doch, kommt er mit
   seiner id zurück. Bestehende Nutzer betrifft das nie: Sie haben Verlauf oder mehr als den einen Plan.
   Liefert { planId, created, changed, swaps }. */
export function choosePlan(state, choice, opts = {}) {
  const c = PLAN_CHOICES.find(x => x.id === choice);
  if (!c) throw new Error('Unbekannte Planwahl: ' + choice);
  const fresh = isFreshSetup(state) && !(state.sessions || []).length && !state.active;
  const ctx = { plans: state.plans, custom: state.exercisesCustom || [], equipment: state.profile.equipment || [], settings: state.settings,
    tags: (state.profile.limitations && state.profile.limitations.tags) || [] };
  const before = state.activePlanId;
  let plan = findPlanFor(state, choice);
  let created = false;
  let swaps = [];
  if (plan && choice === 'split' && untouchedDefault(state, plan)) {
    /* Der mitgelieferte, nie benutzte 3er-Split darf sich noch an die Geräte anpassen */
    const r = defaultPlanFor(ctx);
    swaps = r.swaps;
    if (swaps.length || !same(r.plan, plan)) state.plans[state.plans.indexOf(plan)] = plan = r.plan;
  }
  if (!plan) {
    if (choice === 'split') ({ plan, swaps } = defaultPlanFor(ctx));
    else if (choice === 'empty') { plan = emptyPlan(c.name); plan.template = 'empty'; }
    else { ({ plan, swaps } = templatePlan(findTemplate(choice), ctx)); plan.template = choice; }
    if (plan.id !== DEFAULT_PLAN.id) plan.name = uniqueName(state.plans, plan.name);
    state.plans.push(plan);
    created = true;
  }
  state.activePlanId = plan.id;
  if (opts.discardId && opts.discardId !== plan.id) discardUnused(state, opts.discardId);
  if (fresh && plan.id !== DEFAULT_PLAN.id) {
    const i = state.plans.findIndex(p => p.id === DEFAULT_PLAN.id);
    if (i >= 0 && untouchedDefault(state, state.plans[i])) state.plans.splice(i, 1);
  }
  return { planId: plan.id, created, changed: plan.id !== before, swaps };
}
