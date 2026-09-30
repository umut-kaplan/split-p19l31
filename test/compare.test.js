import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  standOf, encodeStand, decodeStand, compareStands, liftRecords, weekLoad, bodyOf, liftLabel, cleanText,
  MAX_CODE, MAX_LIFTS, MSG,
} from '../js/domain/compare.js';
import { defaultState, normalize, toBackup, fromBackup } from '../js/store/migrate.js';
import { qrMatrix, qrSVG, readQR, robustMatrix, probeScore, probeImage, PROBES } from '../js/ui/qr.js';

/* ZXing setzt beim Laden globalThis.ZXing, wie im Browser window.ZXing */
await import('../js/vendor/zxing.min.js');
const Z = globalThis.ZXing;

const DAY = 864e5;
const NOW = new Date('2026-09-30T18:00:00').getTime();
const ymdOf = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ex = (name, w, r, n = 3, unit = 'reps', exId = name) => ({ exId, name, unit, sets: Array.from({ length: n }, () => ({ w, r, rir: 2 })) });
const sess = (daysAgo, list) => ({ id: 's' + daysAgo, startedAt: NOW - daysAgo * DAY, ex: list });

function state() {
  const S = defaultState();
  S.profile.name = 'Jürgen';
  S.profile.daysPerWeek = 3;
  S.sessions = [0, 2, 4, 7, 9, 11, 14, 16, 18].map((d, i) => sess(d, [
    ex('Bankdrücken', 80 + i, 8), ex('Kniebeugen', 100 + i, 6), ex('Latzug', 60, 10), ex('Beinpresse', 150, 10),
    ex('Schulterdrücken', 40, 8), ex('Schrägbankdrücken', 60, 8), ex('Rudern sitzend', 55, 10), ex('Seitheben', 10, 15),
  ]));
  S.body.weights = Array.from({ length: 40 }, (_, i) => ({ date: ymdOf(NOW - (39 - i) * DAY), kg: 84 - i * 0.05 }));
  return S;
}

/* ---------- Kodieren und Dekodieren ---------- */
test('Rundreise: was kodiert wird, kommt beim anderen gleich an', () => {
  const st = standOf(state(), { now: NOW });
  const code = encodeStand(st);
  const r = decodeStand(code);
  assert.equal(r.ok, true);
  assert.deepEqual(r.stand, { ...st, lifts: st.lifts.slice(0, MAX_LIFTS) });
  assert.equal(r.stand.name, 'Jürgen');
  assert.equal(r.stand.date, '2026-09-30');
  assert.deepEqual(r.stand.lifts.map(l => l.key), ['kniebeugen', 'bankdruecken', 'schulterdruecken', 'latzug', 'beinpresse', 'schraegbankdruecken']);
});

test('Format: Versionsfeld, kurze Schlüssel, nur ASCII, deutlich unter der Grenze', () => {
  const code = encodeStand(standOf(state(), { now: NOW }));
  const o = JSON.parse(code);
  assert.equal(o.a, 'split-cmp');
  assert.equal(o.v, 1);
  assert.deepEqual(Object.keys(o), ['a', 'v', 'd', 'n', 'r', 'w', 's', 'b']);
  assert.match(code, /^[\x20-\x7e]+$/);
  assert.ok(code.includes('J\\u00fcrgen'));
  assert.ok(code.length < 300, `typischer Stand: ${code.length} Zeichen`);
});

test('Größe: auch lange Namen mit Umlauten und Emoji bleiben unter der Grenze', () => {
  const S = state();
  S.profile.name = 'Ümmühan-Özgür Äßlinger';
  S.exercisesCustom = Array.from({ length: 8 }, (_, i) => ({
    id: 'c' + i, name: `Übung Ä Ö Ü ß 🏋️ ${i} äöüäöüäöü`, type: 'compound', unit: 'reps', muscles: { primary: ['chest'], secondary: [] }, custom: true,
  }));
  S.sessions.push(sess(1, S.exercisesCustom.map(e => ex(e.name, 50, 5))));
  const st = standOf(S, { now: NOW });
  const code = encodeStand(st);
  assert.ok(code.length <= MAX_CODE, `${code.length} Zeichen`);
  assert.match(code, /^[\x20-\x7e]+$/);
  const r = decodeStand(code);
  assert.equal(r.ok, true);
  assert.ok(r.stand.lifts.length >= 1);
  /* Was übrig bleibt, ist die wichtigste Übung zuerst */
  assert.equal(r.stand.lifts[0].key, 'kniebeugen');
});

