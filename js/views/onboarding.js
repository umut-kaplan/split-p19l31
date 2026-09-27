import { S, V, save } from '../state.js';
import { esc, fmt0 } from '../util.js';
import { render } from '../render.js';
import { calorieGoal, waterGoal } from '../domain/energy.js';
import { plateSVG } from '../ui/plate.js';
import { profileNow } from '../ui/cards.js';
import { fName, fAge, fSex, fHeight, fWeight, fGoal, fActivity, fDays, fEquipment, fLimits } from './profile-fields.js';

const STEPS = [
  {
    title: () => 'Willkommen bei Split',
    text: 'Richte die App in einer Minute ein. Jeder Schritt lässt sich überspringen, und alles ist später im Profil änderbar.',
    body: () => `<div class="plate-btn roll">${plateSVG('red', 'Split', 'Training, Körper, Ernährung')}</div>`,
  },
  { title: () => 'Wie heißt du?', text: 'Damit die App dich begrüßen kann.', body: p => `<div class="fields">${fName(p)}</div>` },
  {
    title: () => 'Ein paar Eckdaten',
    text: 'Daraus rechnet die App BMI, Kalorien- und Wasserziel. Die Werte bleiben auf deinem Handy.',
    body: p => `<div class="fields">${fAge(p)}${fSex(p)}<div class="row2">${fHeight(p)}${fWeight(p)}</div></div>`,
  },
  { title: () => 'Was ist dein Ziel?', text: 'Davon hängt dein Kalorienziel ab.', body: fGoal },
  {
    title: () => 'Wie aktiv bist du?',
    text: 'Zähle Arbeit und Training zusammen.',
    body: p => `${fActivity(p)}<div style="margin-top:22px">${fDays(p)}</div>`,
  },
  { title: () => 'Welche Geräte hast du?', text: 'Tippe alles an, was du im Studio nutzen kannst.', body: fEquipment },
  {
    title: () => 'Gibt es Einschränkungen?',
    text: 'Zum Beispiel ein empfindliches Knie. Die App soll das später bei Übungsvorschlägen berücksichtigen.',
    body: fLimits,
  },
  {
    title: p => (p.name ? `Alles bereit, ${p.name}` : 'Alles bereit'),
    text: 'Deine Startwerte:',
    body: () => {
      const p = profileNow();
      const cg = calorieGoal(p);
      return `<ul class="rules">
        <li>${cg.ok ? `Kalorienziel: <b class="num">${fmt0(cg.kcal)} kcal</b> am Tag` : `Für das Kalorienziel fehlt noch: ${esc(cg.missing.join(', '))}`}</li>
        <li>Wasser: <b class="num">${(waterGoal(p.weightKg) / 1000).toLocaleString('de-DE')} l</b> am Tag</li>
        <li>Serie: <b>${p.daysPerWeek}</b> Einheiten pro Woche</li>
      </ul>`;
    },
  },
];

export function view() {
  const i = Math.min(V.ob, STEPS.length - 1);
  const st = STEPS[i];
  const last = i === STEPS.length - 1;
  const p = S.profile;
  return `<div class="ob day-red">
    <div class="ob-top">
      ${i > 0 ? '<button class="link" data-act="obback">Zurück</button>' : '<span></span>'}
      <div class="ob-dots" aria-label="Schritt ${i + 1} von ${STEPS.length}">${STEPS.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
    </div>
    <div class="ob-body">
      <h1>${esc(st.title(p))}</h1>
      <p>${esc(st.text)}</p>
      ${st.body(p)}
    </div>
    <div class="ob-foot">
      <button class="btn primary" data-act="${last ? 'obdone' : 'obnext'}">${i === 0 ? 'Einrichten' : last ? 'Los geht’s' : 'Weiter'}</button>
      ${last ? '' : `<button class="btn ghost" data-act="${i === 0 ? 'obdone' : 'obnext'}">${i === 0 ? 'Einrichtung überspringen' : 'Überspringen'}</button>`}
    </div>
  </div>`;
}

const go = n => {
  if (document.activeElement) document.activeElement.blur();
  V.ob = Math.max(0, Math.min(STEPS.length - 1, n));
  render(); window.scrollTo(0, 0);
};

export const actions = {
  obnext: () => go(V.ob + 1),
  obback: () => go(V.ob - 1),
  obdone: () => {
    S.settings.onboardingDone = true;
    V.ob = 0; V.tab = 'today'; V.roll = true;
    save(); render(); window.scrollTo(0, 0);
  },
};
