import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/data/exercises.js';
import { OFF_CREDIT_HTML } from '../js/store/off.js';

test('Jede Übung mit Bild nennt Urheber, Lizenz und Lizenz-Link (CC BY-SA 3(a)(1))', () => {
  const withImage = EXERCISES.filter(e => e.image && e.image !== 'idb');
  assert.ok(withImage.length > 0);
  withImage.forEach(e => {
    assert.ok(e.credit, e.id + ': credit fehlt');
    assert.ok(e.credit.author, e.id + ': Urheber fehlt');
    assert.match(e.credit.license, /^CC BY-SA [34]\.0$/, e.id);
    assert.match(e.credit.licenseUrl, /^https:\/\/creativecommons\.org\/licenses\/by-sa\/[34]\.0\//, e.id);
  });
});

test('Open-Food-Facts-Hinweis verlinkt Datenbank und ODbL', () => {
  assert.match(OFF_CREDIT_HTML, /href="https:\/\/openfoodfacts\.org"/);
  assert.match(OFF_CREDIT_HTML, /href="https:\/\/opendatacommons\.org\/licenses\/odbl\/1-0\/"/);
});
