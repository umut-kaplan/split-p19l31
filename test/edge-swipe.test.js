import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EDGE, edgeStart, edgeMove, edgeEnd, blocked, edgeGesture, isIosHomeScreen } from '../js/ui/edge-swipe.js';

const P = (x, y, t = 0) => ({ x, y, t });

test('Rand-Geste beginnt nur am linken Rand', () => {
  assert.equal(edgeStart(0), true);
  assert.equal(edgeStart(EDGE.startPx), true);
  assert.equal(edgeStart(EDGE.startPx + 1), false);
  assert.equal(edgeStart(200), false);
});

test('Während der Bewegung: waagerecht nach rechts verfolgen, senkrecht oder nach links abbrechen', () => {
  const s = P(5, 300);
  assert.equal(edgeMove(s, P(10, 304)), 'wait');
  assert.equal(edgeMove(s, P(40, 310)), 'track');
  assert.equal(edgeMove(s, P(20, 360)), 'cancel');   // Seite rollen
  assert.equal(edgeMove(s, P(-10, 300)), 'cancel');
});

test('Loslassen: weit genug oder schnell genug, überwiegend waagerecht', () => {
  const s = P(5, 300, 1000);
  assert.equal(edgeEnd(s, P(5 + EDGE.minDx, 320, 1600)), true);         // langsam, aber weit
  assert.equal(edgeEnd(s, P(5 + EDGE.minDx - 1, 300, 1600)), false);    // langsam und zu kurz
  assert.equal(edgeEnd(s, P(45, 305, 1050)), true);                     // kurz, aber schnell (0,8 px/ms)
  assert.equal(edgeEnd(s, P(25, 300, 1020)), false);                    // zu kurz, auch schnell
  assert.equal(edgeEnd(s, P(120, 400, 1200)), false);                   // zu schräg
  assert.equal(edgeEnd(s, P(0, 300, 1100)), false);
});

/* Kleiner DOM-Nachbau: tagName, parentElement, Maße, Stil */
const node = (tag, o = {}, parent = null) => ({
  nodeType: 1, tagName: tag, parentElement: parent, isContentEditable: !!o.edit, scrollWidth: o.sw || 100, clientWidth: o.cw || 100,
  ox: o.ox || 'visible', attrs: o.attrs || [], hasAttribute(a) { return this.attrs.includes(a); },
});
const styleOf = n => ({ overflowX: n.ox });

test('Nicht in Eingabefeldern und waagerecht rollbaren Bereichen', () => {
  const body = node('BODY');
  const main = node('MAIN', {}, body);
  assert.equal(blocked(node('BUTTON', {}, main), styleOf), false);
  assert.equal(blocked(node('INPUT', {}, main), styleOf), true);
  assert.equal(blocked(node('TEXTAREA', {}, main), styleOf), true);
  assert.equal(blocked(node('DIV', { edit: true }, main), styleOf), true);
  const tabs = node('DIV', { sw: 500, cw: 320, ox: 'auto' }, main);
  assert.equal(blocked(node('BUTTON', {}, tabs), styleOf), true);
  /* Breiter Inhalt, aber abgeschnitten statt rollbar: frei */
  const clip = node('DIV', { sw: 500, cw: 320, ox: 'clip' }, main);
  assert.equal(blocked(node('SPAN', {}, clip), styleOf), false);
  assert.equal(blocked(node('DIV', { attrs: ['data-noswipe'] }, main), styleOf), true);
});

test('Ablauf: eine Geste geht genau eine Ebene zurück', () => {
  let depth = 2, backs = 0;
  const shown = [];
  const g = edgeGesture({ canGoBack: () => depth > 0, goBack: () => { backs++; depth--; }, feedback: s => shown.push(s) });
  assert.equal(g.start(P(6, 300, 0), {}), true);
  g.move(P(30, 305, 40));
  g.move(P(90, 310, 120));
  assert.equal(g.end(P(100, 310, 150)), true);
  assert.equal(backs, 1);
  assert.deepEqual([...new Set(shown)], ['move', 'ready', 'end']);
  /* Danach ist nichts mehr offen: ein zweites Loslassen tut nichts */
  assert.equal(g.end(P(100, 310, 200)), false);
  assert.equal(backs, 1);
});

test('Ablauf: nichts, wenn es keine Ebene gibt, beim Rollen, abseits des Rands und in gesperrten Bereichen', () => {
  let backs = 0;
  const mk = (o = {}) => edgeGesture({ canGoBack: () => true, goBack: () => { backs++; }, ...o });
  const swipe = (g, x0 = 6, dy = 0, target = {}) => { g.start(P(x0, 300, 0), target); g.move(P(x0 + 40, 300 + dy / 2, 60)); g.move(P(x0 + 100, 300 + dy, 120)); return g.end(P(x0 + 100, 300 + dy, 140)); };
  assert.equal(swipe(mk({ canGoBack: () => false })), false);
  assert.equal(swipe(mk(), 6, 200), false);             // senkrecht: Seite rollt
  assert.equal(swipe(mk(), 60), false);                 // nicht am Rand
  assert.equal(swipe(mk({ isBlocked: t => t.input }), 6, 0, { input: true }), false);
  /* Nur getippt, nicht gewischt */
  const g = mk(); g.start(P(6, 300, 0), {}); assert.equal(g.end(P(7, 300, 80)), false);
  /* Abgebrochen (zweiter Finger, System) */
  const c = mk(); c.start(P(6, 300, 0), {}); c.move(P(60, 300, 60)); c.cancel(); assert.equal(c.end(P(120, 300, 100)), false);
  assert.equal(backs, 0);
});

test('Nur in der Home-Bildschirm-App eines iPhones oder iPads', () => {
  const win = (nav, standalone) => ({ navigator: nav, matchMedia: () => ({ matches: standalone }) });
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile';
  assert.equal(isIosHomeScreen(win({ standalone: true, userAgent: IPHONE }, false)), true);
  assert.equal(isIosHomeScreen(win({ userAgent: IPHONE }, true)), true);
  assert.equal(isIosHomeScreen(win({ standalone: false, userAgent: IPHONE }, false)), false);   // Safari
  assert.equal(isIosHomeScreen(win({ userAgent: ANDROID }, true)), false);                     // Android hat eine eigene Geste
  assert.equal(isIosHomeScreen(win({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }, true)), true); // iPad
});
