/* Import aus dem Apple-Health-Export (Stufe 6). Abschnitt unter Einstellungen.
   Nach dem Übernehmen der Tageswerte fragt ein Sheet, ob Geburtsdatum, Geschlecht und Größe ins Profil sollen. */
import { S, V, save, replaceState, KEY } from '../state.js';
import { esc, fmt0, fmt1, dShort, ymd } from '../util.js';
import { render } from '../render.js';
import { toast } from '../ui/toast.js';
import { confirmSheet, openSheet, closeSheet } from '../ui/sheet.js';
import { IMPORTERS } from '../importers/index.js';
import {
  previewHealthImport, mergeHealthImport, removeHealthImport, profileProposals, applyProfileProposals, HEALTH_SOURCE,
} from '../importers/health-merge.js';

const importer = IMPORTERS.find(i => i.id === 'apple-health');

const METRICS = [
  ['weights', 'Gewicht'],
  ['steps', 'Schritte'],
  ['restingHr', 'Ruhepuls'],
  ['sleep', 'Schlaf'],
];
const PERIODS = [['1y', '12 Monate', 365], ['2y', '2 Jahre', 730], ['all', 'Alles', null]];

let job = null;   // laufender Import: AbortController

const st = () => { if (!V.ahi) V.ahi = { phase: 'idle', period: '2y' }; return V.ahi; };
const mb = bytes => bytes / 1048576;
const mbText = bytes => (mb(bytes) < 10 ? fmt1(mb(bytes)) : fmt0(mb(bytes)));
/* Mit Jahr, denn ein Export reicht meist über mehrere Jahre */
const dayText = d => new Date(d + 'T12:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' });
const sinceFor = key => {
  const p = PERIODS.find(x => x[0] === key);
  return p && p[2] ? ymd(Date.now() - p[2] * 864e5) : null;
};
const days = n => `${fmt0(n)} ${n === 1 ? 'Tag' : 'Tage'}`;

/* ---------- Ansicht ---------- */
export function importSection() {
  const s = st();
  return `<section class="p-section card ahi">
    <h2>Apple Health importieren</h2>
    ${s.phase === 'reading' ? vReading(s) : s.phase === 'done' ? vDone(s) : s.phase === 'error' ? vError(s) : vIdle()}
  </section>`;
}

const fileButton = (label, kind = 'primary') => `<label class="btn ${kind}">${esc(label)}
  <input class="vh" type="file" accept="${esc(importer.accept)}" data-in="ahifile"></label>`;

function lastImport() {
  const h = S.settings.healthImport;
  if (!h) return '';
  const parts = METRICS.map(([k, l]) => (h.counts && h.counts[k] && h.counts[k].added ? `${days(h.counts[k].added)} ${l}` : '')).filter(Boolean);
  return `<p class="small-print ahi-last">Zuletzt importiert am ${esc(dShort(h.at))}${parts.length ? `: ${esc(parts.join(', '))}` : ''}.
    <button class="link" data-act="ahiremove">Importierte Werte entfernen</button></p>`;
}

function vIdle() {
  return `<p class="muted">Übernimmt Gewicht, Schritte, Ruhepuls und Schlaf aus dem Export der Health-App. Geburtsdatum, Geschlecht und Größe bietet die App dir danach fürs Profil an. Die Datei wird nur auf diesem Handy gelesen.</p>
    <ol class="ahi-steps">
      <li>In der Health-App oben rechts auf dein Profilbild tippen.</li>
      <li>Ganz unten <b>Alle Gesundheitsdaten exportieren</b> wählen und bestätigen. Das dauert ein paar Minuten.</li>
      <li>Im Teilen-Menü <b>In Dateien sichern</b> wählen.</li>
      <li>Hier <b>Datei auswählen</b> tippen und die gesicherte <b>Export.zip</b> nehmen.</li>
    </ol>
    <p class="small-print">Pro Tag zählt ein Wert. Was du selbst eingetragen hast, bleibt stehen. Ein neuer Import ersetzt den vorigen.</p>
    ${lastImport()}
    <div class="stack">${fileButton('Datei auswählen')}</div>`;
}

function vReading(s) {
  const pct = s.total ? Math.min(100, Math.round(s.done / s.total * 100)) : 0;
  return `<p class="muted">Lese <b>${esc(s.name)}</b>. Du kannst die App dabei offen lassen; die Datei bleibt auf dem Handy.</p>
    <div class="bar ahi-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Fortschritt"><i id="ahi-bar" style="width:${pct}%"></i></div>
    <p class="small-print num" id="ahi-text" aria-live="polite">${progressText(s)}</p>
    <div class="stack"><button class="btn ghost" data-act="ahicancel">Abbrechen</button></div>`;
}

