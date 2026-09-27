import { esc, fmt, fmt1, dShort } from '../util.js';
import { dayNumber, movingAverage, inRange } from '../domain/body.js';

let cid = 0;
const at = date => new Date(date + 'T12:00').getTime();

/* Gewichtsdiagramm: Rohwerte als Punkte, gleitender 7-Tage-Schnitt als Linie, Ziel gestrichelt.
   Der Schnitt wird über alle Einträge gerechnet, damit er am Anfang des Zeitraums schon stimmt. */
export function weightChart(weights, { today, range = '4w', target = null } = {}) {
  const raw = inRange(weights, today, range);
  if (!raw.length) return '';
  const ma = movingAverage(weights, 7).filter(p => raw.some(r => r.date === p.date));
  const W = 320, H = 180, L = 34, R = 12, T = 14, B = 24;
  let x0 = dayNumber(raw[0].date), x1 = dayNumber(raw[raw.length - 1].date);
  if (x1 - x0 < 6) { const mid = (x0 + x1) / 2; x0 = mid - 3; x1 = mid + 3; }
  const vals = [...raw.map(p => p.kg), ...ma.map(p => p.avg)];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  /* Ziel nur einbeziehen, wenn es nahe am Verlauf liegt, sonst wird die Kurve platt */
  const showTarget = target > 0 && target > lo - 3 && target < hi + 3;
  if (showTarget) { lo = Math.min(lo, target); hi = Math.max(hi, target); }
  if (hi - lo < 1) { const m = (hi + lo) / 2; lo = m - 0.5; hi = m + 0.5; }
  const pad = (hi - lo) * 0.12;
  lo -= pad; hi += pad;
  const X = d => L + (W - L - R) * ((dayNumber(d) - x0) / (x1 - x0));
  const Y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const g = 'wg' + (++cid);
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const line = ma.map(p => `${X(p.date).toFixed(1)},${Y(p.avg).toFixed(1)}`).join(' ');
  const last = ma[ma.length - 1];
  const area = ma.length > 1 ? `M${X(ma[0].date).toFixed(1)},${H - B} L${line.split(' ').join(' L')} L${X(last.date).toFixed(1)},${H - B} Z` : '';
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewichtsverlauf: ${raw.length} Einträge, zuletzt ${esc(fmt1(raw[raw.length - 1].kg))} kg, Schnitt ${esc(fmt1(last.avg))} kg">
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c)" stop-opacity=".22"/><stop offset="1" stop-color="var(--c)" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="rgba(238,235,228,.08)"/>
      <text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#6F7680" font-family="ui-rounded,system-ui">${fmt(Math.round(v * 10) / 10)}</text>`).join('')}
    ${showTarget ? `<line x1="${L}" x2="${W - R}" y1="${Y(target).toFixed(1)}" y2="${Y(target).toFixed(1)}" stroke="#F2C230" stroke-width="1.5" stroke-dasharray="5 4"/>
      <text x="${W - R}" y="${(Y(target) - 5).toFixed(1)}" text-anchor="end" font-size="10" fill="#F2C230">Ziel ${esc(fmt1(target))}</text>` : ''}
    ${area ? `<path d="${area}" fill="url(#${g})"/>` : ''}
    ${raw.map(p => `<circle cx="${X(p.date).toFixed(1)}" cy="${Y(p.kg).toFixed(1)}" r="2.6" fill="#1E2124" stroke="var(--c)" stroke-opacity=".75" stroke-width="1.5"/>`).join('')}
    ${ma.length > 1 ? `<polyline points="${line}" fill="none" stroke="var(--c)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
    <circle cx="${X(last.date).toFixed(1)}" cy="${Y(last.avg).toFixed(1)}" r="5" fill="var(--c)"/>
    <text x="${L}" y="${H - 6}" font-size="10" fill="#6F7680">${esc(dShort(at(raw[0].date)))}</text>
    <text x="${W - R}" y="${H - 6}" font-size="10" fill="#6F7680" text-anchor="end">${esc(dShort(at(raw[raw.length - 1].date)))}</text>
  </svg>`;
}
