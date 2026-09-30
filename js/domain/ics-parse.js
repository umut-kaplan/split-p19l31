/* Liest Kalender-Dateien (.ics, RFC 5545) und erkennt darin Schichten. Reine Funktionen; die Datei verlässt das Gerät nicht.

   Unterstützt: Zeilenfaltung, DTSTART und DTEND mit TZID, in UTC (Z), ohne Zeitzone (Ortszeit) und ganztägig
   (VALUE=DATE), DURATION, STATUS:CANCELLED, RRULE mit FREQ=DAILY oder WEEKLY (INTERVAL, COUNT, UNTIL, BYDAY),
   EXDATE und geänderte Einzeltermine (RECURRENCE-ID). Andere Wiederholungen zählen nur mit dem ersten Termin
   und werden in der Zusammenfassung genannt.

   Schichtart:
   1. Titel: Früh/Frueh/F, Spät/Spaet/S, Nacht/N (auch „Frühschicht“, „Spätdienst“, „F-Schicht“ usw.),
      Urlaub wird zu 'U', „frei“ zu '-'.
   2. Sonst die Startzeit: höchstens 2 Stunden neben dem eingestellten Schichtbeginn, bei Standardzeiten
      also 04–08 Uhr Früh, 12–16 Uhr Spät, 20–24 Uhr Nacht. Das gilt nur für Termine ab 4 Stunden Dauer,
      damit ein kurzer Termin am Morgen nicht als Frühschicht zählt.
   Eine Nachtschicht zählt zum Tag, an dem sie beginnt. Übernommen werden nur Datum und Schichtart. */
import { WORK, DEFAULT_TIMES, isYmd, dayNum, fromDayNum, addDays, toMin } from './shifts.js';

export const MIN_SHIFT_MINUTES = 240;
export const TIME_TOLERANCE = 120;
const MAX_OCCURRENCES = 1500;
const MAX_SPAN_DAYS = 62;

/* ---------- Zeilen ---------- */
export function unfold(text) {
  return String(text || '')
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .filter(l => l.trim() !== '');
}

/* „NAME;PARAM=WERT:Inhalt“. Ein Doppelpunkt in Anführungszeichen gehört noch zu den Parametern. */
export function parseLine(line) {
  let q = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') q = !q;
    else if (c === ':' && !q) { colon = i; break; }
  }
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const parts = [];
  let cur = '';
  q = false;
  for (const c of head) {
    if (c === '"') { q = !q; cur += c; } else if (c === ';' && !q) { parts.push(cur); cur = ''; } else cur += c;
  }
  parts.push(cur);
  const params = {};
  parts.slice(1).forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) params[p.slice(0, i).trim().toUpperCase()] = p.slice(i + 1).trim().replace(/^"(.*)"$/, '$1');
  });
  /* Gruppen-Präfixe wie „item1.SUMMARY“ ignorieren */
  const name = parts[0].trim().toUpperCase().replace(/^.*\./, '');
  return { name, params, value: line.slice(colon + 1) };
}

export const unescapeText = v => String(v).replace(/\\([\\;,nN])/g, (m, c) => (c === 'n' || c === 'N' ? '\n' : c));

/* ---------- Datum und Zeit ---------- */
/* { date, allDay: true } oder { date, hh, mm, utc, tz } in der Zeit des Termins */
export function parseDateValue(prop) {
  if (!prop) return null;
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(prop.value).trim());
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!isYmd(date)) return null;
  const params = prop.params || {};
  if (m[4] == null || String(params.VALUE || '').toUpperCase() === 'DATE') return { date, allDay: true };
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  if (hh > 23 || mm > 59) return null;
  return { date, hh, mm, utc: !!m[7], tz: m[7] ? null : (params.TZID || null) };
}

/* Dauer in Minuten, z. B. PT8H, P1D, P1W */
export function parseDuration(v) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v || '').trim());
  if (!m) return null;
  const min = (Number(m[2]) || 0) * 10080 + (Number(m[3]) || 0) * 1440 + (Number(m[4]) || 0) * 60 + (Number(m[5]) || 0) + Math.floor((Number(m[6]) || 0) / 60);
  return m[1] === '-' ? -min : min;
}

