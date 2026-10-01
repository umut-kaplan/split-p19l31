import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unseenChanges, shouldShow, dateDe } from '../js/domain/whatsnew.js';
import { CHANGES, APP_VERSION } from '../js/data/changelog.js';

const C = [
  { version: '4.4', date: '2026-11-01', items: ['c'] },
  { version: '4.3', date: '2026-10-15', items: ['b'] },
  { version: '4.2', date: '2026-09-30', items: ['a'] },
];

test('Nach einem Update kommen alle Versionen seit der zuletzt gesehenen', () => {
  assert.deepEqual(unseenChanges(C, '4.2').map(c => c.version), ['4.4', '4.3']);
  assert.deepEqual(unseenChanges(C, '4.3').map(c => c.version), ['4.4']);
  assert.deepEqual(unseenChanges(C, '4.4'), []);
});

test('Ohne gesehene oder mit unbekannter Version nur der neueste Eintrag', () => {
  assert.deepEqual(unseenChanges(C, undefined).map(c => c.version), ['4.4']);
  assert.deepEqual(unseenChanges(C, '3.0').map(c => c.version), ['4.4']);
  assert.deepEqual(unseenChanges([], '4.2'), []);
});

test('Gezeigt wird nur nach der Einrichtung und nur einmal pro Version', () => {
  assert.equal(shouldShow({ onboardingDone: true }, '4.2'), true);
  assert.equal(shouldShow({ onboardingDone: true, seenVersion: '4.1' }, '4.2'), true);
  assert.equal(shouldShow({ onboardingDone: true, seenVersion: '4.2' }, '4.2'), false);
  assert.equal(shouldShow({ onboardingDone: false }, '4.2'), false);
});

test('Datum im deutschen Format', () => {
  assert.equal(dateDe('2026-09-30'), '30.09.2026');
});

test('Changelog: neueste Version zuerst, jede mit Datum und Text, passend zum Cache in sw.js', () => {
  assert.ok(CHANGES.length > 0);
  assert.equal(APP_VERSION, CHANGES[0].version);
  CHANGES.forEach(c => {
    assert.match(c.version, /^\d+\.\d+$/);
    assert.match(c.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(c.items.length > 0 && c.items.every(i => typeof i === 'string' && i.length > 0));
  });
  const dates = CHANGES.map(c => c.date);
  assert.deepEqual([...dates].sort().reverse(), dates);
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.ok(sw.includes(`const CACHE = 'split-v${APP_VERSION}';`), 'CACHE in sw.js muss split-v' + APP_VERSION + ' heißen');
});

test('Der Changelog-Speicherstand steckt nicht im Grundzustand, sonst sähen Bestandsnutzer nie etwas', async () => {
  const { defaultState } = await import('../js/store/migrate.js');
  assert.equal(defaultState().settings.seenVersion, undefined);
});

test('Changelog 4.7 (Prüfung M4): höchstens 8 Punkte, „EGYM“ höchstens einmal, Plan-Satz richtig, Neuerungen genannt', () => {
  const c = CHANGES.find(x => x.version === '4.7');
  assert.ok(c.items.length <= 8, `${c.items.length} Punkte`);
  const all = c.items.join(' ');
  assert.ok((all.match(/EGYM/g) || []).length <= 1);
  assert.match(all, /Smart-Zirkel-Geräte \(z\. B\. EGYM\)/);
  assert.match(all, /Übernimmst du den überarbeiteten 3er-Split, kommt er als neuer Plan dazu; dein bisheriger bleibt\./);
  assert.doesNotMatch(all, /außer du übernimmst/);
  [/höchstens 500 kcal/, /Kalorienziel kann darum nach dem Update steigen/, /0,25 bis 0,5 % Zunahme pro Woche/, /erst ab 10 Wiegungen/,
    /Kurzhanteln steigen/, /Nacken und unterer Rücken/, /Rücken-Volumen niedriger/, /prüf bitte kurz, ob alles stimmt/, /Push\/Pull\/Beine 6×/]
    .forEach(re => assert.match(all, re));
});
