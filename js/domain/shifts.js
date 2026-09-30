/* Schichtplan: Muster, Import und Einzeländerungen. Reine Funktionen, Tage als 'YYYY-MM-DD' in Ortszeit.

   Codes: 'F' Früh, 'S' Spät, 'N' Nacht, '-' frei, 'U' Urlaub (wie frei, aber gekennzeichnet).
   Rangfolge je Tag: Einzeländerung > Import > Muster. Im Zeitraum eines Imports gilt ein Tag ohne Schicht als frei.
   Eine Nachtschicht zählt zum Tag, an dem sie beginnt.
   Gerechnet wird mit Tagnummern (Mitternacht in UTC). So verschiebt die Zeitumstellung keinen Tag. */

export const SHIFT_CODES = ['F', 'S', 'N', '-', 'U'];
export const WORK = ['F', 'S', 'N'];
export const SHIFT_LABEL = { F: 'Früh', S: 'Spät', N: 'Nacht', '-': 'frei', U: 'Urlaub' };
export const SHIFT_NAME = { F: 'Frühschicht', S: 'Spätschicht', N: 'Nachtschicht', '-': 'frei', U: 'Urlaub' };
/* Kürzel im Kalender und CSS-Klasse je Code; null steht für einen Tag ohne Angabe */
export const SHIFT_SHORT = { F: 'F', S: 'S', N: 'N', '-': '–', U: 'U' };
export const shiftClass = c => ({ F: 'sh-f', S: 'sh-s', N: 'sh-n', '-': 'sh-x', U: 'sh-u' }[c] || 'sh-q');

/* Vorlage „28 Tage, 21 Schichten“ in drei Blöcken. Tag 1 ist der erste Frühdienst von Block 1. */
export const TEMPLATE_28 = {
  id: 't28',
  name: '28 Tage, 21 Schichten',
  blocks: ['FFSSSNN--', 'FFFSSNN---', 'FFSSNNN--'],
  days: 'FFSSSNN--FFFSSNN---FFSSNNN--'.split(''),
};

export const PATTERN_MIN = 7;
export const PATTERN_MAX = 56;
export const DEFAULT_TIMES = { F: ['06:00', '14:00'], S: ['14:00', '22:00'], N: ['22:00', '06:00'] };
/* Bevorzugte Trainingszeit je Tagart; '-' gilt für freie Tage, Urlaub und Tage ohne Angabe */
export const DEFAULT_PREFER = { F: '15:30', S: '10:00', N: '17:00', '-': '11:00' };

/* pattern:    null oder { start, days: [Code, …], template: 't28' | null }
   imported:   { 'YYYY-MM-DD': 'F' | 'S' | 'N' | 'U' }   nur Datum und Schichtart, keine Titel
   importInfo: null oder { at, from, to, shifts, unknown }   Zeitraum und Zahlen des letzten Imports
   overrides:  { 'YYYY-MM-DD': Code }                  Einzeländerungen
   times:      Beginn und Ende je Schicht, prefer: bevorzugte Trainingszeit je Tagart
   exported:   { Montag der Woche: Zeitpunkt }        wann eine Woche in den Kalender übernommen wurde */
export function defaultShifts() {
  return {
    pattern: null,
    imported: {},
    importInfo: null,
    overrides: {},
    times: { F: [...DEFAULT_TIMES.F], S: [...DEFAULT_TIMES.S], N: [...DEFAULT_TIMES.N] },
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

/* ---------- Schicht eines Tages ---------- */
export function patternAt(pattern, ymd) {
  if (!pattern || !pattern.days || !pattern.days.length) return null;
  const len = pattern.days.length;
  const i = (((dayNum(ymd) - dayNum(pattern.start)) % len) + len) % len;
  return pattern.days[i];
}

export const hasShiftPlan = sh => !!(sh && (sh.pattern || sh.importInfo));

/* Schicht eines Tages samt Herkunft. code ist null, wenn für den Tag nichts bekannt ist. */
export function shiftOn(sh, ymd) {
  if (!sh) return { code: null, source: null };
  const o = sh.overrides && sh.overrides[ymd];
  if (o) return { code: o, source: 'override' };
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

/* Setzt eine Einzeländerung. Entspricht sie dem Plan, verschwindet sie wieder. */
export function setOverride(sh, ymd, code) {
  const next = { ...(sh.overrides || {}) };
  if (!code || baseShift(sh, ymd).code === code) delete next[ymd];
  else next[ymd] = code;
  return next;
}

/* „06–14 Uhr“, bei krummen Zeiten „05:45–13:45 Uhr“ */
export function timesText(times, code) {
  const t = times && times[code];
  if (!t) return '';
  return t[0].endsWith(':00') && t[1].endsWith(':00')
    ? `${t[0].slice(0, 2)}–${t[1].slice(0, 2)} Uhr`
    : `${t[0]}–${t[1]} Uhr`;
}

/* Die nächsten Tage als Liste { date, code, source }, z. B. für eine Vorschau */
export function shiftDays(sh, from, n) {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(from, i);
    return { date, ...shiftOn(sh, date) };
  });
}

/* ---------- Gespeicherten Stand prüfen ---------- */
export function normalizeShifts(raw) {
  const d = defaultShifts();
  if (!raw || typeof raw !== 'object') return d;
  const okCode = c => SHIFT_CODES.includes(c);
  const p = raw.pattern;
  const pattern = p && isYmd(p.start) && Array.isArray(p.days) && p.days.length >= 1 && p.days.length <= PATTERN_MAX && p.days.every(okCode)
    ? { start: p.start, days: [...p.days], template: p.template === TEMPLATE_28.id ? TEMPLATE_28.id : null }
    : null;
  const days = (obj, allowed) => Object.fromEntries(Object.entries(obj && typeof obj === 'object' ? obj : {})
    .filter(([k, v]) => isYmd(k) && allowed.includes(v)));
  const ii = raw.importInfo;
  const importInfo = ii && isYmd(ii.from) && isYmd(ii.to) && ii.from <= ii.to
    ? { at: Number(ii.at) || null, from: ii.from, to: ii.to, shifts: Number(ii.shifts) || 0, unknown: Number(ii.unknown) || 0 }
    : null;
  const time = (v, def) => (isTime(v) ? v : def);
  const times = {};
  WORK.forEach(k => {
    const t = raw.times && Array.isArray(raw.times[k]) ? raw.times[k] : [];
    times[k] = [time(t[0], d.times[k][0]), time(t[1], d.times[k][1])];
  });
  const prefer = {};
  Object.keys(d.prefer).forEach(k => { prefer[k] = time(raw.prefer && raw.prefer[k], d.prefer[k]); });
  const exported = Object.fromEntries(Object.entries(raw.exported && typeof raw.exported === 'object' ? raw.exported : {})
    .filter(([k, v]) => isYmd(k) && Number.isFinite(v)));
  return {
    pattern,
    imported: importInfo ? days(raw.imported, ['F', 'S', 'N', 'U']) : {},
    importInfo,
    overrides: days(raw.overrides, SHIFT_CODES.filter(okCode)),
    times,
    prefer,
    exported,
  };
}
