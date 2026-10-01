import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findExercise, searchExercises, matchesQuery, equipmentOf, limitationHits, safeAlternatives,
  exerciseIdFor, defaultsFor, slug, allExercises,
} from '../js/domain/library.js';
import { EXERCISES } from '../js/data/exercises.js';
import { PLAN_TEMPLATES, PLAN_COLORS } from '../js/data/plan-templates.js';
import { planFromTemplate, emptyPlan, defaultPlan, DEFAULT_PLAN } from '../js/plans.js';

/* Kleine feste Bibliothek, damit die Tests nicht vom Stand der Übungsdaten abhängen */
const LIB = [
  { id: 'bankdruecken', name: 'Bankdrücken', aliases: ['Flachbankdrücken'], type: 'compound', unit: 'reps',
    muscles: { primary: ['chest'], secondary: ['triceps', 'shoulders'] }, equipment: ['langhantel', 'bankdrueckstation'],
    stresses: ['Schulter'], alternatives: ['brustpresse', 'kh-bankdruecken'] },
  { id: 'brustpresse', name: 'Brustpresse', aliases: [], type: 'compound', unit: 'reps',
    muscles: { primary: ['chest'], secondary: ['triceps'] }, equipment: ['brustpresse'], stresses: [], alternatives: [] },
  { id: 'kh-bankdruecken', name: 'Kurzhantel-Bankdrücken', aliases: [], type: 'compound', unit: 'reps',
    muscles: { primary: ['chest'], secondary: [] }, equipment: ['kurzhanteln', 'flachbank'], stresses: ['Schulter'], alternatives: [] },
  { id: 'seitheben', name: 'Seitheben', aliases: [], type: 'isolation', unit: 'reps',
    muscles: { primary: ['shoulders'], secondary: [] }, equipment: ['kurzhanteln'], stresses: [], alternatives: [] },
  { id: 'plank', name: 'Plank', aliases: [], type: 'isolation', unit: 'sec',
    muscles: { primary: ['abs'], secondary: [] }, equipment: [], stresses: [], alternatives: [] },
];
/* findExercise und Co. nehmen eigene Übungen als zweiten Parameter; die feste Liste kommt so hinein */
const find = key => LIB.find(e => e.id === key) || findExercise(key, LIB.filter(e => !EXERCISES.some(x => x.id === e.id)));

test('Slug schreibt Umlaute aus', () => {
  assert.equal(slug('Rumänisches Kreuzheben'), 'rumaenisches-kreuzheben');
  assert.equal(slug('  Überkopf-Trizeps am Kabel '), 'ueberkopf-trizeps-am-kabel');
  assert.equal(slug('Fuß & Größe'), 'fuss-groesse');
});

test('Finden über id, Namen und Alias, Groß- und Kleinschreibung egal', () => {
  const custom = [{ id: 'c1', name: 'Kabelrudern einarmig', aliases: [], custom: true }];
  assert.equal(findExercise('c1', custom).name, 'Kabelrudern einarmig');
  assert.equal(findExercise('kabelrudern  EINARMIG', custom).id, 'c1');
  assert.equal(findExercise('Gibt es nicht', custom), null);
  assert.equal(findExercise('Bankdrücken').id, 'bankdruecken');
  const withAlias = [{ id: 'x', name: 'Irgendwas', aliases: ['Spitzname'] }];
  assert.equal(findExercise('spitzname', withAlias).id, 'x');
});

test('Suche: alle Wörter müssen passen, auch Geräte zählen', () => {
  assert.equal(matchesQuery(LIB[0], ''), true);
  assert.equal(matchesQuery(LIB[0], 'bank'), true);
  assert.equal(matchesQuery(LIB[0], 'flachbank'), true);
  assert.equal(matchesQuery(LIB[0], 'langhantel bank'), true);
  assert.equal(matchesQuery(LIB[0], 'kurzhantel bank'), false);
  assert.deepEqual(searchExercises(LIB, { q: 'bank' }).map(e => e.id), ['bankdruecken', 'kh-bankdruecken']);
});

test('Filter nach Muskel (primär und sekundär) und Gerät, alphabetisch', () => {
  assert.deepEqual(searchExercises(LIB, { muscle: 'triceps' }).map(e => e.id), ['bankdruecken', 'brustpresse']);
  assert.deepEqual(searchExercises(LIB, { muscle: 'chest', equipment: 'kurzhanteln' }).map(e => e.id), ['kh-bankdruecken']);
  assert.deepEqual(searchExercises(LIB).map(e => e.name), ['Bankdrücken', 'Brustpresse', 'Kurzhantel-Bankdrücken', 'Plank', 'Seitheben']);
  /* ids, sortiert nach Anzeigename (Bankdrückstation, Brustpresse, Flachbank, Kurzhanteln, Langhantel mit Scheiben) */
  assert.deepEqual(equipmentOf(LIB), ['bankdrueckstation', 'brustpresse', 'flachbank', 'kurzhanteln', 'langhantel']);
  /* „eines davon“ zählt beim Gerätefilter mit */
  assert.deepEqual(searchExercises([{ ...LIB[3], equipment: [['kurzhanteln', 'kettlebell']] }], { equipment: 'kettlebell' }).length, 1);
});

