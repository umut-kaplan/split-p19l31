/* Liest Kalender-Dateien (.ics, RFC 5545) und erkennt darin Schichten. Reine Funktionen; die Datei verlässt das Gerät nicht.

   Unterstützt: Zeilenfaltung, DTSTART und DTEND mit TZID, in UTC (Z), ohne Zeitzone (Ortszeit) und ganztägig
   (VALUE=DATE), DURATION, STATUS:CANCELLED, RRULE mit FREQ=DAILY oder WEEKLY (INTERVAL, COUNT, UNTIL, BYDAY),
   EXDATE und geänderte Einzeltermine (RECURRENCE-ID). Andere Wiederholungen zählen nur mit dem ersten Termin
   und werden in der Zusammenfassung genannt.

   Schichtart, in dieser Reihenfolge:
   1. Eine gemerkte Zuordnung des Nutzers für genau diesen Titel (map, Schlüssel titleKey).
   2. Der Titel ist Name oder Kürzel einer Schichtart, z. B. „Zwischendienst“ oder „Z“.
   3. Wörter im Titel: Früh/Frueh/F, Spät/Spaet/S, Nacht/N (auch „Frühschicht“, „Spätdienst“, „Nachtwache“, „F-Schicht“,
      „Nachtdienstwoche“ usw., aber nur als ganzes Wort oder mit Schicht, Dienst, Wache oder Bereitschaft dahinter:
      „Frühjahrsputz“ und „Nachtwanderung“ sind keine Schicht),
      Tag/Tagschicht/Tagdienst (T), 24 h/24-Stunden-Dienst (X), Wache/Wachdienst (X, nur ab 16 Stunden Dauer),
      Dispo/Reserve (D), „frei“ ('-'); stehen mehrere im Titel, zählt das erste. Nur wenn keins davon vorkommt:
      Urlaub/Urlaubstag (U), Krank/krankgeschrieben/Krankmeldung (K) oder „AU“ als ganzer Titel. Urlaub und Krank
      zählen nur als ganzes Wort, „Krankengymnastik“, „Krankenpflege“ oder „Urlaubsvertretung“ also nicht.
      Fehlt die voreingestellte Art, nimmt die App die erste Art derselben Kategorie.
   4. Sonst Startzeit und Dauer: Beginn höchstens 2 Stunden neben dem Beginn einer Art mit Arbeitszeit, bei mehreren
      die mit dem kleinsten Abstand (Beginn plus halbe Abweichung der Dauer). Bei Standardzeiten also 04–08 Uhr Früh,
      12–16 Uhr Spät, 20–24 Uhr Nacht; eine Stunde 12-h-Dienst ab 06:00 wird Tag, 24 Stunden ab 07:00 der 24-h-Dienst.
      Das gilt nur für Termine ab 4 Stunden Dauer, damit ein kurzer Termin am Morgen nicht als Frühschicht zählt.
      Ohne Ende und Dauer rechnet die App mit 8 Stunden und wählt nur unter Früh, Spät und Nacht.
   Bei mehreren Terminen an einem Tag gehen Urlaub und Krank vor, außer aus einem Termin unter 4 Stunden.
   Eine Nacht- oder 24-h-Schicht zählt zum Tag, an dem sie beginnt. Übernommen werden nur Datum und Schichtart. */
import { DEFAULT_TIMES, DEFAULT_TYPES, isTimedCat, shiftMinutes, isYmd, dayNum, fromDayNum, addDays, toMin } from './shifts.js';

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
/* Schlüssel eines Titels für gemerkte Zuordnungen: klein, ohne doppelte Leerzeichen, höchstens 60 Zeichen */
export const titleKey = title => String(title || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
/* Titel für die Anzeige, höchstens max Zeichen, gekürzt mit „…“ */
const clip = (s, max) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s);
/* Schichtwörter. Stehen mehrere im Titel, zählt das erste.
   Früh, Spät und Nacht nur als ganzes Wort oder mit Schicht, Dienst, Wache, Bereitschaft oder Shift dahinter
   („Frühschicht“, „Spätdienst“, „Nachtwache“, auch „Früh1“). Danach darf das Wort weitergehen: „Frühdienstvertretung“,
   „Nachtdienstwoche“, „Nachtschichtzulage“. Nicht „Frühstück“, „Frühjahrsputz“, „Spätzle“ oder „Nachtwanderung“. */
const ALONE = '(?![a-z])';
const shiftWord = stem => new RegExp(`\\b${stem}(?:(?:schicht|dienst|wache|bereitschaft|shift)|${ALONE})`);
const SHIFT_WORDS = [
  ['F', shiftWord('(?:frueh|early)')],
  ['S', shiftWord('(?:spaet|late)')],
  ['N', shiftWord('(?:nacht|night)')],
  ['T', /\b(?:tag(?:schicht|dienst)|day\s*shift)/],
  ['X', /\b24\s*[-–]?\s*(?:h\b|std|stunden)|\b24er\b/],
  ['W', /\bwach(?:e|dienst)\b/],
  ['D', /\b(?:dispo|reserve)/],
];
const OFF_WORD = ['-', /\bfrei\b/];
/* Urlaub und Krank nur als ganzes Wort: „Krankengymnastik“, „Krankenhaus“, „Krankenpflege“ und „Urlaubsvertretung“
   sind keine Abwesenheit */
