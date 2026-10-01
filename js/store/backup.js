import { S, V, save, replaceState, LEGACY_KEY } from '../state.js';
import { toBackup, fromBackup } from './migrate.js';
import { dbAll, dbPut, dbClear } from './db.js';
import { fmt0, fmt1 } from '../util.js';
import { render } from '../render.js';
import { toast } from '../ui/toast.js';
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';
import { blobToDataURL, dataURLToBlob } from '../ui/image.js';
import { shareFile, SHARE_FAILED } from '../ui/share-file.js';
import { trainingsCsv, csvFileName } from './csv.js';
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

/* Nur ein Backup über das Teilen-Menü gilt als belegt. Erst dann ist der alte Speicherstand der ersten Version überflüssig. */
function saved() {
  S.settings.lastBackup = Date.now();
  try { localStorage.removeItem(LEGACY_KEY); } catch (e) { /* egal */ }
  save(); render(); toast('Backup gespeichert');
}

/* Beim Download meldet der Browser nicht, ob die Datei ankommt. Der alte Speicherstand bleibt darum stehen,
   und als letztes Backup zählt der Download nur, wenn der Browser so überhaupt speichern kann. */
function downloaded(likely) {
  if (likely) { S.settings.lastBackup = Date.now(); save(); render(); }
  toast('Backup-Datei heruntergeladen. Prüfe, ob sie in Dateien liegt.');
}

/* Muss direkt aus einem Tipp heraus laufen, sonst verweigert Safari das Teilen-Menü */
function deliver(data) {
  shareFile(data, fileName(), 'application/json', 'Split-Backup').then(res => {
    if (res === 'shared') saved();
    else if (res === 'downloaded' || res === 'unsure') downloaded(res === 'downloaded');
    else if (res === 'failed') toast(SHARE_FAILED);
  });
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

/* ---------- Trainings als CSV ---------- */
/* Format von Strong, das Hevy importiert. Kein Backup: Split liest die Datei nicht wieder ein.
   Muss direkt aus einem Tipp heraus laufen, sonst verweigert Safari das Teilen-Menü. */
export function exportCsv() {
  if (!S.sessions.length) { toast('Noch keine Trainings gespeichert.'); return; }
  shareFile(trainingsCsv(S), csvFileName(), 'text/csv', 'Split-Trainings').then(res => {
    if (res === 'shared') toast('CSV gespeichert');
    else if (res === 'downloaded' || res === 'unsure') toast('CSV-Datei heruntergeladen. Prüfe, ob sie in Dateien liegt.');
    else if (res === 'failed') toast(SHARE_FAILED);
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
        ? `Es stammt aus der ersten Version und enthält ${next.sessions.length} ${next.sessions.length === 1 ? 'Training' : 'Trainings'}. Plan und Verlauf werden ersetzt, Profil und Körperdaten bleiben.`
        : `Es enthält ${next.sessions.length} ${next.sessions.length === 1 ? 'Training' : 'Trainings'}${images.length ? ` und ${images.length} ${images.length === 1 ? 'Bild' : 'Bilder'}` : ''} und ersetzt alle Daten auf diesem Gerät.${!images.length && next.body.photos.length ? ' Fotos sind nicht enthalten; vorhandene Fotos auf diesem Gerät bleiben, soweit sie zum Backup passen.' : ''}`;
      confirmSheet('Backup laden?', text, 'Backup laden', async () => {
        next.settings.lastBackup = Date.now();
        /* Erst wenn der neue Stand wirklich gespeichert ist, werden Fotos angeglichen. Sonst bleibt alles, wie es war. */
        const prev = JSON.parse(JSON.stringify(S));
        const recover = V.recover;
        V.recover = null;
        if (!replaceState(next)) {
          replaceState(prev);
          V.recover = recover;
          V.sheet = null; render();
          toast('Das Backup passt nicht in den Speicher dieses Browsers. Nichts wurde geändert.');
          return;
        }
        release();
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
