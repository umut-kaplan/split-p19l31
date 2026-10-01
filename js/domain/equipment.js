/* Geräte: Auswahl im Profil, Anforderung einer Übung, Regeln, Schnellauswahl und Umzug der Kategorien bis 4.6.
   Reine Funktionen, Daten in data/equipment.js.

   Auswahl im Profil (S.profile.equipment): Liste von Geräte-ids, leer = alles erlaubt (wie bis 4.6).
   Anforderung einer Übung (exercise.equipment): Liste von Termen, alle müssen erfüllt sein.
     Term = 'id' (dieses Gerät) oder ['id1', 'id2'] (eines davon genügt).
     [] = Körpergewicht. Beispiel Kniebeugen: ['langhantel', ['kniebeugenstaender', 'multipresse']].
   Mehr als zwei Ebenen gibt es nicht; Fälle wie „Bankdrückstation oder Flachbank + Rack“ lösen die Regeln (IMPLIES). */
import {
  EQUIPMENT, EQUIPMENT_GROUPS, SMART_CIRCUIT, PRESETS, IMPLIES, NEEDS, LEGACY_PROFILE, LEGACY_EXERCISE, LEGACY_MACHINES,
} from '../data/equipment.js';

export { EQUIPMENT, EQUIPMENT_GROUPS, SMART_CIRCUIT, PRESETS };

/* Alle gültigen ids in fester Reihenfolge: Katalog, dann der Smart-Zirkel */
export const EQUIPMENT_IDS = [...EQUIPMENT.map(e => e.id), SMART_CIRCUIT.id];
const ORDER = new Map(EQUIPMENT_IDS.map((id, i) => [id, i]));
const BY_ID = new Map([...EQUIPMENT.map(e => [e.id, e]), [SMART_CIRCUIT.id, SMART_CIRCUIT]]);

export const isEquipmentId = id => typeof id === 'string' && ORDER.has(id);
export const equipmentById = id => BY_ID.get(id) || null;
/* Anzeigename; unbekannte Werte kommen unverändert zurück */
export const equipmentName = id => (BY_ID.has(id) ? BY_ID.get(id).name : String(id));
const byOrder = (a, b) => ORDER.get(a) - ORDER.get(b);
const uniq = list => [...new Set(list)];

/* Geräte einer Gruppe in Katalog-Reihenfolge */
export const groupEquipment = groupId => EQUIPMENT.filter(e => e.group === groupId);

/* ---------- Anforderung einer Übung ---------- */

/* Eine Kategorie bis 4.6 oder eine id zu ids; Unbekanntes fällt weg */
const termIds = v => {
  if (isEquipmentId(v)) return [v];
  const m = LEGACY_EXERCISE[v];
  return m ? [].concat(m) : [];
};

/* Bereinigte Terme: gültige ids, Gruppen mit einer id werden zur id, doppelte fallen weg.
   Kategorien bis 4.6 ('Kurzhanteln') werden unterwegs übersetzt, damit auch ungeprüfte Daten funktionieren. */
export function requirementTerms(req) {
  if (!Array.isArray(req)) return [];
  const out = [];
  const seen = new Set();
  req.forEach(t => {
    const ids = uniq(Array.isArray(t) ? t.flatMap(termIds) : termIds(t)).sort(byOrder);
    if (!ids.length) return;
    /* Eine Kategorie bis 4.6 wie „Maschinen“ heißt „eines davon“, eine einzelne id „genau dieses“ */
    const term = ids.length === 1 ? ids[0] : ids;
    const key = JSON.stringify(term);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(term);
  });
  return out;
}

/* Alle ids, die in der Anforderung vorkommen, auch die aus „eines davon“ */
export const requirementIds = req => uniq(requirementTerms(req).flat()).sort(byOrder);

/* Die Kategorie „Maschinen“ bis 4.6 an einer eigenen Übung: lange Liste, von der eines genügt. Angezeigt wird sie
   kurz als „eine der Maschinen“ statt mit 30 „oder“. Erkannt wird auch die kürzere Liste aus Vorabständen von 4.7. */
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const MACHINES_PRE = EQUIPMENT.filter(e => e.group === 'steck' && e.id !== 'beinpresse').map(e => e.id).concat(['hackenschmidt', 'multipresse']);
export const isMachinesTerm = t => Array.isArray(t) && (sameSet(t, LEGACY_MACHINES) || sameSet(t, MACHINES_PRE));
export const MACHINES_TEXT = 'eine der Maschinen';

