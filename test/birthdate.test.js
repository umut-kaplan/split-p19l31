import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ageFrom, parseYmd, cleanBirthDate, birthDateProblem, profileAge, birthDateDe, birthPromptDue, yearsText, PROMPT_SNOOZE_DAYS,
} from '../js/domain/birthdate.js';
import { defaultState, normalize, toBackup, fromBackup } from '../js/store/migrate.js';
import { standOf, encodeStand } from '../js/domain/compare.js';
import { trainingsCsv } from '../js/store/csv.js';
import { weeklyReport, reportWeekStart } from '../js/domain/report.js';

const DAY = 864e5;
/* Ortszeit, damit die Tests in jeder Zeitzone dasselbe meinen */
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

test('Alter in ganzen Jahren: Geburtstag heute zählt, morgen noch nicht', () => {
  assert.equal(ageFrom('1990-03-12', at(2026, 3, 12)), 36);
  assert.equal(ageFrom('1990-03-12', at(2026, 3, 11)), 35);
  assert.equal(ageFrom('1990-03-12', at(2026, 3, 13)), 36);
  assert.equal(ageFrom('1990-03-12', at(2026, 2, 28)), 35);
  assert.equal(ageFrom('1990-03-12', at(2026, 12, 31)), 36);
  assert.equal(ageFrom('1990-12-31', at(2026, 1, 1)), 35);
  /* Kurz nach Mitternacht und kurz davor, in Ortszeit */
  assert.equal(ageFrom('1990-03-12', at(2026, 3, 12, 0, 1)), 36);
  assert.equal(ageFrom('1990-03-12', at(2026, 3, 11, 23, 59)), 35);
  /* Date statt Millisekunden */
  assert.equal(ageFrom('1990-03-12', new Date(2026, 2, 12)), 36);
});

test('29. Februar: in Schaltjahren am 29., sonst am 1. März ein Jahr älter', () => {
  assert.equal(ageFrom('2000-02-29', at(2024, 2, 28)), 23);
  assert.equal(ageFrom('2000-02-29', at(2024, 2, 29)), 24);
  assert.equal(ageFrom('2000-02-29', at(2025, 2, 28)), 24);
  assert.equal(ageFrom('2000-02-29', at(2025, 3, 1)), 25);
  assert.equal(ageFrom('2000-02-29', at(2026, 2, 28)), 25);
  assert.equal(ageFrom('2000-02-29', at(2026, 3, 1)), 26);
  /* Kein Schaltjahr: den Tag gibt es nicht */
  assert.equal(ageFrom('2001-02-29', at(2026, 3, 1)), null);
  assert.equal(parseYmd('1900-02-29'), null);
  assert.deepEqual(parseYmd('2000-02-29'), { y: 2000, m: 2, d: 29 });
});

test('Ungültige Angaben ergeben kein Alter', () => {
  for (const v of [null, undefined, '', '1990-3-12', '12.03.1990', '1990-13-01', '1990-04-31', '1990-00-10', 19900312, 'abc']) {
    assert.equal(ageFrom(v, at(2026, 9, 30)), null, String(v));
    assert.equal(cleanBirthDate(v), null, String(v));
  }
  assert.equal(cleanBirthDate('1990-03-12'), '1990-03-12');
});

test('Zeitzonen: es zählt der Kalendertag vor Ort, nie UTC', () => {
  const before = process.env.TZ;
  try {
    for (const tz of ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Europe/Berlin', 'America/Los_Angeles', 'UTC']) {
      process.env.TZ = tz;
      assert.equal(ageFrom('1990-03-12', new Date(2026, 2, 12, 0, 5).getTime()), 36, tz + ' kurz nach Mitternacht');
      assert.equal(ageFrom('1990-03-12', new Date(2026, 2, 11, 23, 55).getTime()), 35, tz + ' kurz vor Mitternacht');
      assert.equal(birthDateDe('1990-03-12'), '12.03.1990', tz);
    }
  } finally {
    if (before === undefined) delete process.env.TZ; else process.env.TZ = before;
  }
});

test('Plausibel sind 10 bis 100 Jahre, kein Datum in der Zukunft', () => {
  const now = at(2026, 9, 30);
  assert.equal(birthDateProblem('1990-03-12', now), null);
  assert.equal(birthDateProblem('2016-09-30', now), null, 'heute 10 geworden');
  assert.equal(birthDateProblem('2016-10-01', now), 'young');
  assert.equal(birthDateProblem('2026-09-30', now), 'young', 'heute geboren');
  assert.equal(birthDateProblem('2026-10-01', now), 'future');
  assert.equal(birthDateProblem('2030-01-01', now), 'future');
  assert.equal(birthDateProblem('1926-09-30', now), null, 'heute 100 geworden');
  assert.equal(birthDateProblem('1925-10-01', now), null, 'noch 100');
  assert.equal(birthDateProblem('1925-09-30', now), 'old', 'heute 101 geworden');
  assert.equal(birthDateProblem('1899-12-31', at(1990, 1, 1)), 'old', 'vor 1900');
  assert.equal(birthDateProblem('1990-02-30', now), 'format');
});

