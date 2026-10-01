/* Schichtplan: Schichtarten, Muster, Import und Einzeländerungen. Reine Funktionen, Tage als 'YYYY-MM-DD' in Ortszeit.

   Schichtart: { id, short, name, cat, color }. Die id ist der Code in Muster, Import und Einzeländerungen.
   Die Arten der ersten Version behalten ihre Codes 'F', 'S', 'N', '-' (frei) und 'U' (Urlaub); eigene Arten
   heißen 'c1', 'c2' … Das Kürzel (short) sieht der Nutzer, es lässt sich ändern, ohne dass Daten umziehen.
   Die Kategorie (cat) sagt dem Planer, wie er mit dem Tag umgeht. Uhrzeiten stehen je Art in times[id],
   nur für Arten mit Arbeitszeit (Früh, Spät, Nacht, Tag, 24 h).
   Rangfolge je Tag: Einzeländerung > Import > Muster. Im Zeitraum eines Imports gilt ein Tag ohne Schicht als frei.
   Eine Einzeländerung ist ein Code oder { code, times } mit eigenen Uhrzeiten für diesen Tag.
   Eine Nacht- oder 24-h-Schicht zählt zum Tag, an dem sie beginnt.
   Gerechnet wird mit Tagnummern (Mitternacht in UTC). So verschiebt die Zeitumstellung keinen Tag. */

/* ---------- Kategorien ---------- */
export const CATS = ['early', 'late', 'night', 'day', 'h24', 'dispo', 'off', 'vacation', 'sick'];
export const CAT_LABEL = {
  early: 'Früh', late: 'Spät', night: 'Nacht', day: 'Tag', h24: '24 h', dispo: 'Dispo', off: 'frei', vacation: 'Urlaub', sick: 'Krank',
};
/* Kategorien mit Arbeitszeit. Nur sie haben Uhrzeiten und zählen als Schicht. */
export const TIMED = ['early', 'late', 'night', 'day', 'h24'];
export const isTimedCat = cat => TIMED.includes(cat);
/* Uhrzeiten für eine neue Art je Kategorie */
export const CAT_TIMES = {
  early: ['06:00', '14:00'], late: ['14:00', '22:00'], night: ['22:00', '06:00'], day: ['06:00', '18:00'], h24: ['07:00', '07:00'],
};

/* ---------- Farben ---------- */
/* Palette für Schichtarten; die CSS-Klassen heißen sh-c-<Farbe> (css/shifts.css). grey ist das Grau von „frei“. */
export const COLORS = ['yellow', 'orange', 'red', 'pink', 'violet', 'blue', 'teal', 'green', 'steel', 'grey'];
export const COLOR_LABEL = {
  yellow: 'Gelb', orange: 'Orange', red: 'Rot', pink: 'Pink', violet: 'Violett', blue: 'Blau', teal: 'Türkis', green: 'Grün', steel: 'Hellgrau', grey: 'Grau',
};

/* ---------- Voreingestellte Arten ---------- */
export const DEFAULT_TYPES = [
  { id: 'F', short: 'F', name: 'Früh', cat: 'early', color: 'yellow' },
  { id: 'S', short: 'S', name: 'Spät', cat: 'late', color: 'blue' },
  { id: 'N', short: 'N', name: 'Nacht', cat: 'night', color: 'violet' },
  { id: 'T', short: 'T', name: 'Tag', cat: 'day', color: 'orange' },
  { id: 'X', short: 'X', name: '24-h-Dienst', cat: 'h24', color: 'red' },
  { id: 'D', short: 'D', name: 'Dispo', cat: 'dispo', color: 'teal' },
  { id: '-', short: '–', name: 'frei', cat: 'off', color: 'grey' },
  { id: 'U', short: 'U', name: 'Urlaub', cat: 'vacation', color: 'green' },
  { id: 'K', short: 'K', name: 'Krank', cat: 'sick', color: 'pink' },
];
export const DEFAULT_IDS = DEFAULT_TYPES.map(t => t.id);
/* Codes der ersten Version; WORK sind die drei klassischen Arbeitsschichten. Allgemein zählt die Kategorie (isWork). */
export const SHIFT_CODES = ['F', 'S', 'N', '-', 'U'];
export const WORK = ['F', 'S', 'N'];
/* Ganze Wörter für Sätze wie „Heute Frühschicht“, solange der Name der Voreinstellung nicht geändert wurde */
const LONG = { F: ['Früh', 'Frühschicht'], S: ['Spät', 'Spätschicht'], N: ['Nacht', 'Nachtschicht'], T: ['Tag', 'Tagschicht'] };