/* Text für die Anzeige: „Langhantel mit Scheiben + Power Rack / Kniebeugenständer oder Multipresse (Smith-Maschine)“.
   Leere Anforderung: ''. */
export function requirementText(req) {
  return requirementTerms(req)
    .map(t => (isMachinesTerm(t) ? MACHINES_TEXT : Array.isArray(t) ? t.map(equipmentName).join(' oder ') : equipmentName(t)))
    .join(' + ');
}

/* Gespeicherte Anforderung einer eigenen Übung ins neue Format (idempotent) */
export const migrateExerciseEquipment = req => requirementTerms(req);

/* ---------- Auswahl im Profil ---------- */

/* Auswahl bis 4.6 ('Langhantel', …) und neue ids zu einer sortierten Liste neuer ids (idempotent).
   Leer bleibt leer: Wer nichts angetippt hatte, bekommt weiter alle Übungen. Wer alle neun Kategorien hatte, bekommt
   die Schnellauswahl „Großes Studio“ (alle 59 Geräte); ein angehakter Smart-Zirkel bleibt. */
const LEGACY_KEYS = Object.keys(LEGACY_PROFILE);
export function migrateProfileEquipment(list) {
  if (!Array.isArray(list)) return [];
  const all = LEGACY_KEYS.every(k => list.includes(k));
  const ids = list.flatMap(v => (isEquipmentId(v) ? [v] : all ? [] : LEGACY_PROFILE[v] || []));
  return uniq(all ? [...presetEquipment('gross'), ...ids] : ids).sort(byOrder);
}

/* Steht in der Auswahl noch eine Kategorie bis 4.6? Dann zieht der nächste Start sie um (store/migrate.js) und
   „Heute“ bittet einmal, die Geräte zu prüfen. */
export const hasLegacyEquipment = list => Array.isArray(list) && list.some(v => !isEquipmentId(v) && LEGACY_PROFILE[v]);

/* Was man mit der Auswahl tatsächlich hat: plus alles, was die Regeln einschließen (doppelter Kabelzug →
   einzelner, Rack + Flachbank → Bankdrückstation), minus Geräte, denen ein nötiges fehlt (Landmine ohne Langhantel). */
export function expandEquipment(list) {
  const have = new Set((list ? [...list] : []).filter(isEquipmentId));
  let grew = true;
  while (grew) {
    grew = false;
    IMPLIES.forEach(r => {
      if (!have.has(r.then) && r.if.every(id => have.has(id))) { have.add(r.then); grew = true; }
    });
  }
  NEEDS.forEach(r => { if (have.has(r.id) && !r.needs.every(id => have.has(id))) have.delete(r.id); });
  return have;
}

/* Prüft eine Übung gegen eine Auswahl. Für viele Übungen einmal bauen: list.filter(doable(S.profile.equipment)).
   Leere Auswahl: alles erlaubt. Übungen ohne Anforderung (Körpergewicht) gehen immer. */
export function doable(equipment) {
  const list = equipment ? [...equipment] : [];
  if (!list.length) return () => true;
  const have = expandEquipment(list);
  return e => !!e && requirementTerms(e.equipment).every(t =>
    (Array.isArray(t) ? t.some(id => have.has(id)) : have.has(t)));
}

export const canDo = (exercise, equipment) => !!exercise && doable(equipment)(exercise);

/* ---------- Schnellauswahl und Smart-Zirkel ---------- */

export const presetEquipment = presetId => {
  const p = PRESETS.find(x => x.id === presetId);
  return p ? EQUIPMENT.filter(e => e.avail[p.col] >= p.min).map(e => e.id) : [];
};

export const hasSmartCircuit = list => Array.isArray(list) && list.includes(SMART_CIRCUIT.id);

/* Schnellauswahl ersetzt die Auswahl, der Smart-Zirkel bleibt, wie er war */
export function applyPreset(current, presetId) {
  const ids = presetEquipment(presetId);
  if (!ids.length) return migrateProfileEquipment(current);
  return hasSmartCircuit(current) ? [...ids, SMART_CIRCUIT.id] : ids;
}

/* Welche Schnellauswahl genau der Auswahl entspricht (Smart-Zirkel nicht mitgezählt), sonst null */
export function matchingPreset(current) {
  const have = migrateProfileEquipment(current).filter(id => id !== SMART_CIRCUIT.id);
  const hit = PRESETS.find(p => {
    const ids = presetEquipment(p.id);
    return ids.length === have.length && ids.every(id => have.includes(id));
  });
  return hit ? hit.id : null;
}