/* Windows-Namen aus Outlook-Exporten */
const WINDOWS_TZ = {
  'W. Europe Standard Time': 'Europe/Berlin',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'Romance Standard Time': 'Europe/Paris',
  'GMT Standard Time': 'Europe/London',
  'Coordinated Universal Time': 'UTC',
};

const localZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return null; } };
const fmtCache = new Map();
function zoneFormat(zone) {
  if (!fmtCache.has(zone)) {
    let f = null;
    try {
      f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) { f = null; }
    fmtCache.set(zone, f);
  }
  return fmtCache.get(zone);
}

/* Liefert eine gültige IANA-Zone, die sich von der des Geräts unterscheidet, sonst null (dann gilt die Uhrzeit wie angegeben) */
export function zoneOf(tz) {
  if (!tz) return null;
  const z = WINDOWS_TZ[tz.trim()] || tz.trim();
  const parts = z.split('/').filter(Boolean);
  /* Manche Programme schreiben Pfade wie /mozilla.org/20070129_1/Europe/Berlin */
  const cands = [z, ...parts.map((_, i) => parts.slice(i).join('/')).slice(1)];
  const here = localZone();
  for (const c of cands) if (zoneFormat(c)) return c === here ? null : c;
  return null;
}

function zoneOffset(zone, ms) {
  const p = Object.fromEntries(zoneFormat(zone).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

function zonedMs(date, hh, mm, zone) {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ms = guess - zoneOffset(zone, guess);
  const again = guess - zoneOffset(zone, ms);
  if (again !== ms) ms = again;
  return ms;
}

const pad = n => String(n).padStart(2, '0');
const ymdOf = t => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;

/* Zeitpunkt in Ortszeit des Geräts: { date, min, ms, allDay } */
export function toLocal(dt) {
  const [y, m, d] = dt.date.split('-').map(Number);
  if (dt.allDay) return { date: dt.date, min: null, ms: new Date(y, m - 1, d).getTime(), allDay: true };
  let ms;
  if (dt.utc) ms = Date.UTC(y, m - 1, d, dt.hh, dt.mm);
  else {
    const zone = zoneOf(dt.tz);
    ms = zone ? zonedMs(dt.date, dt.hh, dt.mm, zone) : new Date(y, m - 1, d, dt.hh, dt.mm).getTime();
  }
  const t = new Date(ms);
  return { date: ymdOf(t), min: t.getHours() * 60 + t.getMinutes(), ms, allDay: false };
}

/* ---------- Wiederholungen ---------- */
const WD = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const RRULE_KEYS = ['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'WKST'];

export function parseRrule(v) {
  const r = {};
  String(v || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) r[p.slice(0, i).trim().toUpperCase()] = p.slice(i + 1).trim().toUpperCase();
  });
  const byday = r.BYDAY ? r.BYDAY.split(',').map(s => s.trim()) : null;
  const plainDays = !byday || byday.every(d => WD.includes(d));
  const supported = (r.FREQ === 'DAILY' || r.FREQ === 'WEEKLY')
    && Object.keys(r).every(k => RRULE_KEYS.includes(k)) && plainDays;
  return {
    freq: r.FREQ || null,
    interval: Math.max(1, parseInt(r.INTERVAL, 10) || 1),
    count: r.COUNT ? Math.max(0, parseInt(r.COUNT, 10) || 0) : null,
    until: r.UNTIL ? parseDateValue({ value: r.UNTIL, params: {} }) : null,
    byday: byday && plainDays ? byday.map(d => WD.indexOf(d)) : null,
    supported,
  };
}

const wdNum = n => (((n + 3) % 7) + 7) % 7;

/* Beginn aller Termine einer Serie in der Zeit des Termins, bis höchstens `until` (YYYY-MM-DD) */
export function occurrences(ev, until) {
  const s = ev.start;
  const r = ev.rrule;
  if (!r || !r.supported) return [s];
  const first = dayNum(s.date);
  let last = dayNum(until);
  if (r.until) last = Math.min(last, dayNum(r.until.date));
  const untilMs = r.until && !r.until.allDay ? toLocal(r.until).ms : null;
  const out = [];
  const full = () => (r.count != null && out.length >= r.count) || out.length >= MAX_OCCURRENCES;
  const push = n => {
    const o = { ...s, date: fromDayNum(n) };
    if (untilMs != null && toLocal(o).ms > untilMs) return;
    out.push(o);
  };
  if (r.freq === 'DAILY') {
    for (let n = first; n <= last && !full(); n += r.interval) {
      if (!r.byday || r.byday.includes(wdNum(n))) push(n);
    }
  } else {
    const set = (r.byday || [wdNum(first)]).slice().sort((a, b) => a - b);
    outer:
    for (let w = first - wdNum(first); w <= last; w += 7 * r.interval) {
      for (const k of set) {
        const n = w + k;
        if (n < first) continue;
        if (n > last || full()) break outer;
        push(n);
      }
    }
  }
  return out;
}

/* ---------- Datei lesen ---------- */
/* Alle VEVENT-Blöcke. VALARM und andere Unterblöcke werden übersprungen. */
export function parseIcs(text) {
  const events = [];
  const stack = [];
  let raw = null;
  for (const line of unfold(text)) {
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN') {
      const c = p.value.trim().toUpperCase();
      stack.push(c);
      if (c === 'VEVENT') raw = { props: {}, exdates: [] };
      continue;
    }
    if (p.name === 'END') {
      const c = p.value.trim().toUpperCase();
      const i = stack.lastIndexOf(c);
      if (i >= 0) stack.length = i;
      if (c === 'VEVENT' && raw) { events.push(raw); raw = null; }
      continue;
    }
    if (!raw || stack[stack.length - 1] !== 'VEVENT') continue;
    if (p.name === 'EXDATE') raw.exdates.push(p);
    else if (!raw.props[p.name]) raw.props[p.name] = p;
  }
  return events.map(toEvent).filter(Boolean);
}

