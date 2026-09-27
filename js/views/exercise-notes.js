/* Dauerhafte Notiz pro Übung, z. B. „Sitz Stufe 4, Griff eng“. Gespeichert in S.exerciseNotes.
   Die Notiz steht auf der Übungskarte im Training und in den Details der Bibliothek, beide Stellen zeigen dieselbe. */
import { S, save } from '../state.js';
import { esc } from '../util.js';
import { findExercise } from '../domain/library.js';
import { noteKey, findNote, setNote, NOTE_MAX } from '../domain/notes.js';
import { openSheet, closeSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { showExercise } from './library.js';

const notes = () => S.exerciseNotes || (S.exerciseNotes = {});

/* Alle Namen, unter denen dieselbe Übung stehen kann: Name im Plan plus Name und Aliasse der Bibliothek */
function namesFor(name) {
  const e = findExercise(name, S.exercisesCustom);
  return [name, ...(e ? [e.name, ...(e.aliases || [])] : [])];
}

/* Zeile auf der Übungskarte im Training. x: Übung der laufenden Einheit, i: Index */
export function exerciseNote(x, i) {
  const n = findNote(notes(), noteKey(x.exId, x.name), namesFor(x.name));
  if (!n) return `<button class="link ex-note-add" data-act="noteedit" data-i="${i}">Notiz hinzufügen</button>`;
  return `<button class="ex-note" data-act="noteedit" data-i="${i}" aria-label="Notiz zu ${esc(x.name)}: ${esc(n.text)}. Tippen zum Ändern">
    <span class="ex-note-k">Notiz</span><span class="ex-note-t">${esc(n.text)}</span></button>`;
}

/* Abschnitt in den Details der Bibliothek. e: Eintrag der Bibliothek oder eigene Übung */
export function libNoteBlock(e) {
  const n = findNote(notes(), null, [e.name, ...(e.aliases || [])]);
  return `<div class="lib-note">
    <h3>Deine Notiz</h3>
    ${n ? `<p class="lib-note-t">${esc(n.text)}</p>` : '<p class="muted lib-note-t">Noch keine Notiz, zum Beispiel Sitzeinstellung oder Griffbreite.</p>'}
    <button class="link" data-act="notelib" data-id="${esc(e.id)}">${n ? 'Notiz ändern' : 'Notiz hinzufügen'}</button>
  </div>`;
}

/* Sheet mit Textfeld. save(text) speichert, back() führt zurück (Training oder Bibliothek). */
function openNoteSheet({ name, text, has, apply, back }) {
  const actions = [{
    label: 'Notiz speichern', kind: 'primary', fn: () => {
      const el = document.getElementById('note-text');
      const value = el ? el.value : '';
      apply(value);
      save();
      toast(value.trim() ? 'Notiz gespeichert' : 'Notiz gelöscht');
      back();
    },
  }];
  if (has) actions.push({ label: 'Notiz löschen', kind: 'danger', fn: () => { apply(''); save(); toast('Notiz gelöscht'); back(); } });
  actions.push({ label: 'Abbrechen', kind: 'ghost', fn: back });
  openSheet({
    title: `Notiz zu ${name}`,
    body: `<label class="field note-field">Notiz
      <textarea id="note-text" maxlength="${NOTE_MAX}" rows="3" placeholder="z. B. Sitz Stufe 4, Griff eng">${esc(text)}</textarea></label>
      <p class="small-print">Bleibt bei dieser Übung stehen, bis du sie änderst. Höchstens ${NOTE_MAX} Zeichen.</p>`,
    actions,
  });
  const ta = document.getElementById('note-text');
  if (ta) ta.focus();
}

export const actions = {
  noteedit: el => {
    const x = S.active && S.active.ex[+el.dataset.i];
    if (!x) return;
    const key = noteKey(x.exId, x.name);
    const names = namesFor(x.name);
    const cur = findNote(notes(), key, names);
    openNoteSheet({
      name: x.name, text: cur ? cur.text : '', has: !!cur,
      apply: t => setNote(notes(), key, names, t),
      back: closeSheet,
    });
  },
  notelib: el => {
    const e = findExercise(el.dataset.id, S.exercisesCustom);
    if (!e) return;
    const names = [e.name, ...(e.aliases || [])];
    const cur = findNote(notes(), null, names);
    openNoteSheet({
      name: e.name, text: cur ? cur.text : '', has: !!cur,
      apply: t => setNote(notes(), null, names, t, noteKey(`lib:${e.id}`, e.name)),
      back: () => showExercise(e.id),
    });
  },
};

export const inputs = {};
