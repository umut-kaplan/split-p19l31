/* Wege in der laufenden Einheit (4.6): Kopfleiste mit Übersicht, feste Aktionsleiste unten mit „Weiter“ und „Beenden“,
   Übersichts-Sheet, Sprung zu einer Übung, eingeklappte erledigte Übungen und der Weg zurück aus anderen Seiten. */
import { S, V } from '../state.js';
import { esc, mmss, plural } from '../util.js';
import { render } from '../render.js';
import { plateSVG } from '../ui/plate.js';
import { ICON } from '../ui/icons.js';
import { openSheet, closeSheet } from '../ui/sheet.js';
import { overviewOf, nextOpen, progressOf } from '../domain/session-flow.js';
import { goTab } from './navigation.js';

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const LIST = svg('<path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>');
const DOWN = svg('<path d="M12 5v13M6 12l6 6 6-6"/>');

/* Offene Übungen merken sich, ob sie aufgeklappt wurden: V.exOpen[i] */
export const isOpen = i => !!(V.exOpen && V.exOpen[i]);
const setOpen = (i, on) => { V.exOpen = V.exOpen || {}; if (on) V.exOpen[i] = true; else delete V.exOpen[i]; };
/* Beim Start einer neuen Einheit vergessen */
export const resetFlow = () => { V.exOpen = {}; V.woHelp = null; };

/* ---------- Kopfleiste (klebt oben) ---------- */
export function woHeader(a, ov) {
  const n = ov.items.length;
  return `<div class="wo-bar">
    <div class="wo-row">
      ${plateSVG(a.color, '', '', { small: true })}
      <div class="grow"><h1>${esc(a.name)}</h1><span class="elapsed num" id="elapsed" data-tick="elapsed">${mmss((Date.now() - a.startedAt) / 1000)}</span>${a.short ? '<span class="short-badge wo-short" aria-label="Kurzversion">Kurz<span class="wo-short-x">version</span></span>' : ''}</div>
      <button class="wo-ov" data-act="wooverview" aria-label="Übersicht: ${ov.exDone} von ${n} ${plural(n, 'Übung', 'Übungen')} erledigt">${LIST}<span class="wo-ov-l"><span>Übersicht</span><b class="num">${ov.exDone}/${n}</b></span></button>
    </div>
    <div class="wo-prog" role="img" aria-label="${ov.setsDone} von ${ov.setsTotal} ${plural(ov.setsTotal, 'Satz', 'Sätzen')}, ${ov.exDone} von ${n} ${plural(n, 'Übung', 'Übungen')} erledigt">${ov.items.map(it =>
      `<i class="${it.state}"><b style="width:${it.total ? Math.round(it.done / it.total * 100) : 0}%"></b></i>`).join('')}</div>
  </div>`;
}

/* ---------- Aktionsleiste über der Tab-Leiste ---------- */
export function woDock(a, ov) {
  const nx = ov.next >= 0 ? ov.items[ov.next] : null;
  if (!nx) {
    return `<div class="wo-dock all-done day-${a.color}">
      <button class="btn primary wo-finish" data-act="finish">Alle Übungen erledigt: Training beenden</button>
    </div>`;
  }
  return `<div class="wo-dock day-${a.color}">
    <button class="btn wo-next" data-act="wonext" aria-label="Zur nächsten offenen Übung: ${esc(nx.name)}, Übung ${nx.i + 1} von ${ov.items.length}">
      <span class="wo-next-t"><small>Übung ${nx.i + 1} von ${ov.items.length}</small><b>${esc(nx.name)}</b></span>${DOWN}</button>
    <button class="btn primary wo-finish" data-act="finish">Beenden</button>
  </div>`;
}

/* ---------- Hinweis oben, zugeklappt ab dem zweiten Training ---------- */
export function woHelp(text) {
  const open = V.woHelp != null ? V.woHelp : !S.sessions.length;
  return `<details class="more wo-help" ${open ? 'open' : ''}>
    <summary data-act="wohelp">So trägst du Sätze ein</summary>
    <p class="wo-note">${text}</p>
  </details>`;
}

/* ---------- Übersicht ---------- */
function openOverview() {
  const a = S.active;
  if (!a) return;
  const ov = overviewOf(a.ex);
  const sub = it => it.state === 'done' ? 'Erledigt' : it.state === 'next' ? 'Als Nächstes' : it.done ? `${it.done} von ${it.total} ${plural(it.total, 'Satz', 'Sätzen')}` : 'Offen';
  openSheet({
    title: 'Übersicht',
    text: `${ov.exDone} von ${ov.items.length} ${plural(ov.items.length, 'Übung', 'Übungen')} erledigt, ${ov.setsDone} von ${ov.setsTotal} ${plural(ov.setsTotal, 'Satz', 'Sätzen')}. Tippen springt zur Übung.`,
    body: `<ol class="wo-ov-list">${ov.items.map(it => `<li>
      <button class="wo-ov-item ${it.state}" data-act="wojump" data-i="${it.i}">
        <span class="wo-ov-n num" aria-hidden="true">${it.state === 'done' ? ICON.check : it.i + 1}</span>
        <span class="wo-ov-t"><b>${esc(it.name)}</b><small>${sub(it)}${it.group ? ` · Supersatz ${it.group}` : ''}</small></span>
        <span class="wo-ov-c num">${it.done}/${it.total}</span>
      </button></li>`).join('')}</ol>`,
    actions: [{ label: 'Schließen', kind: 'ghost', fn: closeSheet }],
  });
}

