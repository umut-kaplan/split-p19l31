/* Barcode-Scanner: Rückkamera, zuerst BarcodeDetector, sonst ZXing (iOS Safari). Nummer eintippen geht immer. */
import { esc } from '../util.js';
import { isValidBarcode } from '../domain/foods.js';
import { lookupBarcode, OFF_CREDIT } from '../store/off.js';
import { toast } from '../ui/toast.js';
import { nut, topView, closeView, replaceView, customFood } from './food-state.js';
import { bar, amountSheet, newFoodView } from './food-forms.js';

const cam = { stream: null, timer: null, busy: false, detector: undefined, zx: null, canvas: null, torch: false, view: null };

export function view(v) {
  /* Nach dem Zeichnen die Kamera an das neue Video-Element hängen */
  setTimeout(() => attach(v), 0);
  return `<div class="day-yellow food-sub">
    ${bar('Barcode scannen')}
    <div class="scan-box">
      <video id="food-video" playsinline muted autoplay aria-label="Kamerabild"></video>
      <div class="scan-frame" aria-hidden="true"><i></i></div>
    </div>
    <p class="muted scan-status" id="food-scan-status" role="status">${esc(v.status || 'Kamera wird gestartet …')}</p>
    <div class="scan-btns">
      <button class="btn small ghost" id="food-torch" data-act="foodtorch" hidden>Licht an</button>
      ${v.done ? '<button class="btn small" data-act="foodrescan">Noch einmal scannen</button>' : ''}
    </div>
    <section class="block card">
      <h2>Nummer eintippen</h2>
      <p class="small-print" style="margin-top:2px">Die Ziffern unter dem Strichcode, meist 13 Stück.</p>
      <div class="scan-manual">
        <label class="field">Barcode<input id="food-code" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="13 Ziffern" value="${esc(v.code || '')}"></label>
        <button class="btn primary small" data-act="foodcode">Nachschlagen</button>
      </div>
    </section>
    <p class="small-print" style="margin-top:14px">${esc(OFF_CREDIT)}</p>
  </div>`;
}

function status(text, v) {
  if (v) v.status = text;
  const el = document.getElementById('food-scan-status');
  if (el) el.textContent = text;
}

export function stopCamera() {
  clearInterval(cam.timer);
  cam.timer = null;
  if (cam.stream) cam.stream.getTracks().forEach(t => t.stop());
  cam.stream = null;
  cam.torch = false;
  cam.busy = false;
}

async function attach(v) {
  const video = document.getElementById('food-video');
  if (!video || topView() !== v || v.done) return;
  try {
    if (!cam.stream) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error(), { name: 'NoCamera' });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
      /* Während der Freigabe weggetippt? Dann gleich wieder aus. */
      if (topView() !== v || !document.getElementById('food-video')) { stream.getTracks().forEach(t => t.stop()); return; }
      cam.stream = stream;
    }
    const el = document.getElementById('food-video');
    el.srcObject = cam.stream;
    await el.play().catch(() => {});
    cam.view = v;
    status('Halte den Barcode waagerecht in den Rahmen.', v);
    showTorch();
    loop(v);
  } catch (e) {
    stopCamera();
    status(e && e.name === 'NotAllowedError'
      ? 'Kein Zugriff auf die Kamera. Erlaube ihn in den Einstellungen oder tippe die Nummer unten ein.'
      : 'Die Kamera lässt sich hier nicht starten. Tippe die Nummer unten ein.', v);
  }
}

function showTorch() {
  const btn = document.getElementById('food-torch');
  const track = cam.stream && cam.stream.getVideoTracks()[0];
  const caps = track && track.getCapabilities ? track.getCapabilities() : {};
  if (btn) {
    btn.hidden = !caps.torch;
    btn.textContent = cam.torch ? 'Licht aus' : 'Licht an';
  }
}

async function nativeDetector() {
  if (cam.detector !== undefined) return cam.detector;
  cam.detector = null;
  try {
    if ('BarcodeDetector' in window) {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter(f => supported.includes(f));
      if (formats.length) cam.detector = new window.BarcodeDetector({ formats });
    }
  } catch (e) { cam.detector = null; }
  return cam.detector;
}

let zxPromise = null;
function loadZxing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!zxPromise) {
    zxPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/zxing.min.js';
      s.onload = () => resolve(window.ZXing);
      s.onerror = () => { zxPromise = null; reject(new Error('ZXing ließ sich nicht laden.')); };
      document.head.appendChild(s);
    });
  }
  return zxPromise;
}

