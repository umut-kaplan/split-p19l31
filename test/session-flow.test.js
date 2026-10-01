import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startView, progressOf, nextOpen, overviewOf, foldSummary, setsSummary } from '../js/domain/session-flow.js';

const set = (w, r, done = false, t) => (t ? { w, r, rir: 2, done, t } : { w, r, rir: 2, done });
const ex = (name, log, more = {}) => ({ exId: name, name, unit: 'reps', log, ...more });

test('Neustart: laufendes Training öffnet die Einheit, sonst „Heute“', () => {
  assert.deepEqual(startView({ active: { ex: [] } }), { tab: 'training', trainSub: 'start' });
  assert.deepEqual(startView({ active: { ex: [ex('Kniebeugen', [set('100', '8')])] } }), { tab: 'training', trainSub: 'start' });
  assert.deepEqual(startView({ active: null }), { tab: 'today' });
  assert.deepEqual(startView({}), { tab: 'today' });
  assert.deepEqual(startView(null), { tab: 'today' });
  /* Kaputter Stand ohne Übungsliste: lieber „Heute“ als eine leere Einheit */
  assert.deepEqual(startView({ active: { name: 'Legs' } }), { tab: 'today' });
});

test('Fortschritt einer Übung: Aufwärmsätze zählen nicht', () => {
  assert.deepEqual(progressOf(ex('A', [set(40, 10, true, 'w'), set(100, 8, true), set(100, 8)])), { done: 1, total: 2, complete: false });
  assert.deepEqual(progressOf(ex('A', [set(40, 10, false, 'w'), set(100, 8, true), set(80, 10, true, 'd')])), { done: 2, total: 2, complete: true });
  /* Nur Aufwärmsätze: keine Arbeit, also auch nicht fertig */
  assert.deepEqual(progressOf(ex('A', [set(40, 10, true, 'w')])), { done: 0, total: 0, complete: false });
  assert.deepEqual(progressOf({}), { done: 0, total: 0, complete: false });
});

test('Nächste offene Übung in der Reihenfolge der Einheit', () => {
  const a = ex('A', [set(1, 1, true)]), b = ex('B', [set(1, 1, true), set(1, 1)]), c = ex('C', [set(1, 1)]);
  assert.equal(nextOpen([a, b, c]), 1);
  assert.equal(nextOpen([a, c, b]), 1);
  assert.equal(nextOpen([c, a]), 0);
  assert.equal(nextOpen([a]), -1);
  assert.equal(nextOpen([]), -1);
  /* Übersprungene Übung weiter vorn bleibt die nächste offene */
  assert.equal(nextOpen([c, a, b]), 0);
});

test('Übersicht: Zustand, Sätze und Supersatz-Gruppen', () => {
  const list = [
    ex('Kniebeugen', [set(100, 8, true), set(100, 8, true)]),
    ex('Beinpresse', [set(150, 10, true), set(150, 10)], { ss: true }),
    ex('Beinbeuger', [set(40, 12), set(40, 12)]),
    ex('Plank', [set(0, 45)], { unit: 'sec' }),
  ];
  const o = overviewOf(list);
  assert.equal(o.next, 1);
  assert.equal(o.exDone, 1);
  assert.equal(o.setsDone, 3);
  assert.equal(o.setsTotal, 7);
  assert.deepEqual(o.items.map(it => it.state), ['done', 'next', 'open', 'open']);
  assert.deepEqual(o.items.map(it => it.group), [null, 1, 1, null]);
  assert.deepEqual(o.items.map(it => `${it.done}/${it.total}`), ['2/2', '1/2', '0/2', '0/1']);
  const all = overviewOf(list.map(x => ({ ...x, log: x.log.map(s => ({ ...s, done: true })) })));
  assert.equal(all.next, -1);
  assert.equal(all.exDone, 4);
});

