/* Angebot „Überarbeiteter 3er-Split verfügbar“ (4.7, Entscheidung Q29a). Reine Funktionen.
   Der aktive Plan wird nie überschrieben. Nutzt jemand den 3er-Split bis 4.6, unverändert oder leicht verändert,
   zeigt Training · Plan einmal eine Gegenüberstellung. Übernehmen legt den neuen Split als weiteren Plan an und macht
   ihn aktiv; gleiche Übungen behalten ihre ids, der Verlauf läuft weiter. „Behalten, nicht mehr fragen“ blendet das Angebot
   dauerhaft aus; die Vorlage steht weiter unter „Neuer Plan“.
   Die Entscheidung steht wie bei den Coach-Vorschlägen in S.suggestions[OFFER_ID]. */
import { LEGACY_SPLIT, DEFAULT_PLAN, templatePlan } from '../plans.js';
import { findTemplate } from '../data/plan-templates.js';
import { dayMinutes } from './plan-stats.js';

export const OFFER_ID = 'plan-update:split-4.7';
export const NEW_PLAN_NAME = '3er-Split (überarbeitet)';
/* Ab dieser Ähnlichkeit der Übungs-ids (Jaccard) gilt ein Plan als „leicht verändert“ */
export const SIMILAR = 0.6;

const idsOf = plan => new Set(plan.order.flatMap(id => ((plan.days[id] && plan.days[id].exercises) || []).map(e => e.id)));
function jaccard(a, b) {
  const inter = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 0;
}

/* Ist das der 3er-Split bis 4.6? Ähnlich genug zum alten und ähnlicher zum alten als zum neuen. */
export function isLegacySplit(plan) {
  if (!plan || !plan.order || !plan.days) return false;
  const ids = idsOf(plan);
  const old = jaccard(ids, idsOf(LEGACY_SPLIT));
  return old >= SIMILAR && old > jaccard(ids, idsOf(DEFAULT_PLAN));
}

const activeOf = S => S.plans.find(p => p.id === S.activePlanId) || S.plans[0] || null;

/* Soll das Angebot erscheinen? Nur einmal: nach Übernehmen oder „Behalten, nicht mehr fragen“ nie wieder. */
export function offerPending(S) {
  if (S.suggestions && S.suggestions[OFFER_ID]) return false;
  return isLegacySplit(activeOf(S));
}

const names = list => list.map(e => e.names[0]);

/* Gegenüberstellung zweier Pläne je Tag: Tage über den Namen, sonst über die Position zugeordnet.
   Liefert [{ name, before: { sets, minutes }, after: { sets, minutes }, removed: [Name], added: [Name] }] */
export function comparePlans(oldPlan, newPlan) {
  const oldDays = oldPlan.order.map(id => oldPlan.days[id]).filter(Boolean);
  const newDays = newPlan.order.map(id => newPlan.days[id]).filter(Boolean);
  return newDays.map((nd, i) => {
    const od = oldDays.find(d => d.name === nd.name) || oldDays[i] || { exercises: [] };
    const oldIds = new Set(od.exercises.map(e => e.id));
    const newIds = new Set(nd.exercises.map(e => e.id));
    const facts = d => ({ sets: d.exercises.reduce((a, e) => a + (e.sets || 0), 0), minutes: dayMinutes(d.exercises) });
    return {
      name: nd.name,
      before: facts(od),
      after: facts(nd),
      removed: names(od.exercises.filter(e => !newIds.has(e.id))),
      added: names(nd.exercises.filter(e => !oldIds.has(e.id))),
    };
  });
}

/* Der neue Split für diesen Nutzer: Kopie des 3er-Splits, an Geräte und Einstellungen angepasst. { plan, swaps } */
export function offeredPlan(S) {
  const r = templatePlan(findTemplate('split'), {
    plans: S.plans, custom: S.exercisesCustom || [], equipment: (S.profile && S.profile.equipment) || [], settings: S.settings,
    tags: (S.profile && S.profile.limitations && S.profile.limitations.tags) || [],
  });
  r.plan.name = NEW_PLAN_NAME;
  return r;
}

/* Angebot mit Vergleich, oder null */
export function planOffer(S) {
  if (!offerPending(S)) return null;
  const current = activeOf(S);
  const { plan, swaps } = offeredPlan(S);
  return { current, plan, swaps, days: comparePlans(current, plan) };
}

/* Übernehmen: neuen Plan anlegen und aktivieren; der bisherige bleibt in der Liste. Liefert die id des neuen Plans. */
export function acceptOffer(S, now = Date.now()) {
  const { plan } = offeredPlan(S);
  const names = new Set(S.plans.map(p => p.name));
  for (let i = 2; names.has(plan.name); i++) plan.name = `${NEW_PLAN_NAME} (${i})`;
  /* Markiert als 3er-Split: Wählt jemand in der Einrichtung später „3er-Split“, ist dieser gemeint */
  plan.template = 'split';
  /* Ab wann der Plan gilt: Der Coach schlägt Volumen erst nach einer vollen Woche mit ihm vor (coach/training.js) */
  plan.createdAt = now;
  S.plans.push(plan);
  S.activePlanId = plan.id;
  S.suggestions[OFFER_ID] = { status: 'accepted', date: now };
  return plan.id;
}

export function declineOffer(S, now = Date.now()) {
  S.suggestions[OFFER_ID] = { status: 'declined', date: now };
}
