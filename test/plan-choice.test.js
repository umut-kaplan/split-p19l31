import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_CHOICES, choosePlan, currentChoice, findPlanFor, recommendedChoices, choicesFor, isFreshSetup } from '../js/domain/plan-choice.js';
import { defaultState } from '../js/store/migrate.js';
import { planFromTemplate } from '../js/plans.js';
import { PLAN_TEMPLATES } from '../js/data/plan-templates.js';

const fresh = () => defaultState();

test('Sechs Vorlagen und der eigene Plan', () => {
  assert.deepEqual(PLAN_CHOICES.map(c => c.id), ['fullbody2', 'fullbody3', 'upperlower4', 'split', 'ppl6', 'smart', 'empty']);
  assert.deepEqual(PLAN_CHOICES.map(c => c.days), [2, 3, 4, 3, 6, 2, null]);
});

test('Empfehlung nach Trainingstagen, Smart-Zirkel zusätzlich (Q28)', () => {
  assert.deepEqual(recommendedChoices(1), ['fullbody2']);
  assert.deepEqual(recommendedChoices(2), ['fullbody2']);
  assert.deepEqual(recommendedChoices(3), ['fullbody3']);
  assert.deepEqual(recommendedChoices(4), ['upperlower4']);
  assert.deepEqual(recommendedChoices(5), ['ppl6']);
  assert.deepEqual(recommendedChoices(6), ['ppl6']);
  assert.deepEqual(recommendedChoices(7), ['ppl6']);
  assert.deepEqual(recommendedChoices(3, ['kurzhanteln', 'smart-zirkel']), ['fullbody3', 'smart']);
  assert.deepEqual(recommendedChoices(2, []), ['fullbody2'], 'leere Auswahl heißt alles, aber nicht „Smart-Zirkel angehakt“');
});

test('Anzeige: Empfehlungen oben, „Nur Smart-Zirkel“ nur mit angehaktem Smart-Zirkel', () => {
  const s = fresh();
  s.profile.daysPerWeek = 4;
  let list = choicesFor(s);
  assert.equal(list[0].id, 'upperlower4');
  assert.equal(list[0].recommended, true);
  assert.ok(!list.some(c => c.id === 'smart'));
  assert.equal(list.filter(c => c.recommended).length, 1);
  assert.equal(list[list.length - 1].id, 'empty');
  s.profile.equipment = ['smart-zirkel'];
  list = choicesFor(s);
  assert.deepEqual(list.slice(0, 2).map(c => [c.id, c.recommended]), [['upperlower4', true], ['smart', true]]);
  assert.equal(list.length, 7);
});

test('Frische Einrichtung startet mit dem 3er-Split, die Tage bleiben, wie eingestellt', () => {
  const s = fresh();
  assert.equal(isFreshSetup(s), true);
  assert.equal(currentChoice(s), 'split');
  const r = choosePlan(s, 'split');
  assert.deepEqual(r, { planId: 'split', created: false, changed: false, swaps: [] });
  assert.equal(s.plans.length, 1);
  assert.equal(s.profile.daysPerWeek, 3);
});

test('Vorlage legt einen neuen Plan an und macht ihn aktiv; die Trainingstage ändert sie nicht', () => {
  const s = fresh();
  const r = choosePlan(s, 'fullbody2');
  assert.equal(r.created, true);
  assert.equal(s.plans.length, 1, 'frische Einrichtung: der mitgelieferte 3er-Split bleibt nicht als zweiter Plan');
  assert.equal(s.activePlanId, r.planId);
  const p = s.plans.find(x => x.id === r.planId);
  assert.equal(p.template, 'fullbody2');
  assert.equal(p.name, 'Ganzkörper 2×');
  assert.equal(p.order.length, 2);
  assert.equal(s.profile.daysPerWeek, 3, 'die Tage kommen aus dem Schritt davor');
  assert.equal(currentChoice(s), 'fullbody2');
  assert.equal(isFreshSetup(s), false);
  assert.ok(!s.plans.find(x => x.id === 'split'));
});

test('Frische Einrichtung (Punkt A): andere Vorlage ersetzt den unbenutzten 3er-Split, Zurück zum Split bringt ihn wieder', () => {
  for (const c of ['fullbody3', 'upperlower4', 'ppl6', 'empty']) {
    const s = fresh();
    const a = choosePlan(s, c);
    assert.deepEqual(s.plans.map(p => p.id), [a.planId], c);
    assert.equal(s.activePlanId, a.planId);
    /* In der Einrichtung zurück und doch der 3er-Split: kommt mit seiner id, der eben angelegte fällt weg */
    const b = choosePlan(s, 'split', { discardId: a.planId });
    assert.deepEqual(s.plans.map(p => p.id), ['split'], c);
    assert.equal(b.created, true);
    assert.equal(s.activePlanId, 'split');
  }
});

