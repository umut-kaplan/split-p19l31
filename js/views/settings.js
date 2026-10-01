/* Einstellungen: Unterseite des Profils. Oben eine Übersicht mit kurzen Zeilen (Name, eine Zeile Erklärung, Pfeil),
   jede Zeile öffnet eine eigene Unterseite (V.setView). Das Profil selbst zeigt nur, was den Nutzer beschreibt. */
import { S, V, replaceState, LEGACY_KEY } from '../state.js';
import { esc, dShort } from '../util.js';
import { render } from '../render.js';
import { ICON } from '../ui/icons.js';
import { backLink, navRow } from '../ui/navlinks.js';
import { defaultState } from '../store/migrate.js';
import { exportData, exportCsv, importData, clearImages } from '../store/backup.js';
import { release } from '../timer.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/sheet.js';
import { fEquipment, dumbbellSection } from './gear.js';
import * as healthImport from './health-import.js';
import * as backupReminder from './backup-reminder.js';
import * as plateSettings from './plate-settings.js';
import { changesPage } from './whatsnew.js';
import { APP_VERSION } from '../data/changelog.js';
import { hasShiftPlan } from '../domain/shifts.js';
import { wakeOn } from '../wake-lock.js';

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
  <button class="set-link" data-act="setopen"><span><b>Einstellungen</b><small>Geräte, Stangen und Scheiben, Bildschirm im Training, Backup, Schichtplan, Apple Health, Was ist neu</small></span>${ICON.chevron}</button>
