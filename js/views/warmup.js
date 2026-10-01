/* Aufwärm-Vorschlag: bei der ersten schweren Grundübung des Tages und bei der ersten jeder neuen Muskelgruppe.
   Zählt nicht mit. „Aufwärmsätze übernehmen“ trägt die Rampe als Sätze vom Typ Aufwärmen ein. */
import { S, V, save } from '../state.js';
import { esc, fmt, fmtIn, toNum } from '../util.js';
import { render } from '../render.js';
import { findExercise } from '../domain/library.js';
import { plateSettings, nearestLoadable, loadBar, perSideText } from '../domain/plates.js';
import { barInfo } from './plates.js';
import { warmupRamp, warmupTargets, rampText, roundToStep, rampSets } from '../domain/warmup.js';
import { isWarmup } from '../domain/settypes.js';
import { lastLog } from '../domain/progression.js';

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
  /* Dieselbe Stange wie im Scheibenrechner: für die Übung gewählt oder passend zum Gerät */
  const bar = barInfo(x);
  const st = plateSettings(S.settings && S.settings.plates);
  const round = bar ? kg => nearestLoadable(kg, bar.kg, st.available) : roundToStep(x.inc > 0 ? x.inc : 2.5);
  const ramp = warmupRamp(work, { barKg: bar ? bar.kg : null, round });
  return ramp.length ? { ramp, work, bar, st } : null;
}

/* Erledigter Arbeitssatz: Die Rampe kommt zu spät, übernehmen lässt sie sich dann nicht mehr (#66) */
const workDone = x => x.log.some(s => s.done && !isWarmup(s));

/* Bekäme Übung i mit einem Gewicht einen Aufwärm-Vorschlag? Ob sie dran ist, hängt nur von ihr und den Übungen davor ab,
   nicht von ihrem Gewicht (domain/warmup.js). */
function rampPossible(x, i) {
  const a = S.active;
  if (!a || x.unit === 'sec') return false;
  return warmupTargets(a.ex.map((e, k) => ({ lib: libOf(e), workKg: k === i ? 1 : workKg(e) }))).includes(i);
}

/* Was die Zeile zeigt: die Rampe, einen Platzhalter oder nichts. key steht als data-ramp an der Zeile, damit workout.js
   nach einer Gewichtseingabe sieht, ob sich etwas geändert hat.
   Platzhalter (#66): Beim ersten Mal einer Übung gibt es die Rampe erst mit dem eingetragenen Gewicht. Die Zeile steht
   vorher schon da, gleich hoch, damit die Sätze darunter nicht verrutschen, wenn die Rampe erscheint. */
function lineOf(x, i) {
  const rf = rampFor(x, i);
  if (rf) return { rf, key: `${rampText(rf.ramp, fmt)}|${x.log.some(isWarmup) || workDone(x) ? 1 : 0}` };
  if (workDone(x) || x.log.some(isWarmup) || lastLog(S.sessions, x.exId, x.name) || !rampPossible(x, i)) return { key: '' };
  return { wait: workKg(x) > 0 ? 'light' : 'empty', key: workKg(x) > 0 ? 'wait-light' : 'wait' };
}
export const rampKey = (x, i) => lineOf(x, i).key;

/* Zwei Zeilen: oben klein „Aufwärmen“, darunter die Stufen oder der Platzhalter */
const head = (v, cls = 'num') => `<span class="wu-t"><span class="wu-k">Aufwärmen</span><span class="wu-v ${cls}">${v}</span></span>`;

/* Aufklappbare Zeile auf der Übungskarte. x: Übung der laufenden Einheit, i: Index in S.active.ex */
export function warmupLine(x, i) {
  const { rf, wait, key } = lineOf(x, i);
  if (wait) {
    return `<div class="wu wu-wait" data-ramp="${esc(key)}"><p class="wu-sum">${head(wait === 'light' ? 'Bei dem Gewicht nicht nötig' : 'Erst das Gewicht eintragen', '')}</p></div>`;
  }
  if (!rf) return '';
  const { ramp, work, bar, st } = rf;
  const taken = x.log.some(isWarmup);
  const late = !taken && workDone(x);
  const k = `${i}:${x.exId}`;
  const open = V.wuOpen && V.wuOpen[k];
  const plates = kg => {
    if (!bar) return '';
    const r = loadBar(kg, bar.kg, st.available);
    return r.status === 'exact' ? `je Seite ${perSideText(r.perSide, fmt)}` : r.status === 'bar' ? 'leere Stange' : '';
  };
  return `<details class="wu" data-ramp="${esc(key)}" ${open ? 'open' : ''}>
    <summary data-act="gymwu" data-key="${esc(k)}">${head(esc(rampText(ramp, fmt)))}</summary>
    <ul class="wu-list">${ramp.map(s => `
      <li><b class="num">${esc(fmt(s.kg))} kg × ${s.reps}</b>${bar ? `<span>${esc(plates(s.kg))}</span>` : ''}</li>`).join('')}</ul>
    <p class="small-print">Aus ${esc(fmt(work))} kg Arbeitsgewicht, kurze Pausen dazwischen. ${taken
      ? 'Steht als Aufwärmsätze (A) in der Liste und zählt nicht mit.'
      : late ? 'Zählt nicht mit. Der erste Arbeitssatz ist schon erledigt, darum lassen sich die Aufwärmsätze nicht mehr übernehmen.'
        : 'Zählt nicht mit. Übernommen stehen die Stufen als Aufwärmsätze (A) in der Liste, zum Abhaken.'}</p>
    ${taken || late ? '' : `<div class="wu-take"><button class="btn small" data-act="wutake" data-i="${i}">Aufwärmsätze übernehmen</button></div>`}
  </details>`;
}

export const actions = {
  /* Rampe als Aufwärmsätze vor die Arbeitssätze setzen, nur einmal pro Übung */
  wutake: el => {
    const i = +el.dataset.i;
    const x = S.active && S.active.ex[i];
    if (!x || x.log.some(isWarmup) || workDone(x)) return;
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
