import { esc } from '../util.js';

export const PAL = { red: '#E0403F', blue: '#2F7BE0', green: '#2FA85A', yellow: '#F2C230', white: '#E9E6DF', steel: '#8E959E' };
const INK = { yellow: '#1E2124', white: '#1E2124', steel: '#1E2124' };

let gid = 0;

/* Eine Wettkampf-Hantelscheibe. Oben der Name, unten ein Untertitel, beide auf dem Rand. */
export function plateSVG(color, top = '', bottom = '', opts = {}) {
  const c = PAL[color] || PAL.red;
  const ink = INK[color] || '#fff';
  const id = 'p' + (++gid);
  const { small, ghost } = opts;
  /* Lange Namen kleiner setzen, damit sie auf den oberen Bogen passen */
  const topSize = Math.min(30, Math.round(125 / (Math.max(1, String(top).length) * 0.6)));
  if (ghost) {
    return `<svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="94" fill="none" stroke="${c}" stroke-opacity=".35" stroke-width="8"/>
      <circle cx="100" cy="100" r="26" fill="#31363C"/><circle cx="100" cy="100" r="14" fill="#1E2124"/></svg>`;
  }
  return `<svg viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <radialGradient id="${id}s" cx="35%" cy="28%" r="80%">
        <stop offset="0" stop-color="#fff" stop-opacity=".28"/>
        <stop offset=".55" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".25"/>
      </radialGradient>
      <linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#E4E7EB"/><stop offset=".5" stop-color="#9AA1AA"/><stop offset="1" stop-color="#5E656E"/>
      </linearGradient>
      <path id="${id}t" d="M 26,100 A 74,74 0 0,1 174,100"/>
      <path id="${id}b" d="M 19,100 A 81,81 0 0,0 181,100"/>
    </defs>
    <circle cx="100" cy="100" r="98" fill="${c}"/>
    <circle cx="100" cy="100" r="98" fill="url(#${id}s)"/>
    <circle cx="100" cy="100" r="91" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="2"/>
    <circle cx="100" cy="100" r="56" fill="#000" fill-opacity=".14"/>
    <circle cx="100" cy="100" r="56" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1.5"/>
    ${small ? '' : `
    <text font-family="ui-rounded,-apple-system,system-ui,sans-serif" font-weight="800" font-size="${topSize}" letter-spacing="1" fill="${ink}" fill-opacity=".92" text-anchor="middle">
      <textPath href="#${id}t" startOffset="50%">${esc(top)}</textPath></text>
    <text font-family="-apple-system,system-ui,sans-serif" font-weight="700" font-size="10.5" letter-spacing="1.2" fill="${ink}" fill-opacity=".7" text-anchor="middle">
      <textPath href="#${id}b" startOffset="50%">${esc(bottom)}</textPath></text>`}
    <circle cx="100" cy="100" r="26" fill="url(#${id}h)"/>
    <circle cx="100" cy="100" r="26" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1"/>
    <circle cx="100" cy="100" r="14" fill="#1E2124"/>
  </svg>`;
}
