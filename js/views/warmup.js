/* Aufwärm-Vorschlag: bei der ersten schweren Grundübung des Tages und bei der ersten jeder neuen Muskelgruppe.
   Wird nicht eingetragen, Aufwärmsätze zählen laut Plan nicht. */
import { S, V } from '../state.js';
import { esc, fmt, toNum } from '../util.js';
import { findExercise } from '../domain/library.js';
import { plateSettings, barFor, nearestLoadable, loadBar, perSideText } from '../domain/plates.js';
import { warmupRamp, warmupTargets, rampText, roundToStep } from '../domain/warmup.js';

const libOf = x => findExercise(x.name, S.exercisesCustom);

/* Arbeitsgewicht des ersten Satzes: eingetragen oder grauer Vorschlag */
function workKg(x) {
  const s = x.log[0];
  if (!s) return 0;
  const w = s.w !== '' ? toNum(s.w) : toNum(s.pw);
  return w > 0 ? w : 0;
}

/* Aufklappbare Zeile auf der Übungskarte. x: Übung der laufenden Einheit, i: Index in S.active.ex */
export function warmupLine(x, i) {
  const a = S.active;
  if (!a || x.unit === 'sec') return '';
  const targets = warmupTargets(a.ex.map(e => ({ lib: libOf(e), workKg: workKg(e) })));
  if (!targets.includes(i)) return '';
  const work = workKg(x);
  const bar = barFor(libOf(x), S.settings && S.settings.plates);
  const st = plateSettings(S.settings && S.settings.plates);
  const round = bar ? kg => nearestLoadable(kg, bar.kg, st.available) : roundToStep(x.inc > 0 ? x.inc : 2.5);
  const ramp = warmupRamp(work, { barKg: bar ? bar.kg : null, round });
  if (!ramp.length) return '';
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
    <p class="small-print">Zählt nicht mit, nicht abhaken. Aus ${esc(fmt(work))} kg Arbeitsgewicht, kurze Pausen dazwischen.</p>
  </details>`;
}

export const actions = {
  /* Merkt sich, ob die Zeile offen ist; das Auf- und Zuklappen selbst macht der Browser */
  gymwu: el => {
    const key = el.dataset.key;
    const det = el.closest('details');
    V.wuOpen = V.wuOpen || {};
    V.wuOpen[key] = det ? !det.open : !V.wuOpen[key];
  },
};

export const inputs = {};