/* Vorlage „28 Tage, 21 Schichten“ in drei Blöcken (id 't28' seit Version 4.3). Alle Vorlagen: domain/shift-templates.js */
export const TEMPLATE_28 = {
  id: 't28',
  name: '28 Tage, 21 Schichten',
  blocks: ['FFSSSNN--', 'FFFSSNN---', 'FFSSNNN--'],
  days: 'FFSSSNN--FFFSSNN---FFSSNNN--'.split(''),
};

export const PATTERN_MIN = 2;
export const PATTERN_MAX = 371;
/* Zeiten der drei klassischen Schichten; die Import-Erkennung nimmt sie, wenn sie keine Arten bekommt */
export const DEFAULT_TIMES = { F: ['06:00', '14:00'], S: ['14:00', '22:00'], N: ['22:00', '06:00'] };
/* Zeiten aller voreingestellten Arten mit Arbeitszeit */
export const TYPE_TIMES = { ...DEFAULT_TIMES, T: ['06:00', '18:00'], X: ['07:00', '07:00'] };
/* Bevorzugte Trainingszeit je Tagart: F nach Früh- und Tagschicht, S vor der Spätschicht, N vor der Nacht,
   '-' für freie Tage, Urlaub, Dispo und Tage ohne Angabe */
export const DEFAULT_PREFER = { F: '15:30', S: '10:00', N: '17:00', '-': '11:00' };

/* types:      Schichtarten, siehe oben
   pattern:    null oder { start, days: [Code, …], template: Vorlagen-id | null }
   imported:   { 'YYYY-MM-DD': Code }   nur Datum und Schichtart, keine Titel
   importInfo: null oder { at, from, to, shifts, unknown }   Zeitraum und Zahlen des letzten Imports
   importMap:  { Titel in Kleinbuchstaben: Code }   Zuordnungen unbekannter Titel, die der Nutzer beim Import gewählt hat
   overrides:  { 'YYYY-MM-DD': Code | { code, times } }   Einzeländerungen
   times:      Beginn und Ende je Art mit Arbeitszeit, prefer: bevorzugte Trainingszeit je Tagart
   exported:   { Montag der Woche: Zeitpunkt }   wann eine Woche in den Kalender übernommen wurde */
export function defaultShifts() {
  return {
    types: DEFAULT_TYPES.map(t => ({ ...t })),
    pattern: null,
    imported: {},
    importInfo: null,
    importMap: {},
    overrides: {},
    times: Object.fromEntries(Object.entries(TYPE_TIMES).map(([k, v]) => [k, [...v]])),
    prefer: { ...DEFAULT_PREFER },
    exported: {},
  };
}

/* ---------- Tage ---------- */
export const isYmd = s => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return fromDayNum(dayNum(s)) === s;
};
export const isTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const dayNum = ymd => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
};
export const fromDayNum = n => new Date(n * 864e5).toISOString().slice(0, 10);
export const addDays = (ymd, n) => fromDayNum(dayNum(ymd) + n);
/* Wochentag mit Montag = 0. Der 1.1.1970 war ein Donnerstag. */
export const weekdayOf = ymd => (((dayNum(ymd) + 3) % 7) + 7) % 7;
export const mondayOf = ymd => addDays(ymd, -weekdayOf(ymd));
export const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const fromMin = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
/* Zeitpunkt eines Kalendertags und einer Uhrzeit in Ortszeit, mit Sommer- und Winterzeit */
export const localMs = (ymd, min = 0) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, Math.floor(min / 60), min % 60).getTime();
};
/* Dauer einer Schicht in Minuten; gleicher Beginn und gleiches Ende heißt 24 Stunden */
export const shiftMinutes = t => ((toMin(t[1]) - toMin(t[0]) + 1440) % 1440) || 1440;
/* Endet die Schicht erst am Folgetag? */
export const overnight = t => !!t && toMin(t[1]) <= toMin(t[0]);

