import { S, V, save, activePlan, CAN_STORE } from '../state.js';
import { esc, dLong, dShort } from '../util.js';
import { render } from '../render.js';
import { nextDay } from '../domain/progression.js';
import { plateSVG } from '../ui/plate.js';
import { bmiCard } from '../ui/cards.js';
import { suggestionCards } from '../ui/suggestion.js';
import { dayFacts } from './training.js';
import { todayGoalsCard } from './nutrition.js';
import { todayBodyCard } from './body.js';
import * as goals from './goals.js';
import * as report from './report.js';
import * as recovery from './recovery.js';

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

/* Untermodule, deren actions und inputs app.js einsammelt */
export const modules = [goals, report, recovery];

export function view() {
  /* Unterseiten wie „Erfolge“ oder der ganze Wochenbericht ersetzen die Startseite */
  const sub = goals.subview() || report.subview();
  if (sub) return sub;
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
    ${report.reportCard()}
    ${S.active ? activeHero() : hero(id, d, plan, rolled)}
    ${S.active ? '' : recovery.trainTodayCard()}
    ${S.active ? '' : recovery.checkinCard()}
    ${suggestionsBlock()}
    ${goals.streakCard(d.color)}
    ${goals.weeklyGoalsCard()}
    ${todayGoalsCard()}
    ${todayBodyCard()}
    <section class="block">${bmiCard()}</section>
  </div>`;
}

function hero(id, d, plan, rolled) {
  const { sets, min } = dayFacts(d);
  const lastOfDay = [...S.sessions].reverse().find(s => s.dayId === id);
  const others = plan.order.filter(o => o !== id);
  /* Ein Tag ohne Übungen führt in den Plan-Editor statt in eine leere Einheit */
  const empty = !d.exercises.length;
  const go = empty ? `data-act="tab" data-tab="training" data-sub="plan" data-day="${id}"` : `data-act="start" data-day="${id}"`;
  return `<div class="hero">
    <button class="plate-btn ${rolled ? 'roll' : ''}" ${go} aria-label="${esc(d.name)} ${empty ? 'bearbeiten' : 'starten'}">
      ${plateSVG(d.color, d.name, d.muscles)}
    </button>
    <h2 class="hero-title">${esc(d.name)}</h2>
    <p class="hero-sub">${esc(d.muscles)}</p>
    <p class="hero-facts">${empty ? 'Für diesen Tag stehen noch keine Übungen im Plan.' : `<b>${d.exercises.length}</b> Übungen mit <b>${sets}</b> Arbeitssätzen, etwa <b>${min}</b> Minuten.
      ${lastOfDay ? `Zuletzt am ${esc(dShort(lastOfDay.startedAt))}` : ''}`}</p>
    <button class="btn primary" ${go}>${empty ? 'Übungen eintragen' : `${esc(d.name)} starten`}</button>
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

/* Höchstens zwei offene Vorschläge aus allen Bereichen */
function suggestionsBlock() {
  const cards = suggestionCards(null, 2);
  return cards ? `<section class="block"><h2>Vorschläge</h2><div class="stack" style="margin-top:0">${cards}</div></section>` : '';
}

export const actions = {
  pick: el => { V.pick = el.dataset.day; V.roll = true; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  disclaimer: () => { S.settings.disclaimerSeen = true; save(); render(); },
};
