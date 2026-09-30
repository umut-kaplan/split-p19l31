/* Fortschrittsfotos: Bilddaten in IndexedDB (Store 'photos'), Metadaten in S.body.photos. Nichts verlässt das Gerät. */
import { S, V, save } from '../state.js';
import { esc, uid, ymd, dShort } from '../util.js';
import { render } from '../render.js';
import { dbAll, dbGet, dbPut, dbDel } from '../store/db.js';
import { resizeImage } from '../ui/image.js';
import { toast } from '../ui/toast.js';
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';
import { photoWeeks, mondayOf } from '../domain/body.js';
import { drawBoard, boardTitle, boardPoses } from '../ui/photo-board.js';

export const POSES = { front: 'Vorne', side: 'Seitlich', back: 'Hinten' };

/* Objekt-URLs der geladenen Bilder, nach id */
const urls = new Map();
let loaded = false, loading = false;

function ensureLoaded() {
  if (loaded || loading) return;
  loading = true;
  dbAll('photos')
    .then(list => { list.forEach(p => { if (p.blob && !urls.has(p.id)) urls.set(p.id, URL.createObjectURL(p.blob)); }); })
    .catch(() => { /* ohne IndexedDB bleiben Platzhalter */ })
    .finally(() => { loaded = true; loading = false; render(); });
}

/* Nach Import oder Löschen alles neu laden */
export function resetPhotoCache() {
  urls.forEach(u => URL.revokeObjectURL(u));
  urls.clear();
  loaded = false; loading = false;
}

/* Bilder löschen, zu denen es keine Metadaten mehr gibt */
export async function reconcilePhotos() {
  try {
    const known = new Set((S.body.photos || []).map(p => p.id));
    const all = await dbAll('photos');
    await Promise.all(all.filter(p => !known.has(p.id)).map(p => dbDel('photos', p.id)));
  } catch (e) { /* egal */ }
}

const weekLabel = w => `Woche ab ${dShort(w + 'T12:00')}`;

function img(p, cls = '') {
  if (!p) return `<div class="ph-empty ${cls}"><span>Kein Foto</span></div>`;
  const u = urls.get(p.id);
  if (!u) return `<div class="ph-empty ${cls}"><span>${loaded ? 'Foto fehlt' : 'Lädt …'}</span></div>`;
  return `<img class="${cls}" src="${u}" alt="${esc(POSES[p.pose] || '')}, ${esc(dShort(p.date + 'T12:00'))}">`;
}

/* Knöpfe zum Aufnehmen und aus der Galerie. Die Eingabe ist unsichtbar, aber per Label erreichbar. */
const pickers = pose => `<div class="ph-pick">
  <label class="btn small primary">Kamera<input class="vh" type="file" accept="image/*" capture="environment" data-in="bodyphoto" data-pose="${pose}"></label>
  <label class="btn small">Galerie<input class="vh" type="file" accept="image/*" data-in="bodyphoto" data-pose="${pose}"></label>
</div>`;

export function vPhotos() {
  ensureLoaded();
  const weeks = photoWeeks(S.body.photos);
  const thisWeek = weeks.find(w => w.week === mondayOf(ymd()));
  return `
    <section class="block card">
      <h2>Diese Woche</h2>
      <p class="muted" style="margin:4px 0 14px">Einmal pro Woche, gleiches Licht, gleiche Haltung, am besten morgens. Die Fotos bleiben auf diesem Gerät und werden nirgends hochgeladen.</p>
      <div class="ph-poses">${Object.entries(POSES).map(([k, l]) => `
        <div class="ph-pose">
          <p class="label">${l}</p>
          ${thisWeek && thisWeek.poses[k] ? `<button class="ph-thumb" data-act="bodyphotoshow" data-id="${thisWeek.poses[k].id}" aria-label="${l} ansehen">${img(thisWeek.poses[k])}</button>` : `<div class="ph-thumb">${img(null)}</div>`}
          ${pickers(k)}
        </div>`).join('')}</div>
      ${thisWeek ? `<div class="ph-board-row">
        <button class="btn small" data-act="bodyboard" data-week="${thisWeek.week}">In Fotos sichern</button>
        <p class="small-print">Legt die Posen dieser Woche nebeneinander auf ein Bild für deine Mediathek.</p>
      </div>` : ''}
    </section>
    ${compareBlock(weeks)}
    ${weeks.length ? `<section class="block">
      <h2>Alle Fotos</h2>
      ${weeks.map(w => `<div class="ph-week">
        <div class="ph-week-head"><p class="label">${esc(weekLabel(w.week))}</p>
          <button class="link" data-act="bodyboard" data-week="${w.week}" aria-label="${esc(weekLabel(w.week))} als ein Bild in Fotos sichern">In Fotos sichern</button></div>
        <div class="ph-row">${w.all.map(p => `<button class="ph-thumb small" data-act="bodyphotoshow" data-id="${p.id}" aria-label="${esc(POSES[p.pose])} vom ${esc(dShort(p.date + 'T12:00'))} ansehen">${img(p)}</button>`).join('')}</div>
      </div>`).join('')}
    </section>` : ''}`;
}

