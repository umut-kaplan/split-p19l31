/* 4.7: Plan-Vorlagen, 3er-Split, Kurzversion, Geräte-Ersatz (Entscheidungen Q6, Q17, Q28, Q30a) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_TEMPLATES, findTemplate } from '../js/data/plan-templates.js';
import { DEFAULT_PLAN, LEGACY_SPLIT, templatePlan, planFromTemplate, adaptPlan, defaultPlan, swapText, swapSummary } from '../js/plans.js';
import { findExercise } from '../js/domain/library.js';
import { canDo, presetEquipment } from '../js/domain/equipment.js';
import { EXERCISES } from '../js/data/exercises.js';
import { weeklyTarget } from '../js/domain/muscles.js';
import { dayMinutes, shortExercises, hasShortVersion, weekMuscleSetsOfPlan, dayMuscleSets, SHORT } from '../js/domain/plan-stats.js';
import { groupsOf } from '../js/domain/superset.js';

const resolve = n => findExercise(n);
const MAIN = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes'];
const ARMS = ['biceps', 'triceps'];
/* Untergrenzen pro Woche. Ganzkörper 2× und der Smart-Zirkel liegen mit Absicht darunter: Zwei Einheiten unter
   60 Minuten bzw. zwei Zirkelrunden tragen nicht mehr (Recherche 7.1 und 7.6). */
const FLOOR = {
  default: { main: 10, arms: 10, small: 4 },
  fullbody2: { main: 8, arms: 6, small: 2 },
  smart: { main: 5, arms: 4, small: 2 },
};
const plans = () => PLAN_TEMPLATES.map(t => ({ t, p: planFromTemplate(t, []) }));

test('Sechs Vorlagen; jede Übung steht unter ihrem Bibliotheksnamen in der Bibliothek', () => {
  assert.equal(PLAN_TEMPLATES.length, 6);
  PLAN_TEMPLATES.filter(t => !t.fromDefault).forEach(t => t.days.forEach(d => d.exercises.forEach(([name]) => {
    const e = findExercise(name);
    assert.ok(e, `${t.name}: „${name}“ fehlt`);
    assert.equal(e.name, name, `${t.name}: „${name}“ ist ein Alias`);
  })));
  Object.values(DEFAULT_PLAN.days).forEach(d => d.exercises.forEach(x => x.names.forEach(n => assert.ok(findExercise(n), n))));
  /* Nur Übungen, die es vor den Kern-Übungen (Agent A) schon gab: keine reservierte id */
  plans().forEach(({ p }) => p.order.forEach(id => p.days[id].exercises.forEach(e => assert.ok(findExercise(e.names[0]).id, e.names[0]))));
});

test('Jede Einheit dauert höchstens 60 Minuten (Schätzung wie auf der Trainingsseite)', () => {
  plans().forEach(({ t, p }) => p.order.forEach(id => {
    const d = p.days[id];
    assert.ok(dayMinutes(d.exercises) <= 60, `${t.name}/${d.name}: ${dayMinutes(d.exercises)} min`);
  }));
  Object.values(DEFAULT_PLAN.days).forEach(d => assert.ok(dayMinutes(d.exercises) <= 60, `3er-Split/${d.name}`));
});

test('Wochenvolumen je Muskel im Zielbereich bei den gedachten Einheiten pro Woche', () => {
  plans().forEach(({ t, p }) => {
    const f = FLOOR[t.id] || FLOOR.default;
    const { week, maxPerDay } = weekMuscleSetsOfPlan(p, t.perWeek, resolve);
    const at = m => Math.round((week[m] || 0) * 10) / 10;
    MAIN.forEach(m => assert.ok(at(m) >= f.main && at(m) <= 20, `${t.name}: ${m} ${at(m)}`));
    ARMS.forEach(m => assert.ok(at(m) >= f.arms && at(m) <= 20, `${t.name}: ${m} ${at(m)}`));
    ['calves', 'abs'].forEach(m => assert.ok(at(m) >= f.small && at(m) <= 10, `${t.name}: ${m} ${at(m)}`));
    /* Nichts über dem Zielbereich, auch nicht die Gruppen, die nur mitlaufen */
    /* Gruppen ohne Zielbereich (Nacken/Trapez, unterer Rücken) höchstens 10 */
    Object.keys(week).forEach(m => assert.ok(at(m) <= (weeklyTarget(m) || [0, 10])[1], `${t.name}: ${m} ${at(m)} zu viel`));
    /* Höchstens etwa 11 Sätze pro Muskel und Einheit (Remmert 2025) */
    Object.entries(maxPerDay).forEach(([m, n]) => assert.ok(n <= 11, `${t.name}: ${m} ${n} in einer Einheit`));
  });
});

