/* Einstieg in ein Muster: Welcher Tag des Musters ist heute? Reine Funktionen.

   Der Nutzer tippt im Muster auf den Tag, der heute dran ist. Kommt derselbe Tag öfter vor (gleiche Schichtart an
   gleicher Stelle im Block, z. B. „2. Frühschicht“ dreimal in der 28-Tage-Vorlage), fragt die App nach dem nächsten
   Tag, an dem sich die Kandidaten unterscheiden („Was hast du morgen?“), höchstens zweimal. Danach zeigt sie die
   übrigen Kandidaten mit Vorschau zur Auswahl. Drehungen, die dasselbe Muster ergeben, zählen als ein Kandidat.
   Mit einem Import sucht importFit den Einstieg, der am besten zu den importierten Tagen passt. */
import { dayNum, addDays, catOf } from './shifts.js';

const mod = (a, n) => ((a % n) + n) % n;

/* Stelle im Block: 1 für den ersten Tag einer Folge gleicher Codes, 2 für den zweiten … */
export function runPos(days, i) {
  const n = days.length;
  let k = 1;
  while (k < n && days[mod(i - k, n)] === days[i]) k++;
  return k;
}

const rotation = (days, j) => [...days.slice(j), ...days.slice(0, j)].join('|');

/* Tage, die aussehen wie Tag i: gleiche Art an gleicher Stelle im Block, i selbst zuerst eingeschlossen */
export function sameDays(days, i) {
  const pos = runPos(days, i);
  const seen = new Set([rotation(days, i)]);
  const out = [i];
  days.forEach((c, j) => {
    if (j === i || c !== days[i] || runPos(days, j) !== pos) return;
    const r = rotation(days, j);
    if (seen.has(r)) return;
    seen.add(r);
    out.push(j);
  });
  return out.sort((a, b) => a - b);
}

/* Kandidaten, die zu allen Antworten passen. answers: [{ d, code }], d Tage nach heute. */
export const narrow = (days, cands, answers) =>
  cands.filter(j => answers.every(a => days[mod(j + a.d, days.length)] === a.code));

/* Nächste sinnvolle Frage: der erste Tag nach heute (höchstens `ahead` Tage), an dem sich die Kandidaten unterscheiden.
   { d, options: [Code, …] } in der Reihenfolge der Kandidaten, oder null. */
export function nextQuestion(days, cands, ahead = 14) {
  const n = days.length;
  for (let d = 1; d <= Math.min(ahead, n); d++) {
    const options = [...new Set(cands.map(j => days[mod(j + d, n)]))];
    if (options.length > 1) return { d, options };
  }
  return null;
}

/* Stand des Einstiegs nach dem Tipp auf `pick` und den bisherigen Antworten:
   { cands, question, index }. index ist der Tag des Musters für heute, sobald er feststeht. */
export function entryState(days, pick, answers = [], maxQuestions = 2) {
  if (pick == null || pick < 0 || pick >= days.length) return { cands: [], question: null, index: null };
  const all = sameDays(days, pick);
  const cands = narrow(days, all, answers);
  const list = cands.length ? cands : all;
  if (list.length === 1) return { cands: list, question: null, index: list[0] };
  const question = answers.length < maxQuestions ? nextQuestion(days, list) : null;
  return { cands: list, question, index: null };
}

/* Kandidaten, deren Vorschau über `len` Tage genauso aussieht wie die eines anderen Kandidaten. Liefert { j: d } mit d,
   dem ersten Tag nach heute, an dem sich j von einem solchen Zwilling unterscheidet; Kandidaten ohne Zwilling fehlen. */
export function previewTwins(days, cands, len = 14) {
  const n = days.length;
  const at = (j, d) => days[mod(j + d, n)];
  const out = {};
  cands.forEach(j => {
    let first = null;
    cands.forEach(k => {
      if (k === j) return;
      let d = 0;
      while (d < n && at(j, d) === at(k, d)) d++;
      if (d >= len && d < n && (first == null || d < first)) first = d;
    });
    if (first != null) out[j] = first;
  });
  return out;
}

/* Starttag (Tag 1 des Musters), wenn heute Tag index + 1 ist */
export const startFor = (today, index) => addDays(today, -index);

/* Bei Mustern ab Montag (Mo–Fr-Vorlagen) steht jede Zeile für eine Woche. Ein Tipp in Zeile row heißt: diese Woche. */
export const weekIndex = (days, row, today) => {
  const wd = mod(dayNum(today) + 3, 7);
  return Math.min(row * 7 + wd, days.length - 1);
};

/* Was gilt beim Vergleich mit dem Import: Kategorie des Codes, Urlaub und Krank zählen nicht */
const kind = (sh, code) => {
  const cat = catOf(sh, code);
  return cat === 'vacation' || cat === 'sick' ? null : cat;
};

/* Einstieg, der am besten zum Import passt. Für jeden möglichen Starttag zählt, an wie vielen Tagen im Zeitraum
   des Imports die Kategorie gleich ist (Tage ohne Termin sind frei). Liefert
   { index, start, same, total, current } oder null, wenn weniger als 7 Tage vergleichbar sind.
   index ist der Tag des Musters für heute, current die Zahl gleicher Tage beim Starttag `start` (falls angegeben). */
export function importFit(days, sh, today, start = null) {
  const r = sh && sh.importInfo;
  if (!r || !days || !days.length) return null;
  const n = days.length;
  const pat = days.map(c => kind(sh, c));
  const obs = [];
  for (let d = r.from, i = 0; d <= r.to && i < 800; d = addDays(d, 1), i++) {
    const k = kind(sh, (sh.imported && sh.imported[d]) || '-');
    if (k) obs.push([dayNum(d), k]);
  }
  if (obs.length < 7) return null;
  const score = o => obs.reduce((a, [dn, k]) => a + (pat[mod(dn + o, n)] === k ? 1 : 0), 0);
  let best = null;
  for (let o = 0; o < n; o++) {
    const same = score(o);
    if (!best || same > best.same) best = { o, same };
  }
  const index = mod(dayNum(today) + best.o, n);
  return {
    index, start: addDays(today, -index), same: best.same, total: obs.length,
    current: start ? score(mod(-dayNum(start), n)) : null,
  };
}
