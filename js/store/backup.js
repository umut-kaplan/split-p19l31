import { S, V, save, replaceState, LEGACY_KEY } from '../state.js';
import { toBackup, fromBackup } from './migrate.js';
import { dbAll, dbPut, dbClear } from './db.js';
import { fmt0, fmt1 } from '../util.js';
import { render } from '../render.js';
import { toast } from '../ui/toast.js';
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';
import { blobToDataURL, dataURLToBlob } from '../ui/image.js';
import { release } from '../timer.js';
import { resetPhotoCache, reconcilePhotos } from '../views/body-photos.js';
import { resetImageCache } from '../views/library.js';

/* Stores mit Bildern, die ein Backup „mit Fotos“ enthält */
export const IMAGE_STORES = ['photos', 'exerciseImages'];

/* ---------- Reine Helfer ---------- */
export function attachImages(backup, images) {
  return images && images.length ? { ...backup, images } : backup;
}

/* Nur gültige Bild-Einträge übernehmen; alte Backups ohne images liefern eine leere Liste */
export function restorableImages(raw) {
  if (!raw || !Array.isArray(raw.images)) return [];
  return raw.images.filter(i => i && IMAGE_STORES.includes(i.store)
    && typeof i.id === 'string' && i.id
    && typeof i.dataUrl === 'string' && i.dataUrl.startsWith('data:image/'));
}

/* Base64 macht Bilder etwa um ein Drittel größer */
export const base64Bytes = bytes => Math.ceil(bytes / 3) * 4;

export function sizeLabel(bytes) {
  if (bytes < 1024 * 1024) return `${fmt0(Math.max(1, bytes / 1024))} KB`;
  return `${fmt1(bytes / 1024 / 1024)} MB`;
}

/* ---------- Speichern ---------- */
const fileName = () => `split-backup-${new Date().toISOString().slice(0, 10)}.json`;

function done() {
  S.settings.lastBackup = Date.now();
  /* Erst jetzt ist der alte Speicherstand der ersten Version überflüssig */
  try { localStorage.removeItem(LEGACY_KEY); } catch (e) { /* egal */ }
  save(); render(); toast('Backup gespeichert');
}

/* Muss direkt aus einem Tipp heraus laufen, sonst verweigert Safari das Teilen-Menü */
function deliver(data) {
  const name = fileName();
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

async function collectImages() {
  const out = [];
  for (const store of IMAGE_STORES) {
    let list = [];
    try { list = await dbAll(store); } catch (e) { list = []; }
    for (const rec of list) {
      if (!rec || !rec.blob) continue;
      const item = { store, id: rec.id, dataUrl: await blobToDataURL(rec.blob) };
      if (rec.date) item.date = rec.date;
      if (rec.pose) item.pose = rec.pose;
      out.push(item);
    }
  }
  return out;
}

/* Bereitet beide Varianten vor und fragt dann, mit oder ohne Fotos */
export async function exportData() {
  toast('Backup wird vorbereitet');
  const base = toBackup(S);
  const plain = JSON.stringify(base, null, 1);
  let images = [];
  try { images = await collectImages(); } catch (e) { images = []; }
  const withImg = images.length ? JSON.stringify(attachImages(base, images)) : null;
  const photos = images.filter(i => i.store === 'photos').length;
  const others = images.length - photos;
  const what = [photos ? `${photos} ${photos === 1 ? 'Fortschrittsfoto' : 'Fortschrittsfotos'}` : '', others ? `${others} ${others === 1 ? 'Übungsbild' : 'Übungsbilder'}` : '']
    .filter(Boolean).join(' und ');
  openSheet({
    title: 'Backup speichern',
    text: withImg
      ? `Ohne Fotos etwa ${sizeLabel(plain.length)}, mit ${what} etwa ${sizeLabel(withImg.length)}. Die Fotos sind nur im Backup mit Fotos gesichert.`
      : `Etwa ${sizeLabel(plain.length)}. Speichere die Datei in iCloud Drive, dann überlebt sie auch einen Handywechsel.`,
    actions: [
      ...(withImg ? [{ label: 'Mit Fotos speichern', kind: 'primary', fn: () => { V.sheet = null; deliver(withImg); render(); } }] : []),
      { label: withImg ? 'Ohne Fotos speichern' : 'Backup speichern', kind: withImg ? '' : 'primary', fn: () => { V.sheet = null; deliver(plain); render(); } },
      { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
    ],
  });
}

/* ---------- Laden ---------- */
async function restoreImages(images) {
  for (const store of IMAGE_STORES) await dbClear(store).catch(() => {});
  for (const i of images) {
    const blob = await dataURLToBlob(i.dataUrl);
    const rec = { id: i.id, blob };
    if (i.date) rec.date = i.date;
    if (i.pose) rec.pose = i.pose;
    await dbPut(i.store, rec);
  }
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
      const images = onlyTraining ? [] : restorableImages(raw);
      const text = onlyTraining
        ? `Es stammt aus der ersten Version und enthält ${next.sessions.length} Trainings. Plan und Verlauf werden ersetzt, Profil und Körperdaten bleiben.`
        : `Es enthält ${next.sessions.length} Trainings${images.length ? ` und ${images.length} ${images.length === 1 ? 'Bild' : 'Bilder'}` : ''} und ersetzt alle Daten auf diesem Gerät.${!images.length && next.body.photos.length ? ' Fotos sind nicht enthalten; vorhandene Fotos auf diesem Gerät bleiben, soweit sie zum Backup passen.' : ''}`;
      confirmSheet('Backup laden?', text, 'Backup laden', async () => {
        release();
        next.settings.lastBackup = Date.now();
        replaceState(next);
        V.sheet = null; V.tab = 'today'; V.roll = true; V.planDay = null; V.histKey = null;
        if (images.length) {
          try { await restoreImages(images); } catch (e) { toast('Die Bilder ließen sich nicht alle wiederherstellen.'); }
        } else if (!onlyTraining) {
          await reconcilePhotos();
        }
        resetPhotoCache(); resetImageCache();
        render(); toast('Backup geladen');
      }, 'primary');
    });
  });
}

export const importData = () => document.getElementById('importFile').click();

/* Für „Alle Daten löschen“: Bild-Stores und Cache leeren */
export async function clearImages() {
  for (const store of [...IMAGE_STORES, 'foodCache']) await dbClear(store).catch(() => {});
  resetPhotoCache(); resetImageCache();
}