test('Große Muskeln zweimal pro Woche, außer im 3er-Split', () => {
  plans().filter(({ t }) => t.id !== 'split').forEach(({ t, p }) => {
    const perDay = p.order.map(id => dayMuscleSets(p.days[id].exercises, resolve));
    MAIN.forEach(m => {
      const days = perDay.filter(v => (v[m] || 0) > 0).length * t.perWeek / p.order.length;
      assert.ok(days >= 2, `${t.name}: ${m} ${days}× pro Woche`);
    });
  });
});

test('Supersätze nur aus Gegenspielern, Zirkel ausgenommen', () => {
  const ANT = { chest: ['back'], back: ['chest', 'shoulders'], shoulders: ['back'], biceps: ['triceps'], triceps: ['biceps'], quads: ['hamstrings'], hamstrings: ['quads'] };
  const all = e => [...e.muscles.primary, ...(e.muscles.secondary || [])];
  const opposed = (a, b) => a.muscles.primary.some(m => (ANT[m] || []).some(o => all(b).includes(o)));
  let pairs = 0;
  plans().filter(({ t }) => !t.smart).concat([{ t: { name: '3er-Split' }, p: defaultPlan() }]).forEach(({ t, p }) => p.order.forEach(id => {
    groupsOf(p.days[id].exercises).filter(g => g.length > 1).forEach(g => {
      assert.equal(g.length, 2, `${t.name}: Supersatz aus mehr als zwei Übungen`);
      const [a, b] = g.map(i => findExercise(p.days[id].exercises[i].names[0]));
      assert.ok(opposed(a, b) || opposed(b, a), `${t.name}: ${a.name} + ${b.name}`);
      pairs++;
    });
  }));
  assert.ok(pairs >= 15, 'Vorlagen bringen Supersätze mit');
  /* Zirkel: eine Runde über alle Stationen */
  const z = planFromTemplate(findTemplate('smart'), []);
  z.order.forEach(id => assert.equal(groupsOf(z.days[id].exercises).length, 1));
});

test('Kurzhantel-Steigerung aus der Einstellung, Smart-Zirkel ohne Steigerung', () => {
  const p = planFromTemplate(findTemplate('fullbody3'), [], [], { settings: { dumbbellInc: 2.5 } });
  const all = p.order.flatMap(id => p.days[id].exercises);
  assert.equal(all.find(e => e.names[0] === 'Seitheben').inc, 2.5);
  assert.equal(all.find(e => e.names[0] === 'Schrägbank-Kurzhanteldrücken').inc, 2.5);
  assert.equal(all.find(e => e.names[0] === 'Bankdrücken').inc, 2.5);
  assert.equal(all.find(e => e.names[0] === 'Beinpresse').inc, 5);
  const q = planFromTemplate(findTemplate('fullbody3'), [], [], { settings: { dumbbellInc: 1 } });
  assert.equal(q.order.flatMap(id => q.days[id].exercises).find(e => e.names[0] === 'Seitheben').inc, 1);
  assert.equal(q.order.flatMap(id => q.days[id].exercises).find(e => e.names[0] === 'Latzug').inc, 2.5);
  const z = planFromTemplate(findTemplate('smart'), []);
  z.order.forEach(id => z.days[id].exercises.forEach(e => {
    assert.equal(e.inc, 0);
    assert.ok(findExercise(e.names[0]).autoLoad);
  }));
});

