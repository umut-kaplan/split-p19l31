/* Scheibenrechner: welche Scheiben pro Seite auf die Stange gehören. Einstellungen in S.settings.plates. */
import { S, save } from '../state.js';
import { esc, fmt, toNum } from '../util.js';
import { render } from '../render.js';
import { findExercise } from '../domain/library.js';
import { PLATE_CATALOG, plateSettings, barFor, loadBar, perSideText } from '../domain/plates.js';
import { openSheet, closeSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/* Farben der Scheiben nach Wettkampfnorm: 25 rot, 20 blau, 15 gelb, 10 grün, 5 weiß;
   kleine Wechselscheiben 2,5 rot und 1,25 verchromt (grau), 0,5 weiß. Größe und Dicke grob wie echte Scheiben. */
const LOOK = {
  25: { fill: '#E0403F', h: 1, w: 20 },
  20: { fill: '#2F7BE0', h: 1, w: 17 },
  15: { fill: '#F2C230', h: 0.92, w: 15 },
  10: { fill: '#2FA85A', h: 0.84, w: 13 },
  5: { fill: '#E9E6DF', h: 0.58, w: 11 },
  2.5: { fill: '#E0403F', h: 0.46, w: 9 },
  1.25: { fill: '#C9CDD2', h: 0.38, w: 8 },
  0.5: { fill: '#E9E6DF', h: 0.3, w: 6 },
};
const look = p => LOOK[p] || { fill: '#C9CDD2', h: 0.4, w: 8 };
const kgText = v => fmt(v);

const settings = () => plateSettings(S.settings && S.settings.plates);

/* Stange für eine Übung der laufenden Einheit oder null (Maschine, Kurzhanteln, Kabel, Zeit) */
export function barInfo(x) {
  if (!x || x.unit === 'sec') return null;
  return barFor(findExercise(x.name, S.exercisesCustom), S.settings && S.settings.plates);
}

/* Kleines Scheiben-Symbol neben dem Gewichtsfeld */
export function plateButton(i, j) {
  return `<button class="pl-btn" data-act="gymplates" data-i="${i}" data-j="${j}" aria-label="Scheiben für Satz ${j + 1}">
    <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M2 14h24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <rect x="7" y="4" width="4" height="20" rx="1.5" fill="currentColor"/><rect x="12.5" y="7" width="3.5" height="14" rx="1.5" fill="currentColor"/>
      <rect x="17.5" y="9.5" width="3" height="9" rx="1.2" fill="currentColor"/></svg></button>`;
}

/* Eine Seite der Stange mit den Scheiben, schwerste innen. Große Scheiben tragen ihr Gewicht,
   darunter steht eine Legende, damit sich die Beschriftung kleiner Scheiben nicht überlappt. */
function barSVG(perSide) {
  const H = 96, mid = 48;
  const INK_DARK = ['#F2C230', '#E9E6DF', '#C9CDD2'];
  let x = 40;
  const plates = perSide.map(p => {
    const l = look(p);
    const h = Math.round((H - 8) * l.h);
    const cx = x + l.w / 2;
    const r = `<rect x="${x}" y="${mid - h / 2}" width="${l.w}" height="${h}" rx="3" fill="${l.fill}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`;
    const label = l.w >= 13
      ? `<text x="${cx}" y="${mid}" transform="rotate(-90 ${cx} ${mid})" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="800" fill="${INK_DARK.includes(l.fill) ? '#1E2124' : '#fff'}" font-family="ui-rounded,system-ui">${esc(kgText(p))}</text>`
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
    return `<li><i style="background:${look(p).fill}"></i>${n > 1 ? `${n} × ` : ''}${esc(kgText(p))} kg</li>`;
  }).join('')}</ul>` : ''}`;
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
  const done = () => closeSheet();
  const setTo = total => () => {
    s.w = fmt(total);
    save(); closeSheet(); toast(`Satz ${j + 1}: ${kgText(total)} kg`);
  };
  if (!(w > 0)) {
    openSheet({ title: 'Scheiben', text: `Trag zuerst ein Gewicht ein, dann zeigt die App die Scheiben für die ${bar.label}.`, actions: [{ label: 'Fertig', kind: 'primary', fn: done }] });
    return;
  }
  const r = loadBar(w, bar.kg, st.available);
  const actions = [];
  let body;
  if (r.status === 'exact') {
    body = `<p class="pl-line num">Je Seite: <b>${esc(perSideText(r.perSide, kgText))}</b></p>
      ${barSVG(r.perSide)}
      <p class="small-print">${esc(barLine)} plus zweimal ${esc(kgText(r.perSideKg))} kg ergibt ${esc(kgText(r.total))} kg.</p>`;
  } else if (r.status === 'bar') {
    body = `<p class="pl-line">Nur die Stange, keine Scheiben.</p>${barSVG([])}
      <p class="small-print">${esc(barLine)}.</p>`;
  } else if (r.status === 'underbar') {
    body = `<p class="pl-line">${esc(kgText(w))} kg ist leichter als die Stange (${esc(kgText(bar.kg))} kg).</p>`;
    if (!s.done) actions.push({ label: `${kgText(bar.kg)} kg übernehmen`, kind: 'primary', fn: setTo(bar.kg) });
  } else {
    const opts = [r.below, r.above].filter(o => o && o.total > 0);
    body = `<p class="pl-line">${esc(kgText(w))} kg lässt sich mit deinen Scheiben nicht genau laden.</p>
      ${opts.map(o => `<div class="pl-opt"><p class="num"><b>${esc(kgText(o.total))} kg</b>: je Seite ${esc(o.perSide.length ? perSideText(o.perSide, kgText) : 'keine Scheiben')}</p>${barSVG(o.perSide)}</div>`).join('')}
      <p class="small-print">Mit ${esc(barLine)} und den Scheiben aus deinem Profil.</p>`;
    if (!s.done) opts.forEach((o, k) => actions.push({ label: `${kgText(o.total)} kg übernehmen`, kind: k === 0 ? 'primary' : '', fn: setTo(o.total) }));
  }
  actions.push({ label: 'Fertig', kind: actions.length ? 'ghost' : 'primary', fn: done });
  openSheet({ title: `Scheiben für ${kgText(w)} kg`, body: `<div class="pl-sheet">${body}</div>`, actions });
}