test('Alter für die Rechnung: Geburtsdatum vor altem Alter, sonst nichts', () => {
  const now = at(2026, 9, 30);
  assert.deepEqual(profileAge({ birthDate: '1990-03-12', age: 20 }, now), { age: 36, from: 'birthDate' });
  assert.deepEqual(profileAge({ birthDate: null, age: 34 }, now), { age: 34, from: 'age' });
  assert.deepEqual(profileAge({ birthDate: 'kaputt', age: 34 }, now), { age: 34, from: 'age' });
  assert.equal(profileAge({ birthDate: null, age: null }, now), null);
  assert.equal(profileAge({}, now), null);
  assert.equal(profileAge(null, now), null);
  assert.equal(yearsText(1), '1 Jahr');
  assert.equal(yearsText(34), '34 Jahre');
});

test('Karte auf „Heute“ nur für Bestandsnutzer mit Alter und ohne Geburtsdatum', () => {
  const now = at(2026, 9, 30);
  const S = defaultState();
  S.settings.onboardingDone = true;
  assert.equal(birthPromptDue(S, now), false, 'weder Alter noch Geburtsdatum');
  S.profile.age = 34;
  assert.equal(birthPromptDue(S, now), true);
  S.active = { name: 'Push' };
  assert.equal(birthPromptDue(S, now), false, 'nicht während eines Trainings');
  S.active = null;
  S.settings.onboardingDone = false;
  assert.equal(birthPromptDue(S, now), false, 'nicht vor dem Ende der Einrichtung');
  S.settings.onboardingDone = true;
  S.settings.birthPromptSnoozedAt = now - 3 * DAY;
  assert.equal(birthPromptDue(S, now), false, '„Später“ vor 3 Tagen');
  S.settings.birthPromptSnoozedAt = now - PROMPT_SNOOZE_DAYS * DAY;
  assert.equal(birthPromptDue(S, now), true, 'nach 30 Tagen wieder da');
  S.settings.birthPromptSnoozedAt = now + 5 * DAY;
  assert.equal(birthPromptDue(S, now), true, '„Später“ aus der Zukunft zählt nicht');
  S.profile.birthDate = '1990-03-12';
  assert.equal(birthPromptDue(S, now), false, 'Geburtsdatum eingetragen');
});

test('normalize: alte Stände ohne Geburtsdatum, kaputte Werte fallen weg, Backup trägt es mit', () => {
  const old = defaultState();
  delete old.profile.birthDate;
  old.profile.age = 34;
  const n = normalize(old);
  assert.equal(n.profile.birthDate, null);
  assert.equal(n.profile.age, 34);
  assert.equal(normalize({ ...old, profile: { ...old.profile, birthDate: '31.02.1990' } }).profile.birthDate, null);
  const S = defaultState();
  S.profile.birthDate = '1990-03-12';
  const back = fromBackup(JSON.parse(JSON.stringify(toBackup(S))));
  assert.equal(back.profile.birthDate, '1990-03-12');
});

test('Das Geburtsdatum steht nie im QR-Code, in der CSV oder im Wochenbericht', () => {
  const NOW = at(2026, 9, 30, 18);
  const S = defaultState();
  Object.assign(S.profile, { name: 'Umut', birthDate: '1990-03-12', age: 34, sex: 'm', heightCm: 180 });
  S.sessions = [1, 3, 5].map(d => ({
    id: 's' + d, planId: 'split', dayId: 'push', name: 'Push', color: 'red',
    startedAt: NOW - d * DAY, endedAt: NOW - d * DAY + 3600e3,
    ex: [{ exId: 'bankdruecken', name: 'Bankdrücken', unit: 'reps', sets: [{ w: 80, r: 8, rir: 2 }] }],
  }));
  S.body.weights = [{ date: '2026-09-25', kg: 82, source: 'manual', method: 'scale' }];
  const texts = [
    encodeStand(standOf(S, { now: NOW })),
    trainingsCsv(S),
    JSON.stringify(weeklyReport(S, reportWeekStart(NOW))),
    JSON.stringify(weeklyReport(S, reportWeekStart(NOW + 7 * DAY))),
  ];
  assert.match(texts[0], /Umut/, 'der QR-Code liest das Profil');
  assert.match(texts[1], /Bankdr/, 'die CSV enthält die Trainings');
  for (const t of texts) {
    assert.ok(!/1990|12\.03\.|birth/i.test(t), t.slice(0, 120));
  }
});
