/* Schema-Versionen und Umzug alter Daten. Reine Funktionen, darum per node --test prüfbar. */
import { defaultPlan } from '../plans.js';

export const SCHEMA = 2;
export const APP_ID = 'fit';

export function defaultProfile() {
  return {
    name: '',
    age: null,
    heightCm: null,
    weightKg: null,
    sex: null,          // 'm' | 'f'
    goal: null,         // 'gain' | 'lose' | 'recomp'
    activity: null,     // Schlüssel aus ACTIVITY in domain/energy.js
    daysPerWeek: 3,
    equipment: [],
    limitations: { text: '', tags: [] },
    targetWeightKg: null,
  };
}

export function defaultState() {
  return {
    schema: SCHEMA,
    profile: defaultProfile(),
    settings: { onboardingDone: false, disclaimerSeen: false, lastBackup: null },
    plans: [defaultPlan()],
    activePlanId: 'split',
    sessions: [],
    active: null,
    /* Messwerte immer mit Datum, Quelle und Methode, damit spätere Auswertungen sie einordnen können */
    body: { weights: [] },
    water: {},
    suggestions: {},
  };
}

/* Stand der ersten App (localStorage split.v1 oder Backup version 1) */
export function fromV1(v1) {
  if (!v1 || !v1.plan || !v1.plan.days || !Array.isArray(v1.sessions)) throw new Error('Keine Daten der ersten Version');
  const s = defaultState();
  s.plans = [{ id: 'split', name: '3er-Split', order: v1.plan.order, days: v1.plan.days }];
  s.sessions = v1.sessions.map(x => ({ ...x, planId: 'split' }));
  s.active = v1.active ? { ...v1.active, planId: 'split' } : null;
  s.settings.lastBackup = v1.lastBackup || null;
  return s;
}

/* Füllt fehlende Felder auf, damit ältere Stände mit neuem Code laufen */
export function normalize(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.plans) || !s.plans.length || !Array.isArray(s.sessions)) {
    throw new Error('Ungültige Daten');
  }
  const d = defaultState();
  const p = s.profile || {};
  return {
    ...d,
    ...s,
    schema: SCHEMA,
    profile: { ...d.profile, ...p, limitations: { ...d.profile.limitations, ...(p.limitations || {}) } },
    settings: { ...d.settings, ...(s.settings || {}) },
    body: { ...d.body, ...(s.body || {}) },
    water: { ...(s.water || {}) },
    suggestions: { ...(s.suggestions || {}) },
    activePlanId: s.plans.some(x => x.id === s.activePlanId) ? s.activePlanId : s.plans[0].id,
  };
}

export function toBackup(S, now = new Date()) {
  return { app: APP_ID, version: SCHEMA, exportedAt: now.toISOString(), data: { ...S, active: null } };
}

/* Nimmt Backups beider Versionen an und liefert einen Stand im aktuellen Schema */
export function fromBackup(obj) {
  if (obj && obj.app === 'split' && obj.version === 1) return fromV1(obj);
  if (obj && obj.app === APP_ID && obj.version === SCHEMA && obj.data) return normalize(obj.data);
  if (obj && obj.app === APP_ID && obj.version > SCHEMA) throw new Error('Das Backup stammt aus einer neueren Version der App.');
  throw new Error('Die Datei ist kein Backup dieser App.');
}
