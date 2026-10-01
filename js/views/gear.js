/* Geräteseite (4.7): Schnellauswahl, Zusatzschalter Smart-Zirkel, die 59 Gerätetypen in sechs aufklappbaren Gruppen
   zum Abhaken, Zähler je Gruppe, „Alles abwählen“. Steht unter Einstellungen → Studio und in der Einrichtung
   (fEquipment über profile-fields.js). Dazu die Kurzhantel-Steigerung für Einstellungen → Studio.
   Regeln und Daten: domain/equipment.js, data/equipment.js. Jede Änderung speichert sofort. */
import { S, V, save } from '../state.js';
import { esc, fmt } from '../util.js';
import { render } from '../render.js';
import { toast } from '../ui/toast.js';
import {
  EQUIPMENT, EQUIPMENT_GROUPS, PRESETS, SMART_CIRCUIT, groupEquipment, presetEquipment, applyPreset, matchingPreset,
  hasSmartCircuit, toggleEquipment, toggleSmartCircuit, clearEquipment, groupCount, coveredBy, shortEquipmentName,
  expandEquipment, migrateProfileEquipment,
} from '../domain/equipment.js';
import { NEEDS } from '../data/equipment.js';
import { findExercise, usesDumbbells, DUMBBELL_INCS, cleanDumbbellInc } from '../domain/library.js';

/* Erklärung unter jeder Schnellauswahl; n: Zahl der Geräte */
const PRESET_HINT = {
  gross: n => (n === EQUIPMENT.length ? `Alle ${n} Gerätetypen` : `${n} Gerätetypen`),
  discount: n => `${n} Geräte, die dort fast immer stehen`,
  zuhause: () => 'Kurzhanteln und Bänder, den Rest hakst du an',
};

const ids = p => migrateProfileEquipment(p && p.equipment);
/* „(z. B. EGYM)“ bricht nicht mitten in der Klammer um */
export const keepTogether = t => String(t).replace(/\([^)]*\)/g, m => m.replace(/ /g, '\u00a0'));
const deviceCount = list => list.filter(id => id !== SMART_CIRCUIT.id).length;

/* Was die Auswahl bewirkt, ein Satz unter der Liste */
export function equipmentStatus(list) {
  const n = deviceCount(list);
  if (!n && !hasSmartCircuit(list)) return 'Nichts angehakt: Die App zeigt Übungen für alle Geräte.';
  if (!n) return 'Nur der Smart-Zirkel: Die App zeigt seine Übungen und Übungen ohne Geräte.';
  return 'Bibliothek und Übungsauswahl im Plan zeigen zuerst, was mit diesen Geräten geht.';
}

function item(e, list, have) {
  const on = list.includes(e.id);
  const cov = on ? null : coveredBy(list, e.id);
  const need = on && !have.has(e.id) ? NEEDS.find(r => r.id === e.id) : null;
  const sub = cov ? `<small class="gear-cov">Abgedeckt über ${esc(cov.map(shortEquipmentName).join(' + '))}</small>`
    : need ? `<small class="gear-warn">Zählt erst mit ${esc(need.needs.map(shortEquipmentName).join(' + '))}</small>`
      : e.note ? `<small>${esc(e.note)}</small>` : '';
  return `<button class="gear-item ${on ? 'on' : ''} ${cov ? 'cov' : ''}" role="checkbox" aria-checked="${on}" data-act="geartoggle" data-v="${esc(e.id)}">
    <i class="gear-box" aria-hidden="true"></i><span class="gear-t"><b>${esc(e.name)}</b>${sub}</span></button>`;
}

function group(g, list, have) {
  const c = groupCount(list, g.id);
  const open = !!(V.gearOpen && V.gearOpen[g.id]);
  return `<details class="gear-group" ${open ? 'open' : ''}>
    <summary data-act="geargroup" data-g="${esc(g.id)}" aria-label="${esc(g.name)}, ${c.on} von ${c.total} angehakt">
      <span class="gear-gn">${esc(g.name)}</span><span class="gear-cnt num ${c.on ? 'on' : ''}">${c.on}/${c.total}</span></summary>
    <div class="gear-items">${groupEquipment(g.id).map(e => item(e, list, have)).join('')}</div>
  </details>`;
}

/* Die ganze Geräteauswahl. p: Profil (S.profile) */
export function fEquipment(p) {
  const list = ids(p);
  const have = expandEquipment(list);
  const preset = matchingPreset(list);
  const smart = hasSmartCircuit(list);
  const n = deviceCount(list);
  return `<div class="gear">
    <p class="label">Schnellauswahl</p>
    <div class="choices gear-presets" role="group" aria-label="Schnellauswahl">${PRESETS.map(x => {
      const on = preset === x.id;
      return `<button class="choice ${on ? 'on' : ''}" aria-pressed="${on}" data-act="gearpreset" data-v="${esc(x.id)}">
        <b>${esc(x.name)}</b><span>${esc(PRESET_HINT[x.id](presetEquipment(x.id).length))}</span></button>`;
    }).join('')}</div>
    <button class="cmp-switch gear-smart" role="switch" aria-checked="${smart}" data-act="gearsmart">
      <span class="gear-t"><b>${esc(keepTogether(SMART_CIRCUIT.label))}</b><small>Geräte, die das Gewicht selbst einstellen. Passt zu jeder Auswahl.</small></span><i aria-hidden="true"></i></button>
    <div class="gear-head">
      <p class="label">Geräte <span class="num">${n} von ${EQUIPMENT.length}</span></p>
      <button class="link gear-clear" data-act="gearclear" ${n ? '' : 'disabled'}>Alles abwählen</button>
    </div>
    <div class="gear-groups">${EQUIPMENT_GROUPS.map(g => group(g, list, have)).join('')}</div>
    <p class="small-print gear-status">${esc(equipmentStatus(list))}</p>
  </div>`;
}

