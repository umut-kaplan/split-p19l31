/* 4.7: Angebot „Überarbeiteter 3er-Split verfügbar“ (Q6, Q29a) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../js/store/migrate.js';
import { LEGACY_SPLIT, DEFAULT_PLAN, planFromTemplate } from '../js/plans.js';
import { findTemplate } from '../js/data/plan-templates.js';
import { isLegacySplit, offerPending, planOffer, acceptOffer, declineOffer, comparePlans, OFFER_ID, NEW_PLAN_NAME } from '../js/domain/plan-update.js';
import { nextDay, lastLog } from '../js/domain/progression.js';
import { findPlanFor, choosePlan, currentChoice } from '../js/domain/plan-choice.js';

const copy = o => JSON.parse(JSON.stringify(o));
/* Stand eines Nutzers mit dem 3er-Split bis 4.6 und etwas Verlauf */
function legacyUser(edit = p => p) {
  const s = defaultState();
  s.plans = [edit(copy(LEGACY_SPLIT))];
  s.activePlanId = 'split';
  s.settings.onboardingDone = true;
  s.sessions = [{ id: 'a', planId: 'split', dayId: 'push', name: 'Push', startedAt: 1, endedAt: 2,
    ex: [{ exId: 'bank', name: 'Bankdrücken', unit: 'reps', sets: [{ w: 80, r: 8, rir: 2 }] }] }];
  return s;
}

test('Erkennt den alten 3er-Split, unverändert und leicht verändert', () => {
  assert.equal(isLegacySplit(copy(LEGACY_SPLIT)), true);
  assert.equal(isLegacySplit(copy(DEFAULT_PLAN)), false, 'der neue nicht');
  /* Leicht verändert: drei Übungen raus, zwei eigene dazu, Sätze geändert, Tag umbenannt */
  const p = copy(LEGACY_SPLIT);
  p.days.push.exercises = p.days.push.exercises.filter(e => !['flyup', 'dip'].includes(e.id));
  p.days.legs.exercises = p.days.legs.exercises.filter(e => e.id !== 'abduktoren');
  p.days.pull.exercises.push({ id: 'reverse-flys', names: ['Reverse Flys'], sets: 3, repMin: 12, repMax: 15, rest: 60, inc: 2, unit: 'reps' });
  p.days.legs.exercises.push({ id: 'hip-thrust', names: ['Hip Thrust'], sets: 3, repMin: 8, repMax: 12, rest: 120, inc: 2.5, unit: 'reps' });
  p.days.push.exercises[0].sets = 5;
  p.days.push.name = 'Drücken';
  assert.equal(isLegacySplit(p), true);
  /* Als Kopie aus der alten Vorlage (andere Plan- und Tages-ids) auch */
  const q = copy(LEGACY_SPLIT);
  q.id = 'pX';
  assert.equal(isLegacySplit(q), true);
  /* Stark umgebaut oder ein anderer Plan: nein */
  const r = copy(LEGACY_SPLIT);
  r.days.push.exercises = r.days.push.exercises.slice(0, 2);
  r.days.pull.exercises = r.days.pull.exercises.slice(0, 2);
  assert.equal(isLegacySplit(r), false);
  ['fullbody2', 'fullbody3', 'upperlower4', 'ppl6', 'smart'].forEach(id => assert.equal(isLegacySplit(planFromTemplate(findTemplate(id), [])), false, id));
  assert.equal(isLegacySplit(null), false);
});

test('Angebot nur für den aktiven alten Split, nicht für neue Nutzer', () => {
  assert.equal(offerPending(defaultState()), false, 'neue Nutzer haben schon den neuen');
  const s = legacyUser();
  assert.equal(offerPending(s), true);
  s.plans.push(planFromTemplate(findTemplate('fullbody3'), s.plans));
  s.activePlanId = s.plans[1].id;
  assert.equal(offerPending(s), false, 'anderer Plan aktiv');
});

test('Gegenüberstellung: Sätze, Dauer, gestrichene und neue Übungen je Tag', () => {
  const o = planOffer(legacyUser());
  assert.equal(o.current.id, 'split');
  assert.equal(o.plan.name, NEW_PLAN_NAME);
  assert.deepEqual(o.days.map(d => d.name), ['Push', 'Pull', 'Legs']);
  const [push, pull, legs] = o.days;
  assert.deepEqual([push.before.sets, push.after.sets], [25, 20]);
  assert.deepEqual([push.before.minutes, push.after.minutes], [75, 60]);
  assert.deepEqual(push.removed, ['Dip-Maschine', 'Kabel-Flys von unten nach oben']);
  assert.deepEqual(push.added, []);
  assert.deepEqual(pull.removed, ['Enger Latzug', 'Hammercurls']);
  assert.deepEqual(pull.added, ['Rumänisches Kreuzheben', 'Schrägbank-Curls']);
  assert.deepEqual(legs.removed, ['Beinbeuger', 'Adduktoren', 'Abduktoren', 'Plank']);
  assert.deepEqual(legs.added, ['Beinbeuger sitzend']);
  assert.deepEqual([legs.before.minutes, legs.after.minutes], [78, 59]);
  assert.deepEqual(o.swaps, []);
  /* Tage über den Namen, sonst über die Position */
  const renamed = comparePlans({ ...copy(LEGACY_SPLIT), days: { ...copy(LEGACY_SPLIT).days, push: { ...copy(LEGACY_SPLIT).days.push, name: 'Drücken' } } }, copy(DEFAULT_PLAN));
  assert.deepEqual(renamed[0].removed, ['Dip-Maschine', 'Kabel-Flys von unten nach oben']);
});

