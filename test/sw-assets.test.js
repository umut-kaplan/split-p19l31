import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

const walk = dir => readdirSync(join(root, dir)).flatMap(f => {
  const p = join(dir, f);
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});

test('Jede Datei im Offline-Cache existiert', () => {
  assets.filter(a => a !== './').forEach(a => assert.ok(existsSync(join(root, a)), a + ' fehlt'));
});

test('Jede JS-, CSS- und Icon-Datei ist im Offline-Cache', () => {
  const files = [...walk('js'), ...walk('css'), ...walk('icons')];
  files.forEach(f => assert.ok(assets.includes(f), f + ' fehlt in sw.js'));
});
