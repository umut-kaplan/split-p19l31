import { S, V, load, requestPersist } from './state.js';
import { setRender } from './render.js';
import { ICON } from './ui/icons.js';
import { ymd } from './util.js';
import * as sheet from './ui/sheet.js';
import * as cards from './ui/cards.js';
import * as suggestion from './ui/suggestion.js';
import * as timer from './timer.js';
import { initImport } from './store/backup.js';
import * as today from './views/today.js';
import * as training from './views/training.js';
import * as workout from './views/workout.js';
import * as history from './views/history.js';
import * as planedit from './views/planedit.js';
import * as body from './views/body.js';
import * as nutrition from './views/nutrition.js';
import * as profile from './views/profile.js';
import * as fields from './views/profile-fields.js';
import * as onboarding from './views/onboarding.js';
import * as whatsnew from './views/whatsnew.js';
import * as shifts from './views/shifts.js';
import * as storage from './views/storage.js';
import * as knowledge from './views/knowledge.js';

const TABS = [
  ['today', 'Heute', ICON.today, today],
  ['training', 'Training', ICON.train, training],
  ['body', 'Körper', ICON.body, body],
  ['nutrition', 'Ernährung', ICON.food, nutrition],
  ['profile', 'Profil', ICON.profile, profile],
];

/* knowledge steht hier und nicht nur unter training, weil „Warum?“-Knöpfe auf jeder Seite die Karten öffnen */
const modules = [sheet, cards, suggestion, timer, today, training, workout, history, planedit, body, nutrition, profile, fields, onboarding, whatsnew, shifts, storage, knowledge];
/* Ein Modul kann Untermodule in `export const modules = [...]` nennen. Deren actions und inputs zählen mit. */
const flatten = list => list.flatMap(m => [m, ...flatten(m.modules || [])]);
const all = [...new Set(flatten(modules))];
const ACT = Object.assign({}, ...all.map(m => m.actions || {}));
const INPUT = Object.assign({}, ...all.map(m => m.inputs || {}));

ACT.tab = el => {
  V.tab = el.dataset.tab;
  /* Ein Tipp auf die Navigation schließt Unterseiten wie „Erfolge“ oder den ganzen Wochenbericht */
  V.motView = null;
  V.repView = null;
  V.cmpView = null;
  V.shiftView = null;
  V.setView = null;
  if (el.dataset.sub && V.tab === 'training') V.trainSub = el.dataset.sub;
  if (el.dataset.day && V.tab === 'training') V.planDay = el.dataset.day;
  if (V.tab === 'today') V.roll = true;
  render();
  window.scrollTo(0, 0);
};

/* Farbe des Bereichs: Tage in ihrer Scheibenfarbe, Körper weiß, Ernährung gelb, Profil grau */
function tone() {
  if (S.active && V.tab === 'training') return S.active.color;
  if (V.tab === 'today') return today.todayDay().d.color;
  return { body: 'white', nutrition: 'yellow', profile: 'steel' }[V.tab] || 'red';
}

function vNav() {
  const live = S.active ? S.active.color : 'red';
  return `<nav class="tabs day-${live}" aria-label="Bereiche"><div class="in">${TABS.map(([k, label, icon]) => `
    <button class="${V.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}" aria-current="${V.tab === k ? 'page' : 'false'}">
      ${icon}${label}${k === 'training' && S.active ? '<span class="live"></span>' : ''}</button>`).join('')}</div></nav>`;
}

const app = document.getElementById('app');
function render() {
  drawn = slot();
  if (V.recover) {
    app.innerHTML = `<main>${storage.recoverView()}</main>${sheet.vSheet('red')}`;
    return;
  }
  if (!S.settings.onboardingDone) {
    app.innerHTML = `<main class="ob-main">${onboarding.view()}</main>${sheet.vSheet('red')}`;
    return;
  }
  let view;
  if (V.summary) view = workout.vSummary();
  else if (V.shiftView) view = shifts.view();
  else view = (TABS.find(t => t[0] === V.tab) || TABS[0])[3].view();
  app.innerHTML = `<main>${storage.storageBanner()}${view}</main>${V.summary ? '' : timer.vTimer() + vNav()}${sheet.vSheet(tone())}`;
  timer.tick();
}

