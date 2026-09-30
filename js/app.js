import { S, V, load, requestPersist } from './state.js';
import { setRender } from './render.js';
import { ICON } from './ui/icons.js';
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

const TABS = [
  ['today', 'Heute', ICON.today, today],
  ['training', 'Training', ICON.train, training],
  ['body', 'Körper', ICON.body, body],
  ['nutrition', 'Ernährung', ICON.food, nutrition],
  ['profile', 'Profil', ICON.profile, profile],
];

const modules = [sheet, cards, suggestion, timer, today, training, workout, history, planedit, body, nutrition, profile, fields, onboarding, whatsnew];
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
  if (!S.settings.onboardingDone) {
    app.innerHTML = `<main class="ob-main">${onboarding.view()}</main>${sheet.vSheet('red')}`;
    return;
  }
  let view;
  if (V.summary) view = workout.vSummary();
  else view = (TABS.find(t => t[0] === V.tab) || TABS[0])[3].view();
  app.innerHTML = `<main>${view}</main>${V.summary ? '' : timer.vTimer() + vNav()}${sheet.vSheet(tone())}`;
  timer.tick();
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
  if (document.visibilityState === 'visible') { timer.wake(); timer.tick(); checkUpdate(); }
});
/* iOS zeichnet die erste Seite einer Home-Bildschirm-App manchmal gegen ihre Tippflächen verschoben.
   Ein Scroll-Abgleich nach dem Zeichnen richtet beides wieder aus; die Position bleibt dabei stehen. */
const settle = () => requestAnimationFrame(() => window.scrollTo(0, window.scrollY));
window.addEventListener('resize', settle);
window.addEventListener('pageshow', settle);
setInterval(timer.tick, 250);

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
