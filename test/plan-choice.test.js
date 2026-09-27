import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_CHOICES, choosePlan, currentChoice, findPlanFor } from '../js/domain/plan-choice.js';
import { defaultState } from '../js/store/migrate.js';
import { planFromTemplate } from '../js/plans.js';
import { PLAN_TEMPLATES } from '../js/data/plan-templates.js';

const fresh = () => defaultState();

test('Vier Wahlmöglichkeiten, ohne Doppel des 3er-Splits', () => {
  assert.deepEqual(PLAN_CHOICES.map(c => c.id), ['split', 'fullbody2', 'upperlower4', 'empty']);
  assert.deepEqual(PLAN_CHOICES.map(c => c.days), [3, 2, 4, 3]);
});

test('Frische Einrichtung startet mit dem 3er-Split', () => {
  const s = fresh();
  assert.equal(currentChoice(s), 'split');
  const r = choosePlan(s, 'split');
  assert.deepEqual(r, { planId: 'split', created: false, changed: false });
  assert.equal(s.plans.length, 1);
  assert.equal(s.profile.daysPerWeek, 3);
});

test('Vorlage legt einen neuen Plan an, macht ihn aktiv und belegt die Tage vor', () => {
  const s = fresh();
  const r = choosePlan(s, 'fullbody2');
  assert.equal(r.created, true);
  assert.equal(s.plans.length, 2);
  assert.equal(s.activePlanId, r.planId);
  const p = s.plans.find(x => x.id === r.planId);
  assert.equal(p.template, 'fullbody2');
  assert.equal(p.name, 'Ganzkörper 2×');
  assert.equal(p.order.length, 2);
  assert.equal(s.profile.daysPerWeek, 2);
  assert.equal(currentChoice(s), 'fullbody2');
  /* 3er-Split bleibt unangetastet */
  assert.ok(s.plans.find(x => x.id === 'split'));
});

test('Oberkörper/Unterkörper: vier Tage', () => {
  const s = fresh();
  choosePlan(s, 'upperlower4');
  assert.equal(s.profile.daysPerWeek, 4);
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
  assert.equal(s.profile.daysPerWeek, 3);
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