function compareBlock(weeks) {
  const pose = V.bodyPose || 'front';
  const withPose = weeks.filter(w => w.poses[pose]);
  if (withPose.length < 2) {
    return `<section class="block card"><h2>Vergleich</h2>
      <p class="muted" style="margin-top:4px">Ab zwei Wochen mit Fotos derselben Pose kannst du hier vergleichen.</p></section>`;
  }
  const a = withPose.find(w => w.week === V.bodyCmpA) || withPose[withPose.length - 1];
  const b = withPose.find(w => w.week === V.bodyCmpB) || withPose[0];
  const opts = sel => withPose.map(w => `<option value="${w.week}" ${w.week === sel.week ? 'selected' : ''}>${esc(weekLabel(w.week))}</option>`).join('');
  const mode = V.bodyCmpMode || 'side';
  const pa = a.poses[pose], pb = b.poses[pose];
  return `<section class="block card">
    <h2>Vergleich</h2>
    <div class="seg wide" role="group" aria-label="Pose" style="margin-top:10px">${Object.entries(POSES).map(([k, l]) =>
      `<button class="${k === pose ? 'on' : ''}" aria-pressed="${k === pose}" data-act="bodypose" data-pose="${k}">${l}</button>`).join('')}</div>
    <div class="row2" style="margin-top:12px">
      <label class="field">Vorher<select data-in="bodycmpa">${opts(a)}</select></label>
      <label class="field">Nachher<select data-in="bodycmpb">${opts(b)}</select></label>
    </div>
    <div class="seg wide" role="group" aria-label="Darstellung" style="margin-top:12px">
      <button class="${mode === 'side' ? 'on' : ''}" aria-pressed="${mode === 'side'}" data-act="bodycmpmode" data-mode="side">Nebeneinander</button>
      <button class="${mode === 'slider' ? 'on' : ''}" aria-pressed="${mode === 'slider'}" data-act="bodycmpmode" data-mode="slider">Schieberegler</button>
    </div>
    ${mode === 'side'
      ? `<div class="ph-side">${img(pa)}${img(pb)}</div>
         <div class="ph-side-l"><span>${esc(dShort(pa.date + 'T12:00'))}</span><span>${esc(dShort(pb.date + 'T12:00'))}</span></div>`
      : `<div class="ph-slider" style="--pos:50%">
           ${img(pb, 'ph-under')}
           <div class="ph-over">${img(pa)}</div>
           <i class="ph-handle" aria-hidden="true"></i>
         </div>
         <label class="vh" for="bodyslider">Vorher und nachher verschieben</label>
         <input id="bodyslider" class="ph-range" type="range" min="0" max="100" value="50" data-in="bodyslider">
         <div class="ph-side-l"><span>Vorher ${esc(dShort(pa.date + 'T12:00'))}</span><span>Nachher ${esc(dShort(pb.date + 'T12:00'))}</span></div>`}
  </section>`;
}

async function addPhoto(file, pose) {
  try {
    const blob = await resizeImage(file, 1080, 0.85);
    const date = ymd();
    /* Pro Tag und Pose ein Foto; ein neues ersetzt das alte */
    const old = S.body.photos.filter(p => p.date === date && p.pose === pose);
    for (const o of old) { await dbDel('photos', o.id).catch(() => {}); if (urls.has(o.id)) { URL.revokeObjectURL(urls.get(o.id)); urls.delete(o.id); } }
    const id = 'ph' + uid();
    await dbPut('photos', { id, blob, date, pose });
    S.body.photos = S.body.photos.filter(p => !old.includes(p));
    S.body.photos.push({ id, date, pose });
    if (!save()) {
      /* Ohne gespeicherten Verweis wäre das Bild nach dem Neustart verwaist */
      S.body.photos = S.body.photos.filter(p => p.id !== id);
      await dbDel('photos', id).catch(() => {});
      render(); toast('Der Speicher ist voll. Das Foto wurde nicht gespeichert.');
      return;
    }
    urls.set(id, URL.createObjectURL(blob));
    render(); toast(`Foto ${POSES[pose].toLowerCase()} gespeichert`);
  } catch (e) {
    toast(e && e.message ? e.message : 'Das Foto ließ sich nicht speichern.');
  }
}

