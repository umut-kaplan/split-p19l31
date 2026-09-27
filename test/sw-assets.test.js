import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
/* Alle Pfade aus den Listen zwischen CORE und ASSETS */
const section = sw.slice(sw.indexOf('const CORE'), sw.indexOf('const ASSETS'));
const assets = [...section.matchAll(/'([^']+)'/g)].map(m => m[1]);

const walk = dir => (existsSync(join(root, dir)) ? readdirSync(join(root, dir)) : []).flatMap(f => {
  const p = join(dir, f);
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});

test('Jede Datei im Offline-Cache existiert', () => {
  assets.filter(a => a !== './').forEach(a => assert.ok(existsSync(join(root, a)), a + ' fehlt'));
});

test('Keine Datei steht doppelt im Offline-Cache', () => {
  const dup = assets.filter((a, i) => assets.indexOf(a) !== i);
  assert.deepEqual(dup, []);
});

test('Jede JS-, CSS-, Icon- und Daten-Datei ist im Offline-Cache', () => {
  const files = [...walk('js'), ...walk('css'), ...walk('icons'), ...walk('data')]
    .filter(f => !f.endsWith('.DS_Store') && !f.endsWith('.md'));
  files.forEach(f => assert.ok(assets.includes(f), f + ' fehlt in sw.js'));
});
