/* Schichtarten: Liste in den Einstellungen des Schichtplans und eine Seite zum Anlegen, Bearbeiten und Löschen.
   Teil der Seite aus views/shifts.js; die Seite zeigt den Editor, solange V.shiftView === 'type' ist.

   V.shiftType: { id (null bei neuer Art), name, short, cat, color, t0, t1, back } mit back 'settings' oder 'setup',
   wohin Speichern und Abbrechen zurückführen. */
import { S, V, save } from '../state.js';
import { esc } from '../util.js';
import { render } from '../render.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/sheet.js';
import { ICON } from '../ui/icons.js';
import {
  CATS, CAT_LABEL, CAT_TIMES, COLORS, COLOR_LABEL, typesOf, typeOf, typeTimes, isTimedCat, fmtTimes, newTypeId,
  typeUsage, removeType, isTime,
} from '../domain/shifts.js';
import { shiftBadge } from './shift-today.js';

/* Was die Kategorie für die Planung heißt, in einem Satz */
const CAT_HELP = {
  early: 'Training danach, frühestens eine Stunde nach Schichtende; am Vortag rechtzeitig fertig für genug Schlaf.',
  late: 'Training davor, Ende mindestens 90 Minuten vor Schichtbeginn.',
  night: 'Training davor, mit 3 Stunden Abstand; am Tag danach frühestens 8 Stunden nach Schichtende.',
  day: 'Lange Tagschicht: Training danach, bei spätem Beginn auch davor.',
  h24: 'An diesem Tag kein Training, am Tag danach frühestens 8 Stunden nach Dienstende.',
  dispo: 'Zählt wie frei, die App nimmt aber zuerst die freien Tage.',
  off: 'Freier Tag.',
  vacation: 'Wie frei, im Kalender als Urlaub zu sehen.',
  sick: 'An diesem Tag plant die App kein Training.',
};
/* Farbe für eine neue Art je Kategorie */
const CAT_COLOR = { early: 'yellow', late: 'blue', night: 'violet', day: 'orange', h24: 'red', dispo: 'teal', off: 'grey', vacation: 'green', sick: 'pink' };

const top = () => window.scrollTo(0, 0);
/* Zweite Zeile der Liste: Uhrzeit und, wenn der Name es nicht schon sagt, die Art */
function catText(t) {
  const same = t.name.toLowerCase() === CAT_LABEL[t.cat].toLowerCase();
  if (!isTimedCat(t.cat)) return same ? 'ohne Uhrzeit' : `Art: ${CAT_LABEL[t.cat]}`;
  return `${fmtTimes(typeTimes(S.shifts, t.id))}${same ? '' : `, Art: ${CAT_LABEL[t.cat]}`}`;
}

/* ---------- Liste ---------- */
export function vTypes() {
  return `<section class="block card"><h2>Schichtarten</h2>
      <p class="muted">Tippe auf eine Art, um Name, Kürzel, Farbe oder Uhrzeit zu ändern.</p>
      <ul class="sh-types">${typesOf(S.shifts).map(t => `<li><button class="sh-type" data-act="shifttype" data-id="${esc(t.id)}">
        ${shiftBadge(t.id)}<span><b>${esc(t.name)}</b><small>${esc(catText(t))}</small></span>${ICON.chevron}</button></li>`).join('')}</ul>
      <div class="stack"><button class="btn" data-act="shifttypenew" data-back="settings">Neue Schichtart</button></div>
    </section>`;
}

