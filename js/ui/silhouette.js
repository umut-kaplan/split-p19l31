/* Körperumriss von vorne. Einzelne Bereiche werden aus den Umfängen breiter oder schmaler.
   Bezug ist jeweils der erste Eintrag mit diesem Maß; die Verformung ist begrenzt. Ohne DOM, darum testbar. */

export const SCALE_LIMIT = [0.75, 1.25];
export const clampScale = v => Math.max(SCALE_LIMIT[0], Math.min(SCALE_LIMIT[1], v));

const avg = (...xs) => { const v = xs.filter(x => x > 0); return v.length ? v.reduce((a, x) => a + x, 0) / v.length : null; };

/* Bereich der Figur und woraus er seinen Wert nimmt */
export const REGIONS = {
  neck: m => m.neck || null,
  shoulders: m => m.shoulders || null,
  chest: m => m.chest || null,
  waist: m => m.waist || null,
  belly: m => m.belly || null,
  hip: m => m.hip || null,
  upperArm: m => avg(m.upperArmL, m.upperArmR),
  forearm: m => m.forearm || null,
  thigh: m => m.thigh || null,
  calf: m => m.calf || null,
};

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/* Faktoren für „jetzt“ gegenüber dem ersten Eintrag. Fehlende Bereiche übernehmen einen Nachbarn. */
export function silhouetteScales(measurements) {
  const sorted = [...(measurements || [])].sort(byDate);
  const raw = {};
  Object.entries(REGIONS).forEach(([region, get]) => {
    const pts = sorted.map(m => get(m)).filter(v => v > 0);
    raw[region] = pts.length >= 2 ? clampScale(pts[pts.length - 1] / pts[0]) : null;
  });
  const pick = (...keys) => { for (const k of keys) if (raw[k] != null) return raw[k]; return 1; };
  return {
    neck: pick('neck'),
    shoulders: pick('shoulders', 'chest'),
    chest: pick('chest', 'shoulders'),
    waist: pick('waist', 'belly'),
    belly: pick('belly', 'waist'),
    hip: pick('hip', 'belly', 'waist'),
    upperArm: pick('upperArm', 'forearm'),
    forearm: pick('forearm', 'upperArm'),
    thigh: pick('thigh', 'calf'),
    calf: pick('calf', 'thigh'),
  };
}

export const NEUTRAL = { neck: 1, shoulders: 1, chest: 1, waist: 1, belly: 1, hip: 1, upperArm: 1, forearm: 1, thigh: 1, calf: 1 };

/* Grundmaße als halbe Breiten in SVG-Einheiten */
const BASE = {
  m: { neck: 9, trap: 24, shoulders: 42, chest: 36, ribs: 33, waist: 29, belly: 31, hip: 34, thigh: 17, calf: 12, upperArm: 8.5, forearm: 7 },
  f: { neck: 8, trap: 21, shoulders: 37, chest: 33, ribs: 29, waist: 25, belly: 29, hip: 37, thigh: 17.5, calf: 11.5, upperArm: 7.5, forearm: 6 },
};

const f1 = n => Math.round(n * 10) / 10;

/* Glatte, geschlossene Kurve durch Punkte (Catmull-Rom als kubische Bezier-Kurven) */
function smoothPath(pts) {
  const n = pts.length;
  let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d + ' Z';
}

const CX = 100;

