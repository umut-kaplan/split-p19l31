/* Zugriff auf die Übungsbibliothek: eingebaute Übungen plus eigene aus S.exercisesCustom. Reine Funktionen. */
import { EXERCISES } from '../data/exercises.js';
import { requirementIds, equipmentName, doable } from './equipment.js';
import { tonnage } from './settypes.js';

const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/* Kleinbuchstaben, Umlaute ausgeschrieben, sonst nur Buchstaben, Ziffern und Bindestriche */
export function slug(s) {
  return norm(s)
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function allExercises(custom = []) {
  return [...EXERCISES, ...custom];
}

/* Findet eine Übung über id, Namen oder Alias. Plan-Einträge tragen nur Namen, darum der Abgleich.
   Reihenfolge (4.7): id, dann genau gleicher Name, dabei die eigene Übung vor der Bibliothek, zuletzt ein Alias.
   So bleibt eine eigene Übung „Crunches“ oder „Shrugs“ aus älteren Ständen die eigene, auch wenn die Bibliothek
   inzwischen eine Übung mit diesem Namen oder Alias kennt. */
export function findExercise(key, custom = []) {
  const k = norm(key);
  const own = Array.isArray(custom) ? custom.filter(Boolean) : [];
  const hasAlias = e => (e.aliases || []).some(a => norm(a) === k);
  return EXERCISES.find(e => e.id === key) || own.find(e => e.id === key)
    || own.find(e => norm(e.name) === k) || EXERCISES.find(e => norm(e.name) === k)
    || EXERCISES.find(hasAlias) || own.find(hasAlias) || null;
}

/* Eigene Übungen, die heißen wie eine Übung der Bibliothek (Name oder Alias). Neue Namen lässt der Editor nicht zu,
   aber seit 4.7 kennt die Bibliothek viele neue Übungen, und eigene aus älteren Ständen können so heißen.
   Liefert [{ custom, lib }]. Geändert wird nichts; die Bibliothek zeigt einmal einen Hinweis (views/library.js). */
export function nameClashes(custom = []) {
  return (Array.isArray(custom) ? custom : []).map(c => {
    const k = c && norm(c.name);
    const lib = k ? EXERCISES.find(e => norm(e.name) === k || (e.aliases || []).some(a => norm(a) === k)) : null;
    return lib ? { custom: c, lib } : null;
  }).filter(Boolean);
}

/* ---------- Übungen mit Gegengewicht (4.7) ----------
   Klimmzüge und Dips an der Maschine mit Unterstützung: Die eingetragenen kg sind Unterstützung, weniger ist schwerer.
   Darum keine kg-Steigerung (progression.js), kein Deload (coach/training.js), kein kg-Rekord und kein bewegtes
   Gewicht (prs.js, exerciseTonnage). Gespeicherte Trainings tragen nur exId und Namen, darum der Abgleich. */
const ASSISTED = EXERCISES.filter(e => e.assisted);
const ASSISTED_IDS = new Set(ASSISTED.map(e => e.id));
const ASSISTED_NAMES = new Set(ASSISTED.flatMap(e => [e.name, ...e.aliases]).map(norm));

/* x: Eintrag der Bibliothek, eigene Übung, Plan-Eintrag ({ id, names }) oder Übung einer Einheit ({ exId, name }).
   custom: eigene Übungen; heißt eine eigene genau so, ist sie gemeint und hat kein Gegengewicht. */
export function isAssisted(x, custom = []) {
  if (!x) return false;
  if (typeof x.assisted === 'boolean') return x.assisted;
  if (x.custom) return false;
  if (ASSISTED_IDS.has(x.exId || x.id)) return true;
  const name = norm(x.name || (x.names && x.names[0]));
  return ASSISTED_NAMES.has(name) && !(custom || []).some(c => c && norm(c.name) === name);
}

/* Bewegtes Gewicht einer Übung in einer Einheit: Gewicht mal Wiederholungen der Arbeitssätze.
   Übungen auf Zeit und mit Gegengewicht bewegen in diesem Sinn kein Gewicht. */
export const exerciseTonnage = x => (!x || x.unit === 'sec' || isAssisted(x) ? 0 : tonnage(x.sets));

/* Trifft der Suchbegriff Name, Alias oder Gerät (Anzeigename)? Mehrere Wörter müssen alle vorkommen. */
export function matchesQuery(e, q) {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = norm([e.name, ...(e.aliases || []), ...requirementIds(e.equipment).map(equipmentName)].join(' '));
  return words.every(w => hay.includes(w));
}

/* Filter für die Bibliothek. muscle: Schlüssel aus domain/muscles.js, zählt primär und sekundär.
   equipment: eine Geräte-id, die in der Anforderung vorkommt (auch als „eines davon“).
   have: Geräte-Auswahl wie S.profile.equipment; dann nur Übungen, die damit gehen (canDo, leer = alle). */
export function searchExercises(list, { q = '', muscle = null, equipment = null, have = null } = {}) {
  const ok = doable(have);
  return list
    .filter(e => matchesQuery(e, q))
    .filter(e => !muscle || [...(e.muscles?.primary || []), ...(e.muscles?.secondary || [])].includes(muscle))
    .filter(e => !equipment || requirementIds(e.equipment).includes(equipment))
    .filter(ok)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/* Geräte-ids, die in der Liste vorkommen, nach Anzeigename sortiert */
export function equipmentOf(list) {
  return [...new Set(list.flatMap(e => requirementIds(e.equipment)))]
    .sort((a, b) => equipmentName(a).localeCompare(equipmentName(b), 'de'));
}

/* Welche eingetragenen Einschränkungen belastet die Übung? */
export function limitationHits(e, tags = []) {
  if (!e) return [];
  return (e.stresses || []).filter(t => tags.includes(t));
}

/* Alternativen, die keine der eingetragenen Einschränkungen belasten.
   equipment: Geräte-Auswahl; dann nur Alternativen, die damit gehen (leer oder null = alle). */
export function safeAlternatives(e, custom = [], tags = [], equipment = null) {
  if (!e) return [];
  const ok = doable(equipment);
  return (e.alternatives || [])
    .map(id => findExercise(id, custom))
    .filter(a => a && limitationHits(a, tags).length === 0 && ok(a));
}

/* Übungs-id für einen Plan-Eintrag. Gleiche Übung, gleiche id, damit Verlauf und Progression planübergreifend passen.
   Reihenfolge: gleicher Name in einem vorhandenen Plan, dann Bibliothek, dann ein Slug des Namens. */
export function exerciseIdFor(name, plans = [], custom = []) {
  const k = norm(name);
  for (const p of plans) {
    for (const d of Object.values(p.days || {})) {
      const hit = (d.exercises || []).find(e => (e.names || []).some(n => norm(n) === k));
      if (hit) return hit.id;
    }
  }
  const lib = findExercise(name, custom);
  if (lib) return lib.id;
  return slug(name) || 'uebung';
}

/* Kurzhantel-Steigerung (4.7): Einstellung S.settings.dumbbellInc, 1, 2 oder 2,5 kg, Standard 2 */
export const DUMBBELL_INCS = [1, 2, 2.5];
export const DEFAULT_DUMBBELL_INC = 2;
export const cleanDumbbellInc = v => (DUMBBELL_INCS.includes(v) ? v : DEFAULT_DUMBBELL_INC);

/* Braucht die Übung Kurzhanteln (auch als „eines davon“)? Dann steigt sie in Kurzhantel-Schritten. */
export const usesDumbbells = e => !!e && requirementIds(e.equipment).includes('kurzhanteln');

/* Startwerte für eine neue Plan-Übung je nach Art. settings: S.settings (für die Kurzhantel-Steigerung).
   Kurzhanteln steigen in Kurzhantel-Schritten, Grund- wie Isolationsübungen; sonst 2,5 kg.
   Smart-Zirkel: zwei Runden, keine eigene Steigerung. */
export function defaultsFor(e, settings = null) {
  const step = usesDumbbells(e) ? cleanDumbbellInc(settings && settings.dumbbellInc) : 2.5;
  if (e && e.autoLoad) return { sets: 2, repMin: 10, repMax: 15, rest: 60, inc: 0, unit: 'reps' };
  if (e && e.unit === 'sec') return { sets: 3, repMin: 30, repMax: 60, rest: 60, inc: 0, unit: 'sec' };
  if (e && e.type === 'compound') return { sets: 3, repMin: 6, repMax: 10, rest: 150, inc: step, unit: 'reps' };
  return { sets: 3, repMin: 10, repMax: 15, rest: 75, inc: step, unit: 'reps' };
}