test('3er-Split 4.7: ids von früher, neue Einträge mit Bibliotheks-id, Verlauf passt', () => {
  const ids = p => new Set(p.order.flatMap(id => p.days[id].exercises.map(e => e.id)));
  const now = ids(DEFAULT_PLAN), old = ids(LEGACY_SPLIT);
  ['bank', 'schraeg', 'schulter', 'fly', 'seit', 'trizoh', 'trizkabel', 'latzug', 'rudern', 'brustrudern', 'facepull', 'curls',
    'squat', 'presse', 'strecker', 'waden', 'bauch'].forEach(id => { assert.ok(now.has(id), id); assert.ok(old.has(id), id); });
  ['rumaenisches-kreuzheben', 'schraegbank-curls', 'beinbeuger-sitzend'].forEach(id => assert.ok(now.has(id) && !old.has(id), id));
  assert.deepEqual([...old].filter(id => !now.has(id)).sort(), ['abduktoren', 'adduktoren', 'beuger', 'dip', 'englat', 'flyup', 'hammer', 'plank']);
  /* Vorlagen nehmen für Übungen aus dem alten Split weiter dessen ids */
  const ppl = planFromTemplate(findTemplate('ppl6'), []);
  const all = ppl.order.flatMap(id => ppl.days[id].exercises);
  assert.equal(all.find(e => e.names[0] === 'Hammercurls').id, 'hammer');
  assert.equal(all.find(e => e.names[0] === 'Enger Latzug').id, 'englat');
  assert.equal(all.find(e => e.names[0] === 'Klimmzüge').id, 'latzug');
  assert.equal(all.find(e => e.names[0] === 'Hackenschmidt').id, 'squat');
});

test('Kurzversion: die ersten vier Übungen mit je zwei Sätzen, etwa 30 Minuten', () => {
  const legs = DEFAULT_PLAN.days.legs.exercises;
  const k = shortExercises(legs);
  assert.equal(k.length, SHORT.exercises);
  assert.deepEqual(k.map(e => e.sets), [2, 2, 2, 2]);
  assert.deepEqual(k.map(e => e.id), legs.slice(0, 4).map(e => e.id));
  assert.equal(legs[0].sets, 4, 'Plan bleibt unverändert');
  /* Supersatz zur abgeschnittenen Übung fällt weg, innerhalb der vier bleibt er */
  assert.equal(k[2].ss, true);
  assert.equal('ss' in k[3], false);
  const cut = shortExercises([{ id: 'a', names: ['Bankdrücken'], sets: 3, rest: 150 }, { id: 'b', names: ['Latzug'], sets: 3, rest: 120 },
    { id: 'c', names: ['Kniebeugen'], sets: 3, rest: 180 }, { id: 'd', names: ['Seitheben'], sets: 1, rest: 60, ss: true }, { id: 'e', names: ['Face Pulls'], sets: 3, rest: 60 }]);
  assert.equal('ss' in cut[3], false);
  assert.equal(cut[3].sets, 1);
  plans().forEach(({ t, p }) => p.order.forEach(id => {
    const ex = p.days[id].exercises;
    assert.ok(hasShortVersion(ex), `${t.name}/${p.days[id].name}`);
    const m = dayMinutes(shortExercises(ex));
    assert.ok(m >= 15 && m <= 35, `${t.name}/${p.days[id].name}: Kurzversion ${m} min`);
  }));
  assert.equal(hasShortVersion([{ names: ['Plank'], sets: 2, rest: 60 }]), false);
});

test('Dauer: im Supersatz zählt statt der Pause nur der Wechsel', () => {
  const a = { names: ['Bankdrücken'], sets: 3, rest: 150 };
  const b = { names: ['Latzug'], sets: 3, rest: 120 };
  assert.equal(dayMinutes([a, b]), Math.round((3 * 195 + 3 * 165) / 60 + 10));
  assert.equal(dayMinutes([{ ...a, ss: true }, b]), Math.round((3 * 60 + 3 * 165) / 60 + 10));
  /* An der letzten Übung zählt eine Verbindung nicht */
  assert.equal(dayMinutes([a, { ...b, ss: true }]), dayMinutes([a, b]));
});

/* ---------- Geräte-Ersatz (Q17) ---------- */
const NO_BARBELL = ['kurzhanteln', 'flachbank', 'schraegbank', 'latzug', 'ruderzug', 'kabelturm', 'kabelzug-doppelt', 'beinpresse',
  'hackenschmidt', 'beinstrecker', 'beinbeuger-sitzend', 'wadenmaschine-stehend', 'klimmzugstange', 'brustpresse', 'bauchmaschine'];