/* ---------- Schichtarten ---------- */
export const typesOf = sh => (sh && Array.isArray(sh.types) && sh.types.length ? sh.types : DEFAULT_TYPES);
export const typeOf = (sh, code) => (code == null ? null : typesOf(sh).find(t => t.id === code) || null);
export const catOf = (sh, code) => { const t = typeOf(sh, code); return t ? t.cat : null; };
export const isWork = (sh, code) => isTimedCat(catOf(sh, code));
/* Name für Sätze: „Frühschicht“ statt „Früh“, solange der Name der Voreinstellung gilt */
export function typeLong(t) {
  if (!t) return '';
  const l = LONG[t.id];
  return l && t.name === l[0] ? l[1] : t.name;
}
/* Kürzel für Kalender und Liste, '?' für einen Tag ohne Angabe */
export const shortOf = (sh, code) => { const t = typeOf(sh, code); return t ? t.short : '?'; };
/* CSS-Klasse der Farbe; grau bekommt einen feinen Rand, ein Tag ohne Angabe ist durchsichtig */
export function shiftClass(sh, code) {
  const t = typeOf(sh, code);
  if (!t) return 'sh-q';
  return t.color === 'grey' ? 'sh-x' : `sh-c-${COLORS.includes(t.color) ? t.color : 'steel'}`;
}
/* Freie id für eine eigene Art */
export function newTypeId(types) {
  let n = 1;
  while (types.some(t => t.id === `c${n}`)) n++;
  return `c${n}`;
}

/* ---------- Schicht eines Tages ---------- */
export function patternAt(pattern, ymd) {
  if (!pattern || !pattern.days || !pattern.days.length) return null;
  const len = pattern.days.length;
  const i = (((dayNum(ymd) - dayNum(pattern.start)) % len) + len) % len;
  return pattern.days[i];
}
/* Stelle eines Tages im Muster (0 = Tag 1) */
export function patternIndex(pattern, ymd) {
  const len = pattern.days.length;
  return (((dayNum(ymd) - dayNum(pattern.start)) % len) + len) % len;
}

export const hasShiftPlan = sh => !!(sh && (sh.pattern || sh.importInfo));

const ovCode = v => (v && typeof v === 'object' ? v.code : v) || null;
const ovTimes = v => (v && typeof v === 'object' && Array.isArray(v.times) ? v.times : null);

/* Schicht eines Tages samt Herkunft. code ist null, wenn für den Tag nichts bekannt ist. */
export function shiftOn(sh, ymd) {
  if (!sh) return { code: null, source: null };
  const o = sh.overrides && sh.overrides[ymd];
  if (o) return { code: ovCode(o), source: 'override' };
  return baseShift(sh, ymd);
}

/* Schicht „wie im Plan“, also ohne Einzeländerung */
export function baseShift(sh, ymd) {
  if (!sh) return { code: null, source: null };
  const r = sh.importInfo;
  if (r && ymd >= r.from && ymd <= r.to) return { code: (sh.imported && sh.imported[ymd]) || '-', source: 'import' };
  if (sh.pattern) return { code: patternAt(sh.pattern, ymd), source: 'pattern' };
  return { code: null, source: null };
}

/* Übliche Uhrzeiten einer Art oder null */
export function typeTimes(sh, code) {
  const t = typeOf(sh, code);
  if (!t || !isTimedCat(t.cat)) return null;
  return (sh && sh.times && sh.times[code]) || TYPE_TIMES[code] || CAT_TIMES[t.cat];
}

