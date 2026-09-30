/* Geburtsdatum statt Alter. Reine Funktionen, per node --test geprüft.
   S.profile.birthDate: 'JJJJ-MM-TT' oder null. S.profile.age (ganze Jahre) bleibt nur als Notlösung
   für Stände von vor dem Geburtsdatum; ohne Geburtsdatum rechnet die App damit weiter und schätzt nichts.
   Das Geburtsdatum gehört nie in QR-Code, CSV oder Wochenbericht; test/birthdate.test.js prüft das.
   „Später“ auf der Karte in S.settings.birthPromptSnoozedAt (Zeitpunkt des Tipps), nicht im Grundzustand. */

export const MIN_AGE = 10;
export const MAX_AGE = 100;
export const MIN_DATE = '1900-01-01';
export const PROMPT_SNOOZE_DAYS = 30;
const DAY = 864e5;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/* 'JJJJ-MM-TT' als { y, m, d }, nur echte Kalendertage. Ohne Date-Parser, der Zeitzonen ins Spiel brächte. */
export function parseYmd(s) {
  const m = typeof s === 'string' ? YMD.exec(s) : null;
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1) return null;
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d > days ? null : { y, m: mo, d };
}

/* Gültiges Datum oder null, z. B. für normalize */
export const cleanBirthDate = s => (parseYmd(s) ? s : null);

/* Kalendertag von now in Ortszeit */
function localDay(now) {
  const t = now instanceof Date ? now : new Date(now);
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
}

/* Alter in ganzen Jahren am Kalendertag von now (Ortszeit). Am Geburtstag zählt das neue Jahr schon.
   Wer am 29. Februar geboren ist, wird in Jahren ohne Schalttag am 1. März älter. null bei ungültigem Datum. */
export function ageFrom(birthDate, now = Date.now()) {
  const b = parseYmd(birthDate);
  if (!b) return null;
  const t = localDay(now);
  const before = t.m < b.m || (t.m === b.m && t.d < b.d);
  return t.y - b.y - (before ? 1 : 0);
}

/* Warum ein eingegebenes Datum nicht passt: null, 'format', 'future', 'young' (unter 10) oder 'old' (über 100) */
export function birthDateProblem(birthDate, now = Date.now()) {
  const age = ageFrom(birthDate, now);
  if (age == null) return 'format';
  if (age < 0) return 'future';
  if (age < MIN_AGE) return 'young';
  if (age > MAX_AGE || birthDate < MIN_DATE) return 'old';
  return null;
}

const RANGE_TEXT = `Split rechnet mit ${MIN_AGE} bis ${MAX_AGE} Jahren. Das Datum ist nicht gespeichert.`;
export const PROBLEM_TEXT = {
  format: 'Das Datum ist ungültig und nicht gespeichert.',
  future: 'Das Datum liegt in der Zukunft und ist nicht gespeichert.',
  young: RANGE_TEXT,
  old: RANGE_TEXT,
};

/* Alter für die Rechnung: aus dem Geburtsdatum, sonst das früher eingetragene Alter, sonst null.
   Liefert { age, from: 'birthDate' | 'age' } oder null. */
export function profileAge(p, now = Date.now()) {
  if (!p) return null;
  const a = ageFrom(p.birthDate, now);
  if (a != null && a >= 0) return { age: a, from: 'birthDate' };
  if (p.age > 0) return { age: p.age, from: 'age' };
  return null;
}

export const yearsText = n => `${n} ${n === 1 ? 'Jahr' : 'Jahre'}`;

/* '1990-03-12' als '12.03.1990' */
export function birthDateDe(s) {
  const b = parseYmd(s);
  return b ? `${String(b.d).padStart(2, '0')}.${String(b.m).padStart(2, '0')}.${b.y}` : '';
}

/* Karte auf „Heute“ für Bestandsnutzer: Alter eingetragen, Geburtsdatum fehlt.
   Nicht während eines Trainings und 30 Tage nach „Später“ nicht. */
export function birthPromptDue(S, now = Date.now()) {
  if (!S || !S.profile || !S.settings || !S.settings.onboardingDone || S.active) return false;
  const p = S.profile;
  if (!(p.age > 0) || cleanBirthDate(p.birthDate)) return false;
  const snoozed = S.settings.birthPromptSnoozedAt;
  /* Ein „Später“ aus der Zukunft (Uhr verstellt) zählt nicht */
  if (typeof snoozed === 'number' && now >= snoozed && now - snoozed < PROMPT_SNOOZE_DAYS * DAY) return false;
  return true;
}
