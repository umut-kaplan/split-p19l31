/* Einstellungen: Unterseite des Profils mit den Gruppen Studio, Daten und App.
   Das Profil selbst zeigt nur, was den Nutzer beschreibt („Über dich“). */
import { S, V, replaceState, LEGACY_KEY } from '../state.js';
import { esc, dShort } from '../util.js';
import { render } from '../render.js';
import { ICON } from '../ui/icons.js';
import { defaultState } from '../store/migrate.js';
import { exportData, exportCsv, importData, clearImages } from '../store/backup.js';
import { release } from '../timer.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/sheet.js';
import { fEquipment } from './profile-fields.js';
import * as healthImport from './health-import.js';
import * as backupReminder from './backup-reminder.js';
import * as plateSettings from './plate-settings.js';
import { section as whatsnewSection } from './whatsnew.js';
import { APP_VERSION } from '../data/changelog.js';
import { shiftProfileSection } from './shift-today.js';

/* Untermodule, deren actions und inputs app.js einsammelt */
export const modules = [healthImport, backupReminder, plateSettings];

/* Als Home-Bildschirm-App geöffnet? Dann braucht es die Anleitung dazu nicht mehr. */
const standalone = () => {
  try { return !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)); }
  catch (e) { return false; }
};

/* Versionsnummer ganz unten auf Profil und Einstellungen */
export const versionLine = () => `<p class="app-version">Split · Version ${APP_VERSION}</p>`;

/* Zahnrad oben rechts auf der Profilseite */
export const gearButton = () =>
  `<button class="icon set-gear" data-act="setopen" aria-label="Einstellungen">${ICON.gear}</button>`;

/* Zeile am Ende des Profils, damit die Einstellungen auch ohne das Zahnrad zu finden sind */
export const settingsLink = () => `<section class="p-section">
  <button class="set-link" data-act="setopen"><span><b>Einstellungen</b><small>Stangen und Scheiben, Geräte, Backup, Schichtplan, Apple Health, Was ist neu</small></span>${ICON.chevron}</button>
</section>`;

function backupSection() {
  const n = S.sessions.length;
  return `<section class="p-section card"><h2>Backup</h2>
    <p class="muted" style="margin:6px 0 14px">${n} ${n === 1 ? 'Training' : 'Trainings'} gespeichert.
      ${S.settings.lastBackup ? `Letztes Backup am ${esc(dShort(S.settings.lastBackup))}` : 'Noch kein Backup.'}
      Alles liegt nur auf diesem Handy. Speichere das Backup in iCloud Drive, dann überlebt es auch einen Handywechsel.
      ${S.body.photos.length ? `Fortschrittsfotos sind nur im Backup mit Fotos enthalten (${S.body.photos.length} Fotos).` : ''}</p>
    <div class="stack" style="margin-top:0">
      <button class="btn primary" data-act="export">Backup speichern</button>
      <button class="btn" data-act="import">Backup laden</button>
    </div>
    ${backupReminder.remindSetting()}
    ${V.persisted === false ? '<p class="small-print" style="margin-top:10px">Der Browser hat dauerhaften Speicher nicht zugesagt. Über den Home-Bildschirm geöffnet klappt das meist.</p>' : ''}
  </section>`;
}

function csvSection() {
  const n = S.sessions.length;
  return `<section class="p-section card"><h2>Trainings exportieren</h2>
    <p class="muted" style="margin:6px 0 14px">${n === 1 ? 'Dein Training' : n ? `Alle ${n} Trainings` : 'Die Trainings'} als CSV-Datei im Format der App Strong, Satz für Satz. Hevy kann sie importieren, Tabellenprogramme öffnen sie auch. Split selbst liest sie nicht wieder ein, dafür ist das Backup da.</p>
    <button class="btn" data-act="exportcsv" ${n ? '' : 'disabled'}>Trainings als CSV</button>
    ${n ? '' : '<p class="small-print" style="margin-top:10px">Noch keine Trainings gespeichert.</p>'}
  </section>`;
}