/* Umriss aus Rumpf und Beinen, zwei Arme, Kopf */
export function bodyShapes(sc = NEUTRAL, sex = 'm') {
  const b = BASE[sex === 'f' ? 'f' : 'm'];
  const s = { ...NEUTRAL, ...sc };
  const legC = 18;
  const tw = b.thigh * s.thigh, cw = b.calf * s.calf;
  const hip = b.hip * s.hip;
  /* rechte Hälfte von oben nach unten (x als Abstand zur Mitte) */
  const right = [
    [b.neck * s.neck, 58],
    [b.trap * (0.5 + s.shoulders / 2), 68],
    [b.shoulders * s.shoulders, 82],
    [b.chest * s.chest - 1, 102],
    [b.chest * s.chest, 116],
    [b.ribs * (s.chest + s.waist) / 2, 134],
    [b.waist * s.waist, 152],
    [b.belly * s.belly, 172],
    [hip, 194],
    [Math.max(hip - 1, legC + tw), 214],
    [legC + tw, 238],
    [legC + 10, 292],
    [legC + cw, 326],
    [legC + 5.5, 380],
    [legC + 9, 402],
  ];
  const inner = [
    [legC - 6, 408],
    [legC - 5, 382],
    [Math.max(2, legC - cw * 0.85), 326],
    [legC - 8, 292],
    [Math.max(2, legC - tw * 0.8), 240],
    [2.5, 214],
  ];
  const mirror = pts => pts.map(([x, y]) => [CX - x, y]);
  const side = pts => pts.map(([x, y]) => [CX + x, y]);
  const outline = [
    ...side(right), ...side(inner),
    ...mirror(inner).reverse(), ...mirror(right).reverse(),
  ];
  /* Arm: Mittellinie leicht vom Körper weg, Breite aus Ober- und Unterarm */
  const armX0 = b.shoulders * s.shoulders - 5;
  const armAt = y => armX0 + (y - 88) * 0.06;
  const ua = b.upperArm * s.upperArm, fa = b.forearm * s.forearm;
  const armRight = [
    [armAt(84) - 2, 80],
    [armAt(92) + ua + 1, 92],
    [armAt(125) + ua, 125],
    [armAt(172) + ua * 0.72, 172],
    [armAt(200) + fa, 200],
    [armAt(246) + 4.5, 246],
    [armAt(266) + 6, 266],
    [armAt(284), 284],
    [armAt(266) - 6, 266],
    [armAt(246) - 4.5, 246],
    [armAt(200) - fa, 200],
    [armAt(172) - ua * 0.72, 172],
    [armAt(125) - ua, 125],
    [armAt(100) - ua * 0.7, 100],
  ];
  return {
    outline: smoothPath(outline),
    armR: smoothPath(side(armRight)),
    armL: smoothPath(mirror(armRight)),
    head: { cx: CX, cy: 34, rx: 16.5, ry: 21 },
  };
}

let sid = 0;
const shapesMarkup = sh => `<path d="${sh.outline}"/><path d="${sh.armR}"/><path d="${sh.armL}"/>
  <ellipse cx="${sh.head.cx}" cy="${sh.head.cy}" rx="${sh.head.rx}" ry="${sh.head.ry}"/>`;

/* mode: 'first' | 'now' | 'overlay'. Beim Überlagern ist der erste Eintrag ein gelber Umriss, jetzt ist gefüllt. */
export function silhouetteSVG({ mode = 'now', scales = NEUTRAL, sex = 'm', label = 'Körperumriss' } = {}) {
  const id = 'sil' + (++sid);
  const now = bodyShapes(mode === 'first' ? NEUTRAL : scales, sex);
  const first = bodyShapes(NEUTRAL, sex);
  const fill = `<g fill="url(#${id}g)" stroke="none">${shapesMarkup(now)}</g>`;
  const outline = mode === 'overlay'
    ? `<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="420">
        <g fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round">${shapesMarkup(first)}</g>
        <g fill="#000" stroke="none">${shapesMarkup(first)}</g>
      </mask>
      <rect x="0" y="0" width="200" height="420" fill="#F2C230" mask="url(#${id}m)"/>`
    : '';
  return `<svg viewBox="0 0 200 420" role="img" aria-label="${label}">
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F4F2EC"/><stop offset="1" stop-color="#A9ADB3"/></linearGradient></defs>
    ${fill}
    ${outline}
  </svg>`;
}