/* ---------- Bearbeiten ---------- */
export function vTypeEdit() {
  const e = V.shiftType;
  if (!e) return '';
  const free = e.id === '-';
  const timed = isTimedCat(e.cat);
  const cls = e.color === 'grey' ? 'sh-x' : `sh-c-${e.color}`;
  return `<section class="block card sh-typeed">
      <div class="sh-typehead"><span class="sh-code sh-big ${cls}" aria-hidden="true">${esc(e.short || '?')}</span>
        <h2>${e.id ? 'Schichtart bearbeiten' : 'Neue Schichtart'}</h2></div>
      <div class="fields">
        <label class="field">Name<input type="text" maxlength="24" data-in="shifttname" value="${esc(e.name)}" placeholder="z. B. Zwischendienst" autocomplete="off"></label>
        <label class="field">Kürzel im Kalender, 1 bis 3 Zeichen<input type="text" maxlength="3" data-in="shifttshort" value="${esc(e.short)}" placeholder="z. B. Z" autocomplete="off"></label>
      </div>
      <p class="label" style="margin-top:16px">Art</p>
      ${free ? '<p class="muted">„frei“ bleibt immer ein freier Tag.</p>' : `<div class="chips sh-cats" role="group" aria-label="Art">${CATS.map(c => `<button class="chip ${e.cat === c ? 'on' : ''}"
        aria-pressed="${e.cat === c}" data-act="shifttcat" data-v="${c}">${esc(CAT_LABEL[c])}</button>`).join('')}</div>`}
      <p class="small-print" style="margin-top:8px">${esc(CAT_HELP[e.cat])}</p>
      <p class="label" style="margin-top:16px">Farbe</p>
      <div class="sh-swatches" role="group" aria-label="Farbe">${COLORS.map(c => `<button class="sh-sw ${c === 'grey' ? 'sh-x' : `sh-c-${c}`} ${e.color === c ? 'on' : ''}"
        aria-pressed="${e.color === c}" aria-label="${esc(COLOR_LABEL[c])}" data-act="shifttcolor" data-v="${c}"></button>`).join('')}</div>
      ${timed ? `<p class="label" style="margin-top:16px">Uhrzeit</p>
        <div class="sh-trange ${e.cat === 'h24' ? 'one' : ''}"><span class="muted">${e.cat === 'h24' ? 'Beginn' : 'von'}</span>
          <input type="time" class="sh-time" data-in="shiftttime" data-i="0" value="${esc(e.t0)}" aria-label="Beginn">
          ${e.cat === 'h24' ? '' : `<span class="muted">bis</span><input type="time" class="sh-time" data-in="shiftttime" data-i="1" value="${esc(e.t1)}" aria-label="Ende">`}</div>
        ${e.cat === 'h24' ? '<p class="small-print" style="margin-top:6px">Der Dienst dauert 24 Stunden und endet am nächsten Tag zur selben Zeit.</p>' : ''}` : ''}
      <div class="stack">
        <button class="btn primary" data-act="shifttsave">Speichern</button>
        ${e.id && !free ? '<button class="btn danger" data-act="shifttdel">Schichtart löschen</button>' : ''}
        <button class="btn ghost" data-act="shifttcancel">Abbrechen</button>
      </div>
    </section>`;
}

function open(t, back) {
  const times = t ? typeTimes(S.shifts, t.id) : null;
  V.shiftType = t
    ? { id: t.id, name: t.name, short: t.short, cat: t.cat, color: t.color, t0: times ? times[0] : '', t1: times ? times[1] : '', back }
    : { id: null, name: '', short: '', cat: 'early', color: CAT_COLOR.early, t0: CAT_TIMES.early[0], t1: CAT_TIMES.early[1], back };
  V.shiftView = 'type';
  render(); top();
}

function close() {
  const back = V.shiftType ? V.shiftType.back : 'settings';
  V.shiftType = null;
  V.shiftView = back;
  render(); top();
}

/* Ungültiges oder doppeltes Kürzel: Meldung, sonst null */
function problem(e) {
  if (!e.name.trim()) return 'Gib der Schichtart einen Namen.';
  const short = e.short.trim();
  if (!short) return 'Gib ein Kürzel mit 1 bis 3 Zeichen ein.';
  const clash = typesOf(S.shifts).find(t => t.id !== e.id && t.short.toLowerCase() === short.toLowerCase());
  if (clash) return `Das Kürzel ${short} hat schon „${clash.name}“.`;
  if (isTimedCat(e.cat) && !(isTime(e.t0) && (e.cat === 'h24' || isTime(e.t1)))) return 'Trag Beginn und Ende ein, z. B. 06:00.';
  if (isTimedCat(e.cat) && e.cat !== 'h24' && e.t0 === e.t1) return 'Beginn und Ende sind gleich. Für 24 Stunden wähle die Art „24 h“.';
  return null;
}

function saveType() {
  const e = V.shiftType;
  const msg = problem(e);
  if (msg) { toast(msg); return; }
  const sh = S.shifts;
  const id = e.id || newTypeId(sh.types);
  const fields = { id, short: e.short.trim(), name: e.name.trim(), cat: e.id === '-' ? 'off' : e.cat, color: e.color };
  if (e.id) sh.types = sh.types.map(t => (t.id === id ? fields : t));
  else sh.types.push(fields);
  if (isTimedCat(fields.cat)) sh.times[id] = [e.t0, fields.cat === 'h24' ? e.t0 : e.t1];
  else {
    delete sh.times[id];
    /* Eigene Uhrzeiten an Einzeltagen gelten nur für Arten mit Arbeitszeit */
    Object.entries(sh.overrides).forEach(([d, v]) => { if (v && typeof v === 'object' && v.code === id) sh.overrides[d] = id; });
  }
  if (!e.id && e.back === 'setup' && V.shiftDraft) V.shiftDraft.brush = id;
  save();
  toast(e.id ? 'Schichtart gespeichert' : `„${fields.name}“ angelegt`);
  close();
}