const homeScreenSection = () => standalone() ? '' : `<section class="p-section card"><h2>Auf den Home-Bildschirm</h2>
  <ul class="rules" style="margin-top:8px">
    <li>In Safari unten auf <b>Teilen</b> tippen.</li>
    <li><b>Zum Home-Bildschirm</b> wählen und bestätigen.</li>
    <li>Ab jetzt nur noch über das Symbol öffnen. Dann läuft die App auch offline, und die Daten bleiben erhalten.</li>
  </ul>
</section>`;

const legalSection = () => `<section class="p-section card"><h2>Hinweise und Quellen</h2>
  <p class="muted" style="margin-top:4px">Kalorien, BMI und Körperwerte sind Schätzungen aus Formeln. Sie ersetzen keine ärztliche oder ernährungsfachliche Beratung.</p>
  <p class="muted" style="margin-top:10px">Alle Daten bleiben auf diesem Handy. Nur die Suche nach Lebensmitteln und das Nachschlagen von Barcodes fragen Open Food Facts an.</p>
  <ul class="rules" style="margin-top:10px">
    <li>Übungsbilder: <a href="https://wger.de" target="_blank" rel="noopener">wger.de</a>, <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.de" target="_blank" rel="noopener">CC BY-SA 3.0</a> und <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.de" target="_blank" rel="noopener">4.0</a>. Verkleinert, weiß hinterlegt und als JPEG gespeichert; diese Fassungen stehen unter derselben Lizenz. Urheber in den Details jeder Übung und in den <a href="data/QUELLEN.md" target="_blank" rel="noopener">Einzelnachweisen</a>.</li>
    <li>Lebensmitteldaten: <a href="https://openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a> unter der <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL</a></li>
    <li>Barcode- und QR-Leser: ZXing, Apache-2.0</li>
    <li>Entpacken des Health-Exports: fflate, MIT</li>
  </ul>
</section>`;

const resetSection = () => `<section class="p-section"><h2>Zurücksetzen</h2>
  <div class="stack" style="margin-top:0">
    <button class="btn ghost" data-act="rerunob">Einrichtung noch einmal durchgehen</button>
    <button class="btn ghost" data-act="resetplan">3er-Split auf das Original zurücksetzen</button>
    <button class="btn danger" data-act="wipe">Alle Daten löschen</button>
  </div>
</section>`;

export function subview() {
  if (V.setView !== 'main') return null;
  const p = S.profile;
  return `<div class="day-steel settings">
    <div class="mot-top"><button class="link" data-act="setclose">Zurück zum Profil</button></div>
    <h1 class="page-title">Einstellungen</h1>

    <h2 class="set-group">Studio</h2>
    ${plateSettings.plateSettingsSection()}
    <section class="p-section"><h2>Geräte</h2>${fEquipment(p)}</section>

    <h2 class="set-group">Daten</h2>
    ${backupSection()}
    ${csvSection()}
    ${healthImport.importSection()}
    ${shiftProfileSection()}
    ${resetSection()}

    <h2 class="set-group">App</h2>
    ${whatsnewSection()}
    ${homeScreenSection()}
    ${legalSection()}
    ${versionLine()}
  </div>`;
}

export const actions = {
  setopen: () => { V.setView = 'main'; render(); window.scrollTo(0, 0); },
  setclose: () => { V.setView = null; render(); window.scrollTo(0, 0); },
  export: exportData,
  exportcsv: exportCsv,
  import: importData,
  rerunob: () => { S.settings.onboardingDone = false; V.ob = 1; V.setView = null; render(); window.scrollTo(0, 0); },
  wipe: () => confirmSheet('Alle Daten löschen?', 'Profil, Plan, Verlauf, Körperdaten, Fotos und ein laufendes Training werden gelöscht. Das lässt sich nur mit einem Backup rückgängig machen.', 'Alle Daten löschen', async () => {
    release();
    await clearImages();
    try { localStorage.removeItem(LEGACY_KEY); } catch (e) { /* egal */ }
    replaceState(defaultState());
    V.sheet = null; V.tab = 'today'; V.ob = 0; V.roll = true; V.planDay = null; V.histKey = null; V.setView = null;
    render(); toast('Alle Daten gelöscht');
  }),
};