test('Schalter Körpergewicht: aus heißt, das Gewicht steht gar nicht im Code', () => {
  const S = state();
  const withW = JSON.parse(encodeStand(standOf(S, { now: NOW, weight: true })));
  const without = JSON.parse(encodeStand(standOf(S, { now: NOW, weight: false })));
  assert.deepEqual(withW.b, [82.2, -1.4]);
  assert.equal('b' in without, false);
  assert.equal(decodeStand(JSON.stringify(without)).stand.body, null);
  /* Eingeschaltet, aber keine Einträge: ebenfalls kein Feld */
  S.body.weights = [];
  assert.equal('b' in JSON.parse(encodeStand(standOf(S, { now: NOW, weight: true }))), false);
});

test('Ohne Namen, ohne Training: der Code bleibt gültig', () => {
  const S = defaultState();
  const code = encodeStand(standOf(S, { now: NOW }));
  const o = JSON.parse(code);
  assert.equal('n' in o, false);
  assert.deepEqual(o.r, []);
  assert.deepEqual(o.w, [0, 0]);
  assert.deepEqual(o.s, [0, 3]);
  const r = decodeStand(code);
  assert.equal(r.ok, true);
  assert.equal(r.stand.name, '');
});

/* ---------- Ablehnen und Bereinigen ---------- */
test('Fremde, kaputte und neuere Codes werden freundlich abgelehnt', () => {
  const ok = { a: 'split-cmp', v: 1, d: '2026-09-30' };
  const reason = t => decodeStand(t).reason;
  assert.equal(reason(''), MSG.empty);
  assert.equal(reason('   '), MSG.empty);
  assert.equal(reason(undefined), MSG.empty);
  assert.equal(reason('https://example.com/abo'), MSG.foreign);
  assert.equal(reason('4006381333931'), MSG.foreign);
  assert.equal(reason('{"foo":1}'), MSG.foreign);
  assert.equal(reason('[1,2]'), MSG.foreign);
  assert.equal(reason(JSON.stringify({ ...ok, a: 'fit' })), MSG.foreign);
  assert.equal(reason('{"a":"split-cmp","v":1,"d":"2026-09-3'), MSG.broken);
  assert.equal(reason(JSON.stringify({ ...ok, v: 2 })), MSG.newer);
  assert.equal(reason(JSON.stringify({ ...ok, v: 0 })), MSG.broken);
  assert.equal(reason(JSON.stringify({ ...ok, v: '1' })), MSG.broken);
  assert.equal(reason(JSON.stringify({ ...ok, d: undefined })), MSG.broken);
  assert.equal(reason(JSON.stringify({ ...ok, d: '2026-02-30' })), MSG.broken);
  assert.equal(reason(JSON.stringify({ ...ok, d: '30.09.2026' })), MSG.broken);
  assert.equal(reason(JSON.stringify({ ...ok, n: 'x'.repeat(3000) })), MSG.foreign);
  assert.equal(decodeStand(JSON.stringify(ok)).ok, true);
  /* Von der Autokorrektur verbogene Anführungszeichen und Leerraum drumherum schaden nicht */
  const bent = '  ' + JSON.stringify({ ...ok, n: 'Ali' }).replace(/"/g, (c, i) => (i % 2 ? '\u201e' : '\u201c')) + '\n';
  assert.equal(decodeStand(bent).stand.name, 'Ali');
});

test('Werte aus dem Code werden geprüft, begrenzt und bereinigt', () => {
  const r = decodeStand(JSON.stringify({
    a: 'split-cmp', v: 1, d: '2026-09-30',
    n: '  <img src=x onerror=alert(1)>\u202e\u0007 Langer Name über zwanzig  ',
    r: [
      ['bankdruecken', 100.3], ['<script>', 50], ['kniebeugen', 'viel'], ['bankdruecken', 120], ['~  Eigene   Presse ', 80], ['~', 40],
      ['beinpresse', 180],
    ],
    w: [12.5, 1e9], s: [4, 9], b: [1000, 3],
  }));
  assert.equal(r.ok, true);
  const s = r.stand;
  /* Namen: ohne Steuer- und Richtungszeichen, höchstens 20 Zeichen, HTML bleibt Text (die Ansicht escapet) */
  assert.equal(s.name, '<img src=x onerror=a');
  assert.equal(s.name.length, 20);
  /* Nur die ersten sechs Einträge zählen, ungültige und doppelte fallen weg */
  assert.deepEqual(s.lifts, [{ key: 'bankdruecken', e1rm: 100.5 }, { key: '~Eigene Presse', e1rm: 80 }]);
  const lifts = r => decodeStand(JSON.stringify({ a: 'split-cmp', v: 1, d: '2026-09-30', r })).stand.lifts;
  assert.deepEqual(lifts([['kreuzheben', -5], ['latzug', 5000], ['plank', NaN], 'kaputt', ['kniebeugen', 0], ['hip-thrust', 90]]),
    [{ key: 'hip-thrust', e1rm: 90 }]);
  assert.deepEqual(lifts({ bankdruecken: 100 }), []);
  assert.deepEqual(s.week, { sets: null, kg: null });
  assert.deepEqual(s.streak, { weeks: 4, target: null });
  assert.equal(s.body, null);
  assert.equal(cleanText('a\u2066b\u200fc', 10), 'abc');
  assert.equal(cleanText('💪💪💪', 2), '💪💪');
  assert.equal(cleanText(42, 5), '');
});

/* ---------- Bausteine des eigenen Stands ---------- */
test('Rekorde: nur Grundübungen mit Gewicht, Varianten zusammen, wichtigste zuerst', () => {
  const custom = [
    { id: 'c1', name: 'Meine Presse', type: 'compound', custom: true },
    { id: 'c2', name: 'Mein Curl', type: 'isolation', custom: true },
  ];
  const sessions = [
    sess(3, [
      ex('Flachbankdrücken', 100, 5, 1, 'reps', 'bank'),      // Alias der Bibliothek
      ex('Bankdrücken', 90, 8, 1, 'reps', 'p2-bank'),         // gleiche Übung aus einem anderen Plan
      ex('Rudern sitzend', 60, 10), ex('Rudern sitzend', 60, 10),
      ex('Klimmzüge', 0, 10),                                  // ohne Zusatzgewicht kein 1RM
      ex('Plank', 0, 60, 3, 'sec'),
      ex('Seitheben', 12, 12),                                 // Isolation
      ex('Meine Presse', 70, 6), ex('Mein Curl', 20, 10),
      ex('Unbekannte Planübung', 50, 5),
    ]),
    sess(10, [ex('Kniebeugen', 120, 3, 1), ex('Rudern sitzend', 60, 10)]),
  ];
  const lifts = liftRecords(sessions, custom);
  assert.deepEqual(lifts.map(l => l.key), ['kniebeugen', 'bankdruecken', 'rudern-sitzend', '~Meine Presse']);
  assert.equal(lifts.find(l => l.key === 'bankdruecken').e1rm, 116.5);  // 100 × (1 + 5/30) = 116,67, schlägt 90 × (1 + 8/30) = 114
  assert.equal(lifts.find(l => l.key === 'kniebeugen').e1rm, 132);       // 120 × 1,1
});

test('Wochenvolumen: letzte 7 Kalendertage, Sekunden-Übungen ohne Gewicht', () => {
  const sessions = [
    sess(0, [ex('Bankdrücken', 80, 8, 3), ex('Plank', 0, 60, 2, 'sec')]),
    sess(6, [ex('Kniebeugen', 100, 5, 4)]),
    sess(7, [ex('Kniebeugen', 100, 5, 4)]),
    sess(-1, [ex('Kniebeugen', 100, 5, 4)]),
  ];
  assert.deepEqual(weekLoad(sessions, NOW), { sets: 3 + 2 + 4, kg: 3 * 640 + 4 * 500 });
  assert.deepEqual(weekLoad([], NOW), { sets: 0, kg: 0 });
});

test('Körpergewicht: 7-Tage-Schnitt am letzten Eintrag, Änderung über 4 Wochen', () => {
  const w = (d, kg) => ({ date: d, kg });
  const list = [w('2026-09-01', 86), w('2026-09-02', 86.4), w('2026-09-25', 84), w('2026-09-27', 84.6), w('2026-09-29', 84.2)];
  /* Schnitt 23. bis 29.9.: 84,27; vier Wochen davor 26.8. bis 1.9.: 86 */
  assert.deepEqual(bodyOf(list, '2026-09-30'), { avg: 84.3, delta: -1.7 });
  /* Ohne Werte vier Wochen vorher gibt es keine Änderung */
  assert.deepEqual(bodyOf(list.slice(2), '2026-09-30'), { avg: 84.3, delta: null });
  /* Letzter Eintrag älter als zwei Wochen: kein aktueller Wert */
  assert.equal(bodyOf([w('2026-09-16', 80)], '2026-09-30'), null);
  assert.deepEqual(bodyOf([w('2026-09-17', 80)], '2026-09-30'), { avg: 80, delta: null });
  /* Einträge in der Zukunft zählen nicht */
  assert.equal(bodyOf([w('2026-10-05', 80)], '2026-09-30'), null);
  assert.equal(bodyOf([], '2026-09-30'), null);
});

/* ---------- Vergleich ---------- */
test('Vergleich: gleiche Übungen nebeneinander, Unterschied und Führung', () => {
  const mine = {
    name: 'Umut', date: '2026-09-30',
    lifts: [{ key: 'kniebeugen', e1rm: 130 }, { key: 'bankdruecken', e1rm: 100 }, { key: '~Meine Presse', e1rm: 70 }, { key: 'kreuzheben', e1rm: 160 }],
    week: { sets: 40, kg: 15000 }, streak: { weeks: 5, target: 3 }, body: { avg: 82.4, delta: -0.8 },
  };
  const theirs = {
    name: 'Ali', date: '2026-09-29',
    lifts: [{ key: 'bankdruecken', e1rm: 107.5 }, { key: 'latzug', e1rm: 90 }, { key: '~meine  PRESSE', e1rm: 70 }, { key: 'kniebeugen', e1rm: 120 }],
    week: { sets: 40, kg: null }, streak: { weeks: 2, target: 4 }, body: null,
  };
  const c = compareStands(mine, theirs);
  assert.deepEqual(c.lifts.map(r => [r.key, r.me, r.them, r.lead]), [
    ['bankdruecken', 100, 107.5, 'them'],
    ['~meine  PRESSE', 70, 70, 'even'],
    ['kniebeugen', 130, 120, 'me'],
    ['latzug', null, 90, null],
    ['kreuzheben', 160, null, null],
  ]);
  assert.equal(c.shared, 3);
  assert.equal(c.lifts[0].diff, -7.5);
  assert.deepEqual(c.sets, { me: 40, them: 40, diff: 0, lead: 'even' });
  assert.deepEqual(c.kg, { me: 15000, them: null, diff: null, lead: null });
  assert.equal(c.streak.lead, 'me');
  /* Beim Körpergewicht gibt es kein Besser */
  assert.deepEqual(c.weight, { me: 82.4, them: null, diff: null, lead: null });
  const both = compareStands(mine, { ...theirs, body: { avg: 90, delta: 1 } });
  assert.deepEqual(both.weight, { me: 82.4, them: 90, diff: -7.6, lead: null });
  assert.equal(both.change.lead, null);
});

test('Vergleich über echte Stände: beide Seiten aus der App', () => {
  const a = state();
  const b = state();
  b.profile.name = 'Ali';
  b.sessions = [sess(1, [ex('Bankdrücken', 100, 5, 4), ex('Kreuzheben', 140, 5, 3)])];
  const theirs = decodeStand(encodeStand(standOf(b, { now: NOW, weight: false }))).stand;
  const c = compareStands(standOf(a, { now: NOW }), theirs);
  /* Ali: 100 kg × 5 = 116,5; Jürgen bestenfalls 88 kg × 8 = 111,5 */
  assert.deepEqual([c.lifts[0].key, c.lifts[0].me, c.lifts[0].them, c.lifts[0].lead], ['bankdruecken', 111.5, 116.5, 'them']);
  assert.equal(c.lifts[1].key, 'kreuzheben');
  assert.equal(c.lifts[1].me, null);
  assert.equal(c.weight.them, null);
  assert.equal(c.sets.them, 4 + 3);
});

test('Anzeigenamen: Bibliothek, eigene Übung, unbekannte id aus einer neueren Version', () => {
  assert.equal(liftLabel('bankdruecken'), 'Bankdrücken');
  assert.equal(liftLabel('~Meine Presse'), 'Meine Presse');
  assert.equal(liftLabel('front-squat'), 'Front squat');
});

/* ---------- Zustand und Backup ---------- */
test('Gespeicherter Stand: im Grundzustand leer, alte Stände ohne Feld laufen, Backup nimmt ihn mit', () => {
  const d = defaultState();
  assert.equal(d.compare, null);
  assert.equal(d.settings.compareWeight, true);
  const old = defaultState();
  delete old.compare;
  delete old.settings.compareWeight;
  const n = normalize(old);
  assert.equal(n.compare, null);
  assert.equal(n.settings.compareWeight, true);
  const off = defaultState();
  off.settings.compareWeight = false;
  assert.equal(normalize(off).settings.compareWeight, false);
  for (const bad of [{ code: 5 }, { code: '' }, { code: 'x'.repeat(2001) }, 'text', [1]]) {
    assert.equal(normalize({ ...defaultState(), compare: bad }).compare, null);
  }
  const s = defaultState();
  const code = encodeStand(standOf(state(), { now: NOW }));
  s.compare = { code, scannedAt: NOW };
  const back = fromBackup(JSON.parse(JSON.stringify(toBackup(s))));
  assert.deepEqual(back.compare, { code, scannedAt: NOW });
  assert.equal(normalize({ ...s, compare: { code, scannedAt: 'gestern' } }).compare.scannedAt, null);
});

/* ---------- QR-Code über das Bild ---------- */
/* SVG-Pfad aus qrSVG in ein Graustufenbild zurückverwandeln und mit ZXing lesen */
function rasterSVG(svg, scale = 4) {
  const n = Number(svg.match(/viewBox="0 0 (\d+) \1"/)[1]);
  const W = n * scale;
  const lum = new Uint8ClampedArray(W * W).fill(255);
  const d = svg.match(/<path fill="#000" d="([^"]*)"/)[1];
  for (const [, x, y, w] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
    for (let py = y * scale; py < (+y + 1) * scale; py++) {
      lum.fill(0, py * W + x * scale, py * W + (+x + +w) * scale);
    }
  }
  return new Z.RGBLuminanceSource(lum, W, W);
}

