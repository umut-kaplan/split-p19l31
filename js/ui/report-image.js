/* Wochenbericht als Bild (1080 × 1350) im Stil der App: Gummiboden, Hantelscheibe, große Zahlen.
   Alles läuft synchron, damit Safari das Teilen-Menü direkt aus dem Tipp heraus öffnet. */
import { fmt0, fmt1 } from '../util.js';
import { PAL } from './plate.js';
import { formatRecord, RECORD_LABEL } from '../domain/prs.js';

export const IMG_W = 1080;
export const IMG_H = 1350;

const C = { floor: '#1E2124', deck: '#272B30', deck2: '#31363C', chalk: '#EEEBE4', steel: '#A2A9B2', dim: '#6F7680', yellow: '#F2C230' };
const ROUND = 'ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif';
const LIGHT = { green: PAL.green, yellow: PAL.yellow, red: PAL.red };

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* Text kürzen, bis er in die Breite passt */
function fit(g, text, max) {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

function floor(g) {
  g.fillStyle = C.floor;
  g.fillRect(0, 0, IMG_W, IMG_H);
  /* Granulat wie auf dem Gummiboden, feste Folge statt Zufall */
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rnd() > 0.6 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.28)';
    g.beginPath();
    g.arc(rnd() * IMG_W, rnd() * IMG_H, 1.4 + rnd() * 1.4, 0, Math.PI * 2);
    g.fill();
  }
}

function plate(g, cx, cy, r, color) {
  const ring = (rad, col) => { g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fillStyle = col; g.fill(); };
  g.save();
  g.shadowColor = 'rgba(0,0,0,.45)';
  g.shadowBlur = 40;
  g.shadowOffsetY = 18;
  ring(r, color);
  g.restore();
  const sheen = g.createRadialGradient(cx - r * 0.3, cy - r * 0.45, 0, cx, cy, r * 1.1);
  sheen.addColorStop(0, 'rgba(255,255,255,.28)');
  sheen.addColorStop(0.55, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,.22)');
  ring(r, sheen);
  ring(r * 0.57, 'rgba(0,0,0,.14)');
  const hub = g.createLinearGradient(cx - r * 0.27, cy - r * 0.27, cx + r * 0.27, cy + r * 0.27);
  hub.addColorStop(0, '#E4E7EB'); hub.addColorStop(0.5, '#9AA1AA'); hub.addColorStop(1, '#5E656E');
  ring(r * 0.27, hub);
  ring(r * 0.14, C.floor);
}

function card(g, x, y, w, h, label, value, sub, accent) {
  roundRect(g, x, y, w, h, 34);
  g.fillStyle = C.deck;
  g.fill();
  g.strokeStyle = 'rgba(238,235,228,.09)';
  g.lineWidth = 2;
  g.stroke();
  g.textBaseline = 'alphabetic';
  g.fillStyle = C.steel;
  g.font = `600 32px ${SANS}`;
  g.fillText(fit(g, label, w - 64), x + 32, y + 56);
  g.fillStyle = accent || C.chalk;
  g.font = `800 72px ${ROUND}`;
  g.fillText(fit(g, value, w - 64), x + 32, y + 136);
  if (sub) {
    g.fillStyle = C.steel;
    g.font = `500 28px ${SANS}`;
    g.fillText(fit(g, sub, w - 64), x + 32, y + 182);
  }
}

/* Text auf höchstens `lines` Zeilen umbrechen, der Rest wird gekürzt */
function wrap(g, text, max, lines) {
  const words = text.split(' ');
  const out = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (g.measureText(next).width <= max) { cur = next; continue; }
    if (out.length === lines - 1) { out.push(fit(g, words.slice(i).reduce((a, w) => `${a} ${w}`, cur).trim(), max)); return out; }
    out.push(cur);
    cur = words[i];
  }
  if (cur) out.push(cur);
  return out;
}