test('Ersatz: nächste passende Alternative, ohne Doppel im Tag, mit Liste der Ersetzungen', () => {
  const { plan, swaps } = templatePlan(findTemplate('upperlower4'), { equipment: NO_BARBELL });
  const names = id => plan.days[id].exercises.map(e => e.names[0]);
  const [oa, ua, , ub] = plan.order;
  assert.equal(names(oa)[0], 'Kurzhantel-Bankdrücken');
  assert.equal(names(ua)[0], 'Hackenschmidt');
  assert.ok(!names(ub).includes('Hip Thrust'));
  assert.ok(!names(ua).includes('Rumänisches Kreuzheben'));
  assert.ok(swaps.every(s => s.to), 'für alles gibt es Ersatz');
  plan.order.forEach(id => assert.equal(new Set(names(id)).size, names(id).length, 'keine Übung doppelt'));
  plan.order.forEach(id => assert.equal(new Set(plan.days[id].exercises.map(e => e.id)).size, plan.days[id].exercises.length, 'keine id doppelt'));
  assert.ok(swaps.some(s => s.from === 'Bankdrücken' && s.to === 'Kurzhantel-Bankdrücken' && s.day === 'Oberkörper A'));
  assert.equal(swapText({ from: 'Kniebeugen', to: 'Hackenschmidt' }), 'Kniebeugen → Hackenschmidt');
  assert.match(swapText({ from: 'Hip Thrust', to: null }), /kein passendes Gerät/);
  /* Supersatz bleibt am Platz */
  assert.equal(plan.days[oa].exercises[0].ss, true);
});

test('Ersatz: Varianten fallen weg, ohne Alternative bleibt die Übung stehen, leere Auswahl ersetzt nichts', () => {
  const p = defaultPlan();
  const swaps = adaptPlan(p, { equipment: NO_BARBELL });
  assert.deepEqual(p.days.legs.exercises[0].names, ['Hackenschmidt']);
  assert.equal(p.days.legs.exercises[0].id, 'squat');
  assert.deepEqual(p.days.pull.exercises[0].names, ['Latzug', 'Klimmzüge']);
  /* Langhantel- und SZ-Curls gehen nicht: Hammercurls, unter der id von früher */
  const curls = p.days.pull.exercises[5];
  assert.deepEqual(curls.names, ['Hammercurls']);
  assert.equal(curls.id, 'hammer');
  assert.ok(swaps.some(s => s.from === 'Kniebeugen' && s.to === 'Hackenschmidt'));
  /* Nur ein Kabelturm: Kabel-Flys gehen nicht (doppelter Kabelzug); Ersatz trainiert die Brust und geht mit dem Kabelturm.
     (Welche Übung genau, hängt von der Bibliothek ab, die mit den Kern-Übungen wächst.) */
  const q = planFromTemplate(findTemplate('fullbody3'), [], [], {});
  const tiny = adaptPlan(q, { equipment: ['kabelturm'] });
  const fly = tiny.find(s => s.from === 'Kabel-Flys' && s.to);
  assert.ok(fly && fly.to, 'Kabel-Flys ersetzt');
  assert.ok(findExercise(fly.to).muscles.primary.includes('chest'));
  assert.ok(canDo(findExercise(fly.to), ['kabelturm']));
  /* Ohne jede passende Übung bleibt sie stehen und die Liste sagt es */
  const odd = [{ id: 'tst-odd', name: 'Testgerät', custom: true, type: 'isolation', unit: 'reps', muscles: { primary: ['testmuskel'], secondary: [] }, equipment: ['beinpresse'], alternatives: [] }];
  const one = { id: 'x', name: 'X', order: ['a'], days: { a: { id: 'a', name: 'A', exercises: [{ id: 'tst-odd', names: ['Testgerät'], sets: 3, repMin: 8, repMax: 12, rest: 90, inc: 2.5, unit: 'reps' }] } } };
  assert.deepEqual(adaptPlan(one, { equipment: ['kabelturm'], custom: odd }), [{ day: 'A', from: 'Testgerät', to: null, missing: 'Beinpresse' }]);
  assert.deepEqual(one.days.a.exercises[0].names, ['Testgerät'], 'bleibt stehen');
  assert.deepEqual(adaptPlan(defaultPlan(), { equipment: [] }), []);
});

