/* Aufwärm-Vorschlag: bei der ersten schweren Grundübung des Tages und bei der ersten jeder neuen Muskelgruppe.
   Zählt nicht mit. „Aufwärmsätze übernehmen“ trägt die Rampe als Sätze vom Typ Aufwärmen ein. */
import { S, V, save } from '../state.js';
import { esc, fmt, fmtIn, toNum } from '../util.js';
import { render } from '../render.js';
import { findExercise } from '../domain/library.js';
import { plateSettings, barFor, nearestLoadable, loadBar, perSideText } from '../domain/plates.js';
import { warmupRamp, warmupTargets, rampText, roundToStep, rampSets } from '../domain/warmup.js';
import { isWarmup } from '../domain/settypes.js';

const libOf = x => findExercise(x.name, S.exercisesCustom);

/* Arbeitsgewicht des ersten Arbeitssatzes: eingetragen oder grauer Vorschlag */
function workKg(x) {
  const s = x.log.find(t => !isWarmup(t));
  if (!s) return 0;
  const w = s.w !== '' ? toNum(s.w) : toNum(s.pw);
  return w > 0 ? w : 0;
}

/* Rampe für Übung i der laufenden Einheit oder null, wenn sie keinen Aufwärm-Vorschlag bekommt */
function rampFor(x, i) {
  const a = S.active;
  if (!a || x.unit === 'sec') return null;
  const targets = warmupTargets(a.ex.map(e => ({ lib: libOf(e), workKg: workKg(e) })));
  if (!targets.includes(i)) return null;
  const work = workKg(x);
  const bar = barFor(libOf(x), S.settings && S.settings.plates);
  const st = plateSettings(S.settings && S.settings.plates);
  const round = bar ? kg => nearestLoadable(kg, bar.kg, st.available) : roundToStep(x.inc > 0 ? x.inc : 2.5);
  const ramp = warmupRamp(work, { barKg: bar ? bar.kg : null, round });
  return ramp.length ? { ramp, work, bar, st } : null;
}

/* Aufklappbare Zeile auf der Übungskarte. x: Übung der laufenden Einheit, i: Index in S.active.ex */
export function warmupLine(x, i) {
  const rf = rampFor(x, i);
  if (!rf) return '';
  const { ramp, work, bar, st } = rf;
  const taken = x.log.some(isWarmup);
  const key = `${i}:${x.exId}`;
  const open = V.wuOpen && V.wuOpen[key];
  const plates = kg => {
    if (!bar) return '';
    const r = loadBar(kg, bar.kg, st.available);
    return r.status === 'exact' ? `je Seite ${perSideText(r.perSide, fmt)}` : r.status === 'bar' ? 'leere Stange' : '';
  };
  return `<details class="wu" ${open ? 'open' : ''}>
    <summary data-act="gymwu" data-key="${esc(key)}"><span class="wu-k">Aufwärmen</span> <span class="num">${esc(rampText(ramp, fmt))}</span></summary>
    <ul class="wu-list">${ramp.map(s => `
      <li><b class="num">${esc(fmt(s.kg))} kg × ${s.reps}</b>${bar ? `<span>${esc(plates(s.kg))}</span>` : ''}</li>`).join('')}</ul>
    <p class="small-print">Aus ${esc(fmt(work))} kg Arbeitsgewicht, kurze Pausen dazwischen. ${taken
      ? 'Steht als Aufwärmsätze (A) in der Liste und zählt nicht mit.'
      : 'Zählt nicht mit. Übernommen stehen die Stufen als Aufwärmsätze (A) in der Liste, zum Abhaken.'}</p>
    ${taken ? '' : `<div class="wu-take"><button class="btn small" data-act="wutake" data-i="${i}">Aufwärmsätze übernehmen</button></div>`}
  </details>`;
}

export const actions = {
  /* Rampe als Aufwärmsätze vor die Arbeitssätze setzen, nur einmal pro Übung */
  wutake: el => {
    const i = +el.dataset.i;
    const x = S.active && S.active.ex[i];
    if (!x || x.log.some(isWarmup)) return;
    const rf = rampFor(x, i);
    if (!rf) return;
    x.log.unshift(...rampSets(rf.ramp, fmtIn));
    save(); render();
  },
  /* Merkt sich, ob die Zeile offen ist; das Auf- und Zuklappen selbst macht der Browser */
  gymwu: el => {
    const key = el.dataset.key;
    const det = el.closest('details');
    V.wuOpen = V.wuOpen || {};
    V.wuOpen[key] = det ? !det.open : !V.wuOpen[key];
  },
};

export const inputs = {};
