import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, V } from '../js/state.js';
import { defaultState } from '../js/store/migrate.js';
import { settingsRows, subview, PAGES, actions } from '../js/views/settings.js';
import { APP_VERSION } from '../js/data/changelog.js';

beforeEach(() => {
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, defaultState());
  V.setView = null;
  V.tab = 'profile';
});

const titles = env => settingsRows(env).flatMap(([, rows]) => rows.map(r => r.title));

test('Übersicht: neun Zeilen in der gewünschten Reihenfolge, in drei Gruppen', () => {
  assert.deepEqual(settingsRows({ standalone: true }).map(([g]) => g), ['Training', 'Daten', 'App']);
  assert.deepEqual(titles({ standalone: true }),
    ['Studio', 'Training', 'Backup', 'Export', 'Apple Health', 'Schichtplan', 'Zurücksetzen', 'Was ist neu', 'Hinweise und Quellen']);
});

test('Training: Schalter „Bildschirm im Training wach halten“, Standard an, die Zeile nennt den Stand', () => {
  const hint = () => settingsRows({}).flatMap(([, r]) => r).find(r => r.page === 'training').hint;
  assert.equal(S.settings.wakeLock, true);
  assert.equal(hint(), 'Bildschirm bleibt an');
  V.setView = 'training';
  assert.match(subview(), /role="switch" aria-checked="true" data-act="wakelock">\s*<span>Bildschirm im Training wach halten<\/span>/);
  S.settings.wakeLock = false;
  assert.equal(hint(), 'Bildschirm geht wie sonst aus');
  assert.match(subview(), /aria-checked="false"/);
});

test('Im Browser kommt die Anleitung für den Home-Bildschirm als letzte Zeile dazu', () => {
  assert.equal(titles({ standalone: false }).at(-1), 'Auf den Home-Bildschirm');
});

test('Jede Zeile hat eine kurze Erklärung in einer Zeile und führt zu einer Unterseite oder zum Schichtplan', () => {
  settingsRows({}).forEach(([, rows]) => rows.forEach(r => {
    assert.ok(r.hint && r.hint.trim(), `${r.title}: Erklärung fehlt`);
    assert.ok(!/\n/.test(r.hint) && r.hint.length <= 30, `${r.title}: „${r.hint}“ zu lang für eine Zeile bei 320 px`);
    assert.ok(r.shift || PAGES[r.page], `${r.title}: kein Ziel`);
  }));
});

test('Schichtplan-Zeile öffnet die Einrichtung ohne Plan und mit Plan dessen Reiter „Einstellungen“', () => {
  const row = () => settingsRows({}).flatMap(([, r]) => r).find(r => r.title === 'Schichtplan');
  assert.equal(row().shift, 'setup');
  S.shifts.pattern = { start: '2026-09-14', days: ['F', 'S', 'N', '-'] };
  assert.equal(row().shift, 'settings');
});

test('Backup-Zeile nennt das letzte Backup', () => {
  const hint = () => settingsRows({}).flatMap(([, r]) => r).find(r => r.page === 'backup').hint;
  assert.equal(hint(), 'Noch kein Backup');
  S.settings.lastBackup = new Date('2026-09-25T12:00').getTime();
  assert.equal(hint(), 'Zuletzt am 25.9.');
});

test('Übersicht zeigt Zurück, alle Zeilen und unten die Versionszeile, aber keine langen Abschnitte', () => {
  V.setView = 'main';
  const html = subview();
  assert.match(html, /class="link back-link" data-act="back"/);
  for (const p of ['studio', 'training', 'backup', 'csv', 'health', 'reset', 'whatsnew', 'legal']) assert.match(html, new RegExp(`data-act="setgo" data-v="${p}"`));
  assert.match(html, /data-act="shiftopen"/);
  const version = html.indexOf(`Version ${APP_VERSION}</p>`);
  assert.ok(version > html.lastIndexOf('data-act="setgo"'), 'Versionszeile steht unten');
  assert.doesNotMatch(html, /data-act="export"|data-act="wipe"|data-act="gymplateedit"/);
});

test('Jede Unterseite hat „Zurück“, ihren Titel und ihren Inhalt', () => {
  const expect = {
    studio: /data-act="gymplateedit"[\s\S]*data-act="ptoggle"/,
    training: /data-act="wakelock"/,
    backup: /data-act="export"[\s\S]*data-act="import"[\s\S]*data-act="bkremind"/,
    csv: /data-act="exportcsv"/,
    health: /data-in="ahifile"/,
    reset: /data-act="rerunob"[\s\S]*data-act="resetplan"[\s\S]*data-act="wipe"/,
    whatsnew: new RegExp(`Version ${APP_VERSION.replace('.', '\\.')}`),
    legal: /href="https:\/\/wger\.de"/,
    home: /Zum Home-Bildschirm/,
  };
  assert.deepEqual(Object.keys(expect).sort(), Object.keys(PAGES).sort());
  for (const [page, re] of Object.entries(expect)) {
    V.setView = page;
    const html = subview();
    assert.match(html, /data-act="back"/, page);
    assert.match(html, new RegExp(`<h1 class="page-title">${PAGES[page][0]}</h1>`), page);
    assert.match(html, re, page);
  }
});

test('Hinweise und Quellen: jeder Link ist eine eigene Zeile, kein Link im Fließtext', () => {
  V.setView = 'legal';
  const html = subview();
  const links = [...html.matchAll(/<a\b[^>]*>/g)].map(m => m[0]);
  assert.ok(links.length >= 6);
  links.forEach(a => assert.match(a, /class="nav-row src-row"/, a));
});

test('Unbekannte Unterseite zeigt die Übersicht, „setgo“ ignoriert unbekannte Ziele', () => {
  V.setView = 'gibtsnicht';
  assert.match(subview(), /<h1 class="page-title">Einstellungen<\/h1>/);
  V.setView = 'main';
  actions.setgo({ dataset: { v: 'gibtsnicht' } });
  assert.equal(V.setView, 'main');
});