test('Filter „geht mit meinen Geräten“: canDo mit der Profil-Auswahl, leer = alle', () => {
  assert.deepEqual(searchExercises(LIB, { have: ['kurzhanteln'] }).map(e => e.id), ['plank', 'seitheben']);
  assert.deepEqual(searchExercises(LIB, { have: ['kurzhanteln', 'schraegbank'] }).map(e => e.id), ['kh-bankdruecken', 'plank', 'seitheben']);
  assert.equal(searchExercises(LIB, { have: [] }).length, 5);
  assert.equal(searchExercises(LIB, { have: null }).length, 5);
  /* Gerätenamen sind durchsuchbar, nicht nur ids */
  assert.equal(matchesQuery(LIB[0], 'ablage'), true);
});

test('Einschränkungen: Treffer und schonende Alternativen', () => {
  assert.deepEqual(limitationHits(LIB[0], ['Schulter', 'Knie']), ['Schulter']);
  assert.deepEqual(limitationHits(LIB[0], []), []);
  assert.deepEqual(limitationHits(null, ['Schulter']), []);
  // Kurzhantel-Bankdrücken belastet die Schulter auch, bleibt also draußen
  const custom = LIB.filter(e => e.id !== 'bankdruecken');
  const alts = safeAlternatives(LIB[0], custom, ['Schulter']).map(a => a.id);
  assert.ok(alts.includes('brustpresse'));
  assert.ok(!alts.includes('kh-bankdruecken'));
  /* Mit Geräte-Auswahl nur Alternativen, die damit gehen */
  assert.deepEqual(safeAlternatives(LIB[0], custom, [], ['kurzhanteln', 'flachbank']).map(a => a.id), ['kh-bankdruecken']);
  assert.deepEqual(safeAlternatives(LIB[0], custom, [], []).map(a => a.id), ['brustpresse', 'kh-bankdruecken']);
});

test('Übungs-ids passen planübergreifend zusammen', () => {
  const plans = [defaultPlan()];
  assert.equal(exerciseIdFor('Bankdrücken', plans), 'bank');          // gleicher Name im 3er-Split
  assert.equal(exerciseIdFor('Klimmzüge', plans), 'latzug');          // Variante im Split
  assert.equal(exerciseIdFor('hackenschmidt', plans), 'squat');
  assert.equal(exerciseIdFor('Neue Übung XY', plans), 'neue-uebung-xy');
  assert.equal(find('seitheben').id, 'seitheben');
});

test('Startwerte je nach Art der Übung', () => {
  assert.deepEqual(defaultsFor(LIB[0]), { sets: 3, repMin: 6, repMax: 10, rest: 150, inc: 2.5, unit: 'reps' });
  assert.equal(defaultsFor(LIB[3]).inc, 2);          // Kurzhantel-Isolation, Standard 2 kg (4.7)
  assert.equal(defaultsFor(LIB[4]).unit, 'sec');
  assert.equal(defaultsFor(null).rest, 75);
});

test('4.7: Kurzhantel-Steigerung aus den Einstellungen, für Grund- und Isolationsübungen', () => {
  assert.equal(defaultsFor(LIB[3], { dumbbellInc: 1 }).inc, 1);
  assert.equal(defaultsFor(LIB[3], { dumbbellInc: 2.5 }).inc, 2.5);
  assert.equal(defaultsFor(LIB[3], { dumbbellInc: 3 }).inc, 2, 'unbekannter Wert: Standard');
  assert.equal(defaultsFor(LIB[3], {}).inc, 2);
  assert.equal(defaultsFor(LIB[2], { dumbbellInc: 1 }).inc, 1, 'Kurzhantel-Bankdrücken (Grundübung)');
  assert.equal(defaultsFor(LIB[0], { dumbbellInc: 1 }).inc, 2.5, 'Langhantel bleibt bei 2,5');
  assert.equal(defaultsFor(LIB[1], { dumbbellInc: 1 }).inc, 2.5, 'Maschine bleibt bei 2,5');
  assert.equal(defaultsFor({ ...LIB[3], equipment: [['kurzhanteln', 'kettlebell']] }, { dumbbellInc: 2.5 }).inc, 2.5);
  assert.equal(defaultsFor(LIB[4], { dumbbellInc: 1 }).inc, 0, 'Zeitübung ohne Steigerung');
});

