/* Backup-Erinnerung: Karte auf „Heute“ und Auswahl in den Einstellungen bei Backup. Logik in domain/backup-reminder.js.
   „Backup speichern“ nutzt data-act="export" aus den Einstellungen, derselbe Ablauf mit Teilen-Menü. */
import { S, save } from '../state.js';
import { esc } from '../util.js';
import { render } from '../render.js';
import { backupReminder, reminderText, remindEvery, REMIND_OPTIONS } from '../domain/backup-reminder.js';

/* Kurze Knöpfe, damit vier nebeneinander auch auf schmalen Handys einzeilig bleiben */
const LABEL = { 7: '7', 14: '14', 30: '30', 0: 'Aus' };
const SPOKEN = { 7: '7 Tage', 14: '14 Tage', 30: '30 Tage', 0: 'Aus' };

export function backupCard() {
  const r = backupReminder(S, Date.now());
  if (!r) return '';
  return `<section class="block card notice bk-card">
    <h2>Backup</h2>
    <p style="margin-bottom:0">${esc(reminderText(r))}</p>
    <div class="sug-btns">
      <button class="btn small primary" data-act="export">Backup speichern</button>
      <button class="btn small ghost" data-act="bklater">Später</button>
    </div>
  </section>`;
}

/* Auswahl unter Einstellungen bei Backup */
export function remindSetting() {
  const cur = remindEvery(S.settings.backupRemindDays);
  return `<p class="label" id="bk-remind-l" style="margin-top:16px">Auf „Heute“ erinnern nach wie vielen Tagen ohne Backup?</p>
    <div class="seg wide" role="group" aria-labelledby="bk-remind-l">${REMIND_OPTIONS.map(v =>
      `<button class="${v === cur ? 'on' : ''}" aria-pressed="${v === cur}" aria-label="${esc(SPOKEN[v])}" data-act="bkremind" data-v="${v}">${esc(LABEL[v])}</button>`).join('')}</div>`;
}

export const actions = {
  bklater: () => { S.settings.backupSnoozedAt = Date.now(); save(); render(); },
  bkremind: el => {
    S.settings.backupRemindDays = remindEvery(Number(el.dataset.v));
    save(); render();
  },
};
