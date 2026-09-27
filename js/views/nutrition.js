import { S } from '../state.js';
import { esc, fmt0 } from '../util.js';
import { calorieGoal, macros, GOALS } from '../domain/energy.js';
import { waterBlock, profileNow } from '../ui/cards.js';

export function view() {
  const p = profileNow();
  const cg = calorieGoal(p);
  const goal = GOALS[S.profile.goal] || GOALS.recomp;
  let kcalCard;
  if (cg.ok) {
    const m = macros(cg.kcal, p.weightKg);
    kcalCard = `<section class="block card">
      <h2>Kalorienziel</h2>
      <p class="kcal-big num">${fmt0(cg.kcal)}<small>kcal am Tag</small></p>
      <p class="muted" style="margin-top:6px">Für dein Ziel „${esc(goal.label)}“.</p>
      <div class="macros">
        <div class="macro"><b class="num">${m.protein} g</b><span>Protein</span></div>
        <div class="macro"><b class="num">${m.fat} g</b><span>Fett</span></div>
        <div class="macro"><b class="num">${m.carbs} g</b><span>Kohlenhydrate</span></div>
      </div>
      <details class="more" style="margin-top:8px">
        <summary>So rechnet die App</summary>
        <ol class="calc">
          ${cg.lines.map(l => `<li>${esc(l)}</li>`).join('')}
          <li>Protein 2 g pro kg Körpergewicht (sinnvoll sind ${m.proteinRange[0]}–${m.proteinRange[1]} g), Fett 0,8 g pro kg, der Rest Kohlenhydrate.</li>
        </ol>
      </details>
    </section>`;
  } else {
    kcalCard = `<section class="block card">
      <h2>Kalorienziel</h2>
      <p class="muted" style="margin:4px 0 12px">Für die Rechnung fehlt noch: ${esc(cg.missing.join(', '))}.</p>
      <button class="btn small" data-act="tab" data-tab="profile">Profil ergänzen</button>
    </section>`;
  }
  return `<div class="day-yellow">
    <h1 class="page-title">Ernährung</h1>
    <p class="page-sub">Ziele aus deinem Profil. Mahlzeiten lassen sich noch nicht eintragen.</p>
    ${kcalCard}
    <section class="block card"><h2>Heute getrunken</h2>${waterBlock()}</section>
    <p class="small-print" style="margin-top:18px">Alle Werte sind Schätzungen aus Formeln und ersetzen keine Ernährungsberatung.</p>
  </div>`;
}