/* ---------- Springen ---------- */
/* Oberkante von Pausentimer, Aktionsleiste oder Navigation: bis dahin ist die Seite zu sehen.
   Aus Abstand nach unten und Höhe gerechnet, weil der Pausentimer beim Erscheinen noch hereinfährt (transform). */
const fixedTop = e => window.innerHeight - (parseFloat(getComputedStyle(e).bottom) || 0) - e.offsetHeight;
const visibleBottom = () => Math.min(window.innerHeight, ...['#timer', '.wo-dock', 'nav.tabs']
  .map(sel => document.querySelector(sel)).filter(Boolean).map(fixedTop));

/* Übung i unter die Kopfleiste scrollen. Erste Übung eines Supersatzes: den ganzen Rahmen zeigen.
   Der erste offene Satz soll dabei über Pausentimer und Aktionsleiste stehen; dafür rutscht der Kartenkopf notfalls nach oben
   (die Aktionsleiste nennt die Übung). */
export function scrollToEx(i) {
  const card = document.getElementById('ex' + i);
  if (!card) return;
  const group = card.closest('.ss-group');
  const el = group && group.querySelector('.ex') === card ? group : card;
  const bar = document.querySelector('.wo-bar');
  const off = (bar ? bar.getBoundingClientRect().height : 0) + 8;
  let y = el.getBoundingClientRect().top + window.scrollY - off;
  const row = [...card.querySelectorAll('.set')].find(r => !r.classList.contains('done'));
  if (row) {
    const below = row.getBoundingClientRect().bottom + window.scrollY - y - (visibleBottom() - 8);
    if (below > 0) y += below;
  }
  window.scrollTo(0, Math.max(0, y));
}

/* Zu Übung i springen; eine erledigte, eingeklappte Übung klappt dabei auf */
export function jumpTo(i) {
  const a = S.active;
  if (!a || !a.ex[i]) return;
  if (progressOf(a.ex[i]).complete) setOpen(i, true);
  render();
  scrollToEx(i);
}

/* Eine Übung ist gerade eingeklappt: liegt ihre Zeile über dem sichtbaren Bereich, rückt sie unter die Kopfleiste,
   damit die nächste Übung direkt darunter zu sehen ist */
export function keepInView(i) {
  const card = document.getElementById('ex' + i);
  const bar = document.querySelector('.wo-bar');
  if (!card) return;
  const lim = bar ? bar.getBoundingClientRect().bottom : 0;
  if (card.getBoundingClientRect().top < lim) scrollToEx(i);
}

/* Zur nächsten offenen Übung scrollen. Noch nichts abgehakt: Anfang der Einheit (showStart). Alles erledigt: nach oben. */
export function scrollToCurrent() {
  const ex = S.active ? S.active.ex : [];
  const i = nextOpen(ex);
  const started = ex.some(x => (x.log || []).some(s => s.done));
  if (i > 0 || (i === 0 && started)) scrollToEx(i);
  else if (i === 0) showStart();
  else window.scrollTo(0, 0);
}

/* Anfang der Einheit: oben. Liegt der erste Satz hinter der Aktionsleiste (Varianten, lange Hinweise, kleine Bildschirme),
   rückt die Seite gerade so weit hoch, dass er zu sehen ist. Ist „So trägst du Sätze ein“ aufgeklappt (erstes Training),
   bleibt der Hinweis oben stehen. */
export function showStart() {
  window.scrollTo(0, 0);
  const help = document.querySelector('.wo-help');
  if (help && help.open) return;
  revealOpenSet(0);
}

/* Nach dem Abhaken: liegt der nächste offene Satz der Übung i hinter Pausentimer oder Aktionsleiste, rückt er gerade so weit hoch,
   dass er zu sehen ist (höchstens bis unter die Kopfleiste) */
export function revealOpenSet(i) {
  const card = document.getElementById('ex' + i);
  if (!card || card.classList.contains('folded')) return;
  const row = [...card.querySelectorAll('.set')].find(r => !r.classList.contains('done'));
  if (!row) return;
  const r = row.getBoundingClientRect();
  const bar = document.querySelector('.wo-bar');
  const top = bar ? bar.getBoundingClientRect().bottom : 0;
  const below = r.bottom - (visibleBottom() - 8);
  if (below > 0) window.scrollBy(0, Math.min(below, Math.max(0, r.top - top - 8)));
}

/* Zurück in die Einheit (Mini-Leiste, „Weiter trainieren“ auf Heute): alle Unterseiten zu wie beim Tipp auf den Tab
   (Kamera aus, Verlauf zurück, views/navigation.js), dann zur nächsten offenen Übung */
export function backToWorkout() {
  if (!S.active) return;
  goTab('training', { sub: 'start' });
  render();
  scrollToCurrent();
}

export const actions = {
  wooverview: openOverview,
  wojump: el => { V.sheet = null; jumpTo(+el.dataset.i); },
  wonext: () => { const i = S.active ? nextOpen(S.active.ex) : -1; if (i >= 0) jumpTo(i); },
  woback: backToWorkout,
  /* Erledigte Übung auf- oder zuklappen */
  exfold: el => {
    const i = +el.dataset.i;
    const open = !isOpen(i);
    setOpen(i, open);
    render();
    if (!open) keepInView(i);
  },
  /* Merkt sich, ob der Hinweis offen ist; das Auf- und Zuklappen selbst macht der Browser */
  wohelp: el => { const det = el.closest('details'); V.woHelp = det ? !det.open : !V.woHelp; },
};

export const inputs = {};