function deleteType() {
  const e = V.shiftType;
  const t = typeOf(S.shifts, e.id);
  if (!t || t.id === '-') return;
  const u = typeUsage(S.shifts, t.id);
  const done = () => {
    Object.assign(S.shifts, removeType(S.shifts, t.id));
    if (V.shiftDraft) V.shiftDraft.days = V.shiftDraft.days.map(c => (c === t.id ? '-' : c));
    V.sheet = null;
    save();
    toast(`„${t.name}“ gelöscht`);
    close();
  };
  const where = [
    u.pattern ? `im Muster an ${u.pattern === 1 ? 'einem Tag' : `${u.pattern} Tagen`}` : '',
    u.imported ? `im Import an ${u.imported === 1 ? 'einem Tag' : `${u.imported} Tagen`}` : '',
    u.overrides ? `an ${u.overrides === 1 ? 'einem Tag' : `${u.overrides} Tagen`} von Hand` : '',
  ].filter(Boolean);
  if (!where.length) { done(); return; }
  /* Nur sagen, was wirklich passiert: Im Muster und im Zeitraum des Imports wird der Tag frei,
     ein von Hand gesetzter Tag folgt wieder Import und Muster */
  const freed = u.pattern + u.imported;
  const places = [u.pattern ? 'im Muster' : '', u.imported ? 'im Import' : ''].filter(Boolean).join(' und ');
  const then = [
    freed ? `${places.charAt(0).toUpperCase()}${places.slice(1)} ${freed === 1 ? 'wird dieser Tag' : 'werden diese Tage'} frei.` : '',
    u.overrides ? `${u.overrides === 1 ? 'Der von Hand gesetzte Tag folgt' : 'Die von Hand gesetzten Tage folgen'} wieder Import und Muster.` : '',
    u.map ? `Gemerkte Zuordnungen von Titeln zu dieser Art vergisst die App.` : '',
  ].filter(Boolean);
  confirmSheet(`„${t.name}“ löschen?`, `Die Art steht ${where.join(', ')}. ${then.join(' ')}`, 'Löschen', done);
}

/* ---------- Aktionen ---------- */
export const actions = {
  shifttype: el => open(typeOf(S.shifts, el.dataset.id), 'settings'),
  shifttypenew: el => open(null, el.dataset.back === 'setup' ? 'setup' : 'settings'),
  shifttcat: el => {
    const e = V.shiftType;
    if (!e || e.id === '-') return;
    const was = e.cat;
    e.cat = el.dataset.v;
    /* Neue Art: Farbe und Zeiten folgen der Kategorie, solange der Nutzer sie nicht selbst gesetzt hat */
    if (!e.id && e.color === CAT_COLOR[was]) e.color = CAT_COLOR[e.cat];
    if (isTimedCat(e.cat) && (!e.id || !isTimedCat(was)) && (!isTime(e.t0) || (CAT_TIMES[was] && e.t0 === CAT_TIMES[was][0] && e.t1 === CAT_TIMES[was][1]))) {
      [e.t0, e.t1] = CAT_TIMES[e.cat];
    }
    render();
  },
  shifttcolor: el => { if (V.shiftType) { V.shiftType.color = el.dataset.v; render(); } },
  shifttsave: saveType,
  shifttdel: deleteType,
  shifttcancel: close,
};

export const inputs = {
  shifttname: el => { if (V.shiftType) V.shiftType.name = el.value; },
  shifttshort: el => {
    if (!V.shiftType) return;
    V.shiftType.short = el.value.slice(0, 3);
    /* Nur die Vorschau oben nachziehen; neu zeichnen würde die Tastatur schließen */
    const badge = document.querySelector('.sh-typehead .sh-code');
    if (badge) badge.textContent = V.shiftType.short || '?';
  },
  shiftttime: (el, type) => {
    if (!V.shiftType || type !== 'change') return;
    if (el.dataset.i === '0') V.shiftType.t0 = el.value; else V.shiftType.t1 = el.value;
  },
};
