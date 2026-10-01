import { test } from 'node:test';
import assert from 'node:assert/strict';
import { triggerSelector } from '../js/ui/sheet.js';

/* Den Auslöser eines Sheets findet die App nach dem Neuzeichnen über diesen Selektor wieder */
test('Auslöser: id vor data-Attributen, ohne beides kein Selektor', () => {
  assert.equal(triggerSelector('button', 'food-q', [['data-act', 'x']]), '#food-q');
  assert.equal(triggerSelector('button', '', [['class', 'btn'], ['data-act', 'qweight']]), 'button[data-act="qweight"]');
  assert.equal(triggerSelector('button', '', [['data-act', 'check'], ['data-i', '0'], ['data-j', '2']]), 'button[data-act="check"][data-i="0"][data-j="2"]');
  assert.equal(triggerSelector('button', '', [['class', 'btn']]), null);
});

test('Anführungszeichen in Werten werden maskiert', () => {
  assert.equal(triggerSelector('button', '', [['data-k', 'a"b']]), 'button[data-k="a\\"b"]');
});
