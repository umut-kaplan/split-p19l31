/* „Neu in Split“: nach einem Update einmal beim Start, sonst über das Profil */
import { S, save } from '../state.js';
import { esc } from '../util.js';
import { openSheet, closeSheet } from '../ui/sheet.js';
import { CHANGES, APP_VERSION } from '../data/changelog.js';
import { unseenChanges, shouldShow, dateDe } from '../domain/whatsnew.js';

const vChanges = list => `<div class="whatsnew">${list.map(c => `
  <section>
    <h3>Version ${esc(c.version)} <small>vom ${esc(dateDe(c.date))}</small></h3>
    <ul class="rules">${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
  </section>`).join('')}</div>`;

function show(list, title) {
  openSheet({ title, body: vChanges(list), actions: [{ label: 'Alles klar', kind: 'primary', fn: closeSheet }] });
}

/* Beim Start: einmal pro Version, danach gilt sie als gesehen */
export function showIfNew() {
  if (!shouldShow(S.settings, APP_VERSION)) return;
  const list = unseenChanges(CHANGES, S.settings.seenVersion);
  S.settings.seenVersion = APP_VERSION;
  save();
  if (list.length) show(list, 'Neu in Split');
}

/* Nach der Einrichtung ist der aktuelle Stand bekannt */
export function markSeen() { S.settings.seenVersion = APP_VERSION; }

export const section = () => `<section class="p-section card"><h2>Was ist neu</h2>
  <p class="muted" style="margin:6px 0 14px">Du nutzt Version ${esc(APP_VERSION)}.</p>
  <button class="btn" data-act="whatsnew">Alle Änderungen ansehen</button>
</section>`;

export const actions = {
  whatsnew: () => show(CHANGES, 'Was ist neu'),
};