/* Ein Gerät an- oder abhaken. Liefert eine neue, sortierte Liste; unbekannte ids ändern nichts. */
export function toggleEquipment(current, id) {
  const list = migrateProfileEquipment(current);
  if (!isEquipmentId(id)) return list;
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id].sort(byOrder);
}

export const toggleSmartCircuit = current => toggleEquipment(current, SMART_CIRCUIT.id);

/* ---------- Oberfläche (4.7, Arbeitspaket B): Geräteseite, Bibliothek, Picker, eigene Übungen ---------- */

/* „Alles abwählen“: alle Geräte weg, der Smart-Zirkel bleibt, wie er war (wie bei der Schnellauswahl) */
export const clearEquipment = current => (hasSmartCircuit(current) ? [SMART_CIRCUIT.id] : []);

/* Zähler je Gruppe: wie viele ihrer Geräte angehakt sind, { on, total } */
export function groupCount(current, groupId) {
  const list = migrateProfileEquipment(current);
  const ids = groupEquipment(groupId).map(e => e.id);
  return { on: ids.filter(id => list.includes(id)).length, total: ids.length };
}

/* Nicht angehakt, aber über die Regeln abgedeckt (Rack + Flachbank → Bankdrückstation):
   die ids, die es einschließen, sonst null */
export function coveredBy(current, id) {
  const list = migrateProfileEquipment(current);
  if (list.includes(id)) return null;
  const have = expandEquipment(list);
  if (!have.has(id)) return null;
  const rule = IMPLIES.find(r => r.then === id && r.if.every(x => have.has(x)));
  return rule ? [...rule.if] : null;
}

/* Kurzer Name ohne Klammerzusatz: „Multipresse (Smith-Maschine)“ → „Multipresse“ */
export const shortEquipmentName = id => equipmentName(id).replace(/\s*\([^)]*\)\s*$/, '');

/* Was einer Übung mit dieser Auswahl fehlt: die nicht erfüllten Terme. Leere Auswahl: nichts. */
export function missingTerms(exercise, equipment) {
  const list = equipment ? [...equipment] : [];
  if (!exercise || !list.length) return [];
  const have = expandEquipment(list);
  return requirementTerms(exercise.equipment).filter(t =>
    !(Array.isArray(t) ? t.some(id => have.has(id)) : have.has(t)));
}

/* „Multipresse“, „Langhantel mit Scheiben, Power Rack / Kniebeugenständer oder Multipresse“; '' wenn nichts fehlt */
export const missingText = (exercise, equipment) => missingTerms(exercise, equipment)
  .map(t => (isMachinesTerm(t) ? MACHINES_TEXT : Array.isArray(t) ? t.map(shortEquipmentName).join(' oder ') : shortEquipmentName(t)))
  .join(', ');

/* Liste aufteilen: was mit der Auswahl geht (Reihenfolge bleibt), danach der Rest mit dem, was fehlt.
   Leere Auswahl: alles passt. Liefert { fit: [e], rest: [{ e, missing }] }. */
export function splitByEquipment(list, equipment) {
  const ok = doable(equipment);
  const fit = [];
  const rest = [];
  (list || []).forEach(e => {
    if (ok(e)) fit.push(e);
    else rest.push({ e, missing: missingText(e, equipment) });
  });
  return { fit, rest };
}

/* Editor eigener Übungen: Anforderung als Mehrfachauswahl mit Schalter „alle nötig“ / „eines genügt“.
   splitRequirement liefert { ids, mode: 'all' | 'any', simple }. simple false: Die Anforderung mischt beides
   (z. B. aus den Kategorien bis 4.6) und lässt sich so nicht ohne Verlust darstellen. */
export function splitRequirement(req) {
  const terms = requirementTerms(req);
  if (terms.length === 1 && Array.isArray(terms[0])) return { ids: [...terms[0]], mode: 'any', simple: true };
  if (terms.every(t => !Array.isArray(t))) return { ids: [...terms], mode: 'all', simple: true };
  return { ids: requirementIds(req), mode: 'all', simple: false };
}

/* Gegenstück: ids und Schalter zur gespeicherten Anforderung. „Eines genügt“ mit nur einem Gerät ist dasselbe wie „alle“. */
export function buildRequirement(ids, mode = 'all') {
  const clean = uniq((ids || []).filter(isEquipmentId)).sort(byOrder);
  return requirementTerms(mode === 'any' && clean.length > 1 ? [clean] : clean);
}
