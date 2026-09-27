import { S, V, replaceState, LEGACY_KEY } from '../state.js';
import { esc, dShort } from '../util.js';
import { render } from '../render.js';
import { defaultState } from '../store/migrate.js';
import { exportData, importData, clearImages } from '../store/backup.js';
import { release } from '../timer.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/sheet.js';
import { fName, fAge, fSex, fHeight, fWeight, fGoal, fActivity, fDays, fEquipment, fLimits } from './profile-fields.js';

export function view() {
  const p = S.profile;
  const n = S.sessions.length;
  return `<div class="day-steel">
    <h1 class="page-title">Profil</h1>
    <p class="page-sub">Jede Änderung wird sofort gespeichert.</p>

    <section class="block p-section"><h2>Über dich</h2>
      <div class="fields">${fName(p)}${fAge(p)}${fSex(p)}<div class="row2">${fHeight(p)}${fWeight(p)}</div></div>
    </section>
    <section class="p-section"><h2>Ziel</h2>${fGoal(p)}</section>
    <section class="p-section"><h2>Alltag und Training</h2>${fActivity(p)}<div style="margin-top:16px">${fDays(p)}</div></section>
    <section class="p-section"><h2>Geräte</h2>${fEquipment(p)}</section>
    <section class="p-section"><h2>Einschränkungen</h2>${fLimits(p)}</section>

    <section class="p-section card"><h2>Auf den Home-Bildschirm</h2>
      <ul class="rules" style="margin-top:8px">
        <li>In Safari unten auf <b>Teilen</b> tippen.</li>
        <li><b>Zum Home-Bildschirm</b> wählen und bestätigen.</li>
        <li>Ab jetzt nur noch über das Symbol öffnen. Dann läuft die App auch offline, und die Daten bleiben erhalten.</li>
      </ul>
    </section>

    <section class="p-section card"><h2>Backup</h2>
      <p class="muted" style="margin:6px 0 14px">${n} Trainings gespeichert.
        ${S.settings.lastBackup ? `Letztes Backup am ${esc(dShort(S.settings.lastBackup))}` : 'Noch kein Backup.'}
        Alles liegt nur auf diesem Handy. Speichere das Backup in iCloud Drive, dann überlebt es auch einen Handywechsel.
        ${S.body.photos.length ? `Fortschrittsfotos sind nur im Backup mit Fotos enthalten (${S.body.photos.length} Fotos).` : ''}</p>
      <div class="stack" style="margin-top:0">
        <button class="btn primary" data-act="export">Backup speichern</button>
        <button class="btn" data-act="import">Backup laden</button>
      </div>
      ${V.persisted === false ? '<p class="small-print" style="margin-top:10px">Der Browser hat dauerhaften Speicher nicht zugesagt. Über den Home-Bildschirm geöffnet klappt das meist.</p>' : ''}
    </section>

    <section class="p-section card"><h2>Hinweis</h2>
      <p class="muted" style="margin-top:4px">Kalorien, BMI und Körperwerte sind Schätzungen aus Formeln. Sie ersetzen keine ärztliche oder ernährungsfachliche Beratung.</p>
    </section>

    <section class="p-section"><h2>Zurücksetzen</h2>
      <div class="stack" style="margin-top:0">
        <button class="btn ghost" data-act="rerunob">Einrichtung noch einmal durchgehen</button>
        <button class="btn ghost" data-act="resetplan">3er-Split auf das Original zurücksetzen</button>
        <button class="btn danger" data-act="wipe">Alle Daten löschen</button>
      </div>
    </section>
  </div>`;
}

export const actions = {
  export: exportData,
  import: importData,
  rerunob: () => { S.settings.onboardingDone = false; V.ob = 1; render(); window.scrollTo(0, 0); },
  wipe: () => confirmSheet('Alle Daten löschen?', 'Profil, Plan, Verlauf, Körperdaten, Fotos und ein laufendes Training werden gelöscht. Das lässt sich nur mit einem Backup rückgängig machen.', 'Alle Daten löschen', async () => {
    release();
    await clearImages();
    try { localStorage.removeItem(LEGACY_KEY); } catch (e) { /* egal */ }
    replaceState(defaultState());
    V.sheet = null; V.tab = 'today'; V.ob = 0; V.roll = true; V.planDay = null; V.histKey = null;
    render(); toast('Alle Daten gelöscht');
  }),
};
