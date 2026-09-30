/* Einstellungen → Studio → Stangen und Scheiben: eigene Stangen, eigene Scheibengewichte und eine Farbe pro Scheibe.
   Die Regeln (Grenzen, Duplikate, Standardstangen) stehen in domain/plates.js. */
import { S, save } from '../state.js';
import { esc, fmt, fmtIn, toNum, uid } from '../util.js';
import { render } from '../render.js';
import { ICON } from '../ui/icons.js';
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import {
  PLATE_CATALOG, COLOR_IDS, BAR_MIN, BAR_MAX, BAR_NAME_MAX, plateSettings, isStdBar,
  addPlate, removePlate, setPlateColor, setAllColors, colorMode, saveBar, removeBar, barUsage,
} from '../domain/plates.js';
import { plateLook, dotStyle } from './plates.js';

const kgText = v => fmt(v);
const settings = () => plateSettings(S.settings && S.settings.plates);
/* Neue Einstellungen übernehmen und speichern */
const commit = st => { S.settings.plates = st; save(); };

const BAR_HINT = {
  barbell: 'Übungen mit Langhantel',
  sz: 'Übungen mit SZ-Stange',
};

export function plateSettingsSection() {
  const st = settings();
  const mode = colorMode(st);
  return `<section class="p-section" id="gym-settings"><h2>Stangen und Scheiben</h2>
    <p class="muted" style="margin-bottom:12px">Scheibenrechner und Aufwärmen rechnen damit. Tippe auf eine Stange oder Scheibe, um sie zu ändern.</p>
    <p class="label">Stangen</p>
    <ul class="pl-rows">${st.bars.map(b => `
      <li><button class="pl-row" data-act="gymbaredit" data-id="${esc(b.id)}">
        <span><b>${esc(b.name)}</b><small>${esc(BAR_HINT[b.id] || 'Eigene Stange, im Scheibenrechner wählbar')}</small></span>
        <span class="pl-row-kg num">${esc(kgText(b.kg))} kg</span>${ICON.chevron}</button></li>`).join('')}
    </ul>
    <button class="link pl-addlink" data-act="gymbaredit">Stange hinzufügen</button>
    <p class="label" style="margin-top:18px">Scheiben</p>
    <div class="chips">${st.available.map(p => {
      const l = plateLook(p.kg, p.color);
      return `<button class="chip pl-chip" data-act="gymplateedit" data-kg="${p.kg}" aria-label="${esc(kgText(p.kg))} kg, ${esc(l.name)}. Farbe ändern oder entfernen">
        <i class="pl-dot" style="${dotStyle(l)}"></i>${esc(kgText(p.kg))} kg</button>`;
    }).join('')}
      <button class="chip pl-chip pl-add" data-act="gymplateadd">Scheibe hinzufügen</button></div>
    <div class="pl-tools">
      ${mode !== 'black' ? '<button class="btn small" data-act="gymplatecolors" data-mode="black">Alle schwarz wie im Studio</button>' : ''}
      ${mode !== 'comp' ? '<button class="btn small" data-act="gymplatecolors" data-mode="comp">Wettkampffarben</button>' : ''}
    </div>
  </section>`;
}

/* ---------- Scheibe: Farbe oder entfernen ---------- */
function plateSheet(kg) {
  const st = settings();
  const p = st.available.find(q => q.kg === kg);
  if (!p) { closeSheet(); return; }
  const body = `<p class="label">Farbe</p>
    <div class="pl-swatches" role="group" aria-label="Farbe">${COLOR_IDS.map(c => {
      const l = plateLook(kg, c);
      const on = c === p.color;
      return `<button class="pl-sw ${on ? 'on' : ''}" aria-pressed="${on}" data-act="gymplatecolor" data-kg="${kg}" data-color="${c}">
        <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="${l.fill}" stroke="${l.edge}" stroke-width="1.5"/>
          <circle cx="24" cy="24" r="4.5" fill="#1E2124" stroke="${l.edge}" stroke-width="1"/>
          <text x="24" y="12.5" text-anchor="middle" dominant-baseline="central" font-size="${kgText(kg).length > 3 ? 8.5 : 10}" font-weight="800" fill="${l.ink}" font-family="ui-rounded,system-ui">${esc(kgText(kg))}</text></svg>
        <span>${esc(l.name)}</span></button>`;
    }).join('')}</div>
    <p class="small-print" style="margin-top:12px">So erscheint die Scheibe im Scheibenrechner.</p>`;
  openSheet({
    title: `Scheibe ${kgText(kg)} kg`,
    body,
    actions: [
      { label: 'Fertig', kind: 'primary', fn: closeSheet },
      {
        label: 'Scheibe entfernen', kind: 'danger', fn: () => {
          const r = removePlate(S.settings.plates, kg);
          if (r.error) { toast(r.error); return; }
          commit(r.st); closeSheet(); toast(`${kgText(kg)} kg entfernt`);
        },
      },
    ],
  });
}

