/* Apple-Health-Export (export.zip oder export.xml), den man in der Health-App selbst erstellt und hier auswählt.
   Übernommen werden nur Gewicht, Schritte, Ruhepuls und Schlaf, ein Wert pro Tag.
   Dazu kommen fürs Profil Geburtsdatum und Geschlecht aus <Me …/> und die jüngste Größe; übernommen werden sie
   erst, wenn der Nutzer sie bestätigt (siehe profileProposals in health-merge.js).
   Die Datei wird in Stücken gelesen und nie ganz in den Speicher geholt; große Exporte haben mehrere hundert MB. */

export const id = 'apple-health';
export const label = 'Apple Health';
export const accept = '.zip,.xml,application/zip,text/xml';

export const TYPES = {
  weight: 'HKQuantityTypeIdentifierBodyMass',
  steps: 'HKQuantityTypeIdentifierStepCount',
  restingHr: 'HKQuantityTypeIdentifierRestingHeartRate',
  sleep: 'HKCategoryTypeIdentifierSleepAnalysis',
  height: 'HKQuantityTypeIdentifierHeight',
};
const WANTED = new Set(Object.values(TYPES));

/* Nur echte Schlafphasen zählen, nicht „Im Bett“ und nicht „Wach“ */
const ASLEEP = new Set([
  'HKCategoryValueSleepAnalysisAsleep',
  'HKCategoryValueSleepAnalysisAsleepCore',
  'HKCategoryValueSleepAnalysisAsleepDeep',
  'HKCategoryValueSleepAnalysisAsleepREM',
  'HKCategoryValueSleepAnalysisAsleepUnspecified',
]);

const CHUNK = 1 << 20;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HOUR = 36e5;

/* ---------- XML ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescapeXml = s => (s.indexOf('&') < 0 ? s : s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (m, e) => {
  if (e[0] !== '#') return ENT[e];
  return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
}));

export function parseAttrs(tag) {
  const out = {};
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(tag))) out[m[1]] = unescapeXml(m[2]);
  return out;
}

function typeOf(tag) {
  const i = tag.indexOf('type="');
  if (i < 0) return null;
  const j = tag.indexOf('"', i + 6);
  return j < 0 ? null : tag.slice(i + 6, j);
}

/* In Attributwerten darf ein „>“ stehen. Ein Tag endet erst an einem „>“ außerhalb von Anführungszeichen. */
function oddQuotes(s, from, to) {
  let n = 0;
  for (let i = s.indexOf('"', from); i >= 0 && i < to; i = s.indexOf('"', i + 1)) n++;
  return n % 2 === 1;
}

/* Liest Text in beliebig geschnittenen Stücken und meldet jedes <Record …>-Start-Tag mit den gesuchten Typen.
   Ein Record, der über eine Stückgrenze reicht, wird zusammengesetzt. */
export function createRecordScanner(onRecord) {
  let buf = '';
  let seen = 0;
  return {
    push(text) {
      buf = buf ? buf + text : text;
      let pos = 0;
      for (;;) {
        const start = buf.indexOf('<Record', pos);
        if (start < 0) { buf = buf.slice(Math.max(pos, buf.length - 7)); return; }
        if (start + 7 >= buf.length) { buf = buf.slice(start); return; }
        const c = buf.charCodeAt(start + 7);
        /* <RecordX ist ein anderes Element */
        if (!(c === 32 || c === 9 || c === 10 || c === 13 || c === 47 || c === 62)) { pos = start + 7; continue; }
        let end = buf.indexOf('>', start);
        while (end >= 0 && oddQuotes(buf, start, end)) end = buf.indexOf('>', end + 1);
        if (end < 0) { buf = buf.slice(start); return; }
        seen++;
        const tag = buf.slice(start, end + 1);
        if (WANTED.has(typeOf(tag))) onRecord(parseAttrs(tag));
        pos = end + 1;
      }
    },
    get records() { return seen; },
  };
}

/* <Me …/> steht einmal vor dem ersten Record und trägt Geburtsdatum und Geschlecht.
   Wie beim Record-Scanner über Stückgrenzen hinweg; nach dem Fund oder dem ersten Record sucht er nicht weiter. */