/* Tag und Viertelstunde des letzten Zeichnens. Eine Home-Bildschirm-App liegt oft stundenlang im Hintergrund;
   beim Zurückkommen sollen Datum, Schicht und Trainingsvorschlag stimmen (#58). */
let drawn = '';
/* Die Viertelstunde wechselt eine Minute nach :00, :15, :30 und :45, genau wie die aufgerundete Uhrzeit,
   mit der der Schichtplan für heute rechnet (shift-today.js, #59) */
const slot = (quarter = true) => {
  const d = new Date();
  return quarter ? `${ymd(d)} ${Math.ceil((d.getHours() * 60 + d.getMinutes()) / 15)}` : ymd(d);
};
/* Zuletzt eine Datei- oder Kamera-Auswahl geöffnet (Backup laden, Fortschrittsfoto)? Solange sie offen sein kann,
   wird nicht neu gezeichnet, sonst hinge das Eingabefeld nicht mehr auf der Seite und die Auswahl ginge verloren. */
let filePickAt = 0;
document.addEventListener('click', ev => {
  const label = ev.target.closest && ev.target.closest('label');
  const input = label ? label.control : ev.target.closest && ev.target.closest('input[type="file"]');
  if (input && input.type === 'file') filePickAt = Date.now();
}, true);
document.addEventListener('change', ev => { if (ev.target && ev.target.type === 'file') filePickAt = 0; }, true);
/* Nicht mitten in einer Eingabe oder bei offenem Fenster, sonst gingen Tastatur, Datumswähler oder Sheet verloren */
function refreshIfStale(quarter = true) {
  if (slot(quarter) === (quarter ? drawn : drawn.split(' ')[0])) return;
  if (V.sheet || V.recover) return;
  if (filePickAt && Date.now() - filePickAt < 30 * 60e3) return;
  const f = document.activeElement;
  if (f && /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName)) return;
  /* Neuer Tag: Die Auswahl auf der Scheibe von gestern gilt nicht mehr */
  if (slot(false) !== drawn.split(' ')[0]) { V.pick = null; V.roll = true; }
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}
setRender(render);

/* ---------- Ereignisse ---------- */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el);
});
const onField = ev => {
  const el = ev.target;
  const k = el.dataset && el.dataset.in;
  if (k && INPUT[k]) INPUT[k](el, ev.type);
};
document.addEventListener('input', onField);
document.addEventListener('change', onField);
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && V.sheet) sheet.closeSheet(); });
document.addEventListener('pointerdown', timer.unlockAudio, { once: true });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { timer.wake(); timer.tick(); refreshIfStale(); checkUpdate(); }
});
/* iOS zeichnet die erste Seite einer Home-Bildschirm-App manchmal gegen ihre Tippflächen verschoben.
   Ein Scroll-Abgleich nach dem Zeichnen richtet beides wieder aus; die Position bleibt dabei stehen. */
const settle = () => requestAnimationFrame(() => window.scrollTo(0, window.scrollY));
window.addEventListener('resize', settle);
window.addEventListener('pageshow', () => { refreshIfStale(); settle(); });
setInterval(timer.tick, 250);
/* Bleibt die App über Mitternacht offen, springt „Heute“ auf den neuen Tag */
setInterval(() => { if (document.visibilityState === 'visible') refreshIfStale(false); }, 60000);

/* ---------- Start ---------- */
load();
initImport();
render();
requestAnimationFrame(() => window.scrollTo(0, 0));
whatsnew.showIfNew();
if (S.active) timer.wake();
requestPersist();

/* Offline-Betrieb. Nur über http(s), nicht beim Öffnen als Datei. */
let swReg = null;
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').then(r => { swReg = r; }).catch(() => { /* läuft auch ohne */ });
}
/* Eine im Hintergrund gehaltene Home-Bildschirm-App sucht beim Zurückkehren nach einer neuen Version */
function checkUpdate() { if (swReg) swReg.update().catch(() => { /* offline */ }); }
