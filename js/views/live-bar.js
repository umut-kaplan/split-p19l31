/* Mini-Leiste über der Tab-Leiste (4.6). Läuft ein Training, zeigt jede andere Seite Name, Zeit und Pause der Einheit,
   wie der Mini-Player der Musik-App. Ein Tipp führt zurück in die Einheit (Aktion woback in workout-nav.js).
   Den Pausentimer gibt es nur auf der Seite der Einheit; anderswo steht die Pause in dieser Leiste. */
import { S } from '../state.js';
import { esc, mmss } from '../util.js';
import { plateSVG } from '../ui/plate.js';
import { ICON } from '../ui/icons.js';

/* Zeigt dieses Zeichnen die Seite der Einheit? vWorkout meldet sich, vTimer in timer.js fragt danach.
   app.js zeichnet erst die Seite und danach Timer und Navigation, darum gilt die Meldung genau für ein Zeichnen. */
let shown = false;
export const markShown = () => { shown = true; };
export const takeShown = () => { const s = shown; shown = false; return s; };

/* Restzeit der Pause als Text, „vorbei“ nach Ablauf */
export const restText = (t, now = Date.now()) => {
  const left = (t.endAt - now) / 1000;
  return left > 0 ? mmss(Math.ceil(left)) : 'vorbei';
};

export function liveBar() {
  const a = S.active;
  if (!a) return '';
  const t = a.timer;
  const over = !!t && t.endAt <= Date.now();
  return `<div class="live-bar day-${a.color} ${over ? 'over' : ''}">
    <button class="live-btn" data-act="woback" aria-label="${esc(a.name)} läuft. Zurück zur Einheit">
      ${plateSVG(a.color, '', '', { small: true })}
      <span class="live-txt"><b>${esc(a.name)}</b>
        <span class="num"><span data-tick="elapsed">${mmss((Date.now() - a.startedAt) / 1000)}</span>${t
          ? `<span class="live-rest"> · Pause <span data-tick="rest">${restText(t)}</span></span>` : ''}</span></span>
      <span class="live-go">Zur Einheit${ICON.chevron}</span>
    </button>
  </div>`;
}