/* ---------- Scheibe hinzufügen ---------- */
function add(kg) {
  const r = addPlate(S.settings.plates, kg);
  if (r.error) { toast(r.error); return; }
  commit(r.st);
  toast(`${kgText(kg)} kg hinzugefügt`);
  /* Gleich danach die Farbe wählen können */
  plateSheet(kg);
}

function addSheet() {
  const st = settings();
  const quick = PLATE_CATALOG.filter(kg => !st.available.some(p => p.kg === kg));
  const body = `<div class="form">
    ${quick.length ? `<div><p class="label">Übliche Gewichte</p><div class="chips">${quick.map(kg =>
      `<button class="chip" data-act="gymplatequick" data-kg="${kg}">${esc(kgText(kg))} kg</button>`).join('')}</div></div>` : ''}
    <label class="field">Eigenes Gewicht
      <span class="unit-wrap"><input id="pl-new" inputmode="decimal" enterkeyhint="done" placeholder="z. B. 2" autocomplete="off"><span>kg</span></span></label>
    <p class="help">0,25 bis 50 kg in Schritten von 0,25 kg. Jede Scheibe nimmt der Rechner so oft wie nötig.</p>
  </div>`;
  openSheet({
    title: 'Scheibe hinzufügen',
    body,
    actions: [
      { label: 'Hinzufügen', kind: 'primary', fn: () => { const el = document.getElementById('pl-new'); add(toNum(el ? el.value : '')); } },
      { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
    ],
  });
}

/* ---------- Stange anlegen oder ändern ---------- */
function barSheet(id) {
  const st = settings();
  const b = id ? st.bars.find(x => x.id === id) : null;
  if (id && !b) { closeSheet(); return; }
  const std = b && isStdBar(b.id);
  const used = b && !std ? barUsage(st, b.id) : 0;
  const help = `${BAR_MIN} bis ${BAR_MAX} kg. ${std
    ? `${BAR_HINT[b.id]} nehmen diese Stange, solange du im Scheibenrechner keine andere wählst.`
    : 'Im Scheibenrechner wählst du pro Übung die Stange, die App merkt sich die Wahl.'}`;
  const body = `<div class="form">
    <label>Name<input id="bar-name" value="${esc(b ? b.name : '')}" placeholder="z. B. Trap-Bar" maxlength="${BAR_NAME_MAX}" autocomplete="off"></label>
    <label class="field">Gewicht
      <span class="unit-wrap"><input id="bar-kg" inputmode="decimal" enterkeyhint="done" value="${b ? esc(fmtIn(b.kg)) : ''}" placeholder="z. B. 15" autocomplete="off"><span>kg</span></span></label>
    <p class="help">${esc(help)}${used ? ` Gewählt bei ${used} ${used === 1 ? 'Übung' : 'Übungen'}.` : ''}</p>
  </div>`;
  const actions = [{
    label: b ? 'Speichern' : 'Stange hinzufügen', kind: 'primary', fn: () => {
      const g = k => { const el = document.getElementById(k); return el ? el.value : ''; };
      const r = saveBar(S.settings.plates, { id: b ? b.id : null, name: g('bar-name'), kg: toNum(g('bar-kg')) }, `bar-${uid()}`);
      if (r.error) { toast(r.error); return; }
      commit(r.st); closeSheet(); toast(b ? 'Stange gespeichert' : 'Stange hinzugefügt');
    },
  }];
  if (b && !std) actions.push({
    label: 'Stange löschen', kind: 'danger', fn: () =>
      confirmSheet(`${b.name} löschen?`,
        used ? `${used} ${used === 1 ? 'Übung nutzt' : 'Übungen nutzen'} sie. Danach gilt dort wieder die Stange, die zur Übung passt.` : 'Die Stange verschwindet aus dem Scheibenrechner.',
        'Stange löschen', () => {
          const r = removeBar(S.settings.plates, b.id);
          if (r.error) { toast(r.error); return; }
          commit(r.st); closeSheet(); toast('Stange gelöscht');
        }),
  });
  actions.push({ label: 'Abbrechen', kind: 'ghost', fn: closeSheet });
  openSheet({ title: b ? 'Stange bearbeiten' : 'Neue Stange', body, actions });
}

export const actions = {
  gymbaredit: el => barSheet(el.dataset.id || null),
  gymplateedit: el => plateSheet(Number(el.dataset.kg)),
  gymplateadd: () => addSheet(),
  gymplatequick: el => add(Number(el.dataset.kg)),
  gymplatecolor: el => {
    const kg = Number(el.dataset.kg);
    const r = setPlateColor(S.settings.plates, kg, el.dataset.color);
    if (r.error) { toast(r.error); return; }
    commit(r.st);
    plateSheet(kg);
  },
  gymplatecolors: el => {
    const black = el.dataset.mode === 'black';
    commit(setAllColors(S.settings.plates, black ? 'black' : 'comp').st);
    render();
    toast(black ? 'Alle Scheiben schwarz' : 'Scheiben in Wettkampffarben');
  },
};

export const inputs = {};