test('Übernehmen: neuer Plan aktiv, alter bleibt, Verlauf passt über die ids', () => {
  const s = legacyUser();
  const before = copy(s.plans[0]);
  const id = acceptOffer(s, 1000);
  assert.equal(s.plans.length, 2);
  assert.deepEqual(s.plans[0], before, 'alter Plan unverändert');
  assert.equal(s.activePlanId, id);
  const p = s.plans[1];
  assert.equal(p.name, NEW_PLAN_NAME);
  assert.deepEqual(s.suggestions[OFFER_ID], { status: 'accepted', date: 1000 });
  assert.equal(offerPending(s), false);
  /* Bankdrücken heißt weiter „bank“: die Progression findet den Verlauf */
  const bank = p.days[p.order[0]].exercises[0];
  assert.equal(bank.id, 'bank');
  assert.equal(lastLog(s.sessions, bank.id, bank.names[0]).sets[0].w, 80);
  /* Reihenfolge läuft weiter: zuletzt Push im alten Plan, also Pull im neuen (Zuordnung über den Namen) */
  assert.equal(nextDay(p.order, s.sessions, p.id, p.days), p.order[1]);
  assert.equal(p.days[p.order[1]].name, 'Pull');
  assert.equal(nextDay(p.order, s.sessions, p.id), p.order[0], 'ohne Tage wie bisher vorn');
  /* Der Coach wartet mit Volumen eine volle Woche (coach/training.js) */
  assert.equal(p.createdAt, 1000);
  /* Zurück zum alten Plan: kein neues Angebot */
  s.activePlanId = 'split';
  assert.equal(offerPending(s), false);
  /* Die Einrichtung meint mit „3er-Split“ danach den überarbeiteten */
  assert.equal(findPlanFor(s, 'split').id, id);
  choosePlan(s, 'split');
  assert.equal(s.activePlanId, id);
  assert.equal(currentChoice(s), 'split');
});

test('„Behalten, nicht mehr fragen“ blendet das Angebot dauerhaft aus', () => {
  const s = legacyUser();
  declineOffer(s, 5);
  assert.equal(s.suggestions[OFFER_ID].status, 'declined');
  assert.equal(offerPending(s), false);
  assert.equal(planOffer(s), null);
  assert.equal(s.plans.length, 1);
});

test('Übernahme passt sich an die Geräte an und findet einen freien Namen', () => {
  const s = legacyUser();
  s.profile.equipment = ['kurzhanteln', 'flachbank', 'schraegbank', 'latzug', 'ruderzug', 'kabelturm', 'kabelzug-doppelt', 'beinpresse',
    'hackenschmidt', 'beinstrecker', 'beinbeuger-sitzend', 'wadenmaschine-stehend', 'bauchmaschine'];
  s.plans.push({ ...copy(DEFAULT_PLAN), id: 'pY', name: NEW_PLAN_NAME });
  const o = planOffer(s);
  assert.ok(o.swaps.some(x => x.from === 'Kniebeugen' && x.to === 'Hackenschmidt'));
  acceptOffer(s);
  const p = s.plans.find(x => x.id === s.activePlanId);
  assert.equal(p.name, `${NEW_PLAN_NAME} (2)`);
  assert.deepEqual(p.days[p.order[2]].exercises[0].names, ['Hackenschmidt']);
});

test('Weiter nach der zuletzt trainierten Einheit: Legs → Push; ohne gleichen Namen oder mit eigener Einheit wie bisher', () => {
  const s = legacyUser();
  s.sessions.push({ id: 'b', planId: 'split', dayId: 'legs', name: 'Legs', startedAt: 3, endedAt: 4, ex: [] });
  const id = acceptOffer(s, 1000);
  const p = s.plans.find(x => x.id === id);
  assert.equal(p.days[nextDay(p.order, s.sessions, p.id, p.days)].name, 'Push');
  /* Eigene Einheit im neuen Plan geht vor */
  s.sessions.push({ id: 'c', planId: p.id, dayId: p.order[0], name: 'Push', startedAt: 5, endedAt: 6, ex: [] });
  assert.equal(nextDay(p.order, s.sessions, p.id, p.days), p.order[1]);
  /* Andere Tagesnamen (Ganzkörper): vorn */
  const fb = planFromTemplate(findTemplate('fullbody2'), s.plans, []);
  assert.equal(nextDay(fb.order, s.sessions, fb.id, fb.days), fb.order[0]);
});