test('Bestehende Nutzer (Punkt A): mit Verlauf, laufender Einheit, verändertem oder zweitem Plan bleibt der 3er-Split', () => {
  const withSession = fresh();
  withSession.sessions.push({ id: 'x', planId: 'p-alt', dayId: 'a', startedAt: 1, endedAt: 2, ex: [] });
  choosePlan(withSession, 'fullbody2');
  assert.ok(withSession.plans.find(p => p.id === 'split'), 'Verlauf, auch aus einem anderen Plan');
  const running = fresh();
  running.active = { planId: 'split', dayId: 'push', ex: [] };
  choosePlan(running, 'fullbody2');
  assert.ok(running.plans.find(p => p.id === 'split'), 'laufende Einheit');
  const changed = fresh();
  changed.plans[0].days.push.exercises.pop();
  choosePlan(changed, 'fullbody2');
  assert.ok(changed.plans.find(p => p.id === 'split'), 'selbst geänderter Split');
  const two = fresh();
  two.plans.push({ id: 'pX', name: 'Mein Plan', order: [], days: {} });
  choosePlan(two, 'fullbody2');
  assert.ok(two.plans.find(p => p.id === 'split'), 'zweiter Plan');
  assert.equal(two.plans.length, 3);
});

test('Oberkörper/Unterkörper: vier Tage im Plan', () => {
  const s = fresh();
  const r = choosePlan(s, 'upperlower4');
  assert.equal(s.plans.find(p => p.id === r.planId).order.length, 4);
});

test('Fehlende Geräte: die Vorlage ersetzt sie und nennt die Ersetzungen', () => {
  const s = fresh();
  /* Ohne Langhantel, Rack und Multipresse: keine Kniebeugen, kein Bankdrücken */
  s.profile.equipment = ['kurzhanteln', 'flachbank', 'schraegbank', 'latzug', 'ruderzug', 'kabelturm', 'kabelzug-doppelt',
    'beinpresse', 'hackenschmidt', 'beinstrecker', 'beinbeuger-sitzend', 'wadenmaschine-stehend', 'klimmzugstange', 'brustpresse'];
  const r = choosePlan(s, 'fullbody3');
  const p = s.plans.find(x => x.id === r.planId);
  const a = p.days[p.order[0]].exercises.map(e => e.names[0]);
  assert.equal(a[0], 'Hackenschmidt');
  assert.equal(a[1], 'Kurzhantel-Bankdrücken');
  assert.ok(r.swaps.some(x => x.from === 'Kniebeugen' && x.to === 'Hackenschmidt'));
  assert.ok(r.swaps.some(x => x.from === 'Rumänisches Kreuzheben' && x.to));
  /* Ersatz trägt die id von früher, damit der Verlauf zusammenbleibt (Hackenschmidt steht im 3er-Split unter squat) */
  assert.equal(p.days[p.order[0]].exercises[0].id, 'squat');
});

test('Frischer 3er-Split passt sich an die Geräte an, ein benutzter nie', () => {
  const s = fresh();
  s.profile.equipment = ['kurzhanteln', 'flachbank', 'schraegbank', 'latzug', 'ruderzug', 'kabelturm', 'kabelzug-doppelt',
    'beinpresse', 'hackenschmidt', 'beinstrecker', 'beinbeuger-sitzend', 'wadenmaschine-stehend', 'bauchmaschine', 'brustpresse'];
  const r = choosePlan(s, 'split');
  assert.equal(r.planId, 'split');
  assert.ok(r.swaps.length > 0);
  assert.deepEqual(s.plans[0].days.legs.exercises[0].names, ['Hackenschmidt']);
  /* Mit Verlauf bleibt der Plan, wie er ist */
  const t = fresh();
  t.profile.equipment = s.profile.equipment;
  t.sessions.push({ id: 'x', planId: 'split', dayId: 'push', startedAt: 1, endedAt: 2, ex: [] });
  const r2 = choosePlan(t, 'split');
  assert.deepEqual(r2.swaps, []);
  assert.deepEqual(t.plans[0].days.legs.exercises[0].names, ['Kniebeugen', 'Hackenschmidt']);
});

