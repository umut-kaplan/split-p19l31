import { esc } from '../util.js';
import { PAL } from './plate.js';

const INK = { yellow: '#1E2124', white: '#1E2124', steel: '#1E2124' };
let bid = 0;

/* Abzeichen als Hantelscheibe: Farbe der Scheibe, Rand mit Griffmulden, in der Mitte Zahl oder kurzes Wort.
   Nicht verdiente Abzeichen erscheinen als Umriss. */
export function badgeSVG(b, earned = true) {
  const c = PAL[b.color] || PAL.red;
  const label = String(b.label);
  const size = label.length <= 2 ? 64 : label.length === 3 ? 50 : label.length === 4 ? 40 : 30;
  const text = (fill, op = 1) => `<text x="100" y="100" dy=".35em" text-anchor="middle" font-family="ui-rounded,-apple-system,system-ui,sans-serif"
    font-weight="800" font-size="${size}" fill="${fill}" fill-opacity="${op}">${esc(label)}</text>`;
  if (!earned) {
    return `<svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="92" fill="none" stroke="${c}" stroke-opacity=".3" stroke-width="8" stroke-dasharray="14 10"/>
      <circle cx="100" cy="100" r="62" fill="#272B30"/>
      ${text('#6F7680')}
    </svg>`;
  }
  const id = 'bd' + (++bid);
  const ink = INK[b.color] || '#fff';
  /* Zwölf Griffmulden auf dem Rand, wie bei einer Bumper-Scheibe */
  const notches = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return `<circle cx="${(100 + Math.cos(a) * 80).toFixed(1)}" cy="${(100 + Math.sin(a) * 80).toFixed(1)}" r="4" fill="#000" fill-opacity=".16"/>`;
  }).join('');
  return `<svg viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <radialGradient id="${id}" cx="35%" cy="28%" r="80%">
        <stop offset="0" stop-color="#fff" stop-opacity=".3"/>
        <stop offset=".55" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".25"/>
      </radialGradient>
    </defs>
    <circle cx="100" cy="100" r="96" fill="${c}"/>
    <circle cx="100" cy="100" r="96" fill="url(#${id})"/>
    <circle cx="100" cy="100" r="89" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="2"/>
    ${notches}
    <circle cx="100" cy="100" r="62" fill="#000" fill-opacity=".16"/>
    <circle cx="100" cy="100" r="62" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1.5"/>
    ${text(ink, 0.95)}
  </svg>`;
}
