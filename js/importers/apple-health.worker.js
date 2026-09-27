/* Liest den Apple-Health-Export im Hintergrund, damit die Oberfläche flüssig bleibt. */
import { readExport } from './apple-health.js';

self.onmessage = async ev => {
  const { file } = ev.data;
  let last = 0;
  try {
    const result = await readExport(file, {
      onProgress: (done, total, records) => {
        const now = Date.now();
        if (now - last > 150 || done >= total) { last = now; self.postMessage({ type: 'progress', done, total, records }); }
      },
    });
    self.postMessage({ type: 'done', result });
  } catch (e) {
    self.postMessage({ type: 'error', message: (e && e.message) || String(e) });
  }
};