test('Eigener Plan: ein leerer Tag', () => {
  const s = fresh();
  const r = choosePlan(s, 'empty');
  const p = s.plans.find(x => x.id === r.planId);
  assert.equal(p.name, 'Eigener Plan');
  assert.equal(p.order.length, 1);
  assert.equal(p.days[p.order[0]].exercises.length, 0);
  assert.equal(s.profile.daysPerWeek, 3);
  assert.equal(currentChoice(s), 'empty');
});

test('Dieselbe Wahl noch einmal legt keinen zweiten Plan an', () => {
  const s = fresh();
  const a = choosePlan(s, 'fullbody2');
  choosePlan(s, 'split');
  const b = choosePlan(s, 'fullbody2');
  assert.equal(b.planId, a.planId);
  assert.equal(b.created, false);
  assert.equal(s.plans.length, 2);
});

test('Ein im selben Durchgang angelegter, unbenutzter Plan fällt bei anderer Wahl weg', () => {
  const s = fresh();
  const a = choosePlan(s, 'upperlower4');
  choosePlan(s, 'split', { discardId: a.planId });
  assert.equal(s.plans.length, 1);
  assert.equal(s.activePlanId, 'split');
});

test('Benutzte Pläne werden nie entfernt', () => {
  const s = fresh();
  const a = choosePlan(s, 'upperlower4');
  s.sessions.push({ id: 'x', planId: a.planId, dayId: 'd', startedAt: 1, endedAt: 2, ex: [] });
  choosePlan(s, 'split', { discardId: a.planId });
  assert.equal(s.plans.length, 2);
  assert.equal(s.sessions.length, 1);
});

test('Erneute Einrichtung: vorhandener Plan aus dem Plan-Editor wird wiederverwendet, Verlauf bleibt', () => {
  const s = fresh();
  const tpl = PLAN_TEMPLATES.find(t => t.id === 'fullbody2');
  const own = planFromTemplate(tpl, s.plans, []);   // ohne Markierung, wie aus dem Plan-Editor
  s.plans.push(own);
  s.sessions.push({ id: 'y', planId: 'split', dayId: 'push', startedAt: 1, endedAt: 2, ex: [] });
  assert.equal(findPlanFor(s, 'fullbody2').id, own.id);
  const r = choosePlan(s, 'fullbody2', { discardId: 'split' });
  assert.equal(r.planId, own.id);
  assert.equal(r.created, false);
  assert.equal(s.plans.length, 2);
  assert.ok(s.plans.find(x => x.id === 'split'), '3er-Split mit Verlauf bleibt');
  assert.equal(s.sessions.length, 1);
});

test('Selbst angepasste Tage bleiben, wenn der Plan gleich bleibt', () => {
  const s = fresh();
  s.profile.daysPerWeek = 5;
  choosePlan(s, 'split');
  assert.equal(s.profile.daysPerWeek, 5);
});

test('Gelöschter 3er-Split kommt mit seiner id zurück', () => {
  const s = fresh();
  choosePlan(s, 'fullbody2');
  s.plans = s.plans.filter(p => p.id !== 'split');
  const r = choosePlan(s, 'split');
  assert.equal(r.planId, 'split');
  assert.equal(r.created, true);
  assert.equal(s.plans.find(p => p.id === 'split').name, '3er-Split');
});

test('Ein fremder aktiver Plan ergibt keine Vorauswahl', () => {
  const s = fresh();
  s.plans.push({ id: 'pX', name: 'Mein Spezialplan', order: [], days: {} });
  s.activePlanId = 'pX';
  assert.equal(currentChoice(s), null);
});

test('Unbekannte Wahl wird abgewiesen', () => {
  assert.throws(() => choosePlan(fresh(), 'ppl3'));
});

test('Alle sechs Vorlagen lassen sich wählen; „Nur Smart-Zirkel“ ohne Steigerung', () => {
  for (const c of PLAN_CHOICES.filter(x => x.id !== 'empty')) {
    const s = fresh();
    const r = choosePlan(s, c.id);
    assert.equal(s.activePlanId, r.planId, c.id);
    assert.equal(currentChoice(s), c.id);
  }
  const s = fresh();
  const r = choosePlan(s, 'smart');
  const p = s.plans.find(x => x.id === r.planId);
  p.order.forEach(id => p.days[id].exercises.forEach(e => assert.equal(e.inc, 0, e.names[0])));
});