function showPhoto(id) {
  const p = S.body.photos.find(x => x.id === id);
  if (!p) return;
  openSheet({
    title: `${POSES[p.pose]}, ${dShort(p.date + 'T12:00')}`,
    body: `<div class="ph-big">${img(p)}</div>`,
    actions: [
      { label: 'Foto löschen', kind: 'danger', fn: () => confirmSheet('Foto löschen?', 'Das Foto wird von diesem Gerät gelöscht.', 'Foto löschen', async () => {
        await dbDel('photos', id).catch(() => {});
        if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
        S.body.photos = S.body.photos.filter(x => x.id !== id);
        save(); closeSheet(); toast('Foto gelöscht');
      }) },
      { label: 'Schließen', kind: 'ghost', fn: closeSheet },
    ],
  });
}

/* ---------- Fototafel ---------- */
/* Das Bild wird vorher fertig gerechnet. So läuft das Teilen-Menü direkt aus dem Tipp auf „Bild sichern“,
   wie Safari es verlangt. */
let board = null;

function loadImage(id) {
  const ready = urls.has(id)
    ? Promise.resolve(urls.get(id))
    : dbGet('photos', id).then(rec => {
      if (!rec || !rec.blob) throw new Error('Ein Foto dieser Woche fehlt auf dem Gerät.');
      const u = URL.createObjectURL(rec.blob);
      urls.set(id, u);
      return u;
    });
  return ready.then(src => new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Ein Foto ließ sich nicht öffnen.'));
    im.src = src;
  }));
}

async function openBoard(week) {
  const w = photoWeeks(S.body.photos).find(x => x.week === week);
  const keys = w ? boardPoses(w.poses) : [];
  if (!keys.length) return;
  try {
    const items = [];
    for (const k of keys) items.push({ img: await loadImage(w.poses[k].id), label: POSES[k] });
    const canvas = document.createElement('canvas');
    drawBoard(canvas, items, boardTitle(keys.map(k => w.poses[k].date)));
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Das Bild ließ sich nicht erzeugen.'))), 'image/jpeg', 0.9));
    if (board) URL.revokeObjectURL(board.url);
    /* Dateiname mit dem Tag des neuesten Fotos, passend zum Datum auf der Tafel */
    const last = keys.map(k => w.poses[k].date).sort().pop();
    const name = `split-fotos-${last}.jpg`;
    board = { week, name, url: URL.createObjectURL(blob), file: new File([blob], name, { type: 'image/jpeg' }) };
    openSheet({
      title: 'Fototafel',
      text: `${keys.length === 1 ? 'Eine Pose' : `${keys.length} Posen`} auf einem Bild. Im Teilen-Menü „Bild sichern“ wählen, dann liegt es in deiner Mediathek. Die Fotos in der App bleiben unverändert.`,
      body: `<div class="ph-board"><img src="${board.url}" alt="Fototafel, ${esc(weekLabel(week))}"></div>`,
      actions: [
        { label: 'Bild sichern', kind: 'primary', fn: shareBoard },
        { label: 'Schließen', kind: 'ghost', fn: closeSheet },
      ],
    });
  } catch (e) {
    toast(e && e.message ? e.message : 'Die Fototafel ließ sich nicht erstellen.');
  }
}

function downloadBoard() {
  const a = document.createElement('a');
  a.href = board.url; a.download = board.name;
  document.body.appendChild(a); a.click(); a.remove();
  closeSheet(); toast('Bild gespeichert');
}

function shareBoard() {
  if (!board) return;
  const files = [board.file];
  if (navigator.canShare && navigator.canShare({ files })) {
    navigator.share({ files })
      .then(() => closeSheet())
      .catch(e => { if (!e || e.name !== 'AbortError') downloadBoard(); });
    return;
  }
  downloadBoard();
}

export const actions = {
  bodyboard: el => openBoard(el.dataset.week),
  bodyphotoshow: el => showPhoto(el.dataset.id),
  bodypose: el => { V.bodyPose = el.dataset.pose; V.bodyCmpA = null; V.bodyCmpB = null; render(); },
  bodycmpmode: el => { V.bodyCmpMode = el.dataset.mode; render(); },
  bodygophotos: () => { V.tab = 'body'; V.bodySub = 'photos'; render(); window.scrollTo(0, 0); },
  bodyphotolater: () => { S.settings.lastPhotoPrompt = mondayOf(ymd()); save(); render(); },
};

export const inputs = {
  bodyphoto: (el, type) => {
    if (type !== 'change' || !el.files || !el.files[0]) return;
    const file = el.files[0];
    const pose = el.dataset.pose;
    el.value = '';
    addPhoto(file, pose);
  },
  bodycmpa: (el, type) => { if (type === 'change') { V.bodyCmpA = el.value; render(); } },
  bodycmpb: (el, type) => { if (type === 'change') { V.bodyCmpB = el.value; render(); } },
  bodyslider: el => {
    const box = el.parentElement.querySelector('.ph-slider');
    if (box) box.style.setProperty('--pos', el.value + '%');
  },
};
