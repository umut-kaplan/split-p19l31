import { S, V, save, activePlan, CAN_STORE } from '../state.js';
import { esc, dLong, dShort, ymd, plural } from '../util.js';
import { render } from '../render.js';
import { nextDay } from '../domain/progression.js';
import { pickHints } from '../domain/today-hints.js';
import { plateSVG } from '../ui/plate.js';
import { suggestionCardList } from '../ui/suggestion.js';
import { dayFacts } from './training.js';
import { shortStartButton } from './short-start.js';
import { photoReminderCard } from './body.js';
import * as goals from './goals.js';
import * as report from './report.js';
import * as recovery from './recovery.js';
import * as backupReminder from './backup-reminder.js';
import * as quick from './today-quick.js';
import * as overview from './today-overview.js';
import { shiftTodayCard, plannedNextId } from './shift-today.js';
import { birthCard } from './birthdate.js';
import { gearCheckCard } from './gear.js';

export function greeting(h) {
  if (h >= 5 && h < 11) return 'Guten Morgen';
  if (h >= 17 && h < 22) return 'Guten Abend';
  return 'Hallo';
}

export function todayDay() {
  const plan = activePlan();
  const id = V.pick && plan.days[V.pick] ? V.pick : plannedNextId(plan) || nextDay(plan.order, S.sessions, plan.id, plan.days);
  return { id, d: plan.days[id], plan };
}

/* Untermodule, deren actions und inputs app.js einsammelt */
export const modules = [goals, report, recovery, backupReminder, quick, overview];

/* Aufbau: Begrüßung, Schichtzeile, Scheibe mit Startknopf, Schnellzeile, Ampel als Zeile,
   höchstens zwei Hinweis-Karten (Reihenfolge in domain/today-hints.js), darunter „Weitere Hinweise“ zum Aufklappen,
   zuletzt der Überblick mit dem Seltenen. Ziel: höchstens zwei Bildschirmhöhen bei 393×852. */
export function view() {
  /* Unterseiten wie „Erfolge“ oder der ganze Wochenbericht ersetzen die Startseite */
  const sub = goals.subview() || report.subview();
  if (sub) return sub;
  const { id, d, plan } = todayDay();
  const name = S.profile.name;
  const rolled = V.roll; V.roll = false;
  const active = !!S.active;
  const amp = active ? { hint: '', line: '' } : recovery.ampelOnToday();
  const { shown, more } = pickHints([
    !S.settings.disclaimerSeen && { kind: 'disclaimer', html: disclaimerCard() },
    { kind: 'report', html: report.reportCard() },
    { kind: 'ampel', html: amp.hint },
    !active && { kind: 'backup', html: backupReminder.backupCard() },
    !active && { kind: 'gear', html: gearCheckCard() },
    /* Nach „Ändern“ steht die Check-in-Karte unter der Ampel, nicht hier */
    !active && V.recEdit !== ymd() && { kind: 'checkin', html: recovery.checkinCard() },
    !active && { kind: 'birth', html: birthCard() },
    { kind: 'photo', html: photoReminderCard() },
    ...suggestionCardList(null, 2).map(html => ({ kind: 'suggestion', html })),
  ].filter(h => h && h.html));
  queueMicrotask(fitHero);
  return `<div class="day-${d.color} today ${active ? 'live' : ''}">
    ${CAN_STORE ? '' : '<p class="banner">Dieser Browser speichert hier nichts. Öffne die App über den Link in Safari und lege sie auf den Home-Bildschirm.</p>'}
    <header class="greet">
      <p class="date">${esc(dLong(Date.now()))}</p>
      <h1>${greeting(new Date().getHours())}${name ? ', ' + esc(name) : ''}</h1>
    </header>
    ${shiftTodayCard()}
    ${active ? activeHero() : hero(id, d, plan, rolled)}
    ${quick.quickRow()}
    ${amp.line}
    ${shown.length ? `<div class="today-hints">${shown.map(h => h.html).join('')}</div>` : ''}
    ${more.length ? moreHints(more) : ''}
    ${overview.overviewCard(d.color)}
  </div>`;
}

function disclaimerCard() {
  return `<section class="block card notice">
    <h2>Gut zu wissen</h2>
    <p>Kalorien, BMI und Körperwerte in dieser App sind Schätzungen aus Formeln. Sie ersetzen keine ärztliche oder ernährungsfachliche Beratung.</p>
    <button class="btn small" data-act="disclaimer">Verstanden</button>
  </section>`;
}

/* Was nicht unter die ersten zwei passt, bleibt mit einem Tipp erreichbar */
function moreHints(more) {
  const open = !!V.todayHints;
  const n = more.length;
  return `<section class="block today-more">
    <button class="link" data-act="todayhints" aria-expanded="${open}">${open ? 'Weitere Hinweise ausblenden' : `${n === 1 ? 'Ein weiterer Hinweis' : `${n} weitere Hinweise`}`}</button>
    ${open ? `<div class="today-hints">${more.map(h => h.html).join('')}</div>` : ''}
  </section>`;
}

