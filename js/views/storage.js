/* Speicherprobleme sichtbar machen: Banner bei vollem Speicher, eigene Seite bei beschädigtem Stand */
import { V, save } from '../state.js';
import { render } from '../render.js';
import { confirmSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { shareFile, SHARE_FAILED } from '../ui/share-file.js';

/* Über jeder Seite, solange das letzte Speichern gescheitert ist. Das Backup nimmt den Stand aus dem Arbeitsspeicher,
   also auch alles, was gerade nicht mehr gespeichert werden konnte. */
export const storageBanner = () => V.storageFull ? `<section class="banner storage-full" role="alert">
  <b>Der Speicher ist voll.</b> Neue Einträge werden gerade nicht gespeichert und sind nach dem Schließen der App weg.
  Speichere jetzt ein Backup, darin ist alles enthalten. Platz schaffen danach: alte Fortschrittsfotos löschen oder
  importierte Werte aus Apple Health entfernen.
  <button class="btn small" data-act="export" style="margin-top:10px">Backup speichern</button>
</section>` : '';

/* Statt der App, solange der gespeicherte Stand unlesbar ist */
export function recoverView() {
  const r = V.recover;
  return `<div class="day-red recover">
    <h1 class="page-title">Deine Daten ließen sich nicht lesen</h1>
    <p class="page-sub">Der gespeicherte Stand ist beschädigt. Split überschreibt ihn nicht, bis du hier entscheidest.
      ${r && r.key ? 'Eine Kopie liegt zusätzlich im Speicher dieses Browsers.' : ''}</p>
    <section class="block card">
      <h2>Aus einem Backup wiederherstellen</h2>
      <p class="muted" style="margin:6px 0 14px">Wenn du ein Backup in Dateien oder iCloud Drive hast, lade es. Dann ist alles wieder da, was bis dahin gespeichert war.</p>
      <button class="btn primary" data-act="import">Backup laden</button>
    </section>
    <section class="block card">
      <h2>Rohdaten sichern</h2>
      <p class="muted" style="margin:6px 0 14px">Speichert den beschädigten Stand als Datei. Damit lässt er sich später vielleicht noch retten.</p>
      <button class="btn" data-act="recraw">Rohdaten als Datei sichern</button>
    </section>
    <section class="block">
      <button class="btn ghost" data-act="recfresh">Neu anfangen</button>
    </section>
  </div>`;
}

export const actions = {
  recraw: () => {
    const r = V.recover;
    if (!r) return;
    shareFile(r.raw, `split-rohdaten-${new Date().toISOString().slice(0, 10)}.txt`, 'text/plain', 'Split-Rohdaten')
      .then(res => { if (res === 'failed') toast(SHARE_FAILED); });
  },
  recfresh: () => confirmSheet('Neu anfangen?',
    'Split startet mit der Einrichtung, und der beschädigte Stand wird überschrieben. Sichere vorher die Rohdaten, wenn du sie behalten willst.',
    'Neu anfangen', () => {
      V.recover = null; V.sheet = null;
      save(); render(); window.scrollTo(0, 0);
    }),
};
