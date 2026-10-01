/* Smart-Zirkel in der Einheit (4.7, B): Hinweis, Chip „Methode“, Schild je Satz, Sheet */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoHint, methodChip, methodTag, methodSheetBody, AUTO_HINT } from '../js/views/smart-sets.js';
import { setCardMethod, setSetMethod } from '../js/domain/smart-sets.js';

const ex = (m, log) => ({ name: 'Brustpresse (Smart-Zirkel)', ...(m ? { m } : {}), log: log || [{ w: '', r: '', rir: 2, done: false }, { w: '', r: '', rir: 2, done: false }] });

test('Hinweis statt Gewichtsvorschlag, wörtlich wie entschieden', () => {
  assert.equal(AUTO_HINT, 'Das Gerät stellt das Gewicht ein – trag ein, was es anzeigt.');
  assert.equal(autoHint(), '<div class="hint auto">Das Gerät stellt das Gewicht ein – trag ein, was es anzeigt.</div>');
});

test('Chip nennt die Methode der Karte und wie viele Sätze anders sind', () => {
  const x = ex();
  assert.match(methodChip(x, 3), /data-act="smethod" data-i="3"[\s\S]*<small>Methode<\/small>Regulär<\/button>/);
  assert.doesNotMatch(methodChip(x, 3), /sm-note/);
  setCardMethod(x, 'adaptive');
  setSetMethod(x, 1, 'negative');
  const html = methodChip(x, 0);
  assert.match(html, /<small>Methode<\/small>Adaptiv/);
  assert.match(html, /aria-label="Methode Adaptiv, 1 Satz anders\. Tippen zum Ändern"/);
  assert.match(html, /<span class="sm-note">1 Satz anders<\/span>/);
  assert.equal(methodTag(x, x.log[0]), '');
  assert.equal(methodTag(x, x.log[1]), '<span class="set-m">Negativ</span>');
});

test('Sheet: sechs Methoden für alle Sätze, je Satz eine Auswahl, Hinweis zu Rekorden', () => {
  const x = ex('negative');
  setSetMethod(x, 1, 'maxout');
  const html = methodSheetBody(x, 2);
  assert.deepEqual([...html.matchAll(/data-act="smethodall" data-i="2" data-v="(\w+)"/g)].map(m => m[1]),
    ['regular', 'negative', 'adaptive', 'isokinetic', 'explonic', 'maxout']);
  assert.match(html, /class="choice on" role="radio" aria-checked="true" data-act="smethodall" data-i="2" data-v="negative"/);
  assert.equal((html.match(/data-in="smset"/g) || []).length, 2);
  assert.match(html, /Satz 1<select data-in="smset" data-i="2" data-j="0">\s*<option value="" selected>wie alle \(Negativ\)/);
  assert.match(html, /data-j="1">[\s\S]*?<option value="maxout" selected>Max Out/);
  assert.match(html, /Rekorde zählen nur aus Sätzen mit „Regulär“/);
  assert.doesNotMatch(html, /egym/i);
});