test('Eingeklappte Übung: eine Zeile mit den abgehakten Arbeitssätzen', () => {
  assert.equal(foldSummary(ex('A', [set('100', '8', true), set('100', '8', true), set('100', '7', true)])), '100 kg × 8, 8, 7');
  assert.equal(foldSummary(ex('A', [set('40', '10', true, 'w'), set('100', '8', true), set('105', '6', true), set('105', '5', true)])),
    '100 kg × 8 · 105 kg × 6, 5');
  assert.equal(foldSummary(ex('A', [set('42,5', '10', true), set('42,5', '9', true)])), '42,5 kg × 10, 9');
  /* Dropsatz mit „D“, offene Sätze fehlen */
  assert.equal(foldSummary(ex('A', [set('100', '8', true), set('70', '12', true, 'd'), set('100', '8')])), '100 kg × 8 · D 70 kg × 12');
  assert.equal(foldSummary(ex('Klimmzüge', [set('0', '12', true), set('', '10', true), set('0', '9', true)])), '12, 10, 9 Wdh.');
  assert.equal(foldSummary(ex('Plank', [set('0', '45', true), set('0', '50', true)], { unit: 'sec' })), '45, 50 s');
  assert.equal(foldSummary(ex('Plank', [set('10', '45', true)], { unit: 'sec' })), '10 kg × 45 s');
  assert.equal(foldSummary(ex('A', [set('1.000', '1', true)])), '1.000 kg × 1');
  assert.equal(foldSummary(ex('A', [set('100', '8')])), '');
  assert.equal(foldSummary({}), '');
});

test('Letztes Mal als kurze Zeile: Satztypen bleiben sichtbar und trennen die Gruppen', () => {
  assert.equal(setsSummary([{ w: 40, r: 10, t: 'w' }, { w: 40, r: 10, t: 'w' }, { w: 100, r: 8 }, { w: 100, r: 8, t: 'f' }, { w: 100, r: 6, t: 'f' }, { w: 70, r: 12, t: 'd' }]),
    'A 40 kg × 10, 10 · 100 kg × 8 · V 100 kg × 8, 6 · D 70 kg × 12');
  assert.equal(setsSummary([{ w: 170, r: 10 }, { w: 170, r: 10 }, { w: 170, r: 10 }]), '170 kg × 10, 10, 10');
  assert.equal(setsSummary([{ w: 0, r: 30 }, { w: 0, r: 45 }], 'sec'), '30, 45 s');
  assert.equal(setsSummary([{ w: 0, r: 8, t: 'w' }, { w: 0, r: 12 }]), 'A 8, 12 Wdh.');
  assert.equal(setsSummary([]), '');
  assert.equal(setsSummary(null), '');
});

test('Smart-Zirkel (4.7): Methode außer „Regulär“ steht hinter der Gruppe und trennt Gruppen', () => {
  assert.equal(setsSummary([{ w: 90, r: 10, m: 'negative' }, { w: 90, r: 10, m: 'negative' }]), '90 kg × 10, 10 (Negativ)');
  assert.equal(setsSummary([{ w: 90, r: 10, m: 'regular' }, { w: 90, r: 9 }]), '90 kg × 10, 9');
  assert.equal(setsSummary([{ w: 90, r: 10 }, { w: 90, r: 8, m: 'maxout' }]), '90 kg × 10 · 90 kg × 8 (Max Out)');
  /* Unbekannte Methoden zählen als regulär */
  assert.equal(setsSummary([{ w: 50, r: 12, m: 'egym' }]), '50 kg × 12');
  /* Eingeklappte Übung: die Methode der Karte gilt für Sätze ohne eigene */
  const set = (w, r, m) => ({ w, r, rir: 2, done: true, ...(m ? { m } : {}) });
  assert.equal(foldSummary({ name: 'Brustpresse (Smart-Zirkel)', m: 'adaptive', log: [set('60', '12'), set('60', '11', 'regular')] }),
    '60 kg × 12 (Adaptiv) · 60 kg × 11');
});
