/* Schema-Versionen und Umzug alter Daten. Reine Funktionen, darum per node --test prüfbar. */
import { defaultPlan } from '../plans.js';
import { cleanSet } from '../domain/settypes.js';
import { cleanLink } from '../domain/superset.js';
import { defaultShifts, normalizeShifts } from '../domain/shifts.js';
import { plateSettings } from '../domain/plates.js';
import { cleanBirthDate } from '../domain/birthdate.js';
import { migrateProfileEquipment, migrateExerciseEquipment, hasLegacyEquipment } from '../domain/equipment.js';
import { cleanDumbbellInc, DEFAULT_DUMBBELL_INC } from '../domain/library.js';

export const SCHEMA = 2;
export const APP_ID = 'fit';

export function defaultProfile() {
  return {
    name: '',
    birthDate: null,    // 'JJJJ-MM-TT', siehe domain/birthdate.js
    age: null,          // nur noch Notlösung für Stände ohne Geburtsdatum
    heightCm: null,
    weightKg: null,
    sex: null,          // 'm' | 'f'
    goal: null,         // 'gain' | 'lose' | 'recomp'
    activity: null,     // Schlüssel aus ACTIVITY in domain/energy.js
    daysPerWeek: 3,
    equipment: [],      // Geräte-ids aus data/equipment.js, leer = alles erlaubt (domain/equipment.js)
    limitations: { text: '', tags: [] },
    targetWeightKg: null,
  };
}

export function defaultState() {
  return {
    schema: SCHEMA,
    profile: defaultProfile(),
    /* plates: Stangen, vorhandene Scheiben mit Farbe und die Stange pro Übung für Scheibenrechner und Aufwärmen (domain/plates.js) */
    settings: {
      onboardingDone: false, disclaimerSeen: false, lastBackup: null, lastPhotoPrompt: null,
      /* Backup-Erinnerung auf „Heute“: nach 7, 14 oder 30 Tagen, 0 = aus; backupSnoozedAt: Zeitpunkt von „Später“ */
      backupRemindDays: 7, backupSnoozedAt: null,
      /* Vergleich: Körpergewicht im eigenen QR-Code mitteilen */
      compareWeight: true,
      /* Bildschirm während eines Trainings anlassen (Screen Wake Lock, js/wake-lock.js) */
      wakeLock: true,
      /* Steigerung neuer Kurzhantel-Übungen im Plan: 1, 2 oder 2,5 kg (domain/library.js, defaultsFor) */
      dumbbellInc: DEFAULT_DUMBBELL_INC,
      plates: plateSettings(null),
    },
    /* Dauerhafte Notizen pro Übung: { 'exId|Name': 'Sitz Stufe 4' }. Trainings tragen optional rating: { rpe, note }. */
    exerciseNotes: {},
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
    /* Zuletzt gescannter Stand eines Trainingspartners: { code, scannedAt }. code ist der Text aus dem QR-Code,
       gelesen wird er mit decodeStand aus domain/compare.js. */
    compare: null,
    /* Schichtplan: Muster, Import, Einzeländerungen und Zeiten, siehe domain/shifts.js. Ohne Muster und Import plant die App nichts. */
    shifts: defaultShifts(),
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

/* Satztyp t an Sätzen und Supersatz-Verbindung ss an Übungen: gültige Werte bleiben, unbekannte fallen weg.
   Stände ohne diese Felder kommen unverändert durch. */
const mapList = (list, fn) => (Array.isArray(list) ? list.map(fn) : list);
const withList = (o, k, fn) => (o && typeof o === 'object' && Array.isArray(o[k]) ? { ...o, [k]: o[k].map(fn) } : o);
const cleanSessions = list => mapList(list, se => withList(se, 'ex', x => withList(x, 'sets', cleanSet)));
const cleanPlans = list => mapList(list, p => {
  if (!p || typeof p !== 'object' || !p.days || typeof p.days !== 'object') return p;
  const days = {};
  Object.keys(p.days).forEach(k => { days[k] = withList(p.days[k], 'exercises', (e, i, all) => cleanLink(e, i === all.length - 1)); });
  return { ...p, days };
});
const cleanActive = a => withList(a, 'ex', (x, i, all) => withList(cleanLink(x, i === all.length - 1), 'log', cleanSet));
/* Nur die Form prüfen; den Inhalt prüft decodeStand beim Anzeigen. 2000 Zeichen wie MAX_INPUT in domain/compare.js. */
function normalizeCompare(c) {
  if (!c || typeof c !== 'object' || typeof c.code !== 'string' || !c.code || c.code.length > 2000) return null;
  return { code: c.code, scannedAt: Number.isFinite(c.scannedAt) ? c.scannedAt : null };
}

/* Eigene Übungen: Geräte bis 4.6 ('Kurzhanteln', 'Maschinen') werden zur Geräte-Anforderung aus ids (4.7).
   Alles andere bleibt, wie es ist; Einträge ohne Objekt-Form bleiben stehen. */
const cleanCustom = list => (Array.isArray(list) ? list.map(e =>
  (e && typeof e === 'object' && Array.isArray(e.equipment) ? { ...e, equipment: migrateExerciseEquipment(e.equipment) } : e)) : []);

/* Ältere Stände kennen den Schalter nicht: dann an, wie für neue */
const cleanWakeLock = st => !(st && st.wakeLock === false);

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
    profile: {
      ...d.profile, ...p, birthDate: cleanBirthDate(p.birthDate),
      /* 4.7: die neun Kategorien bis 4.6 werden zu Geräte-ids; leer bleibt leer */
      equipment: migrateProfileEquipment(p.equipment),
      limitations: { ...d.profile.limitations, ...(p.limitations || {}) },
    },
    settings: {
      ...d.settings, ...(s.settings || {}), plates: plateSettings(s.settings && s.settings.plates), wakeLock: cleanWakeLock(s.settings),
      dumbbellInc: cleanDumbbellInc(s.settings && s.settings.dumbbellInc),
      /* 4.7: Geräte aus den Kategorien bis 4.6 umgezogen, „Heute“ bittet einmal ums Prüfen (views/gear.js) */
      ...(hasLegacyEquipment(p.equipment) ? { gearCheck: true } : {}),
    },
    body: { ...d.body, ...(s.body || {}) },
    nutrition: { ...d.nutrition, ...(s.nutrition || {}) },
    exercisesCustom: cleanCustom(s.exercisesCustom),
    activity: { ...d.activity, ...(s.activity || {}) },
    checkins: { ...(s.checkins || {}) },
    exerciseNotes: { ...(s.exerciseNotes || {}) },
    motivation: { ...d.motivation, ...(s.motivation || {}), weekly: { ...d.motivation.weekly, ...((s.motivation && s.motivation.weekly) || {}) } },
    water: { ...(s.water || {}) },
    suggestions: { ...(s.suggestions || {}) },
    compare: normalizeCompare(s.compare),
    activePlanId: s.plans.some(x => x.id === s.activePlanId) ? s.activePlanId : s.plans[0].id,
    plans: cleanPlans(s.plans),
    sessions: cleanSessions(s.sessions),
    active: cleanActive('active' in s ? s.active : d.active),
    shifts: normalizeShifts(s.shifts),
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