/* ---------- Kurzhantel-Steigerung ---------- */
const libOf = e => (e.names || []).map(nm => findExercise(nm, S.exercisesCustom || [])).find(Boolean) || null;

/* Plan-Einträge mit Kurzhanteln, deren Steigerung von inc abweicht (Smart-Zirkel, Übungen auf Zeit und
   Einträge ohne Steigerung ausgenommen). plans: S.plans, custom: S.exercisesCustom. */
export function dumbbellEntries(plans, inc, lib = libOf) {
  const out = [];
  (plans || []).forEach(p => Object.values(p.days || {}).forEach(d => (d.exercises || []).forEach(e => {
    const l = lib(e);
    if (!l || !usesDumbbells(l) || l.autoLoad || e.unit === 'sec' || !(e.inc > 0) || e.inc === inc) return;
    out.push(e);
  })));
  return out;
}

export function dumbbellSection() {
  const inc = cleanDumbbellInc(S.settings.dumbbellInc);
  const n = dumbbellEntries(S.plans, inc).length;
  return `<section class="p-section gear-db"><h2>Kurzhanteln</h2>
    <p class="label">Steigerung</p>
    <div class="seg wide" role="radiogroup" aria-label="Steigerung bei Kurzhanteln">${DUMBBELL_INCS.map(v =>
      `<button role="radio" aria-checked="${v === inc}" class="${v === inc ? 'on' : ''}" data-act="geardbinc" data-v="${v}">${esc(fmt(v))} kg</button>`).join('')}</div>
    <p class="small-print" style="margin-top:8px">Um so viel schlägt die App mehr Gewicht vor, wenn alle Sätze einer Kurzhantel-Übung das obere Ende erreichen. Gilt für Übungen, die du neu in einen Plan aufnimmst.</p>
    ${n ? `<p class="small-print gear-dbapply">${n === 1 ? 'Eine Kurzhantel-Übung' : `${n} Kurzhantel-Übungen`} in deinen Plänen ${n === 1 ? 'steigt' : 'steigen'} in anderen Schritten.
      <button class="link" data-act="geardbapply">Auf ${esc(fmt(inc))} kg angleichen</button></p>` : ''}
  </section>`;
}

/* ---------- Hinweis nach dem Update ----------
   Einmal nach dem Update auf 4.7 auf „Heute“: Die Geräte kamen aus den neun Kategorien bis 4.6 (store/migrate.js setzt
   dann S.settings.gearCheck). „Geräte prüfen“ öffnet Einstellungen · Studio, „Passt so“ blendet den Hinweis aus. */
export function gearCheckCard() {
  if (!S.settings.gearCheck) return '';
  const n = deviceCount(ids(S.profile));
  return `<section class="block card notice gear-check">
    <h2>Neu: Geräte deines Studios</h2>
    <p style="margin-bottom:0">Prüf kurz, ob alles stimmt. Deine bisherige Auswahl steht jetzt als ${n} ${n === 1 ? 'einzelnes Gerät' : 'einzelne Geräte'} unter Einstellungen · Studio.</p>
    <div class="sug-btns">
      <button class="btn small primary" data-act="gearcheckgo">Geräte prüfen</button>
      <button class="btn small ghost" data-act="gearcheckok">Passt so</button>
    </div>
  </section>`;
}

/* ---------- Aktionen ---------- */
const setEquipment = list => { S.profile.equipment = list; save(); render(); };

export const actions = {
  /* Zur Geräteseite wie ein Tipp auf Einstellungen · Studio; Unterseiten schließen wie beim Geburtsdatum */
  gearcheckgo: () => {
    S.settings.gearCheck = false;
    save();
    Object.assign(V, { tab: 'profile', setView: 'studio', motView: null, repView: null, cmpView: null, shiftView: null });
    render(); window.scrollTo(0, 0);
  },
  gearcheckok: () => { S.settings.gearCheck = false; save(); render(); },
  gearpreset: el => setEquipment(applyPreset(S.profile.equipment, el.dataset.v)),
  gearsmart: () => setEquipment(toggleSmartCircuit(S.profile.equipment)),
  geartoggle: el => setEquipment(toggleEquipment(S.profile.equipment, el.dataset.v)),
  gearclear: () => setEquipment(clearEquipment(S.profile.equipment)),
  /* Merkt sich, ob eine Gruppe offen ist; das Auf- und Zuklappen selbst macht der Browser */
  geargroup: el => {
    const det = el.closest('details');
    V.gearOpen = V.gearOpen || {};
    V.gearOpen[el.dataset.g] = det ? !det.open : !V.gearOpen[el.dataset.g];
  },
  geardbinc: el => {
    const v = cleanDumbbellInc(Number(el.dataset.v));
    if (v === S.settings.dumbbellInc) return;
    S.settings.dumbbellInc = v;
    save(); render();
  },
  geardbapply: () => {
    const inc = cleanDumbbellInc(S.settings.dumbbellInc);
    const list = dumbbellEntries(S.plans, inc);
    if (!list.length) return;
    list.forEach(e => { e.inc = inc; });
    save(); render();
    toast(`${list.length} ${list.length === 1 ? 'Übung steigt' : 'Übungen steigen'} jetzt in ${fmt(inc)}-kg-Schritten`);
  },
};
