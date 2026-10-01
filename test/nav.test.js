import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYERS, layers, depth, closeTop, closeTo, closeAll, openTab, historySync, NAV_KEY } from '../js/nav.js';

/* Ansichtszustand wie in state.js, nur die Felder, die für Ebenen zählen */
const view = o => ({ tab: 'today', trainSub: 'start', sheet: null, foodStack: [], ...o });
const sheet = { title: 'Test', actions: [] };

/* ---------- Ebenen ---------- */
test('Startseite ohne Unterseiten hat keine Ebene', () => {
  for (const tab of ['today', 'training', 'body', 'nutrition', 'profile']) assert.deepEqual(layers(view({ tab })), []);
});

test('Ebenen zählen von unten nach oben, das Sheet liegt immer oben', () => {
  assert.deepEqual(layers(view({ tab: 'profile', setView: 'main' })), ['settings']);
  assert.deepEqual(layers(view({ tab: 'profile', setView: 'backup' })), ['settings', 'settings-sub']);
  assert.deepEqual(layers(view({ tab: 'profile', setView: 'main', shiftView: 'calendar', sheet })), ['settings', 'shift', 'sheet']);
  assert.deepEqual(layers(view({ tab: 'today', motView: 'goals', cmpView: 'scan' })), ['goals', 'compare', 'compare-scan']);
  assert.deepEqual(layers(view({ tab: 'today', repView: 123, motView: 'goals' })), ['report', 'goals']);
});

test('Jede Ansicht im Ernährungs-Stapel ist eine Ebene, aber nur im Bereich Ernährung', () => {
  const st = [{ kind: 'search' }, { kind: 'food' }, { kind: 'search', purpose: 'ingredient' }];
  assert.deepEqual(layers(view({ tab: 'nutrition', foodStack: st })), ['food', 'food', 'food']);
  assert.deepEqual(layers(view({ tab: 'today', foodStack: st })), []);
});

test('Unterseiten eines anderen Bereichs zählen nicht, Vergleichen und Schichtplan überall', () => {
  assert.deepEqual(layers(view({ tab: 'today', setView: 'backup' })), []);
  assert.deepEqual(layers(view({ tab: 'body', motView: 'goals' })), []);
  assert.deepEqual(layers(view({ tab: 'body', cmpView: 'main' })), ['compare']);
  assert.deepEqual(layers(view({ tab: 'nutrition', shiftView: 'plan' })), ['shift']);
});

test('Tag bearbeiten ist eine Ebene, außer während eines Trainings', () => {
  assert.deepEqual(layers(view({ tab: 'training', planEdit: true })), ['planday']);
  assert.deepEqual(layers(view({ tab: 'training', planEdit: true }), { active: true }), []);
});

test('Schichtplan: „Muster ändern“ und Schichtart liegen über der Seite', () => {
  const on = { shiftOn: true };
  assert.deepEqual(layers(view({ shiftView: 'settings' }), on), ['shift']);
  assert.deepEqual(layers(view({ shiftView: 'setup' }), on), ['shift', 'shift-setup']);
  /* Ohne Plan ist die Einrichtung die Seite selbst */
  assert.deepEqual(layers(view({ shiftView: 'setup' }), { shiftOn: false }), ['shift']);
  assert.deepEqual(layers(view({ shiftView: 'type', shiftType: { back: 'settings' } }), on), ['shift', 'shift-type']);
  assert.deepEqual(layers(view({ shiftView: 'type', shiftType: { back: 'setup' } }), on), ['shift', 'shift-setup', 'shift-type']);
});

test('Einrichtung, Zusammenfassung und Wiederherstellen: nur ein Sheet zählt', () => {
  assert.deepEqual(layers(view({ tab: 'profile', setView: 'backup', sheet }), { app: false }), ['sheet']);
  assert.deepEqual(layers(view({ tab: 'profile', setView: 'backup' }), { app: false }), []);
});

/* ---------- Schließen ---------- */
test('closeTop schließt genau die oberste Ebene und meldet sie', () => {
  const V = view({ tab: 'profile', setView: 'backup', shiftView: 'calendar', sheet });
  assert.equal(closeTop(V), 'sheet');
  assert.equal(V.sheet, null);
  assert.equal(closeTop(V), 'shift');
  assert.equal(V.shiftView, null);
  assert.equal(closeTop(V), 'settings-sub');
  assert.equal(V.setView, 'main');
  assert.equal(closeTop(V), 'settings');
  assert.equal(V.setView, null);
  assert.equal(closeTop(V), null);
  assert.equal(V.tab, 'profile');
});

