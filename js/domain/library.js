/* Zugriff auf die Übungsbibliothek: eingebaute Übungen plus eigene aus S.exercisesCustom. Reine Funktionen. */
import { EXERCISES } from '../data/exercises.js';

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

/* Findet eine Übung über id, Namen oder Alias. Plan-Einträge tragen nur Namen, darum der Abgleich. */
export function findExercise(key, custom = []) {
  const k = norm(key);
  return allExercises(custom).find(e => e.id === key || norm(e.name) === k || (e.aliases || []).some(a => norm(a) === k)) || null;
}

/* Trifft der Suchbegriff Name, Alias oder Gerät? Mehrere Wörter müssen alle vorkommen. */
export function matchesQuery(e, q) {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = norm([e.name, ...(e.aliases || []), ...(e.equipment || [])].join(' '));
  return words.every(w => hay.includes(w));
}

/* Filter für die Bibliothek. muscle: Schlüssel aus domain/muscles.js, zählt primär und sekundär. */
export function searchExercises(list, { q = '', muscle = null, equipment = null } = {}) {
  return list
    .filter(e => matchesQuery(e, q))
    .filter(e => !muscle || [...(e.muscles?.primary || []), ...(e.muscles?.secondary || [])].includes(muscle))
    .filter(e => !equipment || (e.equipment || []).includes(equipment))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/* Alle Geräte, die in der Liste vorkommen, alphabetisch */
export function equipmentOf(list) {
  return [...new Set(list.flatMap(e => e.equipment || []))].sort((a, b) => a.localeCompare(b, 'de'));
}

/* Welche eingetragenen Einschränkungen belastet die Übung? */
export function limitationHits(e, tags = []) {
  if (!e) return [];
  return (e.stresses || []).filter(t => tags.includes(t));
}

/* Alternativen, die keine der eingetragenen Einschränkungen belasten */
export function safeAlternatives(e, custom = [], tags = []) {
  if (!e) return [];
  return (e.alternatives || [])
    .map(id => findExercise(id, custom))
    .filter(a => a && limitationHits(a, tags).length === 0);
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

/* Startwerte für eine neue Plan-Übung je nach Art */
export function defaultsFor(e) {
  if (e && e.unit === 'sec') return { sets: 3, repMin: 30, repMax: 60, rest: 60, inc: 0, unit: 'sec' };
  if (e && e.type === 'compound') return { sets: 3, repMin: 6, repMax: 10, rest: 150, inc: 2.5, unit: 'reps' };
  return { sets: 3, repMin: 10, repMax: 15, rest: 75, inc: e && (e.equipment || []).includes('Kurzhanteln') ? 1 : 2.5, unit: 'reps' };
}
