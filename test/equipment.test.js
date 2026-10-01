import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EQUIPMENT, EQUIPMENT_GROUPS, EQUIPMENT_IDS, SMART_CIRCUIT, PRESETS, isEquipmentId, equipmentName, groupEquipment,
  requirementTerms, requirementIds, requirementText, migrateExerciseEquipment, migrateProfileEquipment,
  expandEquipment, doable, canDo, presetEquipment, applyPreset, matchingPreset, hasSmartCircuit,
  toggleEquipment, toggleSmartCircuit, hasLegacyEquipment, missingText,
} from '../js/domain/equipment.js';
import { LEGACY_PROFILE } from '../js/data/equipment.js';

const LEGACY = Object.keys(LEGACY_PROFILE);

test('Geräteliste: 59 Gerätetypen in sechs Gruppen, eindeutige ids', () => {
  assert.equal(EQUIPMENT.length, 59);
  assert.deepEqual(EQUIPMENT_GROUPS.map(g => [g.id, groupEquipment(g.id).length]),
    [['frei', 5], ['bank', 14], ['kabel', 4], ['steck', 20], ['hebel', 9], ['funktional', 7]]);
  assert.equal(new Set(EQUIPMENT.map(e => e.id)).size, 59);
  EQUIPMENT.forEach(e => {
    assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, e.id);
    assert.ok(EQUIPMENT_GROUPS.some(g => g.id === e.group), e.id);
    assert.ok(e.name && !/egym|technogym|gym80|hammer strength|life fitness|nautilus|milon|trx/i.test(e.name), e.name);
    ['gross', 'discount', 'zuhause'].forEach(k => assert.ok([0, 1, 2, 3].includes(e.avail[k]), `${e.id} ${k}`));
  });
  assert.deepEqual(EQUIPMENT_IDS, [...EQUIPMENT.map(e => e.id), 'smart-zirkel']);
  assert.ok(isEquipmentId('smart-zirkel') && isEquipmentId('langhantel'));
  assert.ok(!isEquipmentId('Langhantel') && !isEquipmentId('') && !isEquipmentId(null));
  assert.equal(equipmentName('kabelturm'), 'Kabelzug, einzeln (Rolle verstellbar)');
  assert.equal(equipmentName(SMART_CIRCUIT.id), 'Smart-Zirkel');
  assert.equal(equipmentName('gibtsnicht'), 'gibtsnicht');
});

test('Schnellauswahl: großes Studio 59, Discount 38, Zuhause 2', () => {
  assert.deepEqual(PRESETS.map(p => p.id), ['gross', 'discount', 'zuhause']);
  assert.equal(presetEquipment('gross').length, 59);
  assert.equal(presetEquipment('discount').length, 38);
  assert.deepEqual(presetEquipment('zuhause'), ['kurzhanteln', 'widerstandsband']);
  ['trap-bar', 'ghd', 'landmine', 'pendel-kniebeuge', 'schlitten'].forEach(id => assert.ok(!presetEquipment('discount').includes(id), id));
  ['bankdrueckstation', 'kniebeugenstaender', 'multipresse', 'kabelzug-doppelt', 'hebel-rudern'].forEach(id =>
    assert.ok(presetEquipment('discount').includes(id), id));
  assert.deepEqual(presetEquipment('gibtsnicht'), []);
  /* Der Smart-Zirkel gehört zu keiner Schnellauswahl */
  PRESETS.forEach(p => assert.ok(!presetEquipment(p.id).includes('smart-zirkel')));
});

test('Schnellauswahl lässt den Smart-Zirkel, wie er war, und wird wiedererkannt', () => {
  const withSmart = applyPreset(['langhantel', 'smart-zirkel'], 'discount');
  assert.equal(withSmart.length, 39);
  assert.ok(hasSmartCircuit(withSmart));
  assert.ok(!hasSmartCircuit(applyPreset(['langhantel'], 'zuhause')));
  assert.equal(matchingPreset(withSmart), 'discount');
  assert.equal(matchingPreset(presetEquipment('gross')), 'gross');
  assert.equal(matchingPreset(['kurzhanteln', 'widerstandsband', 'smart-zirkel']), 'zuhause');
  assert.equal(matchingPreset(['kurzhanteln']), null);
  assert.equal(matchingPreset([]), null);
  assert.deepEqual(applyPreset(['Kurzhanteln'], 'gibtsnicht'), ['kurzhanteln']);
});

test('Abhaken: Reihenfolge wie im Katalog, Smart-Zirkel als Schalter', () => {
  assert.deepEqual(toggleEquipment(['kurzhanteln'], 'langhantel'), ['langhantel', 'kurzhanteln']);
  assert.deepEqual(toggleEquipment(['langhantel', 'kurzhanteln'], 'langhantel'), ['kurzhanteln']);
  assert.deepEqual(toggleEquipment(['kurzhanteln'], 'gibtsnicht'), ['kurzhanteln']);
  assert.deepEqual(toggleSmartCircuit(['kurzhanteln']), ['kurzhanteln', 'smart-zirkel']);
  assert.deepEqual(toggleSmartCircuit(['kurzhanteln', 'smart-zirkel']), ['kurzhanteln']);
});