test('Jede Ebene schließt sich und senkt die Tiefe um genau eins', () => {
  const open = {
    report: { tab: 'today', repView: 5 }, goals: { tab: 'today', motView: 'goals', badgeFresh: new Set() },
    planday: { tab: 'training', planEdit: true }, settings: { tab: 'profile', setView: 'main' },
    'settings-sub': { tab: 'profile', setView: 'health' }, food: { tab: 'nutrition', foodStack: [{ kind: 'search' }, { kind: 'scan' }] },
    compare: { cmpView: 'main' }, 'compare-scan': { cmpView: 'scan' }, shift: { shiftView: 'calendar' },
    'shift-setup': { shiftView: 'setup' }, 'shift-type': { shiftView: 'type', shiftType: { back: 'setup' } }, sheet: { sheet },
  };
  assert.deepEqual(Object.keys(open).sort(), LAYERS.map(l => l.id).sort());
  for (const [id, o] of Object.entries(open)) {
    const V = view(o);
    const c = { shiftOn: true };
    const n = depth(V, c);
    assert.ok(n >= 1, id);
    assert.equal(closeTop(V, c), id, id);
    assert.equal(depth(V, c), n - 1, id);
  }
});

test('Beim Schließen laufen die Haken der Ebene, z. B. Kamera aus', () => {
  const calls = [];
  const hooks = { 'compare-scan': () => calls.push('scan'), compare: () => calls.push('cmp'), food: V => calls.push('food:' + V.foodStack.at(-1).kind) };
  const V = view({ tab: 'nutrition', foodStack: [{ kind: 'search' }, { kind: 'scan' }], cmpView: 'scan' });
  closeAll(V, {}, hooks);
  assert.deepEqual(calls, ['scan', 'cmp', 'food:scan', 'food:search']);
  assert.deepEqual(V.foodStack, []);
  assert.equal(V.cmpView, null);
});

test('closeTo lässt die unteren Ebenen offen', () => {
  const V = view({ tab: 'profile', setView: 'backup', sheet });
  closeTo(V, 1);
  assert.deepEqual(layers(V), ['settings']);
});

test('Tab-Tipp: Startseite des Bereichs, alle Unterseiten zu, auch der Ernährungs-Stapel', () => {
  const V = view({ tab: 'nutrition', foodStack: [{ kind: 'search' }], cmpView: 'main', motView: 'goals', repView: 1, setView: 'backup', shiftView: 'plan', planEdit: true });
  openTab(V, 'nutrition');
  assert.equal(V.tab, 'nutrition');
  assert.deepEqual(V.foodStack, []);
  for (const k of ['cmpView', 'motView', 'repView', 'setView', 'shiftView', 'planEdit']) assert.equal(V[k], null, k);
  assert.deepEqual(layers(V), []);
  /* Verdeckter Stapel der Ernährung schließt auch beim Wechsel aus einem anderen Bereich */
  const W = view({ tab: 'today', foodStack: [{ kind: 'search' }] });
  openTab(W, 'nutrition');
  assert.deepEqual(layers(W), []);
});

test('Tab-Tipp mit Reiter und Tag (Einstieg aus „Heute“) und Heute rollt die Scheibe', () => {
  const V = view({ tab: 'today' });
  openTab(V, 'training', { sub: 'plan', day: 'legs' });
  assert.equal(V.trainSub, 'plan');
  assert.equal(V.planDay, 'legs');
  openTab(V, 'today');
  assert.equal(V.roll, true);
  assert.equal(V.trainSub, 'plan');
});

test('Tab-Tipp setzt die Reiter des Bereichs auf den ersten, außer bei einem gezielten Sprung', () => {
  const V = view({ tab: 'training', trainSub: 'history', libMode: 'knowledge', histView: 'records', bodySub: 'photos', nutDate: '2026-09-28' });
  openTab(V, 'training');
  assert.equal(V.trainSub, 'start');
  assert.equal(V.libMode, 'list');
  assert.equal(V.histView, 'sessions');
  /* Andere Bereiche behalten ihren Reiter, bis man sie antippt */
  assert.equal(V.bodySub, 'photos');
  openTab(V, 'body');
  assert.equal(V.bodySub, 'weight');
  openTab(V, 'nutrition');
  assert.equal(V.nutDate, null);
  /* Gezielter Sprung mit data-sub */
  openTab(V, 'training', { sub: 'library' });
  assert.equal(V.trainSub, 'library');
});