export function createMeScanner(onMe) {
  let buf = '';
  let done = false;
  return {
    push(text) {
      if (done) return;
      buf = buf ? buf + text : text;
      let pos = 0;
      for (;;) {
        const start = buf.indexOf('<Me', pos);
        const rec = buf.indexOf('<Record', pos);
        if (rec >= 0 && (start < 0 || rec < start)) { done = true; buf = ''; return; }
        if (start < 0) { buf = buf.slice(Math.max(pos, buf.length - 6)); return; }
        if (start + 3 >= buf.length) { buf = buf.slice(start); return; }
        const c = buf.charCodeAt(start + 3);
        /* <MetadataEntry und Ähnliches sind andere Elemente */
        if (!(c === 32 || c === 9 || c === 10 || c === 13 || c === 47 || c === 62)) { pos = start + 3; continue; }
        let end = buf.indexOf('>', start);
        while (end >= 0 && oddQuotes(buf, start, end)) end = buf.indexOf('>', end + 1);
        if (end < 0) { buf = buf.slice(start); return; }
        const tag = buf.slice(start, end + 1);
        done = true; buf = '';
        onMe(parseAttrs(tag));
        return;
      }
    },
    get done() { return done; },
  };
}

/* ---------- Profil ---------- */
const SEXES = { HKBiologicalSexMale: 'm', HKBiologicalSexFemale: 'f' };
/* Nur echte Kalendertage; „Nicht festgelegt“ steht im Export als leerer Wert */
function birthDateOf(v) {
  const s = String(v || '').slice(0, 10);
  if (!DAY.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? s : null;
}
export function meProfile(attrs) {
  const a = attrs || {};
  return {
    birthDate: birthDateOf(a.HKCharacteristicTypeIdentifierDateOfBirth),
    sex: SEXES[a.HKCharacteristicTypeIdentifierBiologicalSex] || null,
  };
}

/* Größe in cm aus einem Record; cm, mm, m, in und ft. Unplausible Werte (unter 120 oder über 230 cm) fallen weg. */
const TO_CM = { cm: 1, mm: 0.1, m: 100, in: 2.54, ft: 30.48 };
export function heightCm(value, unit) {
  const f = TO_CM[String(unit || 'cm').toLowerCase()];
  const cm = parseFloat(value) * f;
  return f && cm >= 120 && cm <= 230 ? cm : null;
}

/* ---------- Tageswerte ---------- */
/* '2024-09-20 07:12:00 +0200' als Wandzeit in ms: so, wie die Uhrzeit auf dem Gerät angezeigt wurde */
export function wallMs(s) {
  return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13) || 0, +s.slice(14, 16) || 0, +s.slice(17, 19) || 0);
}
/* Derselbe Zeitpunkt in UTC-ms, mit dem Versatz aus der Angabe; zum Vergleichen über Zeitzonen hinweg */
export function instantMs(s) {
  const m = /([+-])(\d{2}):?(\d{2})\s*$/.exec(s.slice(19));
  const off = m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) * 6e4 : 0;
  return wallMs(s) - off;
}
const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/* Schlaf gehört zu dem Tag, an dem man aufwacht. Sechs Stunden Versatz ordnen auch Abschnitte
   vor Mitternacht (z. B. 22:30 bis 23:50) der folgenden Nacht zu und ein Nickerchen am Nachmittag dem selben Tag. */
const SLEEP_SHIFT = 6 * HOUR;

