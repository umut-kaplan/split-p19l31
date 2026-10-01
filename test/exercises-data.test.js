/* Prüft jede Übung der Bibliothek, auch die aus data/exercises-kern.js und data/exercises-smart.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EXERCISES } from '../js/data/exercises.js';
import { MUSCLES } from '../js/domain/muscles.js';
import { LIMIT_TAGS } from '../js/domain/profile-options.js';
import { isEquipmentId, doable, migrateProfileEquipment } from '../js/domain/equipment.js';
import { findExercise } from '../js/domain/library.js';
import { DEFAULT_PLAN } from '../js/plans.js';

const root = new URL('..', import.meta.url).pathname;
const byId = new Map(EXERCISES.map(e => [e.id, e]));
const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();

/* Hersteller und geschützte Produktnamen. Nur Aliase dürfen mit „EGYM “ beginnen (Suche). */
const BRANDS = /\b(e-?gym|technogym|gym80|hammer strength|life ?fitness|matrix|panatta|nautilus|milon|fle-?xx|eflexx|trx|concept ?2|glute drive|iso-lateral|prowler|cybex|precor|eleiko|bowflex|ergo-fit)\b/i;

test('Genug Übungen und eindeutige ids', () => {
  assert.ok(EXERCISES.length >= 48, 'nur ' + EXERCISES.length);
  assert.equal(byId.size, EXERCISES.length, 'doppelte id');
  EXERCISES.forEach(e => assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, e.id));
});

test('Namen und Aliase sind über alle Übungen eindeutig', () => {
  const seen = new Map();
  EXERCISES.forEach(e => [e.name, ...e.aliases].forEach(n => {
    const k = norm(n);
    assert.ok(!seen.has(k), `„${n}“ bei ${e.id} und ${seen.get(k)}`);
    seen.set(k, e.id);
  }));
});

test('Pflichtfelder und erlaubte Werte', () => {
  EXERCISES.forEach(e => {
    const at = ' bei ' + e.id;
    assert.ok(e.name && typeof e.name === 'string', 'name' + at);
    assert.ok(Array.isArray(e.aliases), 'aliases' + at);
    assert.ok(['compound', 'isolation'].includes(e.type), 'type' + at);
    assert.ok(['reps', 'sec'].includes(e.unit), 'unit' + at);
    assert.ok(e.muscles.primary.length >= 1, 'primäre Muskeln' + at);
    [...e.muscles.primary, ...e.muscles.secondary].forEach(m => assert.ok(m in MUSCLES, `Muskel ${m}${at}`));
    e.muscles.secondary.forEach(m => assert.ok(!e.muscles.primary.includes(m), `Muskel ${m} doppelt${at}`));
    e.stresses.forEach(t => assert.ok(LIMIT_TAGS.includes(t), `Einschränkung ${t}${at}`));
    assert.ok(Array.isArray(e.steps) && e.steps.length >= 3 && e.steps.length <= 6, 'Schritte 3 bis 6' + at);
    assert.ok(Array.isArray(e.mistakes) && e.mistakes.length >= 2 && e.mistakes.length <= 4, 'Fehler 2 bis 4' + at);
    [...e.steps, ...e.mistakes].forEach(s => assert.ok(s.trim().length > 5 && /[.!?]$/.test(s), `Satz „${s}“${at}`));
    assert.ok(e.autoLoad === null || e.autoLoad === 'smart', 'autoLoad' + at);
    assert.equal(typeof e.assisted, 'boolean', 'assisted' + at);
    if (e.assisted) assert.ok(e.equipment.flat().includes('assist-maschine') && !e.autoLoad, 'Gegengewicht nur an der Maschine mit Unterstützung' + at);
    assert.equal(e.media, null, 'media' + at);
  });
});

test('Geräte-Anforderung: gültige ids, „eines davon“ mit mindestens zwei Geräten, nichts doppelt', () => {
  EXERCISES.forEach(e => {
    const at = ' bei ' + e.id;
    assert.ok(Array.isArray(e.equipment), 'equipment' + at);
    const seen = [];
    e.equipment.forEach(t => {
      const ids = Array.isArray(t) ? t : [t];
      if (Array.isArray(t)) assert.ok(t.length >= 2, `Gruppe mit einem Gerät${at}`);
      ids.forEach(id => {
        assert.ok(isEquipmentId(id), `Gerät ${JSON.stringify(id)}${at}`);
        assert.ok(!seen.includes(id), `Gerät ${id} doppelt${at}`);
        seen.push(id);
      });
    });
  });
});

test('Smart-Zirkel: genau die Übungen mit autoLoad brauchen ihn, und nur ihn', () => {
  EXERCISES.forEach(e => {
    const smart = JSON.stringify(e.equipment) === JSON.stringify(['smart-zirkel']);
    const mentions = e.equipment.flat().includes('smart-zirkel');
    assert.equal(e.autoLoad === 'smart', smart, e.id);
    assert.equal(mentions, smart, e.id);
    if (smart) {
      assert.match(e.name, / \(Smart-Zirkel\)$/, e.id);
      assert.equal(e.unit, 'reps', e.id);
    }
  });
});

test('Keine Markennamen; „EGYM …“ nur als Alias', () => {
  EXERCISES.forEach(e => {
    [e.name, ...e.steps, ...e.mistakes].forEach(t => assert.ok(!BRANDS.test(t), `„${t}“ bei ${e.id}`));
    e.aliases.forEach(a => assert.ok(!BRANDS.test(a.replace(/^EGYM /, '')), `Alias „${a}“ bei ${e.id}`));
  });
});