function progressText(s) {
  const recs = s.records ? `, ${fmt0(s.records)} Einträge durchgesehen` : '';
  return `${mbText(s.done)} von ${mbText(s.total)} MB gelesen${recs}`;
}

function vDone(s) {
  const r = s.result;
  const since = sinceFor(s.period);
  const pre = previewHealthImport(S, r, { since });
  const any = METRICS.some(([k]) => pre[k].days);
  const props = profileProposals(S.profile, r.profile);
  return `<p class="muted">Gefunden in <b>${esc(r.stats.file || s.name)}</b>:</p>
    <table class="ahi-sum">
      <thead><tr><th scope="col">Wert</th><th scope="col">Tage</th><th scope="col">Zeitraum</th></tr></thead>
      <tbody>${METRICS.map(([k, l]) => {
        const x = r.stats[k];
        return `<tr><th scope="row">${l}</th><td class="num">${fmt0(x.days)}</td>
          <td class="num">${x.days ? `${esc(dayText(x.from))} bis ${esc(dayText(x.to))}` : '–'}</td></tr>`;
      }).join('')}</tbody>
    </table>
    <p class="label" style="margin-top:16px">Übernehmen für</p>
    <div class="seg wide" role="group" aria-label="Zeitraum">${PERIODS.map(([k, l]) =>
      `<button class="${s.period === k ? 'on' : ''}" aria-pressed="${s.period === k}" data-act="ahiperiod" data-v="${k}">${l}</button>`).join('')}</div>
    <ul class="ahi-pre">${METRICS.map(([k, l]) => `<li><span>${l}</span><span class="num">${pre[k].added ? `${days(pre[k].added)} neu` : 'nichts'}${pre[k].kept ? `, ${days(pre[k].kept)} ${pre[k].kept === 1 ? 'bleibt' : 'bleiben'} wie eingetragen` : ''}</span></li>`).join('')}</ul>
    ${any ? '' : '<p class="small-print">Im gewählten Zeitraum gibt es keine Werte. Wähle einen längeren Zeitraum.</p>'}
    ${props.length ? `<p class="small-print ahi-prof">Fürs Profil: ${esc(props.map(x => x.label).join(', '))}. Was davon übernommen wird, fragt die App gleich.</p>` : ''}
    <div class="stack">
      <button class="btn primary" data-act="ahiapply" ${any || props.length ? '' : 'disabled'}>Übernehmen</button>
      <button class="btn ghost" data-act="ahidiscard">Verwerfen</button>
    </div>`;
}

function vError(s) {
  return `<p class="banner" role="alert">${esc(s.error)}</p>
    <div class="stack">${fileButton('Andere Datei wählen')}
      <button class="btn ghost" data-act="ahidiscard">Schließen</button></div>`;
}

/* Fortschritt ohne ganze Seite neu zu zeichnen */
function paint() {
  const s = st();
  const bar = document.getElementById('ahi-bar');
  const text = document.getElementById('ahi-text');
  if (!bar || !text) return;
  const pct = s.total ? Math.min(100, Math.round(s.done / s.total * 100)) : 0;
  bar.style.width = pct + '%';
  bar.parentElement.setAttribute('aria-valuenow', pct);
  text.textContent = progressText(s);
}

/* ---------- Ablauf ---------- */
async function start(file) {
  if (job) job.abort();
  const ctrl = new AbortController();
  job = ctrl;
  const s = st();
  Object.assign(s, { phase: 'reading', name: file.name, total: file.size, done: 0, records: 0, error: null, result: null });
  render();
  let lastPaint = 0;
  try {
    const result = await importer.parse(file, (done, total, records) => {
      if (job !== ctrl) return;
      s.done = done; s.total = total; s.records = records;
      const now = Date.now();
      if (now - lastPaint > 120) { lastPaint = now; paint(); }
    }, ctrl.signal);
    if (job !== ctrl) return;
    job = null;
    Object.assign(s, { phase: 'done', result });
    render();
    if (V.tab !== 'profile' || V.setView !== 'main') toast('Health-Export gelesen, unter Einstellungen übernehmen');
  } catch (e) {
    if (job !== ctrl) return;
    job = null;
    if (e && e.name === 'AbortError') { Object.assign(s, { phase: 'idle', result: null }); render(); toast('Import abgebrochen'); return; }
    Object.assign(s, { phase: 'error', error: (e && e.message) || 'Die Datei ließ sich nicht lesen.' });
    render();
  }
}

