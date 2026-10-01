/* Import des Schichtplans aus einer Kalender-Datei (.ics): Auswahl, Vorschau, Zuordnung unbekannter Titel,
   Lücken als Urlaub (die erste Art mit Kategorie Urlaub) und danach der Vorschlag, das Muster an den Import anzupassen.
   Teil der Seite aus views/shifts.js.

   V.shiftImport: { name, text, res, map, titles, gaps, allTitles } oder { name, error }. map sind die in dieser Vorschau
   gewählten Zuordnungen { titleKey: Code }, titles die Titel dazu; allTitles zeigt alle statt der ersten MAX_TITLES.
   Erst „Übernehmen“ speichert die Zuordnungen in S.shifts.importMap, damit der nächste Import sie kennt.
   V.shiftFit: { start, same, total, current } nach einem Import, wenn ein anderer Einstieg ins Muster besser passt. */
import { S, V, save } from '../state.js';
import { esc, ymd, dShort } from '../util.js';
import { render } from '../render.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/sheet.js';
import { typesOf, typeOf, addDays, patternIndex } from '../domain/shifts.js';
import { shiftsFromIcs } from '../domain/ics-parse.js';
import { importFit } from '../domain/shift-entry.js';
import { shiftBadge } from './shift-today.js';

const ddmm = d => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
/* Satzende ohne doppelten Punkt nach einem Datum wie „05.11.“ */
const endDot = s => (s.endsWith('.') ? s : s + '.');
const top = () => window.scrollTo(0, 0);
/* So viele unbekannte Titel zeigt die Vorschau zum Zuordnen */
const MAX_TITLES = 8;

/* „vom 01.10. bis 31.01.“, mit Jahr, wenn der Zeitraum nicht im laufenden Jahr liegt */
export function rangeText(from, to, year = ymd().slice(0, 4)) {
  const withYear = from.slice(0, 4) !== year || to.slice(0, 4) !== year;
  const f = d => (withYear ? `${ddmm(d)}${d.slice(0, 4)}` : ddmm(d));
  return `vom ${f(from)} bis ${f(to)}`;
}

export function importSummary(info) {
  const n = info.shifts;
  const u = info.unknown;
  return `${n} ${n === 1 ? 'Schicht' : 'Schichten'} ${rangeText(info.from, info.to)} übernommen${u ? `, ${u} ${u === 1 ? 'Termin' : 'Termine'} nicht erkannt` : ''}`;
}

const fileButton = (label, kind = 'primary') => `<label class="btn ${kind}">${esc(label)}
  <input class="vh" type="file" accept=".ics,text/calendar" data-in="shiftfile"></label>`;

/* ---------- Abschnitt ---------- */
export function importSection() {
  const info = S.shifts.importInfo;
  const im = V.shiftImport;
  const mapped = Object.keys(S.shifts.importMap || {}).length;
  return `<section class="block card sh-import">
    <h2>Aus dem Kalender importieren</h2>
    ${im ? vImport(im) : `<p class="muted">Nimm eine Kalender-Datei (.ics) mit deinen Schichten, z. B. den Export deines Arbeitskalenders aus Google Kalender. Die App liest sie nur auf diesem Handy und merkt sich pro Tag die Schichtart, keine Orte oder Notizen. Einen Titel merkt sie sich nur, wenn du ihn einer Schichtart zuordnest.</p>
    <ul class="rules sh-rules">
      <li>Google Kalender am Computer: <b>Einstellungen</b>, deinen Kalender wählen, <b>Kalender exportieren</b>. Die ZIP-Datei in der Dateien-App antippen, dann liegt die .ics daneben.</li>
      <li>Erkannt werden Titel wie Früh, Spät, Nacht, Tag, 24 h, Urlaub und Krank (auch F, S, N, Frühschicht, Tagdienst) und die Namen deiner Schichtarten, sonst Startzeit und Dauer.</li>
      <li>Im Zeitraum des Imports gilt er vor dem Muster. Ein neuer Import ersetzt den alten.</li>
    </ul>
    ${info ? `<p class="small-print sh-last">${esc(importSummary(info))}${info.at ? ` (Import vom ${esc(dShort(info.at))})` : ''}</p>` : ''}
    <div class="stack">${fileButton(info ? 'Neue Datei importieren' : 'Kalender-Datei wählen', info ? '' : 'primary')}
      ${info ? '<button class="btn ghost" data-act="shiftimportdel">Import entfernen</button>' : ''}
      ${mapped ? `<button class="link" data-act="shiftmapclear">${mapped === 1 ? 'Gemerkte Zuordnung' : `${mapped} gemerkte Zuordnungen`} vergessen</button>` : ''}</div>`}
  </section>`;
}

