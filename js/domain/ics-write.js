/* Geplante Trainings als Kalender-Datei (.ics) für den iPhone-Kalender. Reine Funktionen.

   Format nach RFC 5545: CRLF am Zeilenende, Zeilen ab 75 Oktetten gefaltet (ohne ein Zeichen zu zerteilen),
   Text mit \\ \; \, und \n maskiert. Zeiten in Ortszeit mit TZID=Europe/Berlin und passender VTIMEZONE.
   UID stabil je Datum, z. B. split-2026-10-14@split; Erinnerung 30 Minuten vorher. */

export const ICS_TZ = 'Europe/Berlin';
export const ALARM_MINUTES = 30;
export const ICS_FILE = 'split-training.ics';

const VTIMEZONE_BERLIN = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Berlin',
  'X-LIC-LOCATION:Europe/Berlin',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

export const escapeText = s => String(s == null ? '' : s)
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r\n|\r|\n/g, '\\n');

/* Faltet eine Zeile auf höchstens 75 Oktette je Zeile. Folgezeilen beginnen mit einem Leerzeichen. */
export function foldLine(line) {
  const enc = new TextEncoder();
  const bytes = enc.encode(line);
  if (bytes.length <= 75) return line;
  const dec = new TextDecoder();
  const out = [];
  let i = 0;
  let limit = 75;
  while (i < bytes.length) {
    let end = Math.min(i + limit, bytes.length);
    /* Nicht mitten in einem UTF-8-Zeichen trennen: Folgebytes haben die Form 10xxxxxx */
    while (end < bytes.length && end > i && (bytes[end] & 0xC0) === 0x80) end--;
    out.push(dec.decode(bytes.slice(i, end)));
    i = end;
    limit = 74;
  }
  return out.join('\r\n ');
}

const pad = n => String(n).padStart(2, '0');
export const utcStamp = ms => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const localStamp = (date, time) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
const nextDay = date => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

export const trainingUid = date => `split-${date}@split`;

/* items: [{ date, time, end, name, reason, muscles }] aus planTrainings */
export function trainingsIcs(items, { now = Date.now(), alarmMinutes = ALARM_MINUTES } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Split//Schichtplaner//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...VTIMEZONE_BERLIN,
  ];
  (items || []).forEach(t => {
    const title = `Split: ${t.name}`;
    const endDate = t.end > t.time ? t.date : nextDay(t.date);
    const reason = t.reason ? t.reason.charAt(0).toUpperCase() + t.reason.slice(1) + '.' : '';
    const desc = [reason, t.muscles || '', 'Geplant von Split nach deinem Schichtplan.'].filter(Boolean).join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${trainingUid(t.date)}`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART;TZID=${ICS_TZ}:${localStamp(t.date, t.time)}`,
      `DTEND;TZID=${ICS_TZ}:${localStamp(endDate, t.end)}`,
      `SUMMARY:${escapeText(title)}`,
      `DESCRIPTION:${escapeText(desc)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(title)}`,
      `TRIGGER:-PT${alarmMinutes}M`,
      'END:VALARM',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