test('Ersatz mit anderer Einheit oder Geräte-Gewicht übernimmt passende Startwerte', () => {
  /* Zirkel ohne Smart-Zirkel in der Auswahl: normale Maschinen, mit eigener Steigerung */
  const { plan, swaps } = templatePlan(findTemplate('smart'), { equipment: ['beinpresse', 'brustpresse', 'latzug', 'beinbeuger-sitzend', 'schulterpresse', 'kurzhanteln', 'beinstrecker', 'bauchmaschine', 'adduktoren'] });
  const a = plan.days[plan.order[0]].exercises;
  assert.equal(a[0].names[0], 'Beinpresse');
  assert.ok(a[0].inc > 0);
  assert.equal(a[0].sets, 2);
  assert.ok(swaps.length >= 8);
});

test('Ersetzungen: ohne Doppel, im Fließtext gekürzt', () => {
  const sw = [{ day: 'A', from: 'Kniebeugen', to: 'Goblet Squat' }, { day: 'B', from: 'Wadenheben', to: null },
    { day: 'C', from: 'Wadenheben', to: null }, { day: 'C', from: 'Bankdrücken', to: 'Liegestütze' }];
  assert.equal(swapSummary(sw), 'Kniebeugen → Goblet Squat, Wadenheben (kein passendes Gerät), Bankdrücken → Liegestütze');
  const many = [...sw, { day: 'C', from: 'Latzug', to: null }, { day: 'C', from: 'Beinpresse', to: 'Goblet Squat' }];
  assert.equal(swapSummary(many), '3 Übungen ersetzt, z. B. Kniebeugen → Goblet Squat, Bankdrücken → Liegestütze; für 2 Übungen fehlt ein passendes Gerät');
});

/* ---------- Ersatz zuerst mit derselben Hauptmuskelgruppe (Abschluss 4.7) ---------- */
const HOME = ['kurzhanteln', 'widerstandsband'];
const main = name => findExercise(name).muscles.primary[0];

test('Ersatz trainiert dieselbe Hauptmuskelgruppe, auch wenn die kuratierte Reihenfolge etwas anderes zuerst nennt', () => {
  /* Jede Ersetzung, in allen Vorlagen und dem 3er-Split, zu Hause, mit Bank und Stange, ohne Langhantel */
  [HOME, [...HOME, 'flachbank', 'klimmzugstange'], [...HOME, 'schlingentrainer'], NO_BARBELL].forEach(eq => {
    const all = [...PLAN_TEMPLATES.map(t => templatePlan(t, { equipment: eq })), { swaps: adaptPlan(defaultPlan(), { equipment: eq }) }];
    all.flatMap(r => r.swaps).filter(s => s.to).forEach(s =>
      assert.ok(findExercise(s.to).muscles.primary.includes(main(s.from)), `${eq.join('+')}: ${s.from} → ${s.to}`));
  });
  /* Beinpresse (Quadrizeps) wird zu Hause nicht mehr zum Beckenheben (Gesäß), Hip Thrust bekommt das Beckenheben */
  const p = defaultPlan();
  const sw = adaptPlan(p, { equipment: HOME });
  assert.equal(sw.find(s => s.from === 'Beinpresse').to, 'Ausfallschritte');
  const ul = templatePlan(findTemplate('upperlower4'), { equipment: HOME });
  assert.equal(ul.swaps.find(s => s.from === 'Hackenschmidt').to, 'Goblet Squat');
  assert.equal(ul.swaps.find(s => s.from === 'Hip Thrust').to, 'Beckenheben');
});

