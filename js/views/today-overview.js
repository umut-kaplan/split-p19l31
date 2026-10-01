/* Überblick auf „Heute“: das Seltene in einer Karte. Kacheln für heute (Kalorien, Protein, Wasser) und die Woche
   (Einheiten, Serie, Gewicht), Knöpfe zu Erfolgen und Wochenbericht. „Alles zeigen“ klappt die ganzen Karten auf:
   Serie, Wochenziele, Tagesziele mit Wasser, Gewichtstrend und BMI. */
import { S, V } from '../state.js';
import { esc, fmt0, fmt1, ymd } from '../util.js';
import { render } from '../render.js';
import { targetsFromState, waterGoal } from '../domain/energy.js';
import { dayTotals } from '../domain/nutrition.js';
import { weekStreakWithJokers } from '../domain/streaks.js';
import { weightTrend } from '../domain/body.js';
import { bmiCard, profileNow } from '../ui/cards.js';
import * as goals from './goals.js';
import { todayGoalsCard } from './nutrition.js';
import { weightTrendCard, signedKg } from './body.js';

const pct = (v, goal) => (goal > 0 ? Math.max(0, Math.min(100, v / goal * 100)) : 0);

function tile(label, value, sub, bar = null, cls = '') {
  return `<div class="ov-tile ${cls}">
    <span class="ov-l">${esc(label)}</span>
    <b class="num">${esc(value)}</b>
    <small>${esc(sub)}</small>
    ${bar == null ? '' : `<span class="ov-bar" aria-hidden="true"><i style="width:${bar.toFixed(0)}%"></i></span>`}
  </div>`;
}

export function overviewCard(color) {
  /* Abzeichen und Ziele abgleichen, auch wenn die Wochenziele zugeklappt sind */
  goals.syncAll();
  const today = ymd();
  const t = targetsFromState(S);
  const tot = dayTotals(S.nutrition.log, today);
  const ml = S.water[today] || 0;
  const wGoal = waterGoal(profileNow().weightKg);
  const target = S.profile.daysPerWeek || 3;
  const st = weekStreakWithJokers(S.sessions, target);
  const tr = weightTrend(S.body.weights, today);
  const kg = profileNow().weightKg;
  const open = !!V.todayAll;
  const weight = tr.ok ? tile('Gewicht', signedKg(tr.perWeek).replace(' kg', ''), 'kg/Woche')
    : tile('Gewicht', kg ? fmt1(kg) : '–', kg ? 'kg' : 'noch kein Eintrag');
  return `<section class="block card ov">
    <div class="ov-head">
      <h2>Überblick</h2>
      <button class="link" data-act="todayall" aria-expanded="${open}">${open ? 'Weniger zeigen' : 'Alles zeigen'}</button>
    </div>
    <div class="ov-grid">
      ${tile('Kalorien', fmt0(tot.kcal), t.ok ? `von ${fmt0(t.kcal)}` : 'kcal, Ziel fehlt', t.ok ? pct(tot.kcal, t.kcal) : null, 'day-yellow')}
      ${tile('Protein', `${fmt0(tot.protein)} g`, t.ok && t.protein != null ? `von ${fmt0(t.protein)} g` : 'Ziel fehlt', t.ok && t.protein ? pct(tot.protein, t.protein) : null, 'day-yellow')}
      ${tile('Wasser', `${fmt1(ml / 1000)} l`, `von ${fmt1(wGoal / 1000)} l`, pct(ml, wGoal), 'ov-water')}
      ${tile('Woche', `${st.thisWeek}/${target}`, target === 1 ? 'Einheit' : 'Einheiten', pct(st.thisWeek, target), `day-${color}`)}
      ${tile('Serie', String(st.weeks), st.weeks === 1 ? 'Woche' : 'Wochen')}
      ${weight}
    </div>
    <div class="ov-btns">
      <button class="btn small" data-act="motopen">Erfolge</button>
      ${S.sessions.length ? '<button class="btn small" data-act="repopen">Wochenbericht</button>' : ''}
    </div>
  </section>
  ${open ? `<div class="ov-all">
    ${goals.streakCard(color)}
    ${goals.weeklyGoalsCard()}
    ${todayGoalsCard()}
    ${weightTrendCard()}
    <section class="block">${bmiCard()}</section>
  </div>` : ''}`;
}

export const actions = {
  todayall: () => { V.todayAll = !V.todayAll; render(); },
};
