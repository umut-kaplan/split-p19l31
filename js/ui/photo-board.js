/* Fototafel: die Posen einer Woche nebeneinander auf einem Bild, oben nur das Datum.
   Die Berechnungen sind rein und getestet, gezeichnet wird mit Canvas. */

export const BOARD = {
  height: 1080,
  pad: 40,          // Rand links, rechts, unten
  top: 130,         // Platz für das Datum
  gap: 24,          // Abstand zwischen den Bildern
  label: 64,        // Platz für die Posen-Beschriftung unter jedem Bild
  aspect: 3 / 4,    // Breite zu Höhe eines Bildfelds, wie Hochformat-Fotos der iPhone-Kamera
};

/* Maße des Bilds und Lage der Felder für n Posen (1 bis 3) */
export function boardLayout(n, b = BOARD) {
  const count = Math.max(1, Math.min(3, n | 0));
  const tileH = b.height - b.top - b.label - b.pad;
  const tileW = Math.round(tileH * b.aspect);
  const width = b.pad * 2 + count * tileW + (count - 1) * b.gap;
  const tiles = Array.from({ length: count }, (_, i) => {
    const x = b.pad + i * (tileW + b.gap);
    return { x, y: b.top, w: tileW, h: tileH, labelX: x + tileW / 2, labelY: b.top + tileH + b.label / 2 + 6 };
  });
  return { width, height: b.height, titleX: width / 2, titleY: Math.round(b.top * 0.58), tiles };
}

/* Bild vollständig in ein Feld einpassen, ohne etwas abzuschneiden */
export function fitContain(imgW, imgH, box) {
  const s = Math.min(box.w / imgW, box.h / imgH);
  const w = Math.round(imgW * s), h = Math.round(imgH * s);
  return { x: box.x + Math.round((box.w - w) / 2), y: box.y + Math.round((box.h - h) / 2), w, h };
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const parts = d => { const [y, m, day] = d.split('-').map(Number); return { y, m, day }; };

/* Datum über der Tafel: „27. September 2026“, bei mehreren Tagen „21. bis 24. September 2026“ */
export function boardTitle(dates) {
  const list = [...new Set(dates)].sort();
  if (!list.length) return '';
  const a = parts(list[0]), z = parts(list[list.length - 1]);
  if (list.length === 1) return `${a.day}. ${MONTHS[a.m - 1]} ${a.y}`;
  if (a.y === z.y && a.m === z.m) return `${a.day}. bis ${z.day}. ${MONTHS[z.m - 1]} ${z.y}`;
  if (a.y === z.y) return `${a.day}. ${MONTHS[a.m - 1]} bis ${z.day}. ${MONTHS[z.m - 1]} ${z.y}`;
  return `${a.day}. ${MONTHS[a.m - 1]} ${a.y} bis ${z.day}. ${MONTHS[z.m - 1]} ${z.y}`;
}

/* Reihenfolge vorne, seitlich, hinten; fehlende Posen fallen weg */
export const POSE_ORDER = ['front', 'side', 'back'];
export const boardPoses = poses => POSE_ORDER.filter(k => poses && poses[k]);

/* Zeichnet die Tafel. items: [{ img (geladenes Bild), label }], title: Datum als Text */
export function drawBoard(canvas, items, title) {
  const L = boardLayout(items.length);
  canvas.width = L.width;
  canvas.height = L.height;
  const g = canvas.getContext('2d');
  /* Gummiboden: dunkle Fläche mit feinen, immer gleich verteilten Körnern */
  g.fillStyle = '#1E2124';
  g.fillRect(0, 0, L.width, L.height);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < L.width * L.height / 900; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)';
    g.fillRect(rnd() * L.width, rnd() * L.height, 1.6, 1.6);
  }
  const round = 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#EEEBE4';
  g.font = `800 56px ${round}`;
  g.fillText(title, L.titleX, L.titleY);
  items.forEach((it, i) => {
    const t = L.tiles[i];
    g.fillStyle = '#272B30';
    g.beginPath();
    if (g.roundRect) g.roundRect(t.x, t.y, t.w, t.h, 24); else g.rect(t.x, t.y, t.w, t.h);
    g.fill();
    const f = fitContain(it.img.naturalWidth || it.img.width, it.img.naturalHeight || it.img.height, t);
    g.save();
    g.beginPath();
    if (g.roundRect) g.roundRect(t.x, t.y, t.w, t.h, 24); else g.rect(t.x, t.y, t.w, t.h);
    g.clip();
    g.drawImage(it.img, f.x, f.y, f.w, f.h);
    g.restore();
    g.fillStyle = '#A2A9B2';
    g.font = `600 32px ${round}`;
    g.fillText(it.label, t.labelX, t.labelY);
  });
  return L;
}