/* ---------- Profil ---------- */
export function plateSettingsSection() {
  const st = settings();
  return `<section class="p-section" id="gym-settings"><h2>Stangen und Scheiben</h2>
    <p class="muted" style="margin-bottom:12px">Scheibenrechner und Aufwärmen rechnen damit. Schalte ab, was es in deinem Studio nicht gibt.</p>
    <div class="row2">
      <label class="field">Langhantel-Stange
        <span class="unit-wrap"><input data-in="gymbar" data-k="barKg" inputmode="decimal" value="${esc(kgText(st.barKg))}"><span>kg</span></span></label>
      <label class="field">SZ-Stange
        <span class="unit-wrap"><input data-in="gymbar" data-k="szKg" inputmode="decimal" value="${esc(kgText(st.szKg))}"><span>kg</span></span></label>
    </div>
    <p class="label" style="margin-top:14px">Scheiben</p>
    <div class="chips">${PLATE_CATALOG.map(p => {
      const on = st.available.includes(p);
      return `<button class="chip pl-chip ${on ? 'on' : ''}" aria-pressed="${on}" data-act="gymplate" data-v="${p}">
        <i class="pl-dot" style="background:${look(p).fill}"></i>${esc(kgText(p))} kg</button>`;
    }).join('')}</div>
  </section>`;
}

const RANGE = { barKg: [5, 30, 'Langhantel-Stange: 5 bis 30 kg, z. B. 20'], szKg: [3, 20, 'SZ-Stange: 3 bis 20 kg, z. B. 10'] };

function ensure() {
  if (!S.settings.plates) S.settings.plates = plateSettings(null);
  return S.settings.plates;
}

export const actions = {
  gymplates: el => sheetFor(+el.dataset.i, +el.dataset.j),
  gymplate: el => {
    const p = Number(el.dataset.v);
    const pl = ensure();
    const list = plateSettings(pl).available;
    const on = list.includes(p);
    if (on && list.length === 1) { toast('Mindestens eine Scheibe muss bleiben'); return; }
    pl.available = on ? list.filter(q => q !== p) : [...list, p].sort((a, b) => b - a);
    save(); render();
  },
};

export const inputs = {
  gymbar: (el, type) => {
    if (type !== 'change') return;
    const k = el.dataset.k;
    const [lo, hi, msg] = RANGE[k] || [];
    const v = toNum(el.value);
    if (!(v >= lo && v <= hi)) { toast(msg); el.value = kgText(settings()[k]); return; }
    ensure()[k] = Math.round(v * 4) / 4;
    save();
  },
};
