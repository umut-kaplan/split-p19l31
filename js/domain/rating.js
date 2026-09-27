/* Bewertung nach der Einheit: „Wie hart war es?“ von 1 bis 10 für die ganze Einheit.
   Gespeichert am Training als rating: { rpe, note, at }. */
import { cleanNote } from './notes.js';

export const RPE_HARD = 9;       // ab hier gilt eine Einheit für die Ampel als sehr hart
export const RPE_HOURS = 48;     // so lange wirkt eine sehr harte Einheit auf die Ampel

export const RPE_LABEL = {
  1: 'sehr locker', 2: 'sehr locker', 3: 'locker', 4: 'locker', 5: 'mittel',
  6: 'mittel', 7: 'hart', 8: 'hart', 9: 'sehr hart', 10: 'am Limit',
};

export const validRpe = v => Number.isInteger(v) && v >= 1 && v <= 10;

/* Zeitpunkt eines Trainings: Ende, sonst Beginn */
export const sessionTime = s => (s && (s.endedAt || s.startedAt)) || 0;

/* Bewertung aus Eingaben. Ohne gültige Zahl und ohne Notiz gibt es keine Bewertung. */
export function makeRating(rpe, note, at) {
  const r = validRpe(rpe) ? rpe : null;
  const n = cleanNote(note);
  if (r == null && !n) return null;
  return { rpe: r, note: n, at };
}

/* Die härteste bewertete Einheit der letzten `hours` Stunden vor `now` (bei Gleichstand die jüngste).
   latest: ob es das jüngste Training überhaupt in diesem Zeitraum ist.
   Liefert { session, rpe, latest } oder null. */
export function recentRating(sessions, now, hours = RPE_HOURS) {
  const from = now - hours * 36e5;
  const inWindow = (sessions || []).filter(s => { const t = sessionTime(s); return t > 0 && t <= now && t >= from; });
  const rated = inWindow.filter(s => s.rating && validRpe(s.rating.rpe));
  if (!rated.length) return null;
  const pick = rated.reduce((best, s) => {
    if (!best) return s;
    if (s.rating.rpe !== best.rating.rpe) return s.rating.rpe > best.rating.rpe ? s : best;
    return sessionTime(s) > sessionTime(best) ? s : best;
  }, null);
  const newest = inWindow.reduce((a, s) => (sessionTime(s) > sessionTime(a) ? s : a), inWindow[0]);
  return { session: pick, rpe: pick.rating.rpe, latest: newest === pick };
}