test('Regeln: doppelter Kabelzug, Schrägbank, Rack mit Bank, Landmine nur mit Langhantel', () => {
  assert.ok(expandEquipment(['kabelzug-doppelt']).has('kabelturm'));
  assert.ok(!expandEquipment(['kabelturm']).has('kabelzug-doppelt'));
  assert.ok(expandEquipment(['schraegbank']).has('flachbank'));
  assert.ok(!expandEquipment(['flachbank']).has('schraegbank'));
  const rack = expandEquipment(['kniebeugenstaender', 'schraegbank']);
  ['flachbank', 'bankdrueckstation', 'schraegbankstation'].forEach(id => assert.ok(rack.has(id), id));
  assert.ok(!expandEquipment(['kniebeugenstaender']).has('bankdrueckstation'));
  assert.ok(!expandEquipment(['landmine']).has('landmine'));
  assert.ok(expandEquipment(['landmine', 'langhantel']).has('landmine'));
  assert.equal(expandEquipment(['Langhantel', 'gibtsnicht']).size, 0);
});

test('Anforderung: Terme bereinigen, ids, Text', () => {
  assert.deepEqual(requirementTerms(['langhantel', ['multipresse', 'kniebeugenstaender']]),
    ['langhantel', ['kniebeugenstaender', 'multipresse']]);
  assert.deepEqual(requirementTerms([['kurzhanteln'], 'kurzhanteln', 'gibtsnicht', []]), ['kurzhanteln']);
  assert.deepEqual(requirementTerms(null), []);
  assert.deepEqual(requirementIds(['kurzhanteln', ['plyobox', 'flachbank']]), ['kurzhanteln', 'flachbank', 'plyobox']);
  assert.equal(requirementText(['langhantel', ['kniebeugenstaender', 'multipresse']]),
    'Langhantel mit Scheiben + Power Rack / Kniebeugenständer oder Multipresse (Smith-Maschine)');
  assert.equal(requirementText([]), '');
  assert.equal(requirementText(['smart-zirkel']), 'Smart-Zirkel');
});

test('canDo: eines von mehreren genügt, alle Terme nötig, leere Auswahl erlaubt alles', () => {
  const squat = { equipment: ['langhantel', ['kniebeugenstaender', 'multipresse']] };
  assert.ok(canDo(squat, ['langhantel', 'kniebeugenstaender']));
  assert.ok(canDo(squat, ['langhantel', 'multipresse']));
  assert.ok(!canDo(squat, ['langhantel']));
  assert.ok(!canDo(squat, ['kniebeugenstaender', 'multipresse']));
  assert.ok(canDo(squat, []), 'leere Auswahl');
  assert.ok(canDo(squat, null), 'keine Auswahl');
  assert.ok(canDo({ equipment: [] }, ['kurzhanteln']), 'Körpergewicht');
  assert.ok(!canDo(null, []));
  /* Bankdrücken: Bankdrückstation oder Flachbank + Rack */
  const bench = { equipment: ['langhantel', 'bankdrueckstation'] };
  assert.ok(canDo(bench, ['langhantel', 'bankdrueckstation']));
  assert.ok(canDo(bench, ['langhantel', 'flachbank', 'kniebeugenstaender']));
  assert.ok(canDo(bench, ['langhantel', 'schraegbank', 'kniebeugenstaender']));
  assert.ok(!canDo(bench, ['langhantel', 'flachbank']));
  /* Landmine-Rudern braucht die Langhantel */
  const tbar = { equipment: [['t-bar-rudern', 'landmine']] };
  assert.ok(!canDo(tbar, ['landmine']));
  assert.ok(canDo(tbar, ['landmine', 'langhantel']));
  assert.ok(canDo(tbar, ['t-bar-rudern']));
  /* Ungeprüfte Daten mit Kategorien bis 4.6 */
  assert.ok(canDo({ equipment: ['Kurzhanteln', 'Hantelbank'] }, ['kurzhanteln', 'schraegbank']));
  assert.ok(canDo({ equipment: ['Maschinen'] }, ['beinstrecker']));
  /* Einmal bauen, oft prüfen; auch mit einem Set */
  const ok = doable(new Set(['smart-zirkel']));
  assert.ok(ok({ equipment: ['smart-zirkel'] }));
  assert.ok(!ok({ equipment: ['kurzhanteln'] }));
});

