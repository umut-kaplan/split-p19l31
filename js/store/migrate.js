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
    settings: { onboardingDone: false, disclaimerSeen: false, lastBackup: null, lastPhotoPrompt: null },
    plans: [defaultPlan()],
    activePlanId: 'split',
    sessions: [],
    active: null,
    /* Eigene Übungen: { id, name, muscles: { primary, secondary }, equipment, steps, mistakes, image, media, custom: true } */
    exercisesCustom: [],
    /* Messwerte immer mit Datum, Quelle und Methode, damit spätere Auswertungen sie einordnen können.
       weights:      { date, kg, source, method }
       measurements: { date, neck, shoulders, chest, waist, belly, hip, upperArmL, upperArmR, forearm, thigh, calf, source }  (cm, jede Teilmenge)
       composition:  { date, bfPct, method: 'scale' | 'caliper' | 'dexa' | 'other', source, measured: true }
       photos:       { id, date, pose: 'front' | 'side' | 'back' }  (Bilddaten in IndexedDB, Store 'photos') */
    body: { weights: [], measurements: [], composition: [], photos: [] },
    /* log: { 'YYYY-MM-DD': [{ id, meal, name, grams, per100: { kcal, protein, fat, carbs }, source, ref }] }
       overrides: null oder { kcal, protein, fat, carbs } von Hand gesetzt
       kcalAdjust: Summe der angenommenen Anpassungen aus dem Wochenvergleich */
    nutrition: { log: {}, customFoods: [], savedMeals: [], recipes: [], recent: [], overrides: null, kcalAdjust: 0 },
    water: {},
    /* Entscheidungen zu Empfehlungen: { [id]: { status: 'accepted' | 'declined', date } } */
    suggestions: {},
    /* Tracking (Stufe 6). Jeder Wert mit Datum und Quelle ('manual', 'apple-health', …).
       steps:     { date, steps, source }
       restingHr: { date, bpm, source }
       sleep:     { date, hours, source }   date = der Tag, an dem die Nacht endet
       cardio:    { id, date, type, minutes, km, kcal, source }
       burn:      { date, kcal, source }    gemessener Tagesverbrauch, z. B. von einer Uhr */
    activity: { steps: [], restingHr: [], sleep: [], cardio: [], burn: [] },
    /* Check-in vor dem Training: { 'YYYY-MM-DD': { sleepH, feeling } }, Gefühl 1 (schlecht) bis 5 (sehr gut) */
    checkins: {},
    /* Motivation (Stufe 5)
       goals:      [{ id, kind: 'weight' | 'lift' | 'weeks' | 'custom', title, target, ref, createdAt, doneAt }]
       weekly:     { proteinDays, waterDays }  Trainingstage pro Woche kommen aus profile.daysPerWeek
       badges:     { [id]: Zeitpunkt, an dem das Abzeichen verdient wurde }
       reportSeen: 'JJJJ-WW' der zuletzt angesehenen Berichtswoche */
    motivation: { goals: [], weekly: { proteinDays: 5, waterDays: 5 }, badges: {}, reportSeen: null },
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
    nutrition: { ...d.nutrition, ...(s.nutrition || {}) },
    exercisesCustom: Array.isArray(s.exercisesCustom) ? s.exercisesCustom : [],
    activity: { ...d.activity, ...(s.activity || {}) },
    checkins: { ...(s.checkins || {}) },
    motivation: { ...d.motivation, ...(s.motivation || {}), weekly: { ...d.motivation.weekly, ...((s.motivation && s.motivation.weekly) || {}) } },
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
