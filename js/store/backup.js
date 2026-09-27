import { S, V, save, replaceState, LEGACY_KEY } from '../state.js';
import { toBackup, fromBackup } from './migrate.js';
import { render } from '../render.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/sheet.js';
import { release } from '../timer.js';

export function exportData() {
  const data = JSON.stringify(toBackup(S), null, 1);
  const name = `split-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const done = () => {
    S.settings.lastBackup = Date.now();
    /* Erst jetzt ist der alte Speicherstand der ersten Version überflüssig */
    try { localStorage.removeItem(LEGACY_KEY); } catch (e) { /* egal */ }
    save(); render(); toast('Backup gespeichert');
  };
  let file = null;
  try { file = new File([data], name, { type: 'application/json' }); } catch (e) { /* alter Browser */ }
  /* Auf dem iPhone öffnet das Teilen-Menü, dort „In Dateien sichern“ wählen */
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Split-Backup' }).then(done).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  done();
}

export function initImport() {
  const input = document.getElementById('importFile');
  input.addEventListener('change', ev => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    f.text().then(txt => {
      let raw, next;
      try { raw = JSON.parse(txt); next = fromBackup(raw); }
      catch (e) { toast(e instanceof SyntaxError ? 'Die Datei ist kein gültiges Backup.' : e.message); return; }
      /* Ein Backup der ersten Version kennt nur Plan und Trainings. Profil und Körperdaten bleiben dann stehen. */
      const onlyTraining = raw.app === 'split';
      if (onlyTraining) next = { ...S, plans: next.plans, activePlanId: next.activePlanId, sessions: next.sessions, active: null, settings: { ...S.settings } };
      const text = onlyTraining
        ? `Es stammt aus der ersten Version und enthält ${next.sessions.length} Trainings. Plan und Verlauf werden ersetzt, Profil und Körperdaten bleiben.`
        : `Es enthält ${next.sessions.length} Trainings und ersetzt alle Daten auf diesem Gerät.`;
      confirmSheet('Backup laden?', text, 'Backup laden', () => {
        release();
        next.settings.lastBackup = Date.now();
        replaceState(next);
        V.sheet = null; V.tab = 'today'; V.roll = true; V.planDay = null; V.histKey = null;
        render(); toast('Backup geladen');
      }, 'primary');
    });
  });
}

export const importData = () => document.getElementById('importFile').click();
