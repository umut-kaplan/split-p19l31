/* QR-Scanner für den Vergleich: Rückkamera, zuerst BarcodeDetector, sonst ZXing (iOS Safari).
   Ablauf wie beim Barcode-Scanner: Freigabe, Fehlerfälle, Stream endet beim Schließen, beim Wegwechseln und im Hintergrund. */
import { V } from '../state.js';
import { render } from '../render.js';
import { loadZxing } from '../ui/zxing.js';
import { readQR } from '../ui/qr.js';

const cam = { stream: null, timer: null, busy: false, pending: false, detector: undefined, canvas: null, failed: false, last: null, onText: null };

export const scanning = () => V.cmpView === 'scan';

/* Status bleibt über ein neues Zeichnen hinweg stehen */
export function status(text) {
  V.cmpScanStatus = text;
  const el = document.getElementById('cmp-scan-status');
  if (el) el.textContent = text;
}

export const cameraFailed = () => cam.failed;

export function stopScanner() {
  clearInterval(cam.timer);
  cam.timer = null;
  if (cam.stream) cam.stream.getTracks().forEach(t => t.stop());
  cam.stream = null;
  cam.busy = false;
  cam.last = null;
}

/* Vor dem Öffnen: Fehlerzustand und Status zurücksetzen. onText(text) liefert true, wenn der Code passt und der Scan endet. */
export function resetScanner(onText) {
  stopScanner();
  cam.failed = false;
  cam.onText = onText;
  V.cmpScanStatus = 'Kamera wird gestartet …';
}

/* Nach jedem Zeichnen die Kamera an das neue Video-Element hängen */
export async function attach() {
  const video = document.getElementById('cmp-video');
  /* Läuft die Freigabe noch, hängt der erste Aufruf das Bild an das dann aktuelle Video-Element */
  if (!video || !scanning() || cam.failed || cam.pending) return;
  try {
    if (!cam.stream) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error(), { name: 'NoCamera' });
      cam.pending = true;
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          /* Volle HD-Auflösung: Aus 40 cm hat ein Modul des Codes sonst weniger als drei Pixel, zu wenig für ZXing */
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
        });
      } finally { cam.pending = false; }
      /* Während der Freigabe weggetippt? Dann gleich wieder aus. */
      if (!scanning() || !document.getElementById('cmp-video')) { stream.getTracks().forEach(t => t.stop()); return; }
      cam.stream = stream;
    }
    const el = document.getElementById('cmp-video');
    if (el.srcObject !== cam.stream) el.srcObject = cam.stream;
    await el.play().catch(() => {});
    if (!cam.last) status('Halte den QR-Code des anderen in den Rahmen, aus etwa 30 cm.');
    loop();
  } catch (e) {
    stopScanner();
    cam.failed = true;
    status(e && e.name === 'NotAllowedError'
      ? 'Kein Zugriff auf die Kamera. Erlaube ihn in den Einstellungen oder füge den Code-Text unten ein.'
      : 'Die Kamera lässt sich hier nicht starten. Füge den Code-Text unten ein.');
    /* Neu zeichnen: „Noch einmal versuchen“ erscheint, das Textfeld zum Einfügen ist aufgeklappt */
    if (scanning()) render();
  }
}

async function nativeDetector() {
  if (cam.detector !== undefined) return cam.detector;
  cam.detector = null;
  try {
    if ('BarcodeDetector' in window) {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      if (supported.includes('qr_code')) cam.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    }
  } catch (e) { cam.detector = null; }
  return cam.detector;
}

/* Das mittlere Quadrat des Kamerabilds mit ZXing lesen, in voller Auflösung (höchstens 1100 Pixel) */
function zxingRead(Z, video) {
  const sw = video.videoWidth, sh = video.videoHeight;
  const side = Math.min(sw, sh) * 0.9;
  const scale = Math.min(1, 1100 / side);
  if (!cam.canvas) cam.canvas = document.createElement('canvas');
  const c = cam.canvas;
  c.width = c.height = Math.round(side * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, c.width, c.height);
  return readQR(Z, new Z.HTMLCanvasElementLuminanceSource(c), { both: false });
}

async function detect(video) {
  if (!video.videoWidth) return null;
  const det = await nativeDetector();
  if (det) {
    const found = await det.detect(video);
    return found.length ? found[0].rawValue : null;
  }
  return zxingRead(await loadZxing(), video);
}

function loop() {
  if (cam.timer) return;
  cam.timer = setInterval(async () => {
    const video = document.getElementById('cmp-video');
    if (!video || !scanning() || document.visibilityState === 'hidden') { stopScanner(); return; }
    if (cam.busy) return;
    cam.busy = true;
    try {
      const text = await detect(video);
      /* Denselben fremden Code nicht immer wieder prüfen */
      if (text && text !== cam.last && scanning()) {
        cam.last = text;
        if (cam.onText && cam.onText(text)) {
          stopScanner();
          if (navigator.vibrate) navigator.vibrate(60);
        }
      }
    } catch (e) {
      stopScanner();
      cam.failed = true;
      status('Das Lesen klappt hier nicht. Füge den Code-Text unten ein.');
      if (scanning()) render();
    } finally {
      cam.busy = false;
    }
  }, 250);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { stopScanner(); return; }
  if (scanning() && document.getElementById('cmp-video')) attach();
});
window.addEventListener('pagehide', stopScanner);