test('Suche von „Heute“ (from): Zurück nach der letzten Ansicht des Stapels führt nach Heute', () => {
  const V = view({ tab: 'nutrition', foodStack: [{ kind: 'search', from: 'today' }, { kind: 'scan' }] });
  assert.equal(closeTop(V), 'food');
  assert.equal(V.tab, 'nutrition');
  assert.equal(closeTop(V), 'food');
  assert.equal(V.tab, 'today');
  assert.deepEqual(layers(V), []);
  /* Ohne from bleibt Ernährung */
  const W = view({ tab: 'nutrition', foodStack: [{ kind: 'search' }] });
  closeTop(W);
  assert.equal(W.tab, 'nutrition');
  /* Tab-Tipp auf Ernährung schließt den Stapel und bleibt dort */
  const X = view({ tab: 'nutrition', foodStack: [{ kind: 'search', from: 'today' }] });
  openTab(X, 'nutrition');
  assert.equal(X.tab, 'nutrition');
  assert.deepEqual(X.foodStack, []);
});

/* ---------- Browser-Verlauf ---------- */
/* Nachbau von window.history: Einträge, Index, popstate erst beim flush() wie im Browser asynchron */
function fakeWindow(initialState = null) {
  const entries = [initialState];
  let i = 0;
  const queue = [];
  const listeners = [];
  const timers = [];
  const win = {
    history: {
      get state() { return entries[i]; },
      get length() { return entries.length; },
      scrollRestoration: 'auto',
      pushState(s) { entries.splice(i + 1); entries.push(s); i = entries.length - 1; },
      replaceState(s) { entries[i] = s; },
      go(d) { const j = i + d; if (j < 0 || j >= entries.length || d === 0) return; i = j; queue.push({ state: entries[i] }); },
      back() { this.go(-1); },
    },
    addEventListener: (type, fn) => { if (type === 'popstate') listeners.push(fn); },
    setTimeout: (fn, ms) => { timers.push(fn); return timers.length; },
    clearTimeout: id => { if (id) timers[id - 1] = null; },
  };
  return {
    win, entries: () => entries, index: () => i,
    flush() { while (queue.length) { const ev = queue.shift(); listeners.forEach(f => f(ev)); } },
    runTimers() { timers.splice(0).forEach(f => f && f()); },
    /* Nutzer wischt zurück oder tippt Browser-Zurück */
    userBack() { win.history.go(-1); this.flush(); },
    userForward() { win.history.go(1); this.flush(); },
  };
}

/* Kleine App: V wie oben, render ruft sync auf wie app.js */
function app(fw) {
  const V = view({ tab: 'profile' });
  const draws = [];
  const h = historySync(fw.win, {
    count: () => depth(V),
    backTo: n => closeTo(V, n),
    redraw: y => { draws.push(y); render(); },
  });
  function render(y = 0) { h.sync(y); }
  return { V, h, render, draws };
}

test('Start ohne Verlaufsmüll: kein neuer Eintrag, nur die Markierung des Grundeintrags', () => {
  const fw = fakeWindow();
  const { h, render } = app(fw);
  h.start();
  render(); render();
  assert.equal(fw.entries().length, 1);
  assert.deepEqual(fw.win.history.state, { [NAV_KEY]: 0 });
  assert.equal(fw.win.history.scrollRestoration, 'manual');
});

test('Jede Unterseite bekommt genau einen Eintrag, Neuzeichnen keinen weiteren', () => {
  const fw = fakeWindow();
  const { V, h, render } = app(fw);
  h.start();
  V.setView = 'main'; render(120);
  render(); render();
  assert.equal(fw.entries().length, 2);
  V.setView = 'backup'; render(300);
  render();
  assert.equal(fw.entries().length, 3);
  assert.deepEqual(fw.win.history.state, { [NAV_KEY]: 2 });
  assert.equal(h.depth, 2);
});

test('Zurück (Wischgeste) schließt eine Ebene und springt an die alte Scrollposition', () => {
  const fw = fakeWindow();
  const { V, h, render, draws } = app(fw);
  h.start();
  V.setView = 'main'; render(120);
  V.setView = 'backup'; render(640);
  fw.userBack();
  assert.equal(V.setView, 'main');
  assert.deepEqual(draws, [640]);
  assert.equal(fw.index(), 1);
  fw.userBack();
  assert.equal(V.setView, null);
  assert.deepEqual(draws, [640, 120]);
  assert.equal(fw.index(), 0);
  /* Keine neuen Einträge durch das Neuzeichnen nach dem Zurück */
  assert.equal(fw.entries().length, 3);
});