test('Zu Hause: Latzug, Rudern und Klimmzüge finden Rudern mit Körpergewicht, Kurzhantelrudern oder Rudern mit Band, sonst „fehlt: …“', () => {
  const pulls = r => r.swaps.filter(s => ['Latzug', 'Rudern sitzend', 'Klimmzüge', 'Brustgestütztes Rudern'].includes(s.from));
  /* Mit Flachbank: Kurzhantelrudern */
  const bank = templatePlan(findTemplate('fullbody3'), { equipment: [...HOME, 'flachbank'] });
  assert.ok(pulls(bank).some(s => s.to === 'Kurzhantelrudern einarmig'), JSON.stringify(pulls(bank)));
  /* Mit Schlingentrainer: Rudern mit Körpergewicht */
  const sling = templatePlan(findTemplate('fullbody3'), { equipment: [...HOME, 'schlingentrainer'] });
  assert.ok(pulls(sling).some(s => s.to === 'Rudern mit Körpergewicht'), JSON.stringify(pulls(sling)));
  pulls(bank).concat(pulls(sling)).filter(s => s.to).forEach(s => assert.ok(findExercise(s.to).muscles.primary.includes('back'), s.to));
  /* Nur Kurzhanteln und Bänder (Schnellauswahl Zuhause, Prüfung M3): Rudern mit Band. Ein zweites Rudern am selben Tag
     bekommt es nicht noch einmal, bleibt stehen und die Liste nennt, was fehlt */
  const bare = templatePlan(findTemplate('fullbody3'), { equipment: HOME });
  assert.deepEqual(bare.swaps.find(s => s.from === 'Latzug'), { day: 'Ganzkörper A', from: 'Latzug', to: 'Rudern mit Band' });
  const row = bare.swaps.find(s => s.from === 'Rudern sitzend');
  assert.deepEqual(row, { day: 'Ganzkörper C', from: 'Rudern sitzend', to: null, missing: 'Ruderzug sitzend' });
  assert.equal(swapText(row), 'Rudern sitzend (fehlt: Ruderzug sitzend)');
  assert.ok(bare.plan.order.every(id => bare.plan.days[id].exercises.some(e => findExercise(e.names[0]).muscles.primary.includes('back'))), 'jeder Tag mit Rückenübung');
  /* Nichts mit anderer Hauptmuskelgruppe: Adduktoren bleiben stehen statt Step-ups oder Kniebeugen */
  const ppl = templatePlan(findTemplate('ppl6'), { equipment: [...HOME, 'flachbank'] });
  assert.equal(ppl.swaps.find(s => s.from === 'Adduktoren').to, null);
});

test('Smart-Zirkel-Vorlage ohne Smart-Zirkel: Ersatz aus der Bibliothek mit eigenen Startwerten', () => {
  const { plan, swaps } = templatePlan(findTemplate('smart'), { equipment: HOME });
  const a = plan.days[plan.order[0]].exercises;
  assert.equal(swaps.find(s => s.from === 'Beinpresse (Smart-Zirkel)').to, 'Goblet Squat');
  const goblet = a.find(e => e.names[0] === 'Goblet Squat');
  assert.ok(goblet.inc > 0, 'eigene Steigerung statt 0 wie am Smart-Zirkel');
  assert.equal(findExercise('Goblet Squat').autoLoad || null, null);
});

test('Zuhause (Prüfung M3): Schulterdrücken stehend, Kickbacks ohne Bank, Rudern mit Band', () => {
  const sd = findExercise('Kurzhantel-Schulterdrücken');
  assert.ok(canDo(sd, HOME), 'Schulterdrücken nur mit Kurzhanteln');
  assert.ok(sd.steps.some(t => /Stehend/.test(t)) && sd.steps.some(t => /sitzend/.test(t)), 'Anleitung nennt stehend oder sitzend');
  assert.ok(canDo(findExercise('Trizeps-Kickbacks'), HOME));
  assert.ok(findExercise('Trizeps-Kickbacks').steps.some(t => /Ohne Bank/.test(t)));
  const band = findExercise('Rudern mit Band');
  assert.equal(band.id, 'band-rudern');
  assert.deepEqual(band.muscles.primary, ['back']);
  assert.deepEqual(band.equipment, ['widerstandsband']);
  assert.ok(canDo(band, HOME));
  assert.ok(band.steps.length >= 4 && band.mistakes.length >= 2);
  /* verknüpft: von anderen Ruderübungen aus erreichbar */
  ['rudern-sitzend', 'kh-rudern', 'brustgestuetztes-rudern'].forEach(id => assert.ok(findExercise(id).alternatives.includes('band-rudern'), id));
  /* Die Schnellauswahl Zuhause findet jetzt eine Rückenübung */
  assert.ok(EXERCISES.some(e => e.muscles.primary.includes('back') && canDo(e, presetEquipment('zuhause'))));
});

test('Kein „EGYM“ in Namen und Hinweisen der Vorlagen; die Vorlage heißt „Nur Smart-Zirkel“', () => {
  PLAN_TEMPLATES.forEach(t => {
    assert.doesNotMatch(`${t.name} ${t.hint} ${(t.days || []).map(d => `${d.name} ${d.muscles}`).join(' ')}`, /egym/i, t.id);
  });
  assert.equal(findTemplate('smart').name, 'Nur Smart-Zirkel');
});
