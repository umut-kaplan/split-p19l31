import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dShort } from '../js/util.js';

/* dShort endet schon mit einem Punkt („25.9.“). Ein Satzpunkt direkt dahinter ergäbe „25.9..“. */
const files = dir => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? (f === 'vendor' ? [] : files(p)) : p.endsWith('.js') ? [p] : [];
});

test('dShort endet mit Punkt', () => {
  assert.match(dShort(new Date('2026-09-25T12:00').getTime()), /^25\.9\.$/);
});

test('Kein Satzpunkt direkt nach ${dShort(…)} in den Texten der App', () => {
  const hits = [];
  for (const p of files(new URL('../js', import.meta.url).pathname)) {
    const s = readFileSync(p, 'utf8');
    for (const m of s.matchAll(/dShort\(/g)) {
      let i = m.index + m[0].length;
      for (let depth = 1; depth && i < s.length; i++) depth += s[i] === '(' ? 1 : s[i] === ')' ? -1 : 0;
      let j = i;
      while (j < s.length && ')}'.includes(s[j])) j++;
      if (s[j] === '.' && s[j - 1] === '}') hits.push(`${p}: ${s.slice(m.index, j + 1)}`);
    }
  }
  assert.deepEqual(hits, []);
});