/* Alles über einen Tag: { code, source, type, cat, times, ownTimes }. times sind die Uhrzeiten dieses Tages
   (eigene aus der Einzeländerung oder die üblichen der Art), ownTimes sagt, ob sie für den Tag geändert wurden. */
export function dayShift(sh, ymd) {
  const { code, source } = shiftOn(sh, ymd);
  const type = typeOf(sh, code);
  const cat = type ? type.cat : null;
  const own = source === 'override' && isTimedCat(cat) ? ovTimes(sh.overrides[ymd]) : null;
  return { code, source, type, cat, times: own || typeTimes(sh, code), ownTimes: !!own };
}

const sameTimes = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

/* Setzt eine Einzeländerung, auf Wunsch mit eigenen Uhrzeiten. Entspricht sie dem Plan, verschwindet sie wieder. */
export function setOverride(sh, ymd, code, times = null) {
  const next = { ...(sh.overrides || {}) };
  const own = code && times && isTimedCat(catOf(sh, code)) && !sameTimes(times, typeTimes(sh, code)) ? [times[0], times[1]] : null;
  if (!code || (baseShift(sh, ymd).code === code && !own)) delete next[ymd];
  else next[ymd] = own ? { code, times: own } : code;
  return next;
}

/* „06–14 Uhr“, bei krummen Zeiten „05:45–13:45 Uhr“, beim 24-h-Dienst „07–07 Uhr“ */
export function fmtTimes(t) {
  if (!t) return '';
  return t[0].endsWith(':00') && t[1].endsWith(':00')
    ? `${t[0].slice(0, 2)}–${t[1].slice(0, 2)} Uhr`
    : `${t[0]}–${t[1]} Uhr`;
}
export const timesText = (times, code) => fmtTimes(times && times[code]);

/* Die nächsten Tage als Liste { date, code, source }, z. B. für eine Vorschau */
export function shiftDays(sh, from, n) {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(from, i);
    return { date, ...shiftOn(sh, date) };
  });
}

/* Wo eine Art vorkommt: Tage im Muster, im Import, als Einzeländerung und in gemerkten Zuordnungen */
export function typeUsage(sh, id) {
  const count = obj => Object.values(obj || {}).filter(v => ovCode(v) === id).length;
  return {
    pattern: sh.pattern ? sh.pattern.days.filter(c => c === id).length : 0,
    imported: count(sh.imported),
    overrides: count(sh.overrides),
    map: count(sh.importMap),
  };
}

/* Löscht eine Art. Im Muster wird sie zu „frei“, Import-Tage, Einzeländerungen und Zuordnungen fallen weg.
   „frei“ selbst bleibt immer. Liefert den neuen Stand, der alte bleibt unverändert. */
export function removeType(sh, id) {
  if (id === '-') return sh;
  const keep = obj => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => ovCode(v) !== id));
  const times = { ...(sh.times || {}) };
  delete times[id];
  return {
    ...sh,
    types: typesOf(sh).filter(t => t.id !== id),
    pattern: sh.pattern ? { ...sh.pattern, days: sh.pattern.days.map(c => (c === id ? '-' : c)) } : null,
    imported: keep(sh.imported),
    overrides: keep(sh.overrides),
    importMap: keep(sh.importMap),
    times,
  };
}

/* ---------- Gespeicherten Stand prüfen ---------- */
const ID_RE = /^(?:[A-Z]|-|c\d{1,4})$/;
const clean = (s, max) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '');
function cleanType(t) {
  if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !ID_RE.test(t.id)) return null;
  const def = DEFAULT_TYPES.find(d => d.id === t.id);
  const cat = CATS.includes(t.cat) ? t.cat : def ? def.cat : null;
  if (!cat) return null;
  const short = clean(t.short, 3) || (def ? def.short : '');
  const name = clean(t.name, 24) || (def ? def.name : '');
  if (!short || !name) return null;
  return { id: t.id, short, name, cat, color: COLORS.includes(t.color) ? t.color : def ? def.color : 'steel' };
}
const okTimes = t => Array.isArray(t) && t.length === 2 && isTime(t[0]) && isTime(t[1]);
/* Vorlagen-ids wie 't28', 'w3v-so'; welche es gibt, steht in domain/shift-templates.js */
const TPL_RE = /^[a-z0-9]{1,8}(?:-[a-z0-9]{1,8})?$/;

