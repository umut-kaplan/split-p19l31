import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupsOf, groupAt, restAfter, swapKeepLinks, removeKeepLinks, tidyLinks, cleanLink, WARMUP_REST,
} from '../js/domain/superset.js';

const open = (n, t) => Array.from({ length: n }, () => (t ? { done: false, t } : { done: false }));
const ex = (name, rest, log, ss) => ({ name, rest, log, ...(ss ? { ss: true } : {}) });
/* Satz j von Übung i abhaken und die Pause dazu bestimmen, wie workout.js es tut */
const tick = (list, i, j) => { list[i].log[j].done = true; return restAfter(list, i, j); };

test('Gruppen aus ss an der Übung: verbunden mit der nächsten', () => {
  assert.deepEqual(groupsOf([{}, { ss: true }, {}, {}]), [[0], [1, 2], [3]]);
  assert.deepEqual(groupsOf([{ ss: true }, { ss: true }, {}]), [[0, 1, 2]]);
  assert.deepEqual(groupsOf([{}, { ss: true }]), [[0], [1]]);   // ss an der letzten Übung zählt nicht
  assert.deepEqual(groupsOf([{ ss: 'ja' }, {}]), [[0], [1]]);   // nur true verbindet
  assert.deepEqual(groupsOf([]), []);
  assert.deepEqual(groupAt([{ ss: true }, {}, {}], 1), [0, 1]);
});

test('Ohne Supersatz: Pause der Übung nach jedem Satz', () => {
  const list = [ex('Bank', 150, open(3)), ex('Rudern', 120, open(3))];
  assert.deepEqual(tick(list, 0, 0), { seconds: 150, label: 'Bank', why: 'rest' });
});

test('Supersatz: keine Pause zwischen den Übungen, Pause nach der letzten der Runde', () => {
  const list = [ex('Bank', 150, open(3), true), ex('Rudern', 90, open(3)), ex('Seitheben', 60, open(3))];
  const a = tick(list, 0, 0);
  assert.equal(a.seconds, 0);
  assert.equal(a.why, 'superset');
  assert.equal(a.next, 1);
  const b = tick(list, 1, 0);
  assert.deepEqual(b, { seconds: 90, label: 'dem Supersatz', why: 'round' });
  /* Seitheben gehört nicht zur Gruppe */
  assert.equal(tick(list, 2, 0).why, 'rest');
});

test('Supersatz mit drei Übungen: Pause erst nach der dritten', () => {
  const list = [ex('A', 60, open(2), true), ex('B', 60, open(2), true), ex('C', 75, open(2))];
  assert.equal(tick(list, 0, 0).seconds, 0);
  assert.equal(tick(list, 1, 0).seconds, 0);
  assert.equal(tick(list, 2, 0).seconds, 75);
});

test('Supersatz mit ungleich vielen Sätzen: ist die spätere Übung fertig, kommt die Pause nach der früheren', () => {
  const list = [ex('Bank', 150, open(4), true), ex('Rudern', 90, open(3))];
  for (let k = 0; k < 3; k++) { tick(list, 0, k); tick(list, 1, k); }
  const last = tick(list, 0, 3);
  assert.equal(last.seconds, 150);
  assert.equal(last.why, 'round');
});

test('Offene Aufwärmsätze der späteren Übung halten die Runde nicht auf', () => {
  const list = [ex('Bank', 150, open(1), true), ex('Rudern', 90, [...open(2, 'w'), { done: true }])];
  assert.equal(tick(list, 0, 0).seconds, 150);
});

test('Vor einem offenen Dropsatz keine Pause, danach die normale', () => {
  const list = [ex('Curls', 90, [...open(2), { done: false, t: 'd' }])];
  assert.equal(tick(list, 0, 0).seconds, 90);
  const pre = tick(list, 0, 1);
  assert.equal(pre.seconds, 0);
  assert.equal(pre.why, 'drop');
  assert.equal(tick(list, 0, 2).seconds, 90);
});

test('Nach einem Aufwärmsatz eine kurze Pause, auch im Supersatz', () => {
  const list = [ex('Bank', 150, [{ done: false, t: 'w' }, ...open(3)], true), ex('Rudern', 45, [{ done: false, t: 'w' }, ...open(3)])];
  assert.deepEqual(tick(list, 0, 0), { seconds: WARMUP_REST, label: 'Bank', why: 'warmup' });
  assert.equal(tick(list, 1, 0).seconds, 45);   // kürzer, wenn die Übung selbst weniger Pause hat
});

test('Plan-Editor: Tauschen behält die Gruppe am Platz', () => {
  const list = [{ id: 'a', ss: true }, { id: 'b' }, { id: 'c' }];
  swapKeepLinks(list, 0, 1);
  assert.deepEqual(list, [{ id: 'b', ss: true }, { id: 'a' }, { id: 'c' }]);
  swapKeepLinks(list, 1, 2);
  assert.deepEqual(list, [{ id: 'b', ss: true }, { id: 'c' }, { id: 'a' }]);
  swapKeepLinks(list, 0, 5);   // ungültig: nichts passiert
  assert.deepEqual(list.map(x => x.id), ['b', 'c', 'a']);
});

test('Plan-Editor: Löschen verbindet die Nachbarn nur aus der Mitte einer Gruppe', () => {
  const three = () => [{ id: 'a', ss: true }, { id: 'b', ss: true }, { id: 'c' }, { id: 'd' }];
  assert.deepEqual(removeKeepLinks(three(), 1), [{ id: 'a', ss: true }, { id: 'c' }, { id: 'd' }]);
  assert.deepEqual(removeKeepLinks(three(), 2), [{ id: 'a', ss: true }, { id: 'b' }, { id: 'd' }]);
  assert.deepEqual(removeKeepLinks(three(), 0), [{ id: 'b', ss: true }, { id: 'c' }, { id: 'd' }]);
  const pair = [{ id: 'a' }, { id: 'b', ss: true }, { id: 'c' }];
  assert.deepEqual(removeKeepLinks(pair, 2), [{ id: 'a' }, { id: 'b' }]);
});

test('Keine Verbindung an der letzten Übung, sonst wanderte sie an eine neu angehängte', () => {
  assert.deepEqual(tidyLinks([{ id: 'a' }, { id: 'b', ss: true }]), [{ id: 'a' }, { id: 'b' }]);
  const e = { id: 'x', ss: true };
  assert.equal(cleanLink(e), e);
  assert.deepEqual(cleanLink(e, true), { id: 'x' });
  assert.equal(e.ss, true);   // cleanLink verändert nichts
  assert.deepEqual(cleanLink({ id: 'y', ss: 1 }), { id: 'y' });
});
