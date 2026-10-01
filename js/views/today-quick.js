/* Schnellzeile auf „Heute“ unter der Scheibe: „+ Wasser“, „+ Essen“, „+ Gewicht“, jeweils direkt die Eingabe. */
import { S, save } from '../state.js';
import { esc, fmt1, fmtIn, toNum, ymd, dShort } from '../util.js';
import { render } from '../render.js';
import { MEALS } from '../domain/nutrition.js';
import { waterGoal } from '../domain/energy.js';
import { profileNow } from '../ui/cards.js';
import { openSheet, closeSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { mealNow } from './food-state.js';
import { startSearch, MEAL_SHORT } from './food-search.js';
import { recordWeight } from './body.js';

/* Ein Glas Wasser */
export const GLASS_ML = 250;

const lastWeight = () => [...S.body.weights].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).pop() || null;

export function quickRow() {
  const meal = mealNow();
  const w = lastWeight();
  return `<div class="quick" role="group" aria-label="Schnell eintragen">
    <button class="quick-btn q-water" data-act="qwater" aria-label="Ein Glas Wasser eintragen, ${GLASS_ML} ml"><b>+ Wasser</b><small>${GLASS_ML} ml</small></button>
    <button class="quick-btn q-food" data-act="qfood" aria-label="Essen eintragen, ${esc(MEALS[meal])}"><b>+ Essen</b><small>${esc(MEAL_SHORT[meal])}</small></button>
    <button class="quick-btn q-weight" data-act="qweight" aria-label="Gewicht eintragen${w ? `, zuletzt ${esc(fmt1(w.kg))} kg` : ''}"><b>+ Gewicht</b><small>${w ? `${esc(fmt1(w.kg))} kg` : 'kg'}</small></button>
  </div>`;
}

/* ---------- Gewicht: kleines Sheet mit Zahlenfeld ---------- */
function weightSheet() {
  const w = lastWeight();
  openSheet({
    title: 'Gewicht eintragen',
    body: `<div class="form">
      <label class="field">Gewicht heute
        <span class="unit-wrap"><input id="qw-kg" inputmode="decimal" enterkeyhint="done" autocomplete="off" placeholder="${w ? esc(fmtIn(w.kg)) : 'z. B. 82,4'}"><span>kg</span></span></label>
      <p class="help">${w ? `Zuletzt ${esc(fmt1(w.kg))} kg am ${esc(dShort(w.date + 'T12:00'))} ` : ''}Ein zweiter Wert heute ersetzt den ersten. Ein anderes Datum trägst du unter Körper ein.</p>
    </div>`,
    actions: [
      { label: 'Eintragen', kind: 'primary', fn: saveWeight },
      { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
    ],
  });
  /* Direkt im Tipp fokussiert, öffnet iOS die Zahlentastatur */
  const el = document.getElementById('qw-kg');
  if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
}

function saveWeight() {
  const el = document.getElementById('qw-kg');
  const kg = toNum(el ? el.value : '');
  if (!(kg >= 30 && kg <= 300)) { toast('Gewicht in kg eintragen, z. B. 82,4'); return; }
  recordWeight(Math.round(kg * 10) / 10, 'manual', ymd());
  save(); closeSheet();
  toast(`${fmt1(kg)} kg eingetragen`);
}

/* Die Eingabetaste trägt ein (Hardware-Tastatur, Android). Die Zahlentastatur des iPhones hat keine; ihr „Fertig“
   schließt nur die Tastatur, eingetragen wird dort mit „Eintragen“. */
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target && ev.target.id === 'qw-kg') { ev.preventDefault(); saveWeight(); }
  });
}

export const actions = {
  qwater: () => {
    const k = ymd();
    const before = S.water[k] || 0;
    const after = before + GLASS_ML;
    S.water[k] = after;
    save(); render();
    const goal = waterGoal(profileNow().weightKg);
    toast(before < goal && after >= goal ? 'Wasserziel für heute erreicht'
      : `Ein Glas eingetragen, heute ${fmt1(after / 1000)} von ${fmt1(goal / 1000)} l`);
  },
  qfood: () => startSearch({ from: 'today' }),
  qweight: weightSheet,
};