function toEvent(raw) {
  const P = raw.props;
  const start = parseDateValue(P.DTSTART);
  if (!start) return null;
  return {
    uid: P.UID ? P.UID.value.trim() : null,
    summary: P.SUMMARY ? unescapeText(P.SUMMARY.value).trim() : '',
    status: P.STATUS ? P.STATUS.value.trim().toUpperCase() : null,
    start,
    end: parseDateValue(P.DTEND),
    duration: P.DURATION ? parseDuration(P.DURATION.value) : null,
    rrule: P.RRULE ? parseRrule(P.RRULE.value) : null,
    exdates: raw.exdates.flatMap(p => p.value.split(',').map(v => parseDateValue({ params: p.params, value: v }))).filter(Boolean),
    recurrenceId: parseDateValue(P['RECURRENCE-ID']),
  };
}

/* ---------- Schichtart ---------- */
const norm = s => String(s || '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
const WORDS = [
  ['U', /\burlaub/],
  ['-', /\bfrei\b/],
  ['F', /\b(?:frueh(?!stueck)|early)/],
  ['S', /\b(?:spaet|late\b)/],
  ['N', /\b(?:nacht|night)/],
];

/* Schichtart aus dem Titel oder null */
export function codeFromTitle(title) {
  const t = norm(title).trim();
  if (!t) return null;
  /* Ein einzelner Buchstabe, auch „F-Schicht“, „N 22-06“ */
  const one = /^([fsn])(?:\s*[-–]?\s*(?:schicht|dienst))?[\s\d:.\-–()/]*$/.exec(t);
  if (one) return one[1].toUpperCase();
  let best = null;
  WORDS.forEach(([code, re]) => {
    const m = re.exec(t);
    if (m && (!best || m.index < best.index)) best = { code, index: m.index };
  });
  return best ? best.code : null;
}

/* Schichtart aus der Startzeit (Minuten nach Mitternacht) oder null */
export function codeFromTime(min, times = DEFAULT_TIMES, tolerance = TIME_TOLERANCE) {
  let best = null;
  WORK.forEach(c => {
    let d = Math.abs(min - toMin(times[c][0]));
    d = Math.min(d, 1440 - d);
    if (d <= tolerance && (!best || d < best.d)) best = { c, d };
  });
  return best ? best.c : null;
}

/* ---------- Schichten aus einer Datei ---------- */
/* Ausgenommene Termine: ganztägig nach Datum, sonst nach Zeitpunkt */
const exKeys = list => list.map(dt => (dt.allDay ? 'D' + dt.date : 'T' + toLocal(dt).ms));
/* Vorrang bei mehreren Terminen an einem Tag: Urlaub, dann die früheste Schicht, zuletzt „frei“ */
const PRIO = { U: 0, F: 1, S: 1, N: 1, '-': 2 };

/* Liefert { days: { Datum: Code }, from, to, shifts, vacation, byCode, unknown: [{ date, title }], cancelled,
   unsupported, conflicts, events } oder wirft einen Fehler, wenn die Datei kein Kalender ist.
   until begrenzt endlose Serien (Standard: 400 Tage nach ihrem Beginn). */
export function shiftsFromIcs(text, { times = DEFAULT_TIMES, until = null } = {}) {
  if (!/BEGIN:VCALENDAR/i.test(String(text || ''))) throw new Error('Das ist keine Kalender-Datei (.ics).');
  const events = parseIcs(text);
  const moved = new Map();
  events.filter(e => e.recurrenceId && e.uid).forEach(e => {
    moved.set(e.uid, [...(moved.get(e.uid) || []), ...exKeys([e.recurrenceId])]);
  });
  const days = {};
  const unknown = [];
  let cancelled = 0;
  let unsupported = 0;
  let conflicts = 0;
  let total = 0;
  const put = (date, code, min) => {
    const cur = days[date];
    if (!cur) { days[date] = { code, min }; return; }
    if (cur.code === code) return;
    conflicts++;
    const better = PRIO[code] < PRIO[cur.code] || (PRIO[code] === PRIO[cur.code] && (min ?? 1440) < (cur.min ?? 1440));
    if (better) days[date] = { code, min };
  };

  events.forEach(ev => {
    if (ev.status === 'CANCELLED') { cancelled++; return; }
    if (ev.rrule && !ev.rrule.supported && !ev.recurrenceId) unsupported++;
    const list = ev.recurrenceId ? [ev.start] : occurrences(ev, until || addDays(ev.start.date, 400));
    const skip = new Set([...exKeys(ev.exdates), ...(!ev.recurrenceId && ev.uid ? moved.get(ev.uid) || [] : [])]);
    const startLoc = toLocal(ev.start);
    const endLoc = ev.end ? toLocal(ev.end) : null;
    /* Dauer in Minuten (zeitgebunden) oder Tagen (ganztägig) */
    const durMin = ev.start.allDay ? null
      : endLoc && !endLoc.allDay ? Math.round((endLoc.ms - startLoc.ms) / 60000)
        : ev.duration != null ? ev.duration : null;
    const spanDays = ev.start.allDay
      ? Math.max(1, Math.min(MAX_SPAN_DAYS, ev.end ? dayNum(ev.end.date) - dayNum(ev.start.date) : ev.duration ? Math.ceil(ev.duration / 1440) : 1))
      : 1;
    list.forEach(o => {
      const loc = toLocal(o);
      if (skip.has('D' + o.date) || (!loc.allDay && skip.has('T' + loc.ms))) return;
      total++;
      let code = codeFromTitle(ev.summary);
      if (!code && !loc.allDay && !(durMin != null && durMin < MIN_SHIFT_MINUTES)) code = codeFromTime(loc.min, times);
      if (!code) {
        unknown.push({ date: loc.date, title: (ev.summary || 'Termin ohne Titel').slice(0, 60) });
        return;
      }
      /* Urlaub und „frei“ gelten für jeden Tag, den der Termin abdeckt; eine Schicht nur für den Tag ihres Beginns */
      let n = 1;
      if (loc.allDay) n = spanDays;
      else if ((code === 'U' || code === '-') && durMin > 0) {
        const lastDay = ymdOf(new Date(loc.ms + durMin * 60000 - 1));
        n = Math.max(1, Math.min(MAX_SPAN_DAYS, dayNum(lastDay) - dayNum(loc.date) + 1));
      }
      for (let i = 0; i < n; i++) put(addDays(loc.date, i), code, loc.min);
    });
  });

  const entries = Object.entries(days).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const byCode = { F: 0, S: 0, N: 0, U: 0, '-': 0 };
  entries.forEach(([, v]) => { byCode[v.code]++; });
  return {
    days: Object.fromEntries(entries.filter(([, v]) => v.code !== '-').map(([d, v]) => [d, v.code])),
    from: entries.length ? entries[0][0] : null,
    to: entries.length ? entries[entries.length - 1][0] : null,
    shifts: byCode.F + byCode.S + byCode.N,
    vacation: byCode.U,
    byCode,
    unknown: unknown.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    cancelled,
    unsupported,
    conflicts,
    events: total,
  };
}
