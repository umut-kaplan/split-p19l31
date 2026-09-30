/* Scheibenrechner: welche Scheiben pro Seite auf die Stange gehören. Einstellungen in S.settings.plates,
   bearbeitet in plate-settings.js. Die Stange wählt man im Sheet; die App merkt sie sich pro Übung. */
import { S, save } from '../state.js';
import { esc, fmt, toNum } from '../util.js';
import { findExercise } from '../domain/library.js';
import { PLATE_COLORS, compColor, plateSettings, barFor, barKey, chooseBar, loadBar, perSideText } from '../domain/plates.js';
import { openSheet, closeSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { setName } from '../domain/settypes.js';

/* Höhe (Anteil) und Dicke grob wie echte Scheiben; eigene Gewichte liegen dazwischen */
const SIZE = [[0.25, 0.26, 5], [0.5, 0.3, 6], [1.25, 0.38, 8], [2.5, 0.46, 9], [5, 0.58, 11], [10, 0.84, 13], [15, 0.92, 15], [20, 1, 17], [25, 1, 20], [50, 1, 28]];
function size(kg) {
  if (kg <= SIZE[0][0]) return { h: SIZE[0][1], w: SIZE[0][2] };
  for (let k = 1; k < SIZE.length; k++) {
    const [k1, h1, w1] = SIZE[k];
    if (kg <= k1) {
      const [k0, h0, w0] = SIZE[k - 1];
      const t = (kg - k0) / (k1 - k0);
      return { h: h0 + (h1 - h0) * t, w: Math.round(w0 + (w1 - w0) * t) };
    }
  }
  const last = SIZE[SIZE.length - 1];
  return { h: last[1], w: last[2] };
}

/* Aussehen einer Scheibe: Farbe aus den Einstellungen (sonst Wettkampffarbe), Schrift mit genug Kontrast */
export function plateLook(kg, color) {
  const c = PLATE_COLORS[color] || PLATE_COLORS[compColor(kg)];
  return { ...size(kg), fill: c.fill, ink: c.ink, edge: c.edge || 'rgba(0, 0, 0, .35)', name: c.name };
}
/* Inline-Stil für Farbpunkte (.pl-dot, .pl-legend i, .pl-sw) */
export const dotStyle = l => `--pc:${l.fill};--pe:${l.edge}`;
const kgText = v => fmt(v);

const settings = () => plateSettings(S.settings && S.settings.plates);
const colorOf = (st, kg) => (st.available.find(p => p.kg === kg) || {}).color;

/* Stange für eine Übung der laufenden Einheit oder null (Maschine, Kurzhanteln, Kabel, Zeit).
   Gilt auch fürs Aufwärmen. */
export function barInfo(x) {
  if (!x || x.unit === 'sec') return null;
  return barFor(findExercise(x.name, S.exercisesCustom), S.settings && S.settings.plates, barKey(x));
}

/* Kleines Scheiben-Symbol neben dem Gewichtsfeld */
export function plateButton(i, j) {
  const x = S.active && S.active.ex[i];
  const name = x ? setName(x.log, j) : `Satz ${j + 1}`;
  return `<button class="pl-btn" data-act="gymplates" data-i="${i}" data-j="${j}" aria-label="Scheiben für ${esc(name)}">
    <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M2 14h24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <rect x="7" y="4" width="4" height="20" rx="1.5" fill="currentColor"/><rect x="12.5" y="7" width="3.5" height="14" rx="1.5" fill="currentColor"/>
      <rect x="17.5" y="9.5" width="3" height="9" rx="1.2" fill="currentColor"/></svg></button>`;
}

/* Eine Seite der Stange mit den Scheiben, schwerste innen. Breite Scheiben tragen ihr Gewicht,
   darunter steht eine Legende, damit sich die Beschriftung kleiner Scheiben nicht überlappt. */
export function barSVG(perSide, st = settings()) {
  const H = 96, mid = 48;
  let x = 40;
  const plates = perSide.map(p => {
    const l = plateLook(p, colorOf(st, p));
    const h = Math.round((H - 8) * l.h);
    const cx = x + l.w / 2;
    const r = `<rect x="${x}" y="${mid - h / 2}" width="${l.w}" height="${h}" rx="3" fill="${l.fill}" stroke="${l.edge}" stroke-width="1"/>`;
    const label = l.w >= 13
      ? `<text x="${cx}" y="${mid}" transform="rotate(-90 ${cx} ${mid})" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="800" fill="${l.ink}" font-family="ui-rounded,system-ui">${esc(kgText(p))}</text>`
      : '';
    x += l.w + 3;
    return r + label;
  }).join('');
  const end = Math.max(x + 14, 120);
  return `<svg class="pl-viz" viewBox="0 0 ${end + 6} ${H}" role="img" aria-label="Je Seite: ${esc(perSideText(perSide, kgText) || 'keine Scheiben')}">
    <rect x="0" y="${mid - 5}" width="32" height="10" rx="3" fill="#5E656E"/>
    <rect x="30" y="${mid - 13}" width="8" height="26" rx="2" fill="#6F7680"/>
    <rect x="36" y="${mid - 6}" width="${end - 36}" height="12" rx="4" fill="#8E959E"/>
    ${plates}
  </svg>
  ${perSide.length ? `<ul class="pl-legend num">${[...new Set(perSide)].map(p => {
    const n = perSide.filter(q => q === p).length;
    return `<li><i style="${dotStyle(plateLook(p, colorOf(st, p)))}"></i>${n > 1 ? `${n} × ` : ''}${esc(kgText(p))} kg</li>`;
  }).join('')}</ul>` : ''}`;
}

/* Wahl der Stange oben im Sheet */
function barPicker(i, j, bar, st, x) {
  return `<div class="pl-bars">
    <div class="chips" role="group" aria-label="Stange">${st.bars.map(b => {
      const on = b.id === bar.id;
      return `<button class="chip ${on ? 'on' : ''}" aria-pressed="${on}" data-act="gymbarpick" data-i="${i}" data-j="${j}" data-id="${esc(b.id)}">${esc(b.name)} <span class="num">${esc(kgText(b.kg))} kg</span></button>`;
    }).join('')}</div>
    <p class="small-print">${bar.chosen
      ? `Für ${esc(x.name)} gemerkt.`
      : `Passend zur Übung. Wählst du eine andere Stange, merkt sich die App sie für ${esc(x.name)}.`}</p>
  </div>`;
}

function sheetFor(i, j) {
  const x = S.active && S.active.ex[i];
  const s = x && x.log[j];
  if (!x || !s) return;
  const bar = barInfo(x);
  if (!bar) return;
  const st = settings();
  const w = s.w !== '' ? toNum(s.w) : toNum(s.pw);
  const barLine = `${bar.label} ${kgText(bar.kg)} kg`;
  const picker = barPicker(i, j, bar, st, x);
  const done = () => closeSheet();
  const setTo = total => () => {
    s.w = fmt(total);
    save(); closeSheet(); toast(`${setName(x.log, j)}: ${kgText(total)} kg`);
  };
  if (!(w > 0)) {
    openSheet({
      title: 'Scheiben',
      body: `<div class="pl-sheet">${picker}<p class="pl-line">Trag zuerst ein Gewicht ein, dann zeigt die App die Scheiben für die Stange.</p></div>`,
      actions: [{ label: 'Fertig', kind: 'primary', fn: done }],
    });
    return;
  }
  const r = loadBar(w, bar.kg, st.available);
  const actions = [];
  let body;
  if (r.status === 'exact') {
    body = `<p class="pl-line num">Je Seite: <b>${esc(perSideText(r.perSide, kgText))}</b></p>
      ${barSVG(r.perSide, st)}
      <p class="small-print">${esc(barLine)} plus zweimal ${esc(kgText(r.perSideKg))} kg ergibt ${esc(kgText(r.total))} kg.</p>`;
  } else if (r.status === 'bar') {
    body = `<p class="pl-line">Nur die Stange, keine Scheiben.</p>${barSVG([], st)}
      <p class="small-print">${esc(barLine)}.</p>`;
  } else if (r.status === 'underbar') {
    body = `<p class="pl-line">${esc(kgText(w))} kg ist leichter als die Stange (${esc(kgText(bar.kg))} kg).</p>`;
    if (!s.done) actions.push({ label: `${kgText(bar.kg)} kg übernehmen`, kind: 'primary', fn: setTo(bar.kg) });
  } else {
    const opts = [r.below, r.above].filter(o => o && o.total > 0);
    body = `<p class="pl-line">${esc(kgText(w))} kg lässt sich mit deinen Scheiben nicht genau laden.</p>
      ${opts.map(o => `<div class="pl-opt"><p class="num"><b>${esc(kgText(o.total))} kg</b>: je Seite ${esc(o.perSide.length ? perSideText(o.perSide, kgText) : 'keine Scheiben')}</p>${barSVG(o.perSide, st)}</div>`).join('')}
      <p class="small-print">Mit ${esc(barLine)} und den Scheiben aus deinen Einstellungen.</p>`;
    if (!s.done) opts.forEach((o, k) => actions.push({ label: `${kgText(o.total)} kg übernehmen`, kind: k === 0 ? 'primary' : '', fn: setTo(o.total) }));
  }
  actions.push({ label: 'Fertig', kind: actions.length ? 'ghost' : 'primary', fn: done });
  openSheet({ title: `Scheiben für ${kgText(w)} kg`, body: `<div class="pl-sheet">${picker}${body}</div>`, actions });
}

export const actions = {
  gymplates: el => sheetFor(+el.dataset.i, +el.dataset.j),
  /* Stange im Sheet gewählt: pro Übung merken, Sheet mit der neuen Stange neu zeichnen */
  gymbarpick: el => {
    const i = +el.dataset.i, j = +el.dataset.j;
    const x = S.active && S.active.ex[i];
    if (!x || !barInfo(x)) return;
    S.settings.plates = chooseBar(S.settings.plates, barKey(x), el.dataset.id);
    save();
    sheetFor(i, j);
  },
};

export const inputs = {};
