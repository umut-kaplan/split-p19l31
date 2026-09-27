import { S, V, save, activePlan, CAN_STORE } from '../state.js';
import { esc, dLong, dShort, fmt0 } from '../util.js';
import { render } from '../render.js';
import { nextDay } from '../domain/progression.js';
import { weekStreak, weekHistory } from '../domain/streaks.js';
import { calorieGoal, GOALS } from '../domain/energy.js';
import { plateSVG } from '../ui/plate.js';
import { bmiCard, waterBlock, profileNow } from '../ui/cards.js';
import { dayFacts } from './training.js';

export function greeting(h) {
  if (h >= 5 && h < 11) return 'Guten Morgen';
  if (h >= 17 && h < 22) return 'Guten Abend';
  return 'Hallo';
}

export function todayDay() {
  const plan = activePlan();
  const id = V.pick && plan.days[V.pick] ? V.pick : nextDay(plan.order, S.sessions, plan.id);
  return { id, d: plan.days[id], plan };
}

export function view() {
  const { id, d, plan } = todayDay();
  const name = S.profile.name;
  const rolled = V.roll; V.roll = false;
  return `<div class="day-${d.color}">
    ${CAN_STORE ? '' : '<p class="banner">Dieser Browser speichert hier nichts. Öffne die App über den Link in Safari und lege sie auf den Home-Bildschirm.</p>'}
    <header class="greet">
      <p class="date">${esc(dLong(Date.now()))}</p>
      <h1>${greeting(new Date().getHours())}${name ? ', ' + esc(name) : ''}</h1>
    </header>
    ${S.settings.disclaimerSeen ? '' : `<section class="card notice" style="margin-top:16px">
      <h2>Gut zu wissen</h2>
      <p>Kalorien, BMI und Körperwerte in dieser App sind Schätzungen aus Formeln. Sie ersetzen keine ärztliche oder ernährungsfachliche Beratung.</p>
      <button class="btn small" data-act="disclaimer">Verstanden</button>
    </section>`}
    ${S.active ? activeHero() : hero(id, d, plan, rolled)}
    ${streakBlock(d.color)}
    ${goalsBlock()}
    <section class="block">${bmiCard()}</section>
  </div>`;
}

function hero(id, d, plan, rolled) {
  const { sets, min } = dayFacts(d);
  const lastOfDay = [...S.sessions].reverse().find(s => s.dayId === id);
  const others = plan.order.filter(o => o !== id);
  return `<div class="hero">
    <button class="plate-btn ${rolled ? 'roll' : ''}" data-act="start" data-day="${id}" aria-label="${esc(d.name)} starten">
      ${plateSVG(d.color, d.name, d.muscles)}
    </button>
    <h2 class="hero-title">${esc(d.name)}</h2>
    <p class="hero-sub">${esc(d.muscles)}</p>
    <p class="hero-facts"><b>${d.exercises.length}</b> Übungen mit <b>${sets}</b> Arbeitssätzen, etwa <b>${min}</b> Minuten.
      ${lastOfDay ? `Zuletzt am ${esc(dShort(lastOfDay.startedAt))}` : ''}</p>
    <button class="btn primary" data-act="start" data-day="${id}">${esc(d.name)} starten</button>
    <p class="others-label">Heute lieber etwas anderes?</p>
    <div class="others">${others.map(o => { const od = plan.days[o]; return `
      <button class="other" data-act="pick" data-day="${o}">${plateSVG(od.color, '', '', { small: true })}${esc(od.name)}</button>`; }).join('')}</div>
  </div>`;
}

function activeHero() {
  const a = S.active;
  return `<div class="hero day-${a.color}">
    <button class="plate-btn" data-act="resume" aria-label="Training fortsetzen">${plateSVG(a.color, a.name, 'Training läuft')}</button>
    <h2 class="hero-title">${esc(a.name)} läuft</h2>
    <p class="hero-sub">Begonnen um ${new Date(a.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
    <div style="margin-top:18px"><button class="btn primary" data-act="resume">Weiter trainieren</button></div>
  </div>`;
}

function streakBlock(color) {
  const target = S.profile.daysPerWeek || 3;
  const st = weekStreak(S.sessions, target);
  const hist = weekHistory(S.sessions, target);
  const head = st.weeks > 0
    ? `<b class="num">${st.weeks}</b><span>${st.weeks === 1 ? 'Woche' : 'Wochen'} am Stück</span>`
    : '<span>Noch keine Serie. Eine Woche zählt, wenn du deine geplanten Einheiten schaffst.</span>';
  return `<section class="block card">
    <h2>Deine Serie</h2>
    <div class="streak-head">${head}</div>
    <div class="streak" aria-label="Die letzten ${hist.length} Wochen">${hist.map(w => `
      <div class="wk ${w.met ? 'met' : ''} ${w.current ? 'now' : ''}" title="Woche ab ${esc(dShort(w.start))}: ${w.count} Einheiten">
        ${plateSVG(color, '', '', { small: true, ghost: !w.met })}
        <span class="num">${w.current ? `${w.count}/${target}` : esc(dShort(w.start))}</span>
      </div>`).join('')}</div>
    <p class="small-print" style="margin-top:10px">Diese Woche ${st.thisWeek} von ${target} Einheiten. Jede Scheibe ist eine Woche, Montag bis Sonntag.</p>
  </section>`;
}

function goalsBlock() {
  const cg = calorieGoal(profileNow());
  const kcal = cg.ok
    ? `<div class="goal-row"><div class="goal-top"><span>Kalorienziel</span><span><b class="num">${fmt0(cg.kcal)}</b> <small>kcal</small></span></div>
        <p class="small-print">Für „${esc((GOALS[S.profile.goal] || GOALS.recomp).label)}“. Die Rechnung steht unter Ernährung.</p></div>`
    : `<div class="goal-row"><div class="goal-top"><span>Kalorienziel</span></div>
        <p class="muted" style="margin-bottom:10px">Dafür fehlt noch: ${esc(cg.missing.join(', '))}.</p>
        <button class="btn small" data-act="tab" data-tab="profile">Profil ergänzen</button></div>`;
  return `<section class="block card"><h2>Tagesziele</h2>${kcal}${waterBlock()}</section>`;
}

export const actions = {
  pick: el => { V.pick = el.dataset.day; V.roll = true; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  disclaimer: () => { S.settings.disclaimerSeen = true; save(); render(); },
};