test('QR-Code: SVG lässt sich über das Bild wieder lesen, Fehlerkorrektur M', () => {
  const code = encodeStand(standOf(state(), { now: NOW }));
  const q = qrSVG(Z, code);
  assert.match(q.svg, /^<svg [^>]*viewBox="0 0 \d+ \d+"[^>]*><rect [^>]*fill="#fff"\/><path fill="#000" d="M/);
  assert.equal(readQR(Z, rasterSVG(q.svg)), code);
  const m = qrMatrix(Z, code);
  assert.equal(m.level, 'M');
  assert.equal(m.size, 17 + 4 * m.version);
  assert.ok(m.version <= 12, `Version ${m.version}`);
});

test('QR-Code: auch der größte erlaubte Inhalt bleibt lesbar', () => {
  const S = state();
  S.profile.name = 'Ümmühan-Özgür Äßlinger';
  S.exercisesCustom = Array.from({ length: 6 }, (_, i) => ({ id: 'c' + i, name: `Übung ${i} mit langem Namen xy`, type: 'compound', custom: true }));
  S.sessions.push(sess(1, S.exercisesCustom.map(e => ex(e.name, 50, 5))));
  const code = encodeStand(standOf(S, { now: NOW }));
  assert.ok(code.length <= MAX_CODE);
  const q = qrSVG(Z, code);
  assert.ok(q.version <= 15, `Version ${q.version}`);
  assert.equal(readQR(Z, rasterSVG(q.svg, 3)), code);
  assert.equal(decodeStand(readQR(Z, rasterSVG(q.svg, 3))).ok, true);
});

test('QR-Code: bei einer schlecht lesbaren Maske nimmt qrSVG eine andere', () => {
  /* Bei diesem Inhalt wählt ZXing Maske 2, die ZXing-js im Kamerabild oft nicht findet */
  const text = '{"a":"split-cmp","v":1,"d":"2026-09-30","n":"Ali","r":[["kniebeugen",128.5],["bankdruecken",114],["kreuzheben",171.5],["~Landmine Press",46.5]],"w":[48,26130],"s":[1,4],"b":[76.8,0.8]}';
  const plain = qrMatrix(Z, text);
  assert.equal(plain.mask, 2);
  assert.ok(probeScore(Z, plain, text) < PROBES.length);
  const good = robustMatrix(Z, text);
  assert.notEqual(good.mask, 2);
  assert.equal(good.score, PROBES.length);
  assert.equal(qrSVG(Z, text).mask, good.mask);
  /* Andere Modulgrößen und Drehungen als in der Probe */
  for (const [s, rot] of [[3.2, 0.01], [4, 0.04], [5, -0.02], [6, 0.03], [7.5, 0], [9, -0.015]]) {
    const { lum, c } = probeImage(good, s, rot);
    assert.equal(readQR(Z, new Z.RGBLuminanceSource(lum, c, c)), text, `${s} px pro Modul`);
  }
  /* Ohne Not bleibt es bei der Maske von ZXing */
  const ok = encodeStand(standOf(state(), { now: NOW }));
  const okPlain = qrMatrix(Z, ok);
  if (probeScore(Z, okPlain, ok) === PROBES.length) assert.equal(robustMatrix(Z, ok).mask, okPlain.mask);
  assert.equal(qrMatrix(Z, ok, 'M', 5).mask, 5);
  assert.equal(qrMatrix(Z, ok).mask, okPlain.mask);
});

test('QR-Leser: kein Code im Bild liefert null', () => {
  const blank = new Z.RGBLuminanceSource(new Uint8ClampedArray(200 * 200).fill(255), 200, 200);
  assert.equal(readQR(Z, blank), null);
});

test('Vergleich: Wochenvolumen ohne Aufwärmsätze, Dropsätze zählen mit', async () => {
  const { weekLoad } = await import('../js/domain/compare.js');
  const now = new Date(2026, 9, 1, 18).getTime();
  const sessions = [{ startedAt: now - 3600e3, ex: [{ unit: 'reps', sets: [
    { w: 40, r: 10, t: 'w' }, { w: 80, r: 8 }, { w: 80, r: 7, t: 'f' }, { w: 60, r: 10, t: 'd' },
  ] }] }];
  assert.deepEqual(weekLoad(sessions, now), { sets: 3, kg: 80 * 8 + 80 * 7 + 60 * 10 });
});