const ABSENCE_WORDS = [
  ['U', /\b(?:rest|sonder|jahres|bildungs|erholungs)?urlaub(?:stage?)?\b/],
  ['K', /\bkrank(?:geschrieben|gemeldet|meldung|schreibung|heit)?\b/],
];
/* „AU“ (Arbeitsunfähigkeit) nur als ganzer Titel, sonst träfe es auch „HU/AU“ fürs Auto */
const AU_ONLY = /^au[\s\d:.\-–()/]*$/;
/* Ab so vielen Minuten ist eine Wache ein 24-h-Dienst */
const WATCH_MIN = 960;

/* Code des Worts, das im Titel zuerst steht, oder null */
function firstWord(t, list) {
  let best = null;
  list.forEach(([code, re]) => {
    const m = re.exec(t);
    if (m && (!best || m.index < best.index)) best = { code, index: m.index };
  });
  return best ? best.code : null;
}

/* Schichtart aus dem Titel oder null. Mit Dauer in Minuten zählt „Wache“ erst ab 16 Stunden als 24-h-Dienst.
   Ein Schichtwort geht vor Urlaub und Krank: „Krankenpflege Spätdienst“ und auch „Krank Frühdienst“ bleiben Schicht. */
export function codeFromTitle(title, durMin = null) {
  const t = norm(title).trim();
  if (!t) return null;
  /* Ein einzelner Buchstabe, auch „F-Schicht“, „N 22-06“ */
  const one = /^([fsnt])(?:\s*[-–]?\s*(?:schicht|dienst))?[\s\d:.\-–()/]*$/.exec(t);
  if (one) return one[1].toUpperCase();
  /* „Tag“ allein oder mit Uhrzeit, nicht „Tag der offenen Tür“ */
  if (/^(?:12\s*h\s*)?tag(?:\s*12\s*h)?[\s\d:.\-–()/]*$/.test(t)) return 'T';
  if (AU_ONLY.test(t)) return 'K';
  const shifts = SHIFT_WORDS.filter(([code]) => code !== 'W' || durMin == null || durMin >= WATCH_MIN);
  const code = firstWord(t, shifts)
    ? firstWord(t, [...shifts, OFF_WORD])
    : firstWord(t, [...ABSENCE_WORDS, OFF_WORD]);
  return code === 'W' ? 'X' : code;
}

/* Schichtart aus der Startzeit (Minuten nach Mitternacht) oder null. times: Uhrzeiten je Code.
   Mit Dauer gewinnt bei mehreren passenden Arten die, deren Dauer besser passt. */
export function codeFromTime(min, times = DEFAULT_TIMES, tolerance = TIME_TOLERANCE, durMin = null) {
  let best = null;
  Object.keys(times).forEach(c => {
    const t = times[c];
    if (!t) return;
    let d = Math.abs(min - toMin(t[0]));
    d = Math.min(d, 1440 - d);
    if (d > tolerance) return;
    const score = d + (durMin != null ? Math.abs(durMin - shiftMinutes(t)) / 2 : 0);
    if (!best || score < best.score) best = { c, score };
  });
  return best ? best.c : null;
}

/* ---------- Schichten aus einer Datei ---------- */
/* Ausgenommene Termine: ganztägig nach Datum, sonst nach Zeitpunkt */
const exKeys = list => list.map(dt => (dt.allDay ? 'D' + dt.date : 'T' + toLocal(dt).ms));
/* Vorrang bei mehreren Terminen an einem Tag: Urlaub und Krank, dann die früheste Schicht, zuletzt „frei“.
   Urlaub oder Krank aus einem Termin unter 4 Stunden (short) verdrängt keine Schicht, nur „frei“. */
const PRIO = { vacation: 0, sick: 0, off: 2 };
const prio = (cat, short) => ((cat === 'vacation' || cat === 'sick') && short ? 1.5 : PRIO[cat] ?? 1);
/* Ohne Ende und Dauer: so lange dauert ein Termin für die Erkennung über die Startzeit, und nur diese Arten kommen in Frage */
const ASSUMED_MINUTES = 480;
const ASSUMED_CATS = ['early', 'late', 'night'];
/* Diese Arten gelten für jeden Tag, den ein Termin abdeckt; eine Schicht nur für den Tag ihres Beginns */
const SPANS = ['vacation', 'sick', 'off'];

/* Liefert { days: { Datum: Code }, from, to, shifts, vacation, gapDays, byCode, unknown: [{ date, title, key }],
   unknownTitles: [{ key, title, count, first }], cancelled, unsupported, conflicts, events }
   oder wirft einen Fehler, wenn die Datei kein Kalender ist.
   types: Schichtarten, times: Uhrzeiten je Code für die Erkennung über die Startzeit,
   map: gemerkte Zuordnungen { titleKey: Code }, gaps: Code für Tage im Zeitraum ohne Termin (z. B. 'U') oder null,
   until begrenzt endlose Serien (Standard: 400 Tage nach ihrem Beginn). */
