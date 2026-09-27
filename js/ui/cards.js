import { S, save } from '../state.js';
import { esc, fmt1, fmt0, ymd } from '../util.js';
import { render } from '../render.js';
import { bmi, bmiCategory, bmiScalePos, currentWeight } from '../domain/body.js';
import { waterGoal } from '../domain/energy.js';
import { toast } from './toast.js';

/* Profil mit dem zuletzt eingetragenen Gewicht */
export const profileNow = () => ({ ...S.profile, weightKg: currentWeight(S.profile, S.body.weights) });

export function bmiCard() {
  const p = profileNow();
  const b = bmi(p.weightKg, p.heightCm);
  if (b == null) {
    return `<section class="card"><h2>BMI</h2>
      <p class="muted" style="margin:4px 0 12px">Trage Größe und Gewicht ein, dann steht hier dein BMI.</p>
      <button class="btn small" data-act="tab" data-tab="profile">Profil ergänzen</button></section>`;
  }
  return `<section class="card"><h2>BMI</h2>
    <div class="bmi-val"><b class="num">${fmt1(b)}</b><span>${esc(bmiCategory(b))}</span></div>
    <div class="bmi-scale" aria-hidden="true"></div>
    <div class="bmi-marker" aria-hidden="true"><i style="left:${bmiScalePos(b)}%"></i></div>
    <div class="bmi-legend num" aria-hidden="true">${[15, 18.5, 25, 30, 35].map(v =>
      `<span style="left:${bmiScalePos(v)}%">${String(v).replace('.', ',')}</span>`).join('')}</div>
    <p class="small-print" style="margin-top:10px">Aus ${fmt1(p.weightKg)} kg und ${fmt0(p.heightCm)} cm. Bei viel Muskelmasse ist der BMI wenig aussagekräftig, er unterscheidet nicht zwischen Muskeln und Fett.</p>
  </section>`;
}

export function waterBlock() {
  const goal = waterGoal(profileNow().weightKg);
  const ml = S.water[ymd()] || 0;
  return `<div class="goal-row">
    <div class="goal-top"><span>Wasser</span><span><b class="num">${fmt1(ml / 1000)}</b> <small>von ${fmt1(goal / 1000)} l</small></span></div>
    <div class="bar water" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${ml}" aria-label="Wasser heute"><i style="width:${Math.min(100, ml / goal * 100)}%"></i></div>
    <div class="water-btns">
      <button class="btn" data-act="water" data-ml="250">+250 ml</button>
      <button class="btn" data-act="water" data-ml="500">+500 ml</button>
      <button class="btn ghost minus" data-act="water" data-ml="-250" aria-label="250 ml abziehen">−</button>
    </div>
  </div>`;
}

export const actions = {
  water: el => {
    const k = ymd();
    const before = S.water[k] || 0;
    const after = Math.max(0, before + Number(el.dataset.ml));
    S.water[k] = after;
    save(); render();
    const goal = waterGoal(profileNow().weightKg);
    if (before < goal && after >= goal) toast('Wasserziel für heute erreicht');
  },
};