const signed = (v, unit) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt1(Math.abs(v))} ${unit}`;

/* Zeichnet den Bericht. report aus domain/report.js, recovery aus domain/recovery.js (oder null), range: Text wie „21.–27. September“ */
export function drawReport(g, report, recovery, range) {
  floor(g);
  const pad = 72;
  /* Kopf */
  g.fillStyle = C.steel;
  g.font = `600 38px ${SANS}`;
  g.fillText('Wochenbericht', pad, 128);
  g.fillStyle = C.chalk;
  g.font = `800 72px ${ROUND}`;
  g.fillText(fit(g, range, 640), pad, 214);
  const t = report.training;
  plate(g, IMG_W - 196, 190, 128, t.met ? PAL.green : PAL.red);

  /* Karten, zwei Spalten */
  const gap = 24, cw = (IMG_W - pad * 2 - gap) / 2, ch = 212;
  let y = 348;
  const n = report.nutrition;
  const w = report.weight;
  const cells = [
    ['Einheiten', `${t.count} von ${t.target}`, t.met ? 'Wochenziel geschafft' : 'Wochenziel verpasst', t.met ? PAL.green : null],
    ['Harte Sätze', fmt0(t.sets), `${report.musclesOk} ${report.musclesOk === 1 ? 'Muskelgruppe' : 'Muskelgruppen'} im Ziel`, null],
    ['Neue Rekorde', fmt0(report.recordGroups.length), report.recordGroups.length ? report.recordGroups.slice(0, 2).map(r => r.name).join(', ') + (report.recordGroups.length > 2 ? ` +${report.recordGroups.length - 2}` : '') : 'Nächste Woche vielleicht', report.recordGroups.length ? C.yellow : null],
    ['Gewicht', w.ok ? signed(w.delta, 'kg') : 'offen', w.ok ? `Schnitt jetzt ${fmt1(w.end)} kg` : 'Zu wenige Einträge', null],
    ['Ø Kalorien', n.days ? fmt0(n.avgKcal) : 'offen', n.days ? (report.targets && report.targets.kcal ? `Ziel ${fmt0(report.targets.kcal)} kcal` : `an ${n.days} Tagen erfasst`) : 'Nichts eingetragen', null],
    ['Ø Protein', n.days ? `${fmt0(n.avgProtein)} g` : 'offen', n.days ? (report.targets && report.targets.protein ? `Ziel ${fmt0(report.targets.protein)} g` : `an ${n.days} Tagen erfasst`) : 'Nichts eingetragen', null],
  ];
  cells.forEach((c, i) => {
    const x = pad + (i % 2) * (cw + gap);
    if (i && i % 2 === 0) y += ch + gap;
    card(g, x, y, cw, ch, ...c);
  });
  y += ch + gap;

  /* Ampel */
  if (recovery) {
    const h = 184;
    roundRect(g, pad, y, IMG_W - pad * 2, h, 34);
    g.fillStyle = C.deck;
    g.fill();
    const col = LIGHT[recovery.level] || PAL.green;
    g.beginPath();
    g.arc(pad + 70, y + h / 2, 32, 0, Math.PI * 2);
    g.fillStyle = col;
    g.fill();
    g.fillStyle = C.chalk;
    g.font = `700 34px ${SANS}`;
    const label = { green: 'Erholung: grün', yellow: 'Erholung: gelb', red: 'Erholung: rot' }[recovery.level];
    g.fillText(label, pad + 128, y + 58);
    g.fillStyle = C.steel;
    g.font = `500 27px ${SANS}`;
    wrap(g, recovery.summary, IMG_W - pad * 2 - 160, 3).forEach((line, i) => g.fillText(line, pad + 128, y + 100 + i * 34));
    y += h + gap;
  }

  /* Rekorde im Detail, falls Platz über der Fußzeile */
  if (report.recordGroups.length && y + 100 < IMG_H - 110) {
    g.fillStyle = C.steel;
    g.font = `500 30px ${SANS}`;
    report.recordGroups.slice(0, 2).forEach((r, i) => {
      const it = r.items[0];
      g.fillText(fit(g, `${r.name}: ${RECORD_LABEL[it.kind]} ${formatRecord(it.kind, it.value)}`, IMG_W - pad * 2), pad, y + 40 + i * 44);
    });
  }

  g.fillStyle = C.dim;
  g.font = `600 30px ${SANS}`;
  g.fillText('Split', pad, IMG_H - 64);
  g.textAlign = 'right';
  g.fillText(report.key.replace('-W', ', KW '), IMG_W - pad, IMG_H - 64);
  g.textAlign = 'left';
}

/* Daten-URL in Bytes, synchron */
function dataUrlBytes(url) {
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* Bilddatei des Berichts. Synchron, darf direkt im Tipp laufen. */
export function reportImageFile(report, recovery, range) {
  const c = document.createElement('canvas');
  c.width = IMG_W;
  c.height = IMG_H;
  drawReport(c.getContext('2d'), report, recovery, range);
  const bytes = dataUrlBytes(c.toDataURL('image/png'));
  const name = `wochenbericht-${report.key}.png`;
  try { return new File([bytes], name, { type: 'image/png' }); }
  catch (e) { const b = new Blob([bytes], { type: 'image/png' }); b.name = name; return b; }
}