test('Alternativen existieren und zeigen nicht auf sich selbst', () => {
  EXERCISES.forEach(e => {
    assert.equal(new Set(e.alternatives).size, e.alternatives.length, 'doppelte Alternative bei ' + e.id);
    e.alternatives.forEach(a => {
      assert.ok(byId.has(a), `Alternative ${a} bei ${e.id} fehlt`);
      assert.notEqual(a, e.id, 'selbst als Alternative: ' + e.id);
    });
  });
});

test('Für jede Belastung gibt es eine Alternative, die sie nicht hat', () => {
  EXERCISES.filter(e => e.stresses.length).forEach(e => {
    assert.ok(e.alternatives.length, 'keine Alternative bei ' + e.id);
    e.stresses.forEach(t => {
      const ok = e.alternatives.some(a => !byId.get(a).stresses.includes(t));
      assert.ok(ok, `${e.id}: keine Alternative ohne Belastung „${t}“`);
    });
  });
});

test('Bilder existieren, sind klein und haben eine Quelle', () => {
  let total = 0;
  EXERCISES.filter(e => e.image).forEach(e => {
    const p = join(root, e.image);
    assert.ok(existsSync(p), 'Bild fehlt: ' + e.image);
    assert.equal(e.image, `data/img/exercises/${e.id}.jpg`);
    total += statSync(p).size;
    assert.ok(e.credit && e.credit.author && e.credit.license && e.credit.url, 'Quelle fehlt bei ' + e.id);
    assert.match(e.credit.license, /^CC BY-SA [34]\.0$/);
    assert.match(e.credit.url, /^https:\/\/wger\.de\/de\/exercise\/\d+\/view\/$/);
  });
  EXERCISES.filter(e => !e.image).forEach(e => assert.equal(e.credit, null, 'Quelle ohne Bild bei ' + e.id));
  assert.ok(total < 3 * 1024 * 1024, 'Bilder zu groß: ' + total);
});

test('Jeder Name aus dem 3er-Split ist in der Bibliothek auffindbar', () => {
  Object.values(DEFAULT_PLAN.days).forEach(d => d.exercises.forEach(x => x.names.forEach(n => {
    const e = findExercise(n);
    assert.ok(e, `„${n}“ nicht gefunden`);
    assert.equal(e.unit, x.unit, `Einheit bei ${n}`);
  })));
});

/* Geräte der 50 Übungen bis 4.6, festgehalten, damit der Umzug geprüft bleibt */
const OLD = [
  [['bankdruecken', 'schraegbankdruecken', 'schulterdruecken', 'hip-thrust'], ['Langhantel', 'Hantelbank']],
  [['kh-bankdruecken', 'kh-schraegbankdruecken', 'kh-schulterdruecken', 'brustgestuetztes-rudern', 'kh-rudern', 'bulgarian-split-squat'], ['Kurzhanteln', 'Hantelbank']],
  [['brustpresse', 'butterfly', 'dip-maschine', 'schulterpresse-maschine', 'hackenschmidt', 'beinstrecker', 'beinbeuger', 'beinbeuger-sitzend', 'wadenheben', 'adduktoren', 'abduktoren', 'bauchmaschine'], ['Maschinen']],
  [['kabel-flys', 'kabel-flys-unten', 'face-pulls', 'trizepsdruecken-kabel', 'ueberkopf-trizeps-kabel', 'latzug', 'enger-latzug', 'rudern-sitzend', 'kabel-crunch'], ['Kabelzug']],
  [['barren-dips'], ['Dip-Station']],
  [['liegestuetze', 'plank'], []],
  [['seitheben', 'reverse-flys', 'kh-curls', 'hammercurls', 'goblet-squat', 'ausfallschritte'], ['Kurzhanteln']],
  [['klimmzuege', 'beinheben-haengend'], ['Klimmzugstange']],
  [['langhantelrudern', 'langhantel-curls', 'kniebeugen', 'rumaenisches-kreuzheben', 'kreuzheben'], ['Langhantel']],
  [['sz-curls'], ['SZ-Stange']],
  [['beinpresse', 'wadendruecken-beinpresse'], ['Beinpresse']],
].flatMap(([ids, eq]) => ids.map(id => [id, eq]));

test('Umzug der Profil-Geräte nimmt keine der 50 Übungen bis 4.6 weg', () => {
  assert.equal(OLD.length, 50);
  const LEGACY = ['Langhantel', 'Kurzhanteln', 'SZ-Stange', 'Hantelbank', 'Kabelzug', 'Maschinen', 'Beinpresse', 'Klimmzugstange', 'Dip-Station'];
  const subsets = LEGACY.reduce((acc, x) => acc.concat(acc.map(s => [...s, x])), [[]]).filter(s => s.length);
  subsets.forEach(S => {
    const ok = doable(migrateProfileEquipment(S));
    OLD.forEach(([id, eq]) => {
      if (eq.every(q => S.includes(q))) assert.ok(ok(byId.get(id)), `${id} mit ${S.join(', ')}`);
    });
  });
});

test('Korrekturen 4.7: Kniebeugen und Schulterdrücken brauchen Rack oder Multipresse, Bankdrücken die Station', () => {
  const ok = list => doable(list);
  ['kniebeugen', 'schulterdruecken'].forEach(id => {
    const e = byId.get(id);
    assert.ok(!ok(['langhantel'])(e), id);
    assert.ok(ok(['langhantel', 'kniebeugenstaender'])(e), id);
    assert.ok(ok(['langhantel', 'multipresse'])(e), id);
  });
  const bench = byId.get('bankdruecken');
  assert.ok(!ok(['langhantel', 'flachbank'])(bench));
  assert.ok(ok(['langhantel', 'bankdrueckstation'])(bench));
  assert.ok(ok(['langhantel', 'flachbank', 'kniebeugenstaender'])(bench));
});
