/* Dauerhafte Notiz pro Übung, z. B. „Sitz Stufe 4, Griff eng“.
   Schlüssel wie bei den Rekorden: 'exId|Name'. Bei Varianten (Latzug oder Klimmzüge) gehört die Notiz
   zum Namen der Variante. Dieselbe Übung kann in mehreren Plänen oder in der Bibliothek unter einer
   anderen id stehen; darum zählt beim Suchen auch der Name (samt Aliassen der Bibliothek). */

export const NOTE_MAX = 200;

const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

export const noteKey = (exId, name) => `${exId}|${name}`;
const nameOf = key => key.slice(key.indexOf('|') + 1);

export const cleanNote = text => String(text || '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);

/* Notiz zu einer Übung: zuerst der genaue Schlüssel, sonst ein Eintrag mit gleichem Namen.
   names: alle Namen, die als dieselbe Übung gelten. Liefert { key, text } oder null. */
export function findNote(notes, key, names = []) {
  const all = notes || {};
  if (key && all[key]) return { key, text: all[key] };
  const want = new Set(names.map(norm).filter(Boolean));
  if (key) want.add(norm(nameOf(key)));
  const hit = Object.keys(all).find(k => all[k] && want.has(norm(nameOf(k))));
  return hit ? { key: hit, text: all[hit] } : null;
}

/* Setzt oder löscht die Notiz. Einträge mit gleichem Namen werden mitgeführt, damit Training und
   Bibliothek dieselbe Notiz zeigen. Ohne genauen Schlüssel (Bibliothek) und ohne Treffer entsteht fallbackKey.
   Verändert notes und liefert es zurück. */
export function setNote(notes, key, names, text, fallbackKey) {
  const all = notes || {};
  const value = cleanNote(text);
  const want = new Set((names || []).map(norm).filter(Boolean));
  if (key) want.add(norm(nameOf(key)));
  const same = Object.keys(all).filter(k => want.has(norm(nameOf(k))));
  const targets = new Set(same);
  if (key) targets.add(key);
  if (!targets.size && fallbackKey) targets.add(fallbackKey);
  targets.forEach(k => { if (value) all[k] = value; else delete all[k]; });
  return all;
}
