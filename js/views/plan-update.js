/* Hinweis „Überarbeiteter 3er-Split verfügbar“ unter Training · Plan (4.7). Logik in domain/plan-update.js. */
import { S, V, save } from '../state.js';
import { esc } from '../util.js';
import { render } from '../render.js';
import { toast } from '../ui/toast.js';
import { swapSummary } from '../plans.js';
import { planOffer, acceptOffer, declineOffer } from '../domain/plan-update.js';

const arrow = (a, b) => (a === b ? `${a}` : `${a} → ${b}`);

export function offerCard() {
  const o = planOffer(S);
  if (!o) return '';
  const rows = o.days.map(d => `<li>
      <b>${esc(d.name)}</b>: <span class="num">${arrow(d.before.sets, d.after.sets)} Sätze, etwa ${arrow(d.before.minutes, d.after.minutes)} Min.</span>
      ${d.removed.length ? `<span class="plan-offer-x">Raus: ${esc(d.removed.join(', '))}</span>` : ''}
      ${d.added.length ? `<span class="plan-offer-x">Neu: ${esc(d.added.join(', '))}</span>` : ''}
    </li>`).join('');
  return `<section class="card suggestion plan-offer" aria-labelledby="plan-offer-h">
    <h2 id="plan-offer-h">Überarbeiteter 3er-Split verfügbar</h2>
    <p class="muted">Kürzere Einheiten bis etwa 60 Minuten, jeder große Muskel kommt auf mindestens 10 Sätze pro Woche, hintere Oberschenkel und Gesäß zweimal. Dein Plan „${esc(o.current.name)}“ bleibt, wie er ist; der neue kommt als weiterer Plan dazu.</p>
    <ul class="plan-offer-days">${rows}</ul>
    ${o.swaps.length ? `<p class="small-print">Angepasst an deine Geräte: ${esc(swapSummary(o.swaps))}.</p>` : ''}
    <p class="small-print">Gleiche Übungen laufen mit ihrem Verlauf weiter. Zurück zum alten Plan geht es jederzeit über „Plan wechseln“. Behältst du deinen, findest du den neuen 3er-Split jederzeit unter „Neuer Plan“.</p>
    <div class="sug-btns">
      <button class="btn small primary" data-act="planoffer">Als neuen Plan übernehmen</button>
      <button class="btn small ghost" data-act="planofferno">Behalten, nicht mehr fragen</button>
    </div>
  </section>`;
}

export const actions = {
  planoffer: () => {
    acceptOffer(S);
    V.planDay = null;
    V.pick = null;
    save(); render();
    toast('Überarbeiteter 3er-Split ist aktiv');
  },
  planofferno: () => {
    declineOffer(S);
    save(); render();
    toast('Dein Plan bleibt. Den neuen 3er-Split findest du unter „Neuer Plan“.');
  },
};
