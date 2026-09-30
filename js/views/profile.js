import { S } from '../state.js';
import { fName, fBirth, fSex, fHeight, fWeight, fGoal, fActivity, fDays, fLimits } from './profile-fields.js';
import * as settings from './settings.js';

/* Untermodule, deren actions und inputs app.js einsammelt */
export const modules = [settings];

/* Profil: nur was den Nutzer beschreibt. Alles Übrige steht unter Einstellungen (Zahnrad). */
export function view() {
  const sub = settings.subview();
  if (sub) return sub;
  const p = S.profile;
  return `<div class="day-steel">
    <div class="set-head"><h1 class="page-title">Profil</h1>${settings.gearButton()}</div>
    <p class="page-sub">Jede Änderung wird sofort gespeichert.</p>

    <section class="block p-section"><h2>Über dich</h2>
      <div class="fields">${fName(p)}${fBirth(p)}${fSex(p)}<div class="row2">${fHeight(p)}${fWeight(p)}</div></div>
    </section>
    <section class="p-section"><h2>Ziel</h2>${fGoal(p)}</section>
    <section class="p-section"><h2>Alltag und Training</h2>${fActivity(p)}<div style="margin-top:16px">${fDays(p)}</div></section>
    <section class="p-section"><h2>Einschränkungen</h2>${fLimits(p)}</section>

    ${settings.settingsLink()}
    ${settings.versionLine()}
  </div>`;
}

export const actions = {};