test('Schließt die App selbst („‹ Zurück“, Speichern), geht der Verlauf mit und das popstate wird überhört', () => {
  const fw = fakeWindow();
  const { V, h, render, draws } = app(fw);
  h.start();
  V.setView = 'main'; render();
  V.setView = 'health'; render();
  V.sheet = sheet; render();
  assert.equal(fw.index(), 3);
  /* Sheet und Unterseite gehen in einem Schritt zu */
  V.sheet = null; V.setView = 'main'; render();
  assert.equal(h.pending, 1);
  fw.flush();
  assert.equal(h.pending, 0);
  assert.equal(fw.index(), 1);
  assert.equal(V.setView, 'main');
  assert.deepEqual(draws, []);
  /* Danach wieder normal: neue Ebene, ein Eintrag */
  V.setView = 'csv'; render();
  assert.equal(fw.index(), 2);
  assert.equal(fw.entries().length, 3);
});

test('Während des eigenen Rücksprungs geöffnete Ebenen kommen danach in den Verlauf', () => {
  const fw = fakeWindow();
  const { V, h, render } = app(fw);
  h.start();
  V.setView = 'main'; render();
  V.setView = 'backup'; render();
  V.setView = 'main'; render();      // „‹ Zurück“: history.go(-1) läuft noch
  V.setView = 'legal'; render();     // gleich die nächste Zeile
  assert.equal(fw.index(), 1);
  fw.flush();
  assert.equal(fw.index(), 2);
  assert.deepEqual(fw.win.history.state, { [NAV_KEY]: 2 });
  fw.userBack();
  assert.equal(V.setView, 'main');
});

test('Vorwärts öffnet nichts wieder, die App kehrt auf ihren Stand zurück', () => {
  const fw = fakeWindow();
  const { V, h, render } = app(fw);
  h.start();
  V.setView = 'main'; render();
  fw.userBack();
  assert.equal(V.setView, null);
  fw.userForward();
  assert.equal(fw.index(), 0);
  assert.equal(V.setView, null);
  assert.equal(h.depth, 0);
});

test('Tab-Tipp aus zwei Ebenen Tiefe: ein Sprung zurück, kein Endlos-Hin-und-Her', () => {
  const fw = fakeWindow();
  const { V, h, render } = app(fw);
  h.start();
  V.setView = 'main'; render();
  V.setView = 'backup'; render();
  openTab(V, 'today'); render(); render();
  fw.flush();
  render();
  assert.equal(fw.index(), 0);
  assert.equal(h.depth, 0);
  assert.equal(h.pending, 0);
});

test('Neu geladen mitten im Verlauf: zurück auf den Grundeintrag, Einträge erst danach', () => {
  const fw = fakeWindow({ [NAV_KEY]: 0 });
  fw.win.history.pushState({ [NAV_KEY]: 1 });
  fw.win.history.pushState({ [NAV_KEY]: 2 });
  const { V, h, render } = app(fw);
  h.start();
  V.sheet = sheet; render();            // „Neu in Split“ beim Start
  assert.equal(fw.index(), 0);
  fw.flush();
  assert.equal(fw.index(), 1);
  assert.deepEqual(fw.win.history.state, { [NAV_KEY]: 1 });
  fw.userBack();
  assert.equal(V.sheet, null);
});

test('Kommt das popstate nie, wartet der Abgleich nicht für immer', () => {
  const fw = fakeWindow();
  const { V, h, render } = app(fw);
  h.start();
  V.setView = 'main'; render();
  /* Der Browser führt history.go nicht aus (z. B. weil der Eintrag fehlt): kein popstate */
  const go = fw.win.history.go;
  fw.win.history.go = () => {};
  V.setView = null; render();
  assert.equal(h.pending, 1);
  fw.runTimers();
  fw.win.history.go = go;
  assert.equal(h.pending, 0);
  assert.equal(h.depth, 0);
  assert.deepEqual(fw.win.history.state, { [NAV_KEY]: 0 });
  V.setView = 'main'; render();
  assert.equal(h.depth, 1);
  assert.deepEqual(fw.win.history.state, { [NAV_KEY]: 1 });
  fw.userBack();
  assert.equal(V.setView, null);
});