/* Prüft, ob der Stand wirklich gespeichert wurde; der Speicher im Browser ist begrenzt */
function savedOk() {
  try { return localStorage.getItem(KEY) === JSON.stringify(S); } catch (e) { return false; }
}

function apply() {
  const s = st();
  if (!s.result) return;
  const since = sinceFor(s.period);
  const pre = previewHealthImport(S, s.result, { since });
  const any = METRICS.some(([k]) => pre[k].days);
  const props = profileProposals(S.profile, s.result.profile);
  /* Ohne Tageswerte im Zeitraum bleibt ein früherer Import stehen; dann geht es nur ums Profil */
  if (any) {
    /* Passt der Import nicht in den Speicher, wird er vollständig zurückgenommen; das gelesene Ergebnis bleibt für einen kürzeren Zeitraum */
    const before = JSON.parse(JSON.stringify(S));
    const counts = mergeHealthImport(S, s.result, { since, source: HEALTH_SOURCE });
    if (!(save() && savedOk())) {
      replaceState(before);
      render();
      toast('Das passt nicht mehr in den Speicher. Nichts wurde übernommen. Wähle einen kürzeren Zeitraum.');
      return;
    }
    V.ahi = { phase: 'idle', period: s.period };
    render();
    const n = METRICS.reduce((a, [k]) => a + counts[k].added, 0);
    toast(n ? `Übernommen: ${fmt0(n)} Tageswerte aus Apple Health` : 'Nichts Neues übernommen');
  } else {
    V.ahi = { phase: 'idle', period: s.period };
  }
  if (props.length) profileSheet(props); else if (!any) render();
}

/* Sheet mit Häkchen: nur Angaben, die im Profil fehlen oder abweichen. Überschrieben wird erst mit „Übernehmen“. */
function profileSheet(props) {
  const pick = Object.fromEntries(props.map(x => [x.key, true]));
  const row = x => `<label class="hp-row">
      <input type="checkbox" data-in="hppick" data-k="${esc(x.key)}" ${pick[x.key] ? 'checked' : ''}>
      <span><b>${esc(x.label)} ${esc(x.text)}</b><small>${x.before ? `Im Profil: ${esc(x.before)}` : 'Im Profil noch leer'}</small></span>
    </label>`;
  V.hpPick = pick;
  openSheet({
    title: 'Aus Apple Health übernehmen',
    text: 'Diese Angaben fehlen in deinem Profil oder weichen davon ab. Übernommen wird, was angehakt ist.',
    /* Als Getter, damit ein erneutes Zeichnen die Häkchen behält */
    get body() { return `<div class="hp-list">${props.map(row).join('')}</div>`; },
    actions: [
      { label: 'Übernehmen', kind: 'primary', fn: () => {
        const chosen = props.filter(x => pick[x.key]);
        applyProfileProposals(S, chosen);
        save(); V.hpPick = null; closeSheet();
        toast(chosen.length ? `Ins Profil übernommen: ${chosen.map(x => x.label).join(', ')}` : 'Profil unverändert');
      } },
      { label: 'Nicht übernehmen', kind: 'ghost', fn: () => { V.hpPick = null; closeSheet(); } },
    ],
  });
}

export const actions = {
  ahicancel: () => { if (job) job.abort(); },
  ahiperiod: el => { st().period = el.dataset.v; render(); },
  ahiapply: apply,
  ahidiscard: () => { if (job) job.abort(); V.ahi = { phase: 'idle', period: st().period }; render(); },
  ahiremove: () => confirmSheet('Importierte Werte entfernen?', 'Alle Werte aus Apple Health verschwinden wieder. Was du selbst eingetragen hast, bleibt.', 'Werte entfernen', () => {
    const n = removeHealthImport(S);
    save(); closeSheet(); toast(`${fmt0(n)} importierte Werte entfernt`);
  }),
};

export const inputs = {
  hppick: (el, type) => {
    if (type !== 'change' || !V.hpPick || !(el.dataset.k in V.hpPick)) return;
    V.hpPick[el.dataset.k] = el.checked;
  },
  ahifile: (el, type) => {
    if (type !== 'change') return;
    const f = el.files && el.files[0];
    el.value = '';
    if (f) start(f);
  },
};
