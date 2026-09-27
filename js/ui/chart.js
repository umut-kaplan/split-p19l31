import { esc, fmt, dShort } from '../util.js';

let cid = 0;

/* Liniendiagramm mit Fläche. points: [{ t, v }], chronologisch. Farbe kommt aus var(--c). */
export function lineChart(points, label) {
  const W = 320, H = 160, L = 34, R = 12, T = 12, B = 24;
  let lo = Math.min(...points.map(p => p.v)), hi = Math.max(...points.map(p => p.v));
  if (hi === lo) { hi += 1; lo = Math.max(0, lo - 1); }
  const pad = (hi - lo) * 0.15;
  lo -= pad; hi += pad;
  const n = points.length;
  const X = i => L + (W - L - R) * (i / (n - 1));
  const Y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const coords = points.map((p, i) => `${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`);
  const area = `M${X(0).toFixed(1)},${H - B} L${coords.join(' L')} L${X(n - 1).toFixed(1)},${H - B} Z`;
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const g = 'cg' + (++cid);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c)" stop-opacity=".35"/><stop offset="1" stop-color="var(--c)" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="rgba(238,235,228,.08)"/>
      <text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#6F7680" font-family="ui-rounded,system-ui">${fmt(Math.round(v * 10) / 10)}</text>`).join('')}
    <path d="${area}" fill="url(#${g})"/>
    <polyline points="${coords.join(' ')}" fill="none" stroke="var(--c)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${points.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${i === n - 1 ? 5.5 : 3.5}" fill="${i === n - 1 ? 'var(--c)' : '#1E2124'}" stroke="var(--c)" stroke-width="2"/>`).join('')}
    <text x="${L}" y="${H - 6}" font-size="10" fill="#6F7680">${esc(dShort(points[0].t))}</text>
    <text x="${W - R}" y="${H - 6}" font-size="10" fill="#6F7680" text-anchor="end">${esc(dShort(points[n - 1].t))}</text>
  </svg>`;
}