test('Vorlagen: gültige Tage, Farben und Werte', () => {
  assert.deepEqual(PLAN_TEMPLATES.map(t => t.id), ['fullbody2', 'fullbody3', 'upperlower4', 'split', 'ppl6', 'smart']);
  PLAN_TEMPLATES.filter(t => !t.fromDefault).forEach(t => {
    assert.ok(t.days.length >= 2, t.name);
    t.days.forEach(d => {
      assert.ok(PLAN_COLORS.includes(d.color), `${t.name}/${d.name}: Farbe ${d.color}`);
      assert.ok(d.exercises.length >= 4, `${t.name}/${d.name}: zu wenig Übungen`);
      d.exercises.forEach(([name, sets, lo, hi, rest, inc, unit, opt]) => {
        assert.ok(sets >= 1 && sets <= 6 && lo >= 1 && hi >= lo && rest >= 30 && rest <= 300 && inc >= 0, `${name}: Werte`);
        assert.ok(!unit || unit === 'sec' || unit === 'reps', `${name}: Einheit`);
        assert.ok(opt === undefined || (typeof opt === 'object' && opt.ss === true), `${name}: Optionen`);
      });
      assert.equal((d.exercises[d.exercises.length - 1][7] || {}).ss, undefined, `${d.name}: Supersatz an der letzten Übung`);
      const names = d.exercises.map(x => x[0]);
      assert.equal(new Set(names).size, names.length, `${d.name}: doppelte Übung`);
    });
  });
});

/* Alle Vorlagen-Übungen sollen in der Bibliothek stehen. Fehlen welche, weil die Übungsdaten noch wachsen, wird das als offen gemeldet. */
const templateNames = [...new Set(PLAN_TEMPLATES.filter(t => !t.fromDefault).flatMap(t => t.days.flatMap(d => d.exercises.map(x => x[0]))))];
const missing = templateNames.filter(n => !findExercise(n));
test('Vorlagen-Übungen stehen in der Bibliothek', { todo: missing.length ? `noch nicht in js/data/exercises.js: ${missing.join(', ')}` : false }, () => {
  assert.deepEqual(missing, []);
});

test('Plan aus Vorlage: eigene ids, Reihenfolge, Verlauf passt zum 3er-Split', () => {
  const tpl = PLAN_TEMPLATES.find(t => t.id === 'upperlower4');
  const p = planFromTemplate(tpl, [defaultPlan()]);
  assert.match(p.id, /^p/);
  assert.equal(p.name, 'Oberkörper/Unterkörper 4×');
  assert.equal(p.order.length, 4);
  assert.equal(new Set(p.order).size, 4);
  p.order.forEach(id => assert.equal(p.days[id].id, id));
  const ok = p.days[p.order[0]];
  assert.equal(ok.exercises[0].names[0], 'Bankdrücken');
  assert.equal(ok.exercises[0].id, 'bank');                    // gleiche id wie im 3er-Split
  const ob = p.days[p.order[2]];
  assert.equal(ob.exercises.find(e => e.names[0] === 'Klimmzüge').id, 'latzug');
  const ub = p.days[p.order[3]];
  assert.equal(ub.exercises.find(e => e.names[0] === 'Hackenschmidt').id, 'squat');
  assert.equal(ub.exercises.find(e => e.names[0] === 'Beinbeuger sitzend').id, 'beinbeuger-sitzend');
  /* Supersatz aus der Vorlage kommt im Plan an, an der letzten Übung nie */
  assert.equal(ok.exercises[0].ss, true);
  assert.equal(ok.exercises[1].ss, undefined);
  p.order.forEach(id => { const ex = p.days[id].exercises; assert.equal(ex[ex.length - 1].ss, undefined); });
});

test('Vorlage 3er-Split übernimmt den mitgelieferten Split mit neuen Tages-ids', () => {
  const p = planFromTemplate(PLAN_TEMPLATES.find(t => t.id === 'split'), []);
  assert.equal(p.order.length, 3);
  assert.deepEqual(p.order.map(id => p.days[id].name), ['Push', 'Pull', 'Legs']);
  assert.ok(!p.order.includes('push'));
  assert.equal(p.days[p.order[0]].exercises[0].id, 'bank');
  assert.equal(DEFAULT_PLAN.days.push.exercises.length, p.days[p.order[0]].exercises.length);
});

test('Leerer Plan hat einen Tag ohne Übungen', () => {
  const p = emptyPlan('Test');
  assert.equal(p.order.length, 1);
  assert.deepEqual(p.days[p.order[0]].exercises, []);
});

test('Eigene Übungen erscheinen in der Gesamtliste', () => {
  const all = allExercises([{ id: 'c9', name: 'Meine Übung', custom: true }]);
  assert.equal(all[all.length - 1].id, 'c9');
  assert.equal(all.length, EXERCISES.length + 1);
});
