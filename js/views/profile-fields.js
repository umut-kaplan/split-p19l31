/* Felder, die Profil und Einrichtung gemeinsam nutzen. Jede Eingabe speichert sofort. */
import { S, save } from '../state.js';
import { esc, fmtIn, toNum } from '../util.js';
import { render } from '../render.js';
import { ACTIVITY, GOALS } from '../domain/energy.js';
import { SEX, EQUIPMENT, LIMIT_TAGS } from '../domain/profile-options.js';
import { currentWeight } from '../domain/body.js';
import { toast } from '../ui/toast.js';
import { recordWeight } from './body.js';

const RANGE = {
  age: [10, 100, 'Alter in Jahren eintragen, z. B. 28'],
  heightCm: [120, 230, 'Größe in cm eintragen, z. B. 180'],
  weightKg: [30, 300, 'Gewicht in kg eintragen, z. B. 82,4'],
};

const numField = (label, k, val, unit, mode) => `<label class="field">${label}
  <span class="unit-wrap"><input data-in="pf" data-k="${k}" inputmode="${mode}" value="${val == null ? '' : esc(fmtIn(val))}"><span>${unit}</span></span></label>`;

const chip = (act, k, v, label, on) =>
  `<button class="chip ${on ? 'on' : ''}" aria-pressed="${on}" data-act="${act}" data-k="${k}" data-v="${esc(v)}">${esc(label)}</button>`;

export const fName = p => `<label class="field">Vorname
  <input data-in="pf" data-k="name" value="${esc(p.name)}" autocomplete="given-name" maxlength="30" placeholder="Vorname"></label>`;
export const fAge = p => numField('Alter', 'age', p.age, 'Jahre', 'numeric');
export const fHeight = p => numField('Größe', 'heightCm', p.heightCm, 'cm', 'numeric');
export const fWeight = () => numField('Gewicht', 'weightKg', currentWeight(S.profile, S.body.weights), 'kg', 'decimal');
export const fSex = p => `<div><p class="label">Geschlecht</p>
  <div class="chips">${Object.entries(SEX).map(([k, l]) => chip('pset', 'sex', k, l, p.sex === k)).join('')}</div>
  <p class="small-print" style="margin-top:6px">Nur für die Formel des Grundumsatzes.</p></div>`;

export const fGoal = p => `<div class="choices">${Object.entries(GOALS).map(([k, g]) =>
  `<button class="choice ${p.goal === k ? 'on' : ''}" aria-pressed="${p.goal === k}" data-act="pset" data-k="goal" data-v="${k}"><b>${esc(g.label)}</b><span>${esc(g.hint)}</span></button>`).join('')}</div>`;

export const fActivity = p => `<div class="choices">${Object.entries(ACTIVITY).map(([k, a]) =>
  `<button class="choice ${p.activity === k ? 'on' : ''}" aria-pressed="${p.activity === k}" data-act="pset" data-k="activity" data-v="${k}"><b>${esc(a.label)}</b><span>${esc(a.hint)}</span></button>`).join('')}</div>
  <p class="small-print" style="margin-top:8px">Nur dein Alltag ohne Sport. Das Training rechnet die App aus deinen eingetragenen Einheiten dazu.</p>`;

export const fDays = p => `<div><p class="label">Trainingstage pro Woche</p>
  <div class="stepper">
    <button class="icon" data-act="pdays" data-d="-1" aria-label="Ein Tag weniger" ${p.daysPerWeek <= 1 ? 'disabled' : ''}>−</button>
    <b aria-live="polite">${p.daysPerWeek}</b>
    <button class="icon" data-act="pdays" data-d="1" aria-label="Ein Tag mehr" ${p.daysPerWeek >= 7 ? 'disabled' : ''}>+</button>
  </div>
  <p class="small-print" style="margin-top:6px">Danach zählt die Serie auf der Startseite.</p></div>`;

export const fEquipment = p => `<div class="chips">${EQUIPMENT.map(e => chip('ptoggle', 'equipment', e, e, p.equipment.includes(e))).join('')}</div>
  <div style="margin-top:12px"><button class="btn small ghost" data-act="pequipall">Alles, was ein Studio hat</button></div>`;

export const fLimits = p => `<div class="chips">${LIMIT_TAGS.map(t => chip('ptoggle', 'tags', t, t, p.limitations.tags.includes(t))).join('')}</div>
  <label class="field" style="margin-top:14px">Was genau?
    <textarea data-in="pf" data-k="limitText" maxlength="300" placeholder="z. B. Knie links zwickt bei tiefen Kniebeugen">${esc(p.limitations.text)}</textarea></label>`;

export const actions = {
  pset: el => { S.profile[el.dataset.k] = el.dataset.v; save(); render(); },
  ptoggle: el => {
    const list = el.dataset.k === 'tags' ? S.profile.limitations.tags : S.profile.equipment;
    const v = el.dataset.v;
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1); else list.push(v);
    save(); render();
  },
  pequipall: () => { S.profile.equipment = EQUIPMENT.slice(); save(); render(); },
  pdays: el => {
    S.profile.daysPerWeek = Math.max(1, Math.min(7, (S.profile.daysPerWeek || 3) + Number(el.dataset.d)));
    save(); render();
  },
};

export const inputs = {
  pf: (el, type) => {
    const k = el.dataset.k;
    if (k === 'name') { S.profile.name = el.value.trim(); save(); return; }
    if (k === 'limitText') { S.profile.limitations.text = el.value; save(); return; }
    if (type !== 'change') return;
    const n = toNum(el.value);
    const [lo, hi, msg] = RANGE[k];
    if (el.value.trim() === '') { if (k !== 'weightKg') S.profile[k] = null; save(); return; }
    if (!(n >= lo && n <= hi)) { toast(msg); return; }
    if (k === 'weightKg') recordWeight(n, S.settings.onboardingDone ? 'profile' : 'onboarding');
    else S.profile[k] = k === 'age' ? Math.round(n) : n;
    save();
  },
};
