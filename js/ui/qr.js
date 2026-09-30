/* QR-Codes mit der mitgelieferten ZXing-Bibliothek. Z ist window.ZXing (in Tests globalThis.ZXing).
   Schreiben: eigene SVG-Ausgabe, schwarz auf weiß mit Ruhezone, damit der Code auf dem Bildschirm scharf bleibt.
   Lesen: aus einer Luminanzquelle, im Browser aus einem Canvas.

   ZXing-js liest größere Codes (ab Version 7) nicht bei jeder Maske gleich gut: Manche Datenmuster ähneln den
   Suchmustern in den Ecken. Darum prüft qrSVG den Code vor dem Anzeigen an einem nachgestellten Kamerabild und
   nimmt, falls nötig, eine andere der acht Masken. Der Inhalt bleibt derselbe. */

/* Module des Codes als Zeilen aus true (schwarz) und false. level: 'L' | 'M' | 'Q' | 'H'; mask: 0 bis 7 oder null (ZXing wählt) */
export function qrMatrix(Z, text, level = 'M', mask = null) {
  const enc = Z.QRCodeEncoder;
  const own = Object.prototype.hasOwnProperty.call(enc, 'chooseMaskPattern');
  const choose = enc.chooseMaskPattern;
  if (mask != null) enc.chooseMaskPattern = () => mask;
  let code;
  try {
    code = enc.encode(text, Z.QRCodeDecoderErrorCorrectionLevel.fromString(level), null);
  } finally {
    if (mask != null) { if (own) enc.chooseMaskPattern = choose; else delete enc.chooseMaskPattern; }
  }
  const m = code.getMatrix();
  const size = m.getWidth();
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) row.push(m.get(x, y) === 1);
    rows.push(row);
  }
  return { size, version: code.getVersion().getVersionNumber(), level, mask: code.getMaskPattern(), rows };
}

/* Nachgestelltes Kamerabild: s Pixel pro Modul, leicht gedreht, weichgezeichnet, grauer Rand. Liefert Luminanzwerte. */
export function probeImage(q, s, rot) {
  const n = q.size, full = (n + 8) * s, c = Math.ceil(full + 4 * s);
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const raw = new Float32Array(c * c);
  for (let y = 0; y < c; y++) {
    for (let x = 0; x < c; x++) {
      let acc = 0;
      for (let k = 0; k < 4; k++) {
        const px = x + (k & 1 ? 0.75 : 0.25) - c / 2, py = y + (k & 2 ? 0.75 : 0.25) - c / 2;
        const u = cos * px + sin * py + full / 2, v = -sin * px + cos * py + full / 2;
        const mx = Math.floor(u / s) - 4, my = Math.floor(v / s) - 4;
        const inside = u >= 0 && v >= 0 && u < full && v < full;
        acc += !inside ? 150 : mx >= 0 && my >= 0 && mx < n && my < n && q.rows[my][mx] ? 30 : 225;
      }
      raw[y * c + x] = acc / 4;
    }
  }
  const lum = new Uint8ClampedArray(c * c);
  for (let y = 0; y < c; y++) {
    for (let x = 0; x < c; x++) {
      let a = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && xx >= 0 && yy < c && xx < c) { a += raw[yy * c + xx]; k++; }
      }
      lum[y * c + x] = a / k;
    }
  }
  return { lum, c };
}

/* Modulgrößen und Drehungen der Probe: von knapp lesbar bis nah vor der Kamera */
export const PROBES = [[3.5, 0.02], [4.5, -0.03], [5.5, 0.015], [6.5, -0.01]];

/* Wie viele Proben liest ZXing-js richtig? */
export function probeScore(Z, q, text) {
  return PROBES.filter(([s, rot]) => {
    const { lum, c } = probeImage(q, s, rot);
    return readQR(Z, new Z.RGBLuminanceSource(lum, c, c)) === text;
  }).length;
}

/* Code mit der Maske, die alle Proben besteht; zuerst die von ZXing gewählte, sonst die mit den meisten Treffern */
export function robustMatrix(Z, text, level = 'M') {
  const first = qrMatrix(Z, text, level);
  let best = first, bestScore = probeScore(Z, first, text);
  for (let mask = 0; mask < 8 && bestScore < PROBES.length; mask++) {
    if (mask === first.mask) continue;
    const q = qrMatrix(Z, text, level, mask);
    const score = probeScore(Z, q, text);
    if (score > bestScore) { best = q; bestScore = score; }
  }
  return { ...best, score: bestScore };
}

/* SVG mit einem Pfad; waagerechte Läufe schwarzer Module werden zu einem Rechteck zusammengefasst */
export function matrixSVG(q, { quiet = 4, label = 'QR-Code' } = {}) {
  const n = q.size + 2 * quiet;
  let d = '';
  q.rows.forEach((row, y) => {
    for (let x = 0; x < q.size;) {
      if (!row[x]) { x++; continue; }
      let w = 1;
      while (x + w < q.size && row[x + w]) w++;
      d += `M${x + quiet} ${y + quiet}h${w}v1h-${w}z`;
      x += w;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="${label.replace(/[&<>"]/g, '')}">`
    + `<rect width="${n}" height="${n}" fill="#fff"/><path fill="#000" d="${d}"/></svg>`;
}

/* QR-Code als SVG. check: vorher an nachgestellten Kamerabildern prüfen und die Maske danach wählen */
export function qrSVG(Z, text, { level = 'M', quiet = 4, label = 'QR-Code', check = true } = {}) {
  const q = check ? robustMatrix(Z, text, level) : qrMatrix(Z, text, level);
  return { svg: matrixSVG(q, { quiet, label }), size: q.size, version: q.version, mask: q.mask, score: q.score };
}

/* Liest einen QR-Code aus einer ZXing-Luminanzquelle. Liefert den Text oder null. */
export function readQR(Z, source, { both = true } = {}) {
  const hints = new Map();
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const reader = new Z.QRCodeReader();
  for (const Bin of both ? [Z.HybridBinarizer, Z.GlobalHistogramBinarizer] : [Z.HybridBinarizer]) {
    try {
      return reader.decode(new Z.BinaryBitmap(new Bin(source)), hints).getText();
    } catch (e) { reader.reset(); }
  }
  return null;
}
