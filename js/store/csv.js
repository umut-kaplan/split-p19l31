/* Trainings als CSV im Format der App Strong: klassische, englische, kommagetrennte Form.
   Hevy importiert genau dieses Format. Reine Funktionen, per node --test geprüft. */
import { exName, toNum, ymd } from '../util.js';
import { findExercise } from '../domain/library.js';
import { findNote, noteKey } from '../domain/notes.js';
import { validRpe } from '../domain/rating.js';

export const STRONG_HEADER = ['Date', 'Workout Name', 'Duration', 'Exercise Name', 'Set Order', 'Weight', 'Reps', 'Distance', 'Seconds', 'Notes', 'Workout Notes', 'RPE'];

export const csvFileName = (now = Date.now()) => `split-trainings-${ymd(now)}.csv`;

/* Felder mit Komma, Anführungszeichen oder Zeilenumbruch kommen in Anführungszeichen, innere werden verdoppelt */
export function csvField(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const pad = n => String(n).padStart(2, '0');

/* Ortszeit wie 2026-09-30 18:05:09 */
export function strongDate(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* Dauer wie 1h 5m oder 45m, gerundet auf Minuten wie in der Zusammenfassung */
export function strongDuration(ms) {
  const min = ms > 0 ? Math.max(1, Math.round(ms / 60000)) : 0;
  const h = Math.floor(min / 60);
  return h ? `${h}h ${min % 60}m` : `${min}m`;
}

/* Gespeichert sind Zahlen. Nur Text geht durch toNum, das „1.250“ als Tausender liest. */
const value = v => (typeof v === 'number' ? v : toNum(v));

/* Zahl ohne Einheit, Punkt als Dezimaltrenner, höchstens zwei Nachkommastellen */
export function num(v) {
  const n = value(v);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100 || 0) : '0';
}

/* Gespeicherte Trainings enthalten nur abgehakte Sätze. Zur Sicherheit fallen ausdrücklich offene
   und leere Sätze (keine Wiederholungen oder Sekunden) trotzdem heraus. */
const counts = set => !!set && set.done !== false && value(set.r) > 0;

/* Spalte „Set Order“: fortlaufend ab 1 über die ausgegebenen Sätze einer Übung.
   Satztypen (optionales Feld t am Satz) gehören hierher, sobald es sie gibt. */
export const setOrder = (set, n) => String(n);

/* Satztypen: die Satznummer bleibt eine Zahl, weil nicht belegt ist, dass Hevy Buchstaben dort liest.
   Der Typ steht deshalb vorn in der Notiz der Zeile. */
const TYPE_NOTE = { w: 'Aufwärmsatz', d: 'Dropsatz', f: 'Bis Versagen' };
export const setNote = (set, note) => [TYPE_NOTE[set && set.t], note].filter(Boolean).join(' · ');

/* Name wie im Verlauf: die gewählte Variante. Nur Einträge ohne Namen fallen auf alle Namen zurück. */
const exerciseLabel = x => x.name || (Array.isArray(x.names) && x.names.length ? exName(x) : '');

/* Dauerhafte Notiz zur Übung, auch wenn sie unter einem Alias der Bibliothek gespeichert ist */
function exerciseNote(notes, x, custom) {
  if (!x.name) return '';
  const e = findExercise(x.name, custom);
  const names = [x.name, ...(e ? [e.name, ...(e.aliases || [])] : [])];
  const n = findNote(notes, x.exId != null ? noteKey(x.exId, x.name) : null, names);
  return n ? n.text : '';
}

/* Eine Zeile pro Satz, Trainings nach Beginn sortiert. Zeitübungen (unit 'sec') stehen in „Seconds“,
   unbenutzte Zahlenspalten sind 0 wie bei Strong, RPE ist die Bewertung der ganzen Einheit. */
export function trainingsCsv(S) {
  const notes = S.exerciseNotes || {};
  const custom = S.exercisesCustom || [];
  const sessions = (S.sessions || [])
    .filter(s => s && Array.isArray(s.ex))
    .sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
  const rows = [STRONG_HEADER];
  sessions.forEach(s => {
    const date = strongDate(s.startedAt);
    const duration = strongDuration((s.endedAt || 0) - (s.startedAt || 0));
    const rating = s.rating || {};
    const rpe = validRpe(rating.rpe) ? String(rating.rpe) : '';
    const workoutNote = rating.note || '';
    s.ex.forEach(x => {
      const sets = (x.sets || []).filter(counts);
      if (!sets.length) return;
      const name = exerciseLabel(x);
      const note = exerciseNote(notes, x, custom);
      const sec = x.unit === 'sec';
      sets.forEach((set, k) => rows.push([
        date, s.name || '', duration, name, setOrder(set, k + 1),
        num(set.w), sec ? '0' : num(set.r), '0', sec ? num(set.r) : '0',
        setNote(set, note), workoutNote, rpe,
      ]));
    });
  });
  return rows.map(r => r.map(csvField).join(',')).join('\n') + '\n';
}