/* Stände ohne Schichtarten (bis Version 4.4) bekommen die voreingestellten; ihre Codes F, S, N, U und '-' sind darin enthalten */
export function normalizeShifts(raw) {
  const d = defaultShifts();
  if (!raw || typeof raw !== 'object') return d;
  const seen = new Set();
  let types = (Array.isArray(raw.types) ? raw.types : []).map(cleanType)
    .filter(t => t && !seen.has(t.id) && seen.add(t.id));
  if (!types.length) types = d.types;
  /* „frei“ gibt es immer, denn Import-Tage ohne Termin und gelöschte Arten werden dazu */
  const free = types.find(t => t.id === '-');
  if (!free) types = [...types, { ...DEFAULT_TYPES.find(t => t.id === '-') }];
  else free.cat = 'off';
  const ids = types.map(t => t.id);
  const okCode = c => ids.includes(c);
  const sh = { types };
  const p = raw.pattern;
  const pattern = p && isYmd(p.start) && Array.isArray(p.days) && p.days.length >= 1 && p.days.length <= PATTERN_MAX && p.days.every(okCode)
    ? { start: p.start, days: [...p.days], template: typeof p.template === 'string' && TPL_RE.test(p.template) ? p.template : null }
    : null;
  const days = (obj, ok) => Object.fromEntries(Object.entries(obj && typeof obj === 'object' ? obj : {})
    .filter(([k, v]) => isYmd(k) && ok(v)));
  const ii = raw.importInfo;
  const importInfo = ii && isYmd(ii.from) && isYmd(ii.to) && ii.from <= ii.to
    ? { at: Number(ii.at) || null, from: ii.from, to: ii.to, shifts: Number(ii.shifts) || 0, unknown: Number(ii.unknown) || 0 }
    : null;
  const time = (v, def) => (isTime(v) ? v : def);
  const times = {};
  types.filter(t => isTimedCat(t.cat)).forEach(t => {
    const r = raw.times && Array.isArray(raw.times[t.id]) ? raw.times[t.id] : [];
    const def = TYPE_TIMES[t.id] || CAT_TIMES[t.cat];
    times[t.id] = [time(r[0], def[0]), time(r[1], def[1])];
  });
  sh.times = times;
  const overrides = {};
  Object.entries(raw.overrides && typeof raw.overrides === 'object' ? raw.overrides : {}).forEach(([k, v]) => {
    if (!isYmd(k)) return;
    if (typeof v === 'string' && okCode(v)) overrides[k] = v;
    else if (v && typeof v === 'object' && okCode(v.code)) {
      overrides[k] = okTimes(v.times) && isTimedCat(catOf(sh, v.code)) ? { code: v.code, times: [...v.times] } : v.code;
    }
  });
  const importMap = Object.fromEntries(Object.entries(raw.importMap && typeof raw.importMap === 'object' ? raw.importMap : {})
    .filter(([k, v]) => k && k.length <= 60 && okCode(v)));
  const prefer = {};
  Object.keys(d.prefer).forEach(k => { prefer[k] = time(raw.prefer && raw.prefer[k], d.prefer[k]); });
  const exported = Object.fromEntries(Object.entries(raw.exported && typeof raw.exported === 'object' ? raw.exported : {})
    .filter(([k, v]) => isYmd(k) && Number.isFinite(v)));
  return {
    types,
    pattern,
    imported: importInfo ? days(raw.imported, v => v !== '-' && okCode(v)) : {},
    importInfo,
    importMap,
    overrides,
    times,
    prefer,
    exported,
  };
}
