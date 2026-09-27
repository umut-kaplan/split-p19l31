/* Umfänge, Körperfett und Silhouette */
import { S, V, save } from '../state.js';
import { esc, fmt1, toNum, ymd, dShort, dMid } from '../util.js';
import { render } from '../render.js';
import {
  MEASURES, mergeByDate, measurementDeltas, measurementSinceFirst, missingForNavy,
  latestComposition, leanMass, currentWeight,
} from '../domain/body.js';
import { silhouetteSVG, silhouetteScales } from '../ui/silhouette.js';
import { toast } from '../ui/toast.js';
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';

export const METHODS = { scale: 'Körperfettwaage', caliper: 'Hautfaltenzange', dexa: 'DEXA-Messung', other: 'Andere Messung' };
const day = d => dShort(d + 'T12:00');
const signed = v => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt1(Math.abs(v))}`;

export function vMeasures() {
  return `${compositionCard()}${measurementsCard()}${silhouetteCard()}`;
}

/* ---------- Körperfett ---------- */
function compositionCard() {
  const p = S.profile;
  const comp = latestComposition(p, S.body);
  const kg = currentWeight(p, S.body.weights);
  const measured = [...(S.body.composition || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  let head;
  if (comp) {
    const lean = leanMass(kg, comp.bfPct);
    head = `<div class="bf-top">
        <p class="bf-val num">${fmt1(comp.bfPct)}<small>% Körperfett</small></p>
        <span class="bf-tag ${comp.measured ? 'measured' : ''}">${comp.measured ? 'gemessen' : 'geschätzt'}</span>
      </div>
      <p class="muted">${comp.measured
        ? `${esc(METHODS[comp.method] || 'Messung')} am ${esc(day(comp.date))}`
        : `Nach der US-Navy-Formel aus Größe und den Umfängen vom ${esc(day(comp.date))} Abweichungen von 3 bis 4 Prozentpunkten sind normal.`}</p>
      ${lean ? `<div class="bf-split">
        <div><b class="num">${fmt1(lean)} kg</b><span>fettfreie Masse</span></div>
        <div><b class="num">${fmt1(kg - lean)} kg</b><span>Fettmasse</span></div>
      </div>
      <p class="small-print">Aus ${fmt1(kg)} kg Körpergewicht. Die fettfreie Masse umfasst Muskeln, Knochen, Organe und Wasser.</p>` : ''}`;
  } else {
    const miss = missingForNavy(p, S.body.measurements);
    head = `<p class="muted" style="margin-top:4px">Noch kein Wert. Trag einen gemessenen Wert ein oder deine Umfänge, dann schätzt die App nach der US-Navy-Formel.
      ${miss.length ? `Für die Schätzung fehlt noch: ${esc(miss.join(', '))}.` : ''}</p>`;
  }
  return `<section class="block card">
    <h2>Körperfett</h2>
    ${head}
    <div class="stack"><button class="btn" data-act="bodybfadd">Gemessenen Wert eintragen</button></div>
    ${measured.length ? `<details class="more"><summary>Gemessene Werte (${measured.length})</summary>
      <ul class="b-list">${measured.map(c => `<li><span>${esc(dMid(c.date + 'T12:00'))} <small>${esc(METHODS[c.method] || '')}</small></span>
        <span><b class="num">${fmt1(c.bfPct)} %</b>
        <button class="icon b-del" data-act="bodybfdel" data-date="${c.date}" aria-label="Wert vom ${esc(day(c.date))} löschen">×</button></span></li>`).join('')}</ul>
    </details>` : ''}
  </section>`;
}

function addComposition() {
  openSheet({
    title: 'Gemessenes Körperfett',
    text: 'Zum Beispiel von einer Körperfettwaage, einer Hautfaltenzange oder einer DEXA-Messung.',
    body: `<div class="form">
      <label>Körperfett in %<input id="bf-val" inputmode="decimal" placeholder="z. B. 18,5"></label>
      <label>Methode<select id="bf-method">${Object.entries(METHODS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <label>Datum<input id="bf-date" type="date" value="${ymd()}" max="${ymd()}"></label>
    </div>`,
    actions: [
      { label: 'Speichern', kind: 'primary', fn: () => {
        const bf = toNum(document.getElementById('bf-val').value);
        const date = document.getElementById('bf-date').value || ymd();
        if (!(bf >= 3 && bf <= 60)) { toast('Körperfett in Prozent eintragen, z. B. 18,5'); return; }
        if (date > ymd()) { toast('Das Datum liegt in der Zukunft.'); return; }
        const method = document.getElementById('bf-method').value;
        S.body.composition = mergeByDate(S.body.composition, { date, bfPct: bf, method, source: 'manual', measured: true });
        save(); closeSheet(); toast('Messwert gespeichert');
      } },
      { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
    ],
  });
}

/* ---------- Umfänge ---------- */
function measurementsCard() {
  const d = measurementDeltas(S.body.measurements);
  const keys = MEASURES.filter(m => d[m.key]);
  const entries = [...(S.body.measurements || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  return `<section class="block card">
    <h2>Umfänge</h2>
    ${keys.length ? `<table class="m-table">
      <thead><tr><th scope="col">Maß</th><th scope="col">Zuletzt</th><th scope="col">Veränderung</th></tr></thead>
      <tbody>${keys.map(({ key, label }) => {
        const x = d[key];
        return `<tr><th scope="row">${esc(label)}</th>
          <td class="num">${fmt1(x.value)} cm<small>${esc(day(x.date))}</small></td>
          <td class="num">${x.delta == null ? '<span class="dim">erster Wert</span>' : `${signed(x.delta)} cm<small>seit ${esc(day(x.prevDate))}</small>`}</td></tr>`;
      }).join('')}</tbody></table>`
      : '<p class="muted" style="margin-top:4px">Noch keine Umfänge. Einmal im Monat messen reicht, am besten morgens vor dem Training.</p>'}
    <div class="stack"><button class="btn primary" data-act="bodymadd">Umfänge eintragen</button></div>
    ${entries.length ? `<details class="more"><summary>Alle Einträge (${entries.length})</summary>
      <ul class="b-list">${entries.map(m => `<li><span>${esc(dMid(m.date + 'T12:00'))}
        <small>${esc(MEASURES.filter(x => m[x.key] > 0).length)} Maße</small></span>
        <button class="icon b-del" data-act="bodymdel" data-date="${m.date}" aria-label="Umfänge vom ${esc(day(m.date))} löschen">×</button></li>`).join('')}</ul>
    </details>` : ''}
  </section>`;
}

function addMeasurements() {
  const last = measurementDeltas(S.body.measurements);
  openSheet({
    title: 'Umfänge eintragen',
    text: 'Maßband locker anlegen, nicht einschnüren. Leere Felder bleiben leer. Ein zweiter Eintrag am selben Tag ergänzt den ersten.',
    body: `<div class="form">
      <label>Datum<input id="m-date" type="date" value="${ymd()}" max="${ymd()}"></label>
      ${MEASURES.map(m => `<label>${esc(m.label)}
        <span class="unit-wrap"><input id="m-${m.key}" inputmode="decimal" placeholder="${last[m.key] ? esc(fmt1(last[m.key].value)) : ''}"><span>cm</span></span>
        <span class="m-hint">${esc(m.hint)}</span></label>`).join('')}
    </div>`,
    actions: [
      { label: 'Speichern', kind: 'primary', fn: () => {
        const date = document.getElementById('m-date').value || ymd();
        if (date > ymd()) { toast('Das Datum liegt in der Zukunft.'); return; }
        const entry = { date, source: 'manual' };
        for (const m of MEASURES) {
          const raw = document.getElementById('m-' + m.key).value.trim();
          if (!raw) continue;
          const v = toNum(raw);
          if (!(v >= 10 && v <= 250)) { toast(`${m.label}: bitte in cm eintragen, z. B. 38,5`); return; }
          entry[m.key] = Math.round(v * 10) / 10;
        }
        if (Object.keys(entry).length <= 2) { toast('Trag mindestens ein Maß ein.'); return; }
        S.body.measurements = mergeByDate(S.body.measurements, entry);
        save(); closeSheet(); toast('Umfänge gespeichert');
      } },
      { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
    ],
  });
}

/* ---------- Silhouette ---------- */
function silhouetteCard() {
  const list = S.body.measurements || [];
  const mode = V.bodySil || 'overlay';
  const since = measurementSinceFirst(list);
  const keys = MEASURES.filter(m => since[m.key]);
  const scales = silhouetteScales(list);
  const MODES = { first: 'Erster Eintrag', now: 'Jetzt', overlay: 'Überlagerung' };
  const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length < 2) {
    return `<section class="block card"><h2>Deine Form</h2>
      <p class="muted" style="margin-top:4px">Ab dem zweiten Eintrag mit Umfängen zeigt die Figur, wo du breiter oder schmaler geworden bist.</p>
      <div class="sil sil-small">${silhouetteSVG({ mode: 'first', sex: S.profile.sex, label: 'Neutrale Figur' })}</div></section>`;
  }
  return `<section class="block card">
    <h2>Deine Form</h2>
    <div class="seg wide" role="group" aria-label="Ansicht" style="margin-top:10px">${Object.entries(MODES).map(([k, l]) =>
      `<button class="${k === mode ? 'on' : ''}" aria-pressed="${k === mode}" data-act="bodysil" data-mode="${k}">${l}</button>`).join('')}</div>
    <div class="sil">${silhouetteSVG({ mode, scales, sex: S.profile.sex, label: `Körperumriss, ${MODES[mode]}` })}</div>
    <p class="small-print sil-legend">${mode === 'overlay'
      ? `<span class="sw sw-first"></span>Umriss: erster Eintrag vom ${esc(day(sorted[0].date))} <span class="sw sw-now"></span>Fläche: jetzt.`
      : mode === 'first' ? `Erster Eintrag vom ${esc(day(sorted[0].date))}` : `Stand vom ${esc(day(sorted[sorted.length - 1].date))}`}
      Jeder Bereich wird im Verhältnis zu seinem ersten Maß breiter oder schmaler, höchstens um ein Viertel.</p>
    ${keys.length ? `<ul class="b-list sil-changes">${keys.map(({ key, label }) => `<li><span>${esc(label)}</span>
      <b class="num">${signed(since[key].delta)} cm</b></li>`).join('')}</ul>` : ''}
  </section>`;
}

export const actions = {
  bodybfadd: addComposition,
  bodybfdel: el => confirmSheet('Messwert löschen?', `Der Wert vom ${day(el.dataset.date)} wird gelöscht.`, 'Löschen', () => {
    S.body.composition = S.body.composition.filter(c => c.date !== el.dataset.date);
    save(); closeSheet(); toast('Messwert gelöscht');
  }),
  bodymadd: addMeasurements,
  bodymdel: el => confirmSheet('Umfänge löschen?', `Alle Umfänge vom ${day(el.dataset.date)} werden gelöscht.`, 'Löschen', () => {
    S.body.measurements = S.body.measurements.filter(m => m.date !== el.dataset.date);
    save(); closeSheet(); toast('Umfänge gelöscht');
  }),
  bodysil: el => { V.bodySil = el.dataset.mode; render(); },
};
