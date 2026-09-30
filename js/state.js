import { defaultState, fromV1, normalize } from './store/migrate.js';

export const KEY = 'fit.v2';
export const LEGACY_KEY = 'split.v1';

/* Gespeicherter Zustand. Wird nur verändert, nie ersetzt, damit alle Module dieselbe Referenz halten. */
export const S = {};

/* Ansicht, wird nicht gespeichert */
export const V = {
  tab: 'today', trainSub: 'start', pick: null, planDay: null, histKey: null,
  sheet: null, summary: null, roll: true, ob: 0, persisted: null,
  /* storageFull: das letzte Speichern ist gescheitert (Speicher voll).
     recover: der gespeicherte Stand ließ sich nicht lesen, { raw, key }. Solange gesetzt, speichert die App nichts. */
  storageFull: false, recover: null,
};

function storageOK() {
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; }
  catch (e) { return false; }
}
export const CAN_STORE = storageOK();

/* Ein beschädigter Stand wird nie überschrieben: Kopie unter eigenem Schlüssel, Speichern gesperrt, bis der Nutzer entscheidet */
function keepBroken(raw) {
  const key = `${KEY}.broken.${Date.now()}`;
  let kept = null;
  try { localStorage.setItem(key, raw); kept = key; } catch (e) { /* Speicher voll: der Rohtext bleibt unter fit.v2 stehen */ }
  V.recover = { raw, key: kept };
}

export function load() {
  let st = null;
  let migrated = false;
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
  if (raw) {
    try { st = normalize(JSON.parse(raw)); } catch (e) { st = null; keepBroken(raw); }
  } else {
    try {
      const old = localStorage.getItem(LEGACY_KEY);
      /* Nur ohne neuen Stand. Der alte Schlüssel bleibt stehen, bis ein Backup im neuen Format über das Teilen-Menü gespeichert wurde. */
      if (old) { st = fromV1(JSON.parse(old)); migrated = true; }
    } catch (e) { st = null; }
  }
  Object.assign(S, st || defaultState());
  if (migrated) save();
  return migrated;
}

/* true, wenn der Stand wirklich im Speicher liegt. Scheitert es (Speicher voll), zeigt die App ein Banner. */
export function save() {
  if (V.recover) return false;
  try { localStorage.setItem(KEY, JSON.stringify(S)); V.storageFull = false; return true; }
  catch (e) { V.storageFull = true; return false; }
}

export function replaceState(next) {
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, next);
  return save();
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