function hero(id, d, plan, rolled) {
  const { sets, min } = dayFacts(d);
  const lastOfDay = [...S.sessions].reverse().find(s => s.dayId === id);
  const others = plan.order.filter(o => o !== id);
  /* Ein Tag ohne Übungen führt in den Plan-Editor statt in eine leere Einheit */
  const empty = !d.exercises.length;
  const go = empty ? `data-act="tab" data-tab="training" data-sub="plan" data-day="${id}"` : `data-act="start" data-day="${id}"`;
  return `<div class="hero">
    <button class="plate-btn ${rolled ? 'roll' : ''}" ${go} aria-label="${esc(d.name)}${d.muscles ? `, ${esc(d.muscles)},` : ''} ${empty ? 'bearbeiten' : 'starten'}">
      ${plateSVG(d.color, d.name, d.muscles)}
    </button>
    <h2 class="vh">${esc(d.name)}</h2>
    <p class="hero-facts">${d.muscles ? `${esc(d.muscles)}. ` : ''}${empty ? 'Für diesen Tag stehen noch keine Übungen im Plan.' : `<b>${d.exercises.length}</b> ${plural(d.exercises.length, 'Übung', 'Übungen')}, <b>${sets}</b> ${plural(sets, 'Arbeitssatz', 'Arbeitssätze')}, etwa <b>${min}</b> ${plural(min, 'Minute', 'Minuten')}.
      ${lastOfDay ? `Zuletzt am ${esc(dShort(lastOfDay.startedAt))}` : ''}`}</p>
    <button class="btn primary" ${go}>${empty ? 'Übungen eintragen' : `${esc(d.name)} starten`}</button>
    ${empty ? '' : shortStartButton(id, d, 'hero-short')}
    ${others.length ? `<div class="others"><span class="others-label">Heute lieber</span>${others.map(o => { const od = plan.days[o]; return `
      <button class="other" data-act="pick" data-day="${o}">${plateSVG(od.color, '', '', { small: true })}${esc(od.name)}</button>`; }).join('')}</div>` : ''}
  </div>`;
}

function activeHero() {
  const a = S.active;
  return `<div class="hero day-${a.color}">
    <button class="plate-btn" data-act="resume" aria-label="Training fortsetzen">${plateSVG(a.color, a.name, 'Training läuft')}</button>
    <h2 class="hero-title">${esc(a.name)} läuft</h2>
    <p class="hero-sub">Begonnen um ${new Date(a.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
    <button class="btn primary" data-act="resume">Weiter trainieren</button>
  </div>`;
}

/* Die Scheibe richtet sich nach der Bildschirmhöhe: so klein wie nötig, damit der Startknopf beim Öffnen
   ganz über der Navigation steht (auch bei 320×568), höchstens so groß wie im CSS festgelegt. Läuft ein Training,
   steht über der Navigation noch die Mini-Leiste (live-bar.js); dann muss „Weiter trainieren“ über ihr stehen.
   Läuft nach dem Zeichnen, vor dem Anzeigen; die Scheibe ist quadratisch, also spart jeder Pixel Breite einen Pixel Höhe. */
const PLATE_MIN = 112;
const FOLD_GAP = 12;
function fitHero() {
  const hero = document.querySelector('main .today .hero');
  const plate = hero && hero.querySelector('.plate-btn');
  const btn = hero && hero.querySelector('.btn.primary');
  if (!plate || !btn) return;
  plate.style.width = '';
  /* Oberkante der festen Leisten unten: Navigation oder, darüber, die Mini-Leiste */
  const fixedTop = Math.min(window.innerHeight, ...['nav.tabs', '.live-bar .live-btn']
    .map(sel => document.querySelector(sel)).filter(Boolean).map(e => e.getBoundingClientRect().top));
  const bottom = btn.getBoundingClientRect().bottom + window.scrollY;
  const over = bottom - (fixedTop - FOLD_GAP);
  if (over <= 0) return;
  /* offsetWidth statt getBoundingClientRect: Die hereinrollende Scheibe ist gedreht, ihr Rahmen wäre größer */
  const w = plate.offsetWidth;
  plate.style.width = `${Math.max(PLATE_MIN, Math.floor(w - over))}px`;
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => { if (V.tab === 'today') fitHero(); });
  /* Stehen die Schriften erst nach dem ersten Zeichnen fest, ändern sich die Umbrüche über dem Knopf */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (V.tab === 'today') fitHero(); });
}

export const actions = {
  pick: el => { V.pick = el.dataset.day; V.roll = true; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  disclaimer: () => { S.settings.disclaimerSeen = true; save(); render(); },
  todayhints: () => { V.todayHints = !V.todayHints; render(); },
};