test('Umzug der Profil-Auswahl bis 4.6: Tabelle aus der Recherche, idempotent, leer bleibt leer', () => {
  assert.deepEqual(migrateProfileEquipment(['Langhantel']), ['langhantel', 'bankdrueckstation', 'schraegbankstation', 'kniebeugenstaender']);
  assert.deepEqual(migrateProfileEquipment(['Hantelbank']), ['flachbank', 'schraegbank']);
  assert.deepEqual(migrateProfileEquipment(['Kabelzug']), ['kabelturm', 'kabelzug-doppelt', 'latzug', 'ruderzug']);
  assert.deepEqual(migrateProfileEquipment(['Dip-Station']), ['dip-station', 'beinhebestation']);
  assert.deepEqual(migrateProfileEquipment(['Beinpresse']), ['beinpresse']);
  /* „Maschinen“ (Prüfung M1): Steckgewicht ohne Beinpresse, alle Hebelmaschinen, Multipresse und die Spezialbänke */
  const m = migrateProfileEquipment(['Maschinen']);
  assert.equal(m.length, 32);
  assert.ok(!m.includes('beinpresse'));
  ['hackenschmidt', 'multipresse', 'wadenmaschine-stehend', 'rueckenstrecker-maschine', 'scottbank', 'hyperextension', 'bauchbank',
    'pendel-kniebeuge', 'belt-squat', 'hip-thrust-maschine', 't-bar-rudern', 'hebel-rudern', 'hebel-latzug', 'schraeg-brustpresse',
    'wadenmaschine-sitzend'].forEach(id => assert.ok(m.includes(id), id));
  /* Alle neun Kategorien: großes Studio, alle 59; ein angehakter Smart-Zirkel bleibt */
  const all = migrateProfileEquipment(LEGACY);
  assert.deepEqual(all, presetEquipment('gross'));
  assert.equal(all.length, 59);
  assert.deepEqual(migrateProfileEquipment([...LEGACY, 'smart-zirkel']), [...presetEquipment('gross'), 'smart-zirkel']);
  assert.deepEqual(migrateProfileEquipment(all), all, 'idempotent');
  /* Acht von neun: weiter nach Tabelle */
  assert.ok(migrateProfileEquipment(LEGACY.filter(k => k !== 'SZ-Stange')).length < 59);
  assert.equal(hasLegacyEquipment(['Kurzhanteln']), true);
  assert.equal(hasLegacyEquipment(all), false);
  assert.equal(hasLegacyEquipment(undefined), false);
  assert.deepEqual(migrateProfileEquipment([]), []);
  assert.deepEqual(migrateProfileEquipment(undefined), []);
  assert.deepEqual(migrateProfileEquipment(['Kurzhanteln', 'kurzhanteln', 'smart-zirkel', 'Quatsch']), ['kurzhanteln', 'smart-zirkel']);
});

test('Umzug eigener Übungen: Kategorie zu Gerät, „Maschinen“ zu „eines davon“', () => {
  assert.deepEqual(migrateExerciseEquipment(['Langhantel', 'Hantelbank']), ['langhantel', 'flachbank']);
  assert.deepEqual(migrateExerciseEquipment(['Kabelzug']), ['kabelturm']);
  const mach = migrateExerciseEquipment(['Maschinen']);
  assert.equal(mach.length, 1);
  assert.equal(mach[0].length, 32);
  assert.deepEqual(migrateExerciseEquipment(mach), mach, 'idempotent');
  /* Anzeige kurz statt 32 „oder“ */
  assert.equal(requirementText(mach), 'eine der Maschinen');
  assert.equal(requirementText(migrateExerciseEquipment(['Kurzhanteln', 'Maschinen'])), 'Kurzhanteln + eine der Maschinen');
  assert.equal(missingText({ equipment: mach }, ['kurzhanteln']), 'eine der Maschinen');
  /* Auch die kürzere Liste aus Vorabständen von 4.7 */
  const pre = [...groupEquipment('steck').map(e => e.id).filter(id => id !== 'beinpresse'), 'hackenschmidt', 'multipresse'];
  assert.equal(requirementText([pre]), 'eine der Maschinen');
  assert.equal(requirementText([['brustpresse', 'butterfly']]), 'Brustpresse oder Butterfly / Reverse-Butterfly');
  assert.deepEqual(migrateExerciseEquipment([]), []);
  assert.deepEqual(migrateExerciseEquipment(undefined), []);
});

/* Alle Teilmengen der neun Kategorien bis 4.6 */
const subsets = list => list.reduce((acc, x) => acc.concat(acc.map(s => [...s, x])), [[]]);

test('Umzug nimmt keine eigene Übung weg: was mit der alten Auswahl ging, geht auch danach', () => {
  const exReqs = [...LEGACY.map(a => [a]), ...LEGACY.flatMap((a, i) => LEGACY.slice(i + 1).map(b => [a, b]))];
  subsets(LEGACY).forEach(S => {
    const ok = doable(migrateProfileEquipment(S));
    exReqs.forEach(req => {
      if (!S.length || !req.every(q => S.includes(q))) return;
      assert.ok(ok({ equipment: migrateExerciseEquipment(req) }), `${req.join('+')} mit ${S.join(', ')}`);
    });
  });
});
