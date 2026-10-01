/* Geräte in der Oberfläche (4.7, B): Alles abwählen, Zähler je Gruppe, abgedeckte Geräte, was einer Übung fehlt,
   Picker-Reihenfolge, Anforderung eigener Übungen mit „alle nötig“ / „eines genügt“. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EQUIPMENT_GROUPS, presetEquipment, clearEquipment, groupCount, coveredBy, shortEquipmentName,
  missingTerms, missingText, splitByEquipment, splitRequirement, buildRequirement, requirementText, canDo,
} from '../js/domain/equipment.js';
import { EXERCISES } from '../js/data/exercises.js';
import { findExercise } from '../js/domain/library.js';

test('Alles abwählen: Geräte weg, der Smart-Zirkel bleibt, wie er war', () => {
  assert.deepEqual(clearEquipment(['langhantel', 'kurzhanteln']), []);
  assert.deepEqual(clearEquipment(['langhantel', 'smart-zirkel']), ['smart-zirkel']);
  assert.deepEqual(clearEquipment([]), []);
  assert.deepEqual(clearEquipment(null), []);
});

test('Zähler je Gruppe: angehakt von allen, Summe 59', () => {
  const gross = presetEquipment('gross');
  const total = EQUIPMENT_GROUPS.reduce((n, g) => n + groupCount(gross, g.id).total, 0);
  assert.equal(total, 59);
  EQUIPMENT_GROUPS.forEach(g => { const c = groupCount(gross, g.id); assert.equal(c.on, c.total, g.id); });
  assert.deepEqual(groupCount(['kurzhanteln', 'smart-zirkel'], 'frei'), { on: 1, total: 5 });
  assert.deepEqual(groupCount([], 'kabel'), { on: 0, total: 4 });
  /* Alte Kategorien zählen nach dem Umzug mit */
  assert.deepEqual(groupCount(['Kabelzug'], 'kabel'), { on: 4, total: 4 });
});

test('Abgedeckt über die Regeln: Rack + Flachbank ergibt die Bankdrückstation, angehakt zählt nicht als abgedeckt', () => {
  assert.deepEqual(coveredBy(['kniebeugenstaender', 'flachbank'], 'bankdrueckstation'), ['kniebeugenstaender', 'flachbank']);
  assert.deepEqual(coveredBy(['kabelzug-doppelt'], 'kabelturm'), ['kabelzug-doppelt']);
  assert.deepEqual(coveredBy(['schraegbank'], 'flachbank'), ['schraegbank']);
  /* Kette: Schrägbank → Flachbank, Rack + Flachbank → Bankdrückstation */
  assert.deepEqual(coveredBy(['kniebeugenstaender', 'schraegbank'], 'bankdrueckstation'), ['kniebeugenstaender', 'flachbank']);
  assert.equal(coveredBy(['kniebeugenstaender', 'flachbank', 'bankdrueckstation'], 'bankdrueckstation'), null);
  assert.equal(coveredBy(['flachbank'], 'bankdrueckstation'), null);
  assert.equal(coveredBy([], 'kabelturm'), null);
});

test('Kurzname ohne Klammerzusatz', () => {
  assert.equal(shortEquipmentName('multipresse'), 'Multipresse');
  assert.equal(shortEquipmentName('trap-bar'), 'Trap-Bar');
  assert.equal(shortEquipmentName('kniebeugenstaender'), 'Power Rack / Kniebeugenständer');
  assert.equal(shortEquipmentName('smart-zirkel'), 'Smart-Zirkel');
  assert.equal(shortEquipmentName('langhantel'), 'Langhantel mit Scheiben');
});

test('Was fehlt: nur die nicht erfüllten Terme, „eines davon“ mit „oder“; leere Auswahl: nichts', () => {
  const squat = findExercise('kniebeugen');
  assert.deepEqual(missingTerms(squat, []), []);
  assert.equal(missingText(squat, ['langhantel']), 'Power Rack / Kniebeugenständer oder Multipresse');
  assert.equal(missingText(squat, ['langhantel', 'multipresse']), '');
  assert.equal(missingText(squat, ['kurzhanteln']), 'Langhantel mit Scheiben, Power Rack / Kniebeugenständer oder Multipresse');
  assert.equal(missingText(findExercise('smart-brustpresse'), ['brustpresse']), 'Smart-Zirkel');
  /* Die Regeln zählen mit: Rack + Flachbank deckt die Bankdrückstation ab */
  assert.equal(missingText(findExercise('bankdruecken'), ['langhantel', 'kniebeugenstaender', 'flachbank']), '');
  assert.equal(missingText(null, ['langhantel']), '');
});

test('Picker: passende Übungen zuerst in ihrer Reihenfolge, dann der Rest mit dem, was fehlt', () => {
  const have = ['kurzhanteln', 'flachbank'];
  const { fit, rest } = splitByEquipment(EXERCISES, have);
  assert.equal(fit.length + rest.length, EXERCISES.length);
  fit.forEach(e => assert.ok(canDo(e, have), e.id));
  rest.forEach(r => { assert.ok(!canDo(r.e, have), r.e.id); assert.ok(r.missing, r.e.id); });
  assert.deepEqual(fit.map(e => e.id), EXERCISES.filter(e => canDo(e, have)).map(e => e.id));
  assert.ok(fit.some(e => e.id === 'kh-bankdruecken'));
  assert.equal(rest.find(r => r.e.id === 'smart-latzug').missing, 'Smart-Zirkel');
  /* Leere Auswahl: alles passt */
  assert.equal(splitByEquipment(EXERCISES, []).rest.length, 0);
});

test('Eigene Übung: Anforderung zerlegen und wieder bauen, alle nötig oder eines genügt', () => {
  assert.deepEqual(splitRequirement(['langhantel', 'flachbank']), { ids: ['langhantel', 'flachbank'], mode: 'all', simple: true });
  assert.deepEqual(splitRequirement([['kabelturm', 'widerstandsband']]), { ids: ['kabelturm', 'widerstandsband'], mode: 'any', simple: true });
  assert.deepEqual(splitRequirement([]), { ids: [], mode: 'all', simple: true });
  /* Gemischt (z. B. Kniebeugen oder die Kategorie „Maschinen“ neben einem Gerät): nicht verlustfrei darstellbar */
  const mixed = splitRequirement(['langhantel', ['kniebeugenstaender', 'multipresse']]);
  assert.equal(mixed.simple, false);
  assert.deepEqual(mixed.ids, ['langhantel', 'kniebeugenstaender', 'multipresse']);

  assert.deepEqual(buildRequirement(['flachbank', 'langhantel'], 'all'), ['langhantel', 'flachbank']);
  assert.deepEqual(buildRequirement(['widerstandsband', 'kabelturm'], 'any'), [['kabelturm', 'widerstandsband']]);
  assert.deepEqual(buildRequirement(['kabelturm'], 'any'), ['kabelturm'], 'eines von einem ist das eine');
  assert.deepEqual(buildRequirement(['gibtsnicht', 'kabelturm', 'kabelturm'], 'all'), ['kabelturm']);
  assert.deepEqual(buildRequirement([], 'any'), []);
  assert.equal(requirementText(buildRequirement(['kabelturm', 'widerstandsband'], 'any')), 'Kabelzug, einzeln (Rolle verstellbar) oder Widerstandsbänder / Minibands');
  /* Hin und zurück ändert nichts */
  [['langhantel', 'flachbank'], [['kabelturm', 'widerstandsband']], ['smart-zirkel'], []].forEach(req => {
    const s = splitRequirement(req);
    assert.deepEqual(buildRequirement(s.ids, s.mode), req);
  });
});
