import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupReminder, reminderText, hasUserData, remindEvery, REMIND_DEFAULT, SNOOZE_DAYS } from '../js/domain/backup-reminder.js';
import { defaultState, normalize } from '../js/store/migrate.js';

const DAY = 864e5;
const NOW = new Date(2026, 8, 30, 12, 0).getTime();

const session = () => ({ id: 's1', dayId: 'push', name: 'Push', startedAt: NOW - 20 * DAY, endedAt: NOW - 20 * DAY + 36e5, ex: [] });
const withTraining = (settings = {}) => {
  const s = defaultState();
  s.sessions = [session()];
  Object.assign(s.settings, settings);
  return s;
};

test('Standard: Erinnerung nach 7 Tagen, im Grundzustand hinterlegt', () => {
  assert.equal(REMIND_DEFAULT, 7);
  assert.equal(defaultState().settings.backupRemindDays, 7);
  assert.equal(defaultState().settings.backupSnoozedAt, null);
});

test('Ohne Daten keine Karte, auch ohne Backup', () => {
  assert.equal(backupReminder(defaultState(), NOW), null);
  assert.equal(hasUserData(defaultState()), false);
});

test('Daten zählen: Training, Körper, Aktivität, Essen oder Wasser', () => {
  const base = () => defaultState();
  const a = base(); a.sessions = [session()];
  const b = base(); b.body.weights = [{ date: '2026-09-29', kg: 80 }];
  const c = base(); c.body.photos = [{ id: 'p', date: '2026-09-29', pose: 'front' }];
  const d = base(); d.nutrition.log = { '2026-09-29': [{ id: 'x', name: 'Apfel', grams: 100 }] };
  const e = base(); e.activity.steps = [{ date: '2026-09-29', steps: 8000 }];
  const f = base(); f.water = { '2026-09-29': 500 };
  [a, b, c, d, e, f].forEach((s, i) => assert.equal(hasUserData(s), true, `Fall ${i}`));
  /* Leere Tage im Ernährungsprotokoll oder Wasser 0 zählen nicht */
  const g = base(); g.nutrition.log = { '2026-09-29': [] }; g.water = { '2026-09-29': 0 };
  assert.equal(hasUserData(g), false);
});

test('Noch nie ein Backup, aber Daten da: Karte ohne Tageszahl', () => {
  const r = backupReminder(withTraining(), NOW);
  assert.deepEqual(r, { days: null });
  assert.equal(reminderText(r), 'Noch kein Backup. Alles liegt nur auf diesem Handy.');
});

test('Karte erst ab N Tagen seit dem letzten Backup', () => {
  assert.equal(backupReminder(withTraining({ lastBackup: NOW - 6 * DAY }), NOW), null);
  assert.equal(backupReminder(withTraining({ lastBackup: NOW - 7 * DAY + 1000 }), NOW), null);
  assert.deepEqual(backupReminder(withTraining({ lastBackup: NOW - 7 * DAY }), NOW), { days: 7 });
  const r = backupReminder(withTraining({ lastBackup: NOW - 12 * DAY - 5 * 36e5 }), NOW);
  assert.deepEqual(r, { days: 12 });
  assert.equal(reminderText(r), 'Letztes Backup vor 12 Tagen. Alles liegt nur auf diesem Handy.');
});

test('Einstellung 14 und 30 Tage', () => {
  assert.equal(backupReminder(withTraining({ backupRemindDays: 14, lastBackup: NOW - 13 * DAY }), NOW), null);
  assert.deepEqual(backupReminder(withTraining({ backupRemindDays: 14, lastBackup: NOW - 14 * DAY }), NOW), { days: 14 });
  assert.equal(backupReminder(withTraining({ backupRemindDays: 30, lastBackup: NOW - 29 * DAY }), NOW), null);
  assert.deepEqual(backupReminder(withTraining({ backupRemindDays: 30, lastBackup: NOW - 31 * DAY }), NOW), { days: 31 });
});

test('Einstellung aus: nie eine Karte', () => {
  assert.equal(backupReminder(withTraining({ backupRemindDays: 0 }), NOW), null);
  assert.equal(backupReminder(withTraining({ backupRemindDays: 0, lastBackup: NOW - 400 * DAY }), NOW), null);
});

test('Unbekannte Einstellung gilt als Standard', () => {
  assert.equal(remindEvery(undefined), 7);
  assert.equal(remindEvery('14'), 7);
  assert.equal(remindEvery(3), 7);
  assert.equal(remindEvery(30), 30);
  assert.equal(remindEvery(0), 0);
  assert.deepEqual(backupReminder(withTraining({ backupRemindDays: 'x', lastBackup: NOW - 8 * DAY }), NOW), { days: 8 });
});

test('„Später“ blendet die Karte für zwei Tage aus', () => {
  assert.equal(SNOOZE_DAYS, 2);
  const s = withTraining({ lastBackup: NOW - 10 * DAY, backupSnoozedAt: NOW });
  assert.equal(backupReminder(s, NOW), null);
  assert.equal(backupReminder(s, NOW + 2 * DAY - 1000), null);
  assert.deepEqual(backupReminder(s, NOW + 2 * DAY), { days: 12 });
  /* Auch ohne bisheriges Backup */
  const n = withTraining({ backupSnoozedAt: NOW - DAY });
  assert.equal(backupReminder(n, NOW), null);
  assert.deepEqual(backupReminder(n, NOW + DAY), { days: null });
});

test('„Später“ aus der Zukunft (verstellte Uhr) blendet nichts aus', () => {
  assert.deepEqual(backupReminder(withTraining({ backupSnoozedAt: NOW + 5 * DAY }), NOW), { days: null });
});

test('Alter Stand ohne die neuen Felder: normalize ergänzt sie, Erinnerung läuft', () => {
  const old = defaultState();
  delete old.settings.backupRemindDays;
  delete old.settings.backupSnoozedAt;
  old.sessions = [session()];
  old.settings.lastBackup = NOW - 9 * DAY;
  const s = normalize(JSON.parse(JSON.stringify(old)));
  assert.equal(s.settings.backupRemindDays, 7);
  assert.equal(s.settings.backupSnoozedAt, null);
  assert.deepEqual(backupReminder(s, NOW), { days: 9 });
  /* Eigene Einstellung bleibt erhalten */
  old.settings.backupRemindDays = 30;
  assert.equal(normalize(JSON.parse(JSON.stringify(old))).settings.backupRemindDays, 30);
});

test('Auch ohne settings stürzt nichts ab', () => {
  assert.equal(backupReminder({ sessions: [] }, NOW), null);
  assert.deepEqual(backupReminder({ sessions: [session()] }, NOW), { days: null });
  assert.equal(backupReminder(null, NOW), null);
});
