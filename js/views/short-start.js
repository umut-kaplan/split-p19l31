/* Kurzversion beim Start einer Einheit (4.7, Q30a): „Kurz, ca. 30 min“ neben „… starten“ auf Heute und unter Training.
   Die Kurzversion sind die ersten vier Übungen mit je höchstens zwei Sätzen (domain/plan-stats.js); der Plan bleibt
   unverändert. Hat ein Tag weniger Übungen oder Übungen mit einem Satz, nennen Knopf und Hinweis die echten Zahlen. */
import { esc } from '../util.js';
import { dayOf } from '../state.js';
import { toast } from '../ui/toast.js';
import { unlockAudio } from '../timer.js';
import { dayMinutes, shortExercises, hasShortVersion, shortText } from '../domain/plan-stats.js';
import { startWorkout } from './workout.js';

/* Knopf für einen Plan-Tag, leer, wenn die Kurzversion nicht kürzer wäre */
export function shortStartButton(dayId, day, cls = '') {
  const ex = (day && day.exercises) || [];
  if (!hasShortVersion(ex)) return '';
  const min = dayMinutes(shortExercises(ex));
  return `<button class="link short-start ${cls}" data-act="startshort" data-day="${esc(dayId)}"
    aria-label="${esc(`${day.name} kurz starten: ${shortText(ex)}, etwa ${min} Minuten`)}">Kurz, ca. ${min} min</button>`;
}

export const actions = {
  startshort: el => {
    unlockAudio();
    const day = dayOf(el.dataset.day);
    startWorkout(el.dataset.day, { short: true });
    toast(`Kurzversion: ${shortText((day && day.exercises) || [])}`);
  },
};