</section>`;

/* ---------- Übersicht ---------- */
/* Zeilen der Übersicht in Gruppen. Jede Zeile öffnet eine Unterseite (page) oder den Schichtplan (shift).
   env.standalone: als Home-Bildschirm-App geöffnet, dann fehlt die Anleitung dazu. */
export function settingsRows(env = {}) {
  const n = S.sessions.length;
  const last = S.settings.lastBackup;
  const shiftOn = hasShiftPlan(S.shifts);
  const hi = S.settings.healthImport;
  /* Erklärungen höchstens 30 Zeichen, damit sie auch bei 320 px Breite in eine Zeile passen */
  return [
    ['Training', [
      { page: 'studio', title: 'Studio', hint: 'Geräte, Kurzhanteln, Scheiben' },
      { page: 'training', title: 'Training', hint: wakeOn(S.settings) ? 'Bildschirm bleibt an' : 'Bildschirm geht wie sonst aus' },
    ]],
    ['Daten', [
      { page: 'backup', title: 'Backup', hint: last ? `Zuletzt am ${dShort(last)}` : 'Noch kein Backup' },
      { page: 'csv', title: 'Export', hint: n ? `${n} ${n === 1 ? 'Training' : 'Trainings'} als CSV-Datei` : 'Trainings als CSV-Datei' },
      { page: 'health', title: 'Apple Health', hint: hi && hi.at ? `Importiert am ${dShort(hi.at)}` : 'Daten aus der Health-App' },
      { shift: shiftOn ? 'settings' : 'setup', title: 'Schichtplan', hint: shiftOn ? 'Muster, Schichtarten, Import' : 'Schichten eintragen' },
      { page: 'reset', title: 'Zurücksetzen', hint: 'Einrichtung, Plan, alle Daten' },
    ]],
    ['App', [
      { page: 'whatsnew', title: 'Was ist neu', hint: `Version ${APP_VERSION}` },
      { page: 'legal', title: 'Hinweise und Quellen', hint: 'Schätzungen, Lizenzen' },
      ...(env.standalone ? [] : [{ page: 'home', title: 'Auf den Home-Bildschirm', hint: 'Offline nutzen, Daten behalten' }]),
    ]],
  ];
}

const rowAttrs = r => (r.shift ? `data-act="shiftopen" data-sub="${r.shift}"` : `data-act="setgo" data-v="${r.page}"`);

function overview() {
  return `<div class="day-steel settings">
    ${backLink()}
    <h1 class="page-title">Einstellungen</h1>
    ${settingsRows({ standalone: standalone() }).map(([group, rows]) => `<h2 class="set-group">${esc(group)}</h2>
    <div class="nav-list">${rows.map(r => navRow(r.title, r.hint, rowAttrs(r))).join('')}</div>`).join('')}
    ${versionLine()}
  </div>`;
}

/* ---------- Unterseiten ---------- */
function backupPage() {
  const n = S.sessions.length;
  return `<p class="page-sub">${n} ${n === 1 ? 'Training' : 'Trainings'} gespeichert.
      ${S.settings.lastBackup ? `Letztes Backup am ${esc(dShort(S.settings.lastBackup))}` : 'Noch kein Backup.'}</p>
    <section class="block card">
      <p class="muted">Alles liegt nur auf diesem Handy. Speichere das Backup in iCloud Drive, dann überlebt es auch einen Handywechsel.
        ${S.body.photos.length ? `Fortschrittsfotos sind nur im Backup mit Fotos enthalten (${S.body.photos.length} ${S.body.photos.length === 1 ? 'Foto' : 'Fotos'}).` : ''}</p>
      <div class="stack">
        <button class="btn primary" data-act="export">Backup speichern</button>
        <button class="btn" data-act="import">Backup laden</button>
      </div>
      ${backupReminder.remindSetting()}
      ${V.persisted === false ? '<p class="small-print" style="margin-top:10px">Der Browser hat dauerhaften Speicher nicht zugesagt. Über den Home-Bildschirm geöffnet klappt das meist.</p>' : ''}
    </section>`;
}

function csvPage() {
  const n = S.sessions.length;
  return `<section class="block card">
    <p class="muted">${n === 1 ? 'Dein Training' : n ? `Alle ${n} Trainings` : 'Die Trainings'} als CSV-Datei im Format der App Strong, Satz für Satz. Hevy kann sie importieren, Tabellenprogramme öffnen sie auch. Split selbst liest sie nicht wieder ein, dafür ist das Backup da.</p>
    <div class="stack"><button class="btn primary" data-act="exportcsv" ${n ? '' : 'disabled'}>Trainings als CSV</button></div>
    ${n ? '' : '<p class="small-print" style="margin-top:10px">Noch keine Trainings gespeichert.</p>'}
  </section>`;
}

const homePage = () => `<section class="block card">
  <ul class="rules">
    <li>In Safari unten auf <b>Teilen</b> tippen.</li>
    <li><b>Zum Home-Bildschirm</b> wählen und bestätigen.</li>
    <li>Ab jetzt nur noch über das Symbol öffnen. Dann läuft die App auch offline, und die Daten bleiben erhalten.</li>
  </ul>
