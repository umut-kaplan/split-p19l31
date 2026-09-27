import { defaultState, fromV1, normalize } from './store/migrate.js';

export const KEY = 'fit.v2';
export const LEGACY_KEY = 'split.v1';

/* Gespeicherter Zustand. Wird nur verändert, nie ersetzt, damit alle Module dieselbe Referenz halten. */
export const S = {};

/* Ansicht, wird nicht gespeichert */
export const V = {
  tab: 'today', trainSub: 'start', pick: null, planDay: null, histKey: null,
  sheet: null, summary: null, roll: true, ob: 0, persisted: null,
};

function storageOK() {
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; }
  catch (e) { return false; }
}
export const CAN_STORE = storageOK();

export function load() {
  let st = null;
  let migrated = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) st = normalize(JSON.parse(raw));
  } catch (e) { st = null; }
  if (!st) {
    try {
      const old = localStorage.getItem(LEGACY_KEY);
      /* Der alte Schlüssel bleibt stehen, bis ein Backup im neuen Format gemacht wurde */
      if (old) { st = fromV1(JSON.parse(old)); migrated = true; }
    } catch (e) { st = null; }
  }
  Object.assign(S, st || defaultState());
  if (migrated) save();
  return migrated;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* Banner zeigt es an */ }
}

export function replaceState(next) {
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, next);
  save();
}

/* Bittet den Browser, die Daten nicht bei Platzmangel zu löschen */
export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      V.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    }
  } catch (e) { V.persisted = null; }
}

export const activePlan = () => S.plans.find(p => p.id === S.activePlanId) || S.plans[0];
export const dayOf = id => activePlan().days[id];