function vTitles(im) {
  const all = Object.keys(im.titles);
  if (!all.length) return '';
  const open = im.res.unknown.length;
  const types = typesOf(S.shifts);
  /* Nicht zugeordnete Titel zuerst, sonst kommt man bei vielen Titeln nie an die hinteren heran */
  const keys = [...all.filter(k => !im.map[k]), ...all.filter(k => im.map[k])];
  const shown = im.allTitles ? keys : keys.slice(0, MAX_TITLES);
  const rest = keys.length - shown.length;
  const counts = Object.fromEntries(im.res.unknownTitles.map(g => [g.key, g.count]));
  return `<p class="label" style="margin-top:14px">${open ? `${open} ${open === 1 ? 'Termin' : 'Termine'} nicht erkannt` : 'Alle Titel zugeordnet'}</p>
    <p class="small-print">Ordne einen Titel einer Schichtart zu, dann zählen alle Termine mit diesem Titel. Die App merkt sich das für den nächsten Import.</p>
    <ul class="sh-unknown">${shown.map(k => {
    const t = im.titles[k];
    const cur = im.map[k] || '';
    return `<li><span class="sh-ut"><b>${esc(t.title)}</b><small>${cur ? 'zugeordnet' : `${counts[k] || t.count}× ab ${esc(ddmm(t.first))}${esc(t.first.slice(0, 4))}`}</small></span>
      <select class="sh-map" data-in="shiftmap" data-k="${esc(k)}" aria-label="Schichtart für ${esc(t.title)}">
        <option value="">nicht zählen</option>${types.map(x => `<option value="${esc(x.id)}" ${cur === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
      </select></li>`;
  }).join('')}</ul>
    ${rest ? `<button class="link sh-more" data-act="shiftmapmore">${rest === 1 ? 'Einen weiteren Titel' : `${rest} weitere Titel`} zeigen</button>` : ''}`;
}

function vImport(im) {
  if (im.error) {
    return `<p class="banner" role="alert">${esc(im.error)}</p>
      <div class="stack">${fileButton('Andere Datei wählen')}<button class="btn ghost" data-act="shiftimportdrop">Schließen</button></div>`;
  }
  const r = im.res;
  const parts = typesOf(S.shifts).filter(t => t.id !== '-' && r.byCode[t.id])
    .map(t => `<li>${shiftBadge(t.id)}<span>${esc(t.name)}</span><span class="num">${r.byCode[t.id]} ${r.byCode[t.id] === 1 ? 'Tag' : 'Tage'}</span></li>`).join('');
  const notes = [
    r.cancelled ? `${r.cancelled} ${r.cancelled === 1 ? 'abgesagter Termin' : 'abgesagte Termine'} ausgelassen.` : '',
    r.unsupported ? `${r.unsupported === 1 ? 'Eine Serie wiederholt' : `${r.unsupported} Serien wiederholen`} sich monatlich oder jährlich; davon zählt nur der erste Termin.` : '',
    r.conflicts ? `An ${r.conflicts === 1 ? 'einem Tag' : `${r.conflicts} Tagen`} standen mehrere Termine; es zählt Urlaub oder Krank (ganztägig oder ab 4 Stunden), sonst die frühere Schicht.` : '',
  ].filter(Boolean);
  const any = !!r.from;
  return `<p class="muted">In <b>${esc(im.name)}</b> ${any ? `gefunden: <b>${r.shifts} ${r.shifts === 1 ? 'Schicht' : 'Schichten'}</b> ${esc(endDot(rangeText(r.from, r.to)))}` : 'ließ sich keine Schicht erkennen.'}</p>
    ${parts ? `<ul class="sh-sum">${parts}</ul>` : ''}
    ${vTitles(im)}
    ${any && vacationId() ? `<label class="hp-row sh-gaps"><input type="checkbox" data-in="shiftgaps" ${im.gaps ? 'checked' : ''}>
      <span><b>Tage ohne Eintrag als ${esc(typeOf(S.shifts, vacationId()).name)}</b><small>Nur sinnvoll, wenn dein Kalender auch freie Tage einträgt.${im.gaps && r.gapDays ? ` Betrifft ${r.gapDays} ${r.gapDays === 1 ? 'Tag' : 'Tage'}.` : ''}</small></span></label>` : ''}
    ${notes.map(n => `<p class="small-print" style="margin-top:6px">${esc(n)}</p>`).join('')}
    <div class="stack">
      ${any ? '<button class="btn primary" data-act="shiftimportapply">Übernehmen</button>' : fileButton('Andere Datei wählen')}
      <button class="btn ghost" data-act="shiftimportdrop">Verwerfen</button>
    </div>`;
}

/* ---------- Lesen ---------- */
/* Art für Tage ohne Eintrag: die erste mit Kategorie Urlaub, null ohne solche Art */
const vacationId = () => { const t = typesOf(S.shifts).find(x => x.cat === 'vacation'); return t ? t.id : null; };

function parse(im) {
  const map = { ...(S.shifts.importMap || {}), ...im.map };
  Object.keys(map).forEach(k => { if (!map[k] || !typeOf(S.shifts, map[k])) delete map[k]; });
  im.res = shiftsFromIcs(im.text, {
    types: S.shifts.types, times: S.shifts.times, until: addDays(ymd(), 400), map, gaps: im.gaps ? vacationId() : null,
  });
  im.res.unknownTitles.forEach(g => { if (!im.titles[g.key]) im.titles[g.key] = { title: g.title, count: g.count, first: g.first }; });
}

async function readIcs(file) {
  if (file.size > 20 * 1048576) {
    V.shiftImport = { name: file.name, error: 'Die Datei ist größer als 20 MB. Exportiere nur den Kalender mit deinen Schichten.' };
    render(); return;
  }
  try {
    const im = { name: file.name, text: await file.text(), map: {}, titles: {}, gaps: false };
    parse(im);
    V.shiftImport = im;
  } catch (e) {
    V.shiftImport = { name: file.name, error: e && e.message ? e.message : 'Die Datei ließ sich nicht lesen.' };
  }
  render();
}

/* Passt ein anderer Einstieg ins Muster besser zum Import? Dann merkt sich die Seite den Vorschlag. */
export function checkFit() {
  const p = S.shifts.pattern;
  V.shiftFit = null;
  if (!p || !S.shifts.importInfo) return;
  const today = ymd();
  const fit = importFit(p.days, S.shifts, today, p.start);
  if (!fit || fit.index === patternIndex(p, today) || fit.same <= fit.current || fit.same / fit.total < 0.7) return;
  V.shiftFit = { start: fit.start, index: fit.index, same: fit.same, total: fit.total, current: fit.current };
}

/* Karte im Kalender mit dem Vorschlag */
export function vFitCard() {
  const f = V.shiftFit;
  const p = S.shifts.pattern;
  if (!f || !p) return '';
  const now = patternIndex(p, ymd());
  return `<section class="card sh-fit" role="status">
    <p>Dein Muster passt besser zum Import, wenn heute <b>Tag ${f.index + 1}</b> statt Tag ${now + 1} ist: Dann stimmen ${f.same} von ${f.total} Tagen, bisher ${f.current}.</p>
    <div class="sh-fit-act"><button class="btn small primary" data-act="shiftfitapply">Muster anpassen</button>
      <button class="btn small ghost" data-act="shiftfitdrop">So lassen</button></div>
  </section>`;
}

/* ---------- Aktionen ---------- */
export const actions = {
  shiftimportapply: () => {
    const im = V.shiftImport;
    const r = im && im.res;
    if (!r || !r.from) return;
    S.shifts.imported = { ...r.days };
    S.shifts.importInfo = { at: Date.now(), from: r.from, to: r.to, shifts: r.shifts, unknown: r.unknown.length };
    const map = { ...(S.shifts.importMap || {}) };
    Object.entries(im.map).forEach(([k, v]) => { if (v) map[k] = v; else delete map[k]; });
    S.shifts.importMap = map;
    V.shiftImport = null; V.shiftView = 'calendar'; V.shiftMonth = null;
    checkFit();
    save(); render(); top(); toast(importSummary(S.shifts.importInfo));
  },
  shiftimportdrop: () => { V.shiftImport = null; render(); },
  shiftmapmore: () => { if (V.shiftImport) { V.shiftImport.allTitles = true; render(); } },
  shiftimportdel: () => confirmSheet('Import entfernen?', 'Die importierten Schichten werden gelöscht. Wo ein Muster eingetragen ist, gilt wieder das Muster.', 'Import entfernen', () => {
    S.shifts.imported = {}; S.shifts.importInfo = null; V.shiftFit = null; V.sheet = null; save(); render(); toast('Import entfernt');
  }),
  shiftmapclear: () => confirmSheet('Zuordnungen vergessen?', 'Beim nächsten Import fragt die App wieder nach den Titeln, die sie nicht selbst erkennt. Der aktuelle Import bleibt.', 'Vergessen', () => {
    S.shifts.importMap = {}; V.sheet = null; save(); render(); toast('Zuordnungen vergessen');
  }),
  shiftfitapply: () => {
    const f = V.shiftFit;
    if (!f || !S.shifts.pattern) return;
    S.shifts.pattern = { ...S.shifts.pattern, start: f.start };
    V.shiftFit = null;
    save(); render(); toast(`Muster angepasst: heute ist Tag ${f.index + 1}`);
  },
  shiftfitdrop: () => { V.shiftFit = null; render(); },
};

export const inputs = {
  shiftfile: (el, type) => {
    if (type !== 'change') return;
    const f = el.files && el.files[0];
    el.value = '';
    if (f) readIcs(f);
  },
  shiftmap: (el, type) => {
    const im = V.shiftImport;
    if (type !== 'change' || !im || !im.text) return;
    im.map[el.dataset.k] = el.value;
    parse(im); render();
  },
  shiftgaps: (el, type) => {
    const im = V.shiftImport;
    if (type !== 'change' || !im || !im.text) return;
    im.gaps = el.checked;
    parse(im); render();
  },
};