</section>`;

/* Quellen als eigene Zeilen statt Links im Fließtext: jede Zeile ist mindestens 44 px hoch */
const src = (href, title, hint) => `<a class="nav-row src-row" href="${esc(href)}" target="_blank" rel="noopener">
  <span class="nav-row-t"><b>${esc(title)}</b><small>${esc(hint)}</small></span>${ICON.chevron}</a>`;

const legalPage = () => `<section class="block card">
    <p class="muted">Kalorien, BMI und Körperwerte sind Schätzungen aus Formeln. Sie ersetzen keine ärztliche oder ernährungsfachliche Beratung.</p>
    <p class="muted" style="margin-top:10px">Alle Daten bleiben auf diesem Handy. Nur die Suche nach Lebensmitteln und das Nachschlagen von Barcodes fragen Open Food Facts an.</p>
    <p class="muted" style="margin-top:10px">Die Wissen-Karten unter Training · Übungen nennen ihre Quellen einzeln, jeweils mit Link zur Studie oder Leitlinie.</p>
  </section>
  <section class="block">
    <h2>Übungsbilder</h2>
    <p class="muted">Von wger.de, verkleinert, weiß hinterlegt und als JPEG gespeichert; diese Fassungen stehen unter derselben Lizenz. Urheber in den Details jeder Übung und in den Einzelnachweisen.</p>
    <div class="nav-list" style="margin-top:12px">
      ${src('https://wger.de', 'wger.de', 'Herkunft der Übungsbilder')}
      ${src('https://creativecommons.org/licenses/by-sa/3.0/deed.de', 'CC BY-SA 3.0', 'Lizenz der Übungsbilder')}
      ${src('https://creativecommons.org/licenses/by-sa/4.0/deed.de', 'CC BY-SA 4.0', 'Lizenz der Übungsbilder')}
      ${src('data/QUELLEN.md', 'Einzelnachweise', 'Urheber und Lizenz jedes Bildes')}
    </div>
  </section>
  <section class="block">
    <h2>Lebensmitteldaten</h2>
    <div class="nav-list">
      ${src('https://openfoodfacts.org', 'Open Food Facts', 'Suche und Barcodes')}
      ${src('https://opendatacommons.org/licenses/odbl/1-0/', 'ODbL', 'Lizenz der Lebensmitteldaten')}
    </div>
  </section>
  <section class="block">
    <h2>Bibliotheken</h2>
    <ul class="rules">
      <li>Barcode- und QR-Leser: ZXing, Apache-2.0</li>
      <li>Entpacken des Health-Exports: fflate, MIT</li>
    </ul>
  </section>`;

const resetPage = () => `<div class="stack">
    <button class="btn ghost" data-act="rerunob">Einrichtung noch einmal durchgehen</button>
    <button class="btn ghost" data-act="resetplan">3er-Split auf das Original zurücksetzen</button>
    <button class="btn danger" data-act="wipe">Alle Daten löschen</button>
  </div>`;

/* Bildschirm wach halten (Screen Wake Lock, js/wake-lock.js), Standard an; Aktion wakelock in timer.js */
const trainingPage = () => {
  const on = wakeOn(S.settings);
  return `<section class="block card">
    <button class="cmp-switch wake-switch" role="switch" aria-checked="${on}" data-act="wakelock">
      <span>Bildschirm im Training wach halten</span><i aria-hidden="true"></i></button>
    <p class="small-print" style="margin-top:8px">Solange ein Training läuft, wird das Display nicht dunkel. Auf dem iPhone ab iOS 18.4, wenn Split vom Home-Bildschirm geöffnet ist.</p>
  </section>`;
};

/* Studio (4.7): zuerst die Geräte (Schnellauswahl, Smart-Zirkel, Gruppen), dann Kurzhantel-Steigerung, Stangen und Scheiben */
const studioPage = () => `<section class="p-section gear-sec"><h2>Geräte</h2>
    <p class="muted" style="margin-bottom:12px">Danach richten sich Bibliothek, Übungsauswahl im Plan und Vorschläge.</p>${fEquipment(S.profile)}</section>
  ${dumbbellSection()}
  ${plateSettings.plateSettingsSection()}`;

/* Unterseiten: Titel und Inhalt */
export const PAGES = {
  studio: ['Studio', studioPage],
  training: ['Training', trainingPage],
  backup: ['Backup', backupPage],
  csv: ['Export', csvPage],
  health: ['Apple Health', () => healthImport.importSection({ heading: false })],
  reset: ['Zurücksetzen', resetPage],
  whatsnew: ['Was ist neu', changesPage],
  legal: ['Hinweise und Quellen', legalPage],
  home: ['Auf den Home-Bildschirm', homePage],
};

export function subview() {
  if (!V.setView) return null;
  const page = PAGES[V.setView];
  if (!page) return overview();
  const [title, body] = page;
  return `<div class="day-steel settings set-page set-${esc(V.setView)}">
    ${backLink()}
    <h1 class="page-title">${esc(title)}</h1>
    ${body()}
  </div>`;
}

export const actions = {
  setopen: () => { V.setView = 'main'; render(); window.scrollTo(0, 0); },
  setgo: el => { if (PAGES[el.dataset.v]) { V.setView = el.dataset.v; render(); window.scrollTo(0, 0); } },
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