function mergeIntervals(list) {
  const sorted = [...list].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function createAggregator() {
  const weight = new Map();   // Tag -> { at, kg }
  const steps = new Map();    // Tag -> Map(Quelle -> Summe)
  const hr = new Map();       // Tag -> { sum, n }
  const sleep = new Map();    // Quelle -> [[von, bis], …]
  let height = null;          // { at, cm }, der jüngste Wert
  let me = { birthDate: null, sex: null };
  const counts = { weight: 0, steps: 0, restingHr: 0, sleep: 0, height: 0 };

  function add(r) {
    const start = r.startDate || '';
    const day = start.slice(0, 10);
    if (!DAY.test(day)) return;
    const src = r.sourceName || 'unbekannt';
    switch (r.type) {
      case TYPES.weight: {
        let kg = parseFloat(r.value);
        const unit = (r.unit || 'kg').toLowerCase();
        if (unit === 'lb' || unit === 'lbs') kg *= 0.45359237;
        else if (unit === 'g') kg /= 1000;
        else if (unit === 'st') kg *= 6.35029318;
        else if (unit !== 'kg') return;
        if (!(kg >= 20 && kg <= 400)) return;
        const prev = weight.get(day);
        if (!prev || start >= prev.at) weight.set(day, { at: start, kg });
        counts.weight++;
        return;
      }
      case TYPES.steps: {
        const n = parseFloat(r.value);
        if (!(n > 0)) return;
        let m = steps.get(day);
        if (!m) steps.set(day, (m = new Map()));
        m.set(src, (m.get(src) || 0) + n);
        counts.steps++;
        return;
      }
      case TYPES.restingHr: {
        const bpm = parseFloat(r.value);
        if (!(bpm >= 25 && bpm <= 200)) return;
        const x = hr.get(day) || { sum: 0, n: 0 };
        x.sum += bpm; x.n++;
        hr.set(day, x);
        counts.restingHr++;
        return;
      }
      case TYPES.sleep: {
        if (!ASLEEP.has(r.value) || !r.endDate) return;
        const a = wallMs(start), b = wallMs(r.endDate);
        if (!(b > a) || b - a > 24 * HOUR) return;
        let list = sleep.get(src);
        if (!list) sleep.set(src, (list = []));
        list.push([a, b]);
        counts.sleep++;
        return;
      }
      case TYPES.height: {
        const cm = heightCm(r.value, r.unit);
        if (cm == null) return;
        const at = instantMs(start);
        if (!height || at >= height.at) height = { at, cm };
        counts.height++;
        return;
      }
      default:
    }
  }

  function result() {
    const weights = [...weight].map(([date, v]) => ({ date, kg: Math.round(v.kg * 10) / 10 })).sort(byDate);
    /* iPhone und Uhr zählen dieselben Schritte; pro Tag gilt die Quelle mit den meisten */
    const stepList = [...steps].map(([date, m]) => ({ date, steps: Math.round(Math.max(...m.values())) }))
      .filter(x => x.steps > 0).sort(byDate);
    const hrList = [...hr].map(([date, x]) => ({ date, bpm: Math.round(x.sum / x.n) })).sort(byDate);
    const perDay = new Map();   // Tag -> Map(Quelle -> ms)
    for (const [src, list] of sleep) {
      for (const [a, b] of mergeIntervals(list)) {
        const day = isoDay(b + SLEEP_SHIFT);
        let m = perDay.get(day);
        if (!m) perDay.set(day, (m = new Map()));
        m.set(src, (m.get(src) || 0) + (b - a));
      }
    }
    const sleepList = [...perDay].map(([date, m]) => ({ date, hours: Math.round(Math.max(...m.values()) / HOUR * 100) / 100 }))
      .filter(x => x.hours >= 0.25 && x.hours <= 20).sort(byDate);
    const range = list => (list.length ? { from: list[0].date, to: list[list.length - 1].date, days: list.length } : { from: null, to: null, days: 0 });
    return {
      weights, steps: stepList, restingHr: hrList, sleep: sleepList,
      /* Fürs Profil; null, wo der Export nichts Brauchbares enthält */
      profile: { ...me, heightCm: height ? Math.round(height.cm) : null },
      stats: {
        records: { ...counts },
        weights: range(weights), steps: range(stepList), restingHr: range(hrList), sleep: range(sleepList),
        hasAny: weights.length + stepList.length + hrList.length + sleepList.length > 0,
      },
    };
  }

  /* Attribute aus <Me …/> */
  const setMe = attrs => { me = meProfile(attrs); };

  return { add, me: setMe, result };
}

/* ---------- Datei lesen ---------- */
/* Hauptdatei im Export: XML direkt im Exportordner, ohne „cda“ im Namen (export_cda.xml sind klinische Dokumente).
   Der Name hängt von der Sprache ab (export.xml, Export.xml, exportar.xml …). */
export function isMainXml(name) {
  const n = String(name || '').replace(/\\/g, '/');
  if (n.startsWith('__MACOSX/')) return false;
  const parts = n.split('/').filter(Boolean);
  const base = (parts[parts.length - 1] || '').toLowerCase();
  return parts.length >= 1 && parts.length <= 2 && base.endsWith('.xml') && !base.includes('cda') && !base.startsWith('._');
}

export function abortError() {
  const e = new Error('Der Import wurde abgebrochen.');
  e.name = 'AbortError';
  return e;
}

/* Liest export.zip oder export.xml in Stücken. onProgress(gelesen, gesamt, records). */
export async function readExport(file, { onProgress, signal, chunkSize = CHUNK, yieldToLoop } = {}) {
  const agg = createAggregator();
  const scanner = createRecordScanner(r => agg.add(r));
  const meScanner = createMeScanner(a => agg.me(a));
  const feed = text => { meScanner.push(text); scanner.push(text); };
  const total = file.size;
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 3 && head[3] === 4;
  const dec = new TextDecoder('utf-8');
  let entryName = isZip ? null : (file.name || 'export.xml');
  let xmlDone = !isZip;
  let failure = null;
  let uz = null;

  if (isZip) {
    const { Unzip, UnzipInflate } = await import('../vendor/fflate.js');
    uz = new Unzip(entry => {
      if (entryName || !isMainXml(entry.name)) return;   // andere Dateien werden übersprungen
      entryName = entry.name;
      entry.ondata = (err, data, final) => {
        if (err) { failure = err; return; }
        feed(dec.decode(data, { stream: !final }));
        if (final) xmlDone = true;
      };
      entry.start();
    });
    uz.register(UnzipInflate);
  }

  for (let off = 0; off < total; off += chunkSize) {
    if (signal && signal.aborted) throw abortError();
    const end = Math.min(total, off + chunkSize);
    const bytes = new Uint8Array(await file.slice(off, end).arrayBuffer());
    const last = end >= total;
    if (isZip) {
      try { uz.push(bytes, last); } catch (e) { failure = e; }
      if (failure) throw new Error('Die ZIP-Datei ließ sich nicht entpacken. Ist sie vollständig?');
    } else {
      feed(dec.decode(bytes, { stream: !last }));
    }
    if (onProgress) onProgress(end, total, scanner.records);
    /* Nach der Haupt-XML folgen nur noch Routen und EKGs, die braucht die App nicht */
    if (isZip && xmlDone) { if (onProgress && end < total) onProgress(total, total, scanner.records); break; }
    if (yieldToLoop) await yieldToLoop();
  }

  if (isZip && !entryName) throw new Error('In der ZIP-Datei steht kein Apple-Health-Export. Wähle die Datei export.zip aus der Health-App.');
  if (isZip && !xmlDone) throw new Error('Die ZIP-Datei endet mitten im Export. Ist sie vollständig heruntergeladen?');
  if (scanner.records === 0) throw new Error('In der Datei stehen keine Health-Einträge. Ist es der Export aus der Health-App?');
  const res = agg.result();
  res.stats.file = entryName;
  res.stats.scanned = scanner.records;
  res.stats.bytes = total;
  return res;
}

/* Schnittstelle aus js/importers/index.js. Läuft in einem Worker, damit die Oberfläche flüssig bleibt;
   wo der Browser keine Modul-Worker kann, im Hauptthread mit Pausen. Abbrechen über signal (AbortSignal). */
export function parse(file, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const inMain = () => readExport(file, { onProgress, signal, yieldToLoop: () => new Promise(r => setTimeout(r, 0)) }).then(resolve, reject);
    let worker = null;
    try { worker = new Worker(new URL('./apple-health.worker.js', import.meta.url), { type: 'module' }); } catch (e) { worker = null; }
    if (!worker) { inMain(); return; }
    let heard = false;
    const stop = () => { worker.terminate(); reject(abortError()); };
    if (signal) {
      if (signal.aborted) { stop(); return; }
      signal.addEventListener('abort', stop, { once: true });
    }
    const done = () => { worker.terminate(); if (signal) signal.removeEventListener('abort', stop); };
    worker.onmessage = ev => {
      heard = true;
      const m = ev.data;
      if (m.type === 'progress') { if (onProgress) onProgress(m.done, m.total, m.records); }
      else if (m.type === 'done') { done(); resolve(m.result); }
      else if (m.type === 'error') { done(); reject(new Error(m.message)); }
    };
    worker.onerror = ev => {
      ev.preventDefault();
      done();
      /* Ältere Safari-Versionen laden keine Modul-Worker. Dann im Hauptthread weiterlesen. */
      if (!heard) inMain(); else reject(new Error('Beim Lesen ist ein Fehler aufgetreten.'));
    };
    worker.postMessage({ file });
  });
}