export function shiftsFromIcs(text, { times = DEFAULT_TIMES, types = DEFAULT_TYPES, until = null, map = {}, gaps = null } = {}) {
  if (!/BEGIN:VCALENDAR/i.test(String(text || ''))) throw new Error('Das ist keine Kalender-Datei (.ics).');
  const events = parseIcs(text);
  const byId = new Map(types.map(t => [t.id, t]));
  const cat = code => (byId.get(code) || {}).cat;
  /* Voreingestellter Code aus dem Titel: gibt es die Art nicht mehr, die erste Art derselben Kategorie */
  const resolve = code => {
    if (byId.has(code)) return code;
    const def = DEFAULT_TYPES.find(t => t.id === code);
    const alt = def && types.find(t => t.cat === def.cat);
    return alt ? alt.id : null;
  };
  const named = new Map();
  types.forEach(t => [t.name, t.short].forEach(n => { const k = norm(n).trim(); if (k && !named.has(k)) named.set(k, t.id); }));
  /* Nur Arten mit Arbeitszeit, deren Uhrzeiten bekannt sind */
  const timeTable = Object.fromEntries(Object.entries(times).filter(([c]) => byId.has(c) && isTimedCat(cat(c))));
  const timeTableNoEnd = Object.fromEntries(Object.entries(timeTable).filter(([c]) => ASSUMED_CATS.includes(cat(c))));
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
  const put = (date, code, min, short) => {
    const cur = days[date];
    if (!cur) { days[date] = { code, min, short }; return; }
    if (cur.code === code) { cur.short = cur.short && short; return; }
    conflicts++;
    const a = prio(cat(code), short);
    const b = prio(cat(cur.code), cur.short);
    const better = a < b || (a === b && (min ?? 1440) < (cur.min ?? 1440));
    if (better) days[date] = { code, min, short };
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
    const key = titleKey(ev.summary);
    const own = map && byId.has(map[key]) ? map[key] : named.get(norm(ev.summary).trim()) || null;
    const word = own ? null : codeFromTitle(ev.summary, durMin);
    const fromTitle = own || (word && resolve(word));
    list.forEach(o => {
      const loc = toLocal(o);
      if (skip.has('D' + o.date) || (!loc.allDay && skip.has('T' + loc.ms))) return;
      total++;
      let code = fromTitle;
      const short = !loc.allDay && durMin != null && durMin < MIN_SHIFT_MINUTES;
      if (!code && !loc.allDay && !short) {
        code = durMin != null ? codeFromTime(loc.min, timeTable, TIME_TOLERANCE, durMin)
          : codeFromTime(loc.min, timeTableNoEnd, TIME_TOLERANCE, ASSUMED_MINUTES);
      }
      if (!code) {
        unknown.push({ date: loc.date, title: clip(ev.summary || 'Termin ohne Titel', 60), key });
        return;
      }
      let n = 1;
      if (loc.allDay) n = spanDays;
      else if (SPANS.includes(cat(code)) && durMin > 0) {
        const lastDay = ymdOf(new Date(loc.ms + durMin * 60000 - 1));
        n = Math.max(1, Math.min(MAX_SPAN_DAYS, dayNum(lastDay) - dayNum(loc.date) + 1));
      }
      for (let i = 0; i < n; i++) put(addDays(loc.date, i), code, loc.min, short);
    });
  });

  const entries = Object.entries(days).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const from = entries.length ? entries[0][0] : null;
  const to = entries.length ? entries[entries.length - 1][0] : null;
  /* Lücken im Zeitraum: Tage ohne Termin, auf Wunsch z. B. als Urlaub */
  let gapDays = 0;
  if (gaps && byId.has(gaps) && from) {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (!days[d]) { days[d] = { code: gaps, min: null }; gapDays++; }
    }
  }
  const all = Object.entries(days).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const byCode = Object.fromEntries(types.map(t => [t.id, 0]));
  all.forEach(([, v]) => { byCode[v.code] = (byCode[v.code] || 0) + 1; });
  const count = test => all.filter(([, v]) => test(cat(v.code))).length;
  /* Unbekannte Titel zusammengefasst, häufigste zuerst */
  const groups = new Map();
  unknown.forEach(u => {
    const g = groups.get(u.key) || { key: u.key, title: u.title, count: 0, first: u.date };
    g.count++;
    if (u.date < g.first) g.first = u.date;
    groups.set(u.key, g);
  });
  return {
    days: Object.fromEntries(all.filter(([, v]) => v.code !== '-').map(([d, v]) => [d, v.code])),
    from,
    to,
    shifts: count(isTimedCat),
    vacation: count(c => c === 'vacation'),
    gapDays,
    byCode,
    unknown: unknown.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    unknownTitles: [...groups.values()].sort((a, b) => b.count - a.count || (a.first < b.first ? -1 : 1)),
    cancelled,
    unsupported,
    conflicts,
    events: total,
  };
}