/* Den mittleren Streifen des Kamerabilds mit ZXing lesen */
export function zxingDecode(Z, source, sw, sh) {
  if (!cam.zx) {
    const hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    cam.zx = new Z.MultiFormatReader();
    cam.zx.setHints(hints);
  }
  if (!cam.canvas) cam.canvas = document.createElement('canvas');
  const c = cam.canvas;
  const cropW = sw * 0.8, cropH = sh * 0.5;
  const scale = Math.min(1, 800 / cropW);
  c.width = Math.round(cropW * scale);
  c.height = Math.round(cropH * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, (sw - cropW) / 2, (sh - cropH) / 2, cropW, cropH, 0, 0, c.width, c.height);
  try {
    const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(c)));
    return cam.zx.decodeWithState(bmp).getText();
  } catch (e) {
    return null;
  } finally {
    cam.zx.reset();
  }
}

async function detect(video) {
  if (!video.videoWidth) return null;
  const det = await nativeDetector();
  if (det) {
    const found = await det.detect(video);
    return found.length ? found[0].rawValue : null;
  }
  const Z = await loadZxing();
  return zxingDecode(Z, video, video.videoWidth, video.videoHeight);
}

function loop(v) {
  clearInterval(cam.timer);
  cam.timer = setInterval(async () => {
    const video = document.getElementById('food-video');
    if (!video || topView() !== v || document.visibilityState === 'hidden') { stopCamera(); return; }
    if (cam.busy || v.done) return;
    cam.busy = true;
    try {
      const code = await detect(video);
      if (code && isValidBarcode(code) && !v.done) found(v, code);
    } catch (e) {
      if (!v.done) { stopCamera(); status('Das Lesen klappt hier nicht. Tippe die Nummer unten ein.', v); }
    } finally {
      cam.busy = false;
    }
  }, 300);
}

function found(v, code) {
  v.done = true;
  v.code = code;
  stopCamera();
  if (navigator.vibrate) navigator.vibrate(60);
  const input = document.getElementById('food-code');
  if (input) input.value = code;
  handleCode(v, code);
}

/* Barcode auflösen: erst eigene Lebensmittel, dann Open Food Facts, sonst selbst anlegen */
export async function handleCode(v, code) {
  const ctx = v.purpose === 'ingredient' ? { mode: 'ingredient' } : { mode: 'add', date: v.date, meal: v.meal };
  const own = nut().customFoods.find(c => c.code === code);
  if (own) { closeView(); amountSheet(customFood(own), ctx); return; }
  status(`Barcode ${code}, suche bei Open Food Facts …`, v);
  const r = await lookupBarcode(code);
  if (topView() !== v) return;
  if (r.food) { closeView(); amountSheet(r.food, ctx); return; }
  if (r.notFound) {
    toast('Open Food Facts kennt diesen Barcode nicht. Lege das Lebensmittel selbst an.');
    replaceView(newFoodView({ date: v.date, meal: v.meal, purpose: v.purpose }, { code }));
    return;
  }
  v.done = true;
  status(r.error || 'Das Nachschlagen hat nicht geklappt.', v);
  replaceView(v);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { stopCamera(); return; }
  const v = topView();
  if (v && v.kind === 'scan' && !v.done && document.getElementById('food-video')) attach(v);
});

export const actions = {
  foodtorch: async () => {
    const track = cam.stream && cam.stream.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !cam.torch }] });
      cam.torch = !cam.torch;
    } catch (e) { toast('Das Licht lässt sich hier nicht schalten.'); }
    showTorch();
  },
  foodcode: () => {
    const v = topView();
    const input = document.getElementById('food-code');
    if (!v || v.kind !== 'scan' || !input) return;
    const code = input.value.replace(/\D/g, '');
    if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) { toast('Ein Barcode hat 8, 12 oder 13 Ziffern.'); return; }
    if (!isValidBarcode(code)) { toast('Die Nummer passt nicht zur Prüfziffer. Prüf die Ziffern noch einmal.'); return; }
    input.blur();
    v.done = true;
    v.code = code;
    stopCamera();
    handleCode(v, code);
  },
  foodrescan: () => {
    const v = topView();
    if (!v || v.kind !== 'scan') return;
    v.done = false;
    v.status = '';
    replaceView(v);
  },
};
