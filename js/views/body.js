import { S, save } from '../state.js';
import { esc, fmt1, toNum, ymd, dMid } from '../util.js';
import { render } from '../render.js';
import { bmiCard } from '../ui/cards.js';
import { toast } from '../ui/toast.js';

const SOURCE = { manual: 'eingetragen', profile: 'aus dem Profil', onboarding: 'bei der Einrichtung' };

/* Ein Eintrag pro Tag. Ein zweiter Wert am selben Tag ersetzt den ersten. */
export function recordWeight(kg, source = 'manual', date = ymd()) {
  const list = S.body.weights;
  const i = list.findIndex(w => w.date === date);
  const entry = { date, kg, source, method: 'scale' };
  if (i >= 0) list[i] = entry; else list.push(entry);
  list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  S.profile.weightKg = list[list.length - 1].kg;
}

export function view() {
  const list = [...S.body.weights].reverse().slice(0, 12);
  return `<div class="day-white">
    <h1 class="page-title">Körper</h1>
    <p class="page-sub">Gewicht und BMI. Alles bleibt auf diesem Gerät.</p>
    <section class="block card">
      <h2>Gewicht</h2>
      <div class="weigh">
        <label class="field">Heute
          <span class="unit-wrap"><input id="w-today" inputmode="decimal" placeholder="z. B. 82,4" enterkeyhint="done"><span>kg</span></span></label>
        <button class="btn primary small" data-act="addweight" style="min-height:48px">Eintragen</button>
      </div>
      <p class="small-print" style="margin-top:8px">Am besten morgens nach dem Aufstehen wiegen, dann sind die Werte vergleichbar.</p>
      ${list.length ? `<ul class="weights" style="margin-top:12px">${list.map(w => `
        <li><span>${esc(dMid(w.date + 'T12:00'))} <small>${esc(SOURCE[w.source] || '')}</small></span>
          <b class="num">${fmt1(w.kg)} kg</b></li>`).join('')}</ul>` : ''}
    </section>
    <section class="block">${bmiCard()}</section>
  </div>`;
}

export const actions = {
  addweight: () => {
    const el = document.getElementById('w-today');
    const kg = toNum(el.value);
    if (!(kg >= 30 && kg <= 300)) { toast('Gewicht in kg eintragen, z. B. 82,4'); return; }
    recordWeight(kg);
    save(); render(); toast('Gewicht eingetragen');
  },
};
