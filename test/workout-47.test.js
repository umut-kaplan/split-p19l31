/* Abschluss 4.7: Kurzversion im Verlauf, Methode am Smart-Zirkel in „Letztes Mal“ und im Verlauf */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

/* Kleinste DOM-Attrappe: Einige Ansichten melden beim Laden Ereignisse an */
const el = () => ({ textContent: '', hidden: false, style: {}, setAttribute() {}, appendChild() {}, remove() {}, querySelector: () => null, addEventListener() {} });
globalThis.document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: el, body: el(), addEventListener() {} };
globalThis.window = { addEventListener() {}, scrollTo() {}, scrollBy() {} };
after(() => { delete globalThis.document; delete globalThis.window; });

const { S, V } = await import('../js/state.js');
const { defaultState } = await import('../js/store/migrate.js');
const wo = await import('../js/views/workout.js');
const { vHistory } = await import('../js/views/history.js');

beforeEach(() => {
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, defaultState());
  Object.assign(V, { summary: null, sheet: null, histMode: 'list', histView: 'sessions', histDay: null });
});

/* Training beenden; sind Sätze offen, bestätigt der Test die Rückfrage */
function finish() {
  wo.actions.finish();
  if (V.sheet) V.sheet.actions[0].fn();
}
const tick = (i, w = '80', r = '8') => S.active.ex[i].log.forEach(s => { s.w = w; s.r = r; s.done = true; });

test('Als Kurzversion gestartet: Einheit zeigt „Kurzversion“, gespeichert mit short, Zusammenfassung und Verlauf mit „Kurz“', () => {
  wo.startWorkout('push', { short: true });
  assert.equal(S.active.short, true);
  assert.equal(S.active.ex.length, 4);
  assert.match(wo.vWorkout(), /<span class="short-badge wo-short" aria-label="Kurzversion">Kurz<span class="wo-short-x">version<\/span><\/span>/);
  tick(0);
  finish();
  const s = S.sessions[S.sessions.length - 1];
  assert.equal(s.short, true);
  assert.equal(S.active, null);
  assert.equal(V.summary.short, true);
  assert.match(wo.vSummary(), /<p class="sum-short"><span class="short-badge" aria-label="Kurzversion">Kurz<\/span><\/p>/);
  assert.match(vHistory(), /<b>Push<\/b> <span class="short-badge" aria-label="Kurzversion">Kurz<\/span>/);
  /* Kalender: Tag der Einheit gewählt */
  V.histMode = 'calendar';
  const d = new Date(s.startedAt);
  V.histMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  V.histDay = `${V.histMonth}-${String(d.getDate()).padStart(2, '0')}`;
  assert.match(vHistory(), /<h2>Push <span class="short-badge"/);
});

test('Volle Einheit: kein short, nirgends „Kurz“', () => {
  wo.startWorkout('push');
  assert.equal('short' in S.active, false);
  assert.doesNotMatch(wo.vWorkout(), /Kurzversion/);
  tick(0);
  finish();
  assert.equal('short' in S.sessions[S.sessions.length - 1], false);
  assert.doesNotMatch(wo.vSummary(), /short-badge/);
  assert.doesNotMatch(vHistory(), /short-badge/);
});

test('Smart-Zirkel: Methode außer „Regulär“ in „Letztes Mal“ und im Verlauf', () => {
  const day = S.plans[0].days.push;
  day.exercises = [{ id: 'smart-brustpresse', names: ['Brustpresse (Smart-Zirkel)'], sets: 2, repMin: 10, repMax: 15, rest: 60, inc: 0, unit: 'reps' }];
  wo.startWorkout('push');
  wo.actions.smethodall({ dataset: { i: '0', v: 'negative' } });
  tick(0, '90', '10');
  finish();
  const sets = S.sessions[S.sessions.length - 1].ex[0].sets;
  assert.deepEqual(sets.map(s => s.m), ['negative', 'negative']);
  assert.match(vHistory(), /<dd class="num">90 × 10 \(Negativ\), 90 × 10 \(Negativ\)<\/dd>/);
  /* Beim nächsten Mal: „Letztes Mal“ mit Methode, Startwert der Karte wie zuletzt */
  wo.startWorkout('push');
  assert.equal(S.active.ex[0].m, 'negative');
  assert.match(wo.vWorkout(), /Letztes Mal am [^:]+: <span class="num">90 kg × 10, 10 \(Negativ\)<\/span>/);
  /* Regulär steht nicht dabei */
  wo.actions.smethodall({ dataset: { i: '0', v: 'regular' } });
  tick(0, '85', '12');
  finish();
  assert.match(vHistory(), /<dd class="num">85 × 12, 85 × 12<\/dd>/);
  wo.startWorkout('push');
  assert.match(wo.vWorkout(), /Letztes Mal am [^:]+: <span class="num">85 kg × 12, 12<\/span>/);
});

test('Gegengewicht (H1): „kg Unterstützung“, Vorschlag weniger Unterstützung, keine Aufwärmrampe, kein bewegtes Gewicht', () => {
  S.plans[0].days.pull.exercises.unshift({ id: 'klimmzuege-assistiert', names: ['Klimmzüge mit Unterstützung'], sets: 2, repMin: 8, repMax: 10, rest: 120, inc: 5, unit: 'reps' });
  S.sessions.push({ id: 'a1', planId: 'split', dayId: 'pull', name: 'Pull', color: 'blue', startedAt: Date.now() - 3 * 864e5, endedAt: Date.now() - 3 * 864e5 + 36e5,
    ex: [{ exId: 'klimmzuege-assistiert', name: 'Klimmzüge mit Unterstützung', unit: 'reps', sets: [{ w: 30, r: 10, rir: 2 }, { w: 30, r: 10, rir: 2 }] }] });
  wo.startWorkout('pull');
  const html = wo.vWorkout();
  const card = html.slice(html.indexOf('id="ex0"'), html.indexOf('id="ex1"'));
  assert.match(card, /<span class="set-h-assist">kg Unter&shy;stützung<\/span>/);
  assert.match(card, /Weniger Unterstützung: 25 kg/);
  assert.match(card, /aria-label="Satz 1 Unterstützung in kg"/);
  assert.match(card, /Bestwert<\/span> <b class="num">10 Wdh\. bei 30 kg Unterstützung<\/b>/);
  assert.match(card, /<div class="wu-slot" id="wu0"><\/div>/);
  assert.doesNotMatch(card, /wu-k/);
  assert.equal(S.active.ex[0].log[0].pw, '25');
  /* Mehr Wiederholungen mit weniger Unterstützung: Rekord samt Unterstützung */
  S.active.ex[0].log.forEach(s => { s.w = '25'; s.r = '11'; s.done = true; });
  S.active.ex.length = 1;
  finish();
  assert.equal(V.summary.volume, 0);
  assert.match(wo.vSummary(), /Wiederholungen <b class="num">11 Wdh\. bei 25 kg Unterstützung<\/b>/);
});

test('Muskeln: Nacken/Trapez und unterer Rücken ohne Ampel und ohne Zielzone, nicht in „x von y im Ziel“', () => {
  const now = Date.now();
  S.sessions.push({ id: 'k1', planId: 'split', dayId: 'pull', name: 'Pull', color: 'blue', startedAt: now - 3600e3, endedAt: now,
    ex: [{ exId: 'kreuzheben', name: 'Kreuzheben', unit: 'reps', sets: [{ w: 100, r: 5, rir: 2 }, { w: 100, r: 5, rir: 2 }] },
      { exId: 'bank', name: 'Bankdrücken', unit: 'reps', sets: Array.from({ length: 12 }, () => ({ w: 80, r: 8, rir: 2 })) }] });
  V.histView = 'muscles';
  V.histWeekBack = 0;
  const html = vHistory();
  const row = name => (html.match(new RegExp(`<li class="vol-row [a-z]+" aria-label="${name}[^"]*">[\\s\\S]*?</li>`)) || [''])[0];
  assert.match(row('Unterer Rücken'), /class="vol-row none"/);
  assert.match(row('Unterer Rücken'), /ohne Zielbereich/);
  assert.doesNotMatch(row('Unterer Rücken'), /vol-zone/);
  assert.match(row('Brust'), /class="vol-row ok"/);
  assert.match(row('Brust'), /vol-zone/);
  /* Brust im Ziel; Nacken/Trapez und unterer Rücken zählen bei „von“ nicht mit */
  const shown = (html.match(/<li class="vol-row /g) || []).length;
  const unrated = (html.match(/<li class="vol-row none"/g) || []).length;
  assert.ok(unrated >= 1);
  assert.match(html, new RegExp(`1 von ${shown - unrated} Muskelgruppen im Ziel`));
  assert.match(html, /Nacken\/Trapez und unterer Rücken ohne Zielbereich, sie arbeiten bei Grundübungen mit\./);
  V.histView = 'sessions';
});

test('Smart-Zirkel nur mit anderen Methoden: „Bestwert nur aus regulären Sätzen“ statt leerer Fläche', () => {
  S.plans[0].days.push.exercises.unshift({ id: 'smart-brustpresse', names: ['Brustpresse (Smart-Zirkel)'], sets: 2, repMin: 10, repMax: 15, rest: 60, inc: 0, unit: 'reps' });
  S.sessions.push({ id: 'sm1', planId: 'split', dayId: 'push', name: 'Push', color: 'red', startedAt: Date.now() - 2 * 864e5, endedAt: Date.now() - 2 * 864e5 + 36e5,
    ex: [{ exId: 'smart-brustpresse', name: 'Brustpresse (Smart-Zirkel)', unit: 'reps', sets: [{ w: 70, r: 12, rir: 2, m: 'negative' }, { w: 70, r: 11, rir: 2, m: 'adaptive' }] }] });
  wo.startWorkout('push');
  const html = wo.vWorkout();
  const card = html.slice(html.indexOf('id="ex0"'), html.indexOf('id="ex1"'));
  assert.match(card, /<p class="best best-none"><span class="best-k">Bestwert<\/span> nur aus regulären Sätzen<\/p>/);
  V.histView = 'records';
  assert.match(vHistory(), /Brustpresse \(Smart-Zirkel\)[\s\S]*?Bestwert nur aus regulären Sätzen/);
  V.histView = 'sessions';
  S.active = null;
});

test('Rekorde mit Gegengewicht nennen die Unterstützung', () => {
  S.sessions.push({ id: 'as1', planId: 'split', dayId: 'pull', name: 'Pull', color: 'blue', startedAt: Date.now() - 864e5, endedAt: Date.now() - 864e5 + 36e5,
    ex: [{ exId: 'dips-assistiert', name: 'Dips mit Unterstützung', unit: 'reps', sets: [{ w: 20, r: 9, rir: 2 }] }] });
  V.histView = 'records';
  const html = vHistory();
  assert.match(html, /Dips mit Unterstützung[\s\S]*?9 Wdh\. bei 20 kg Unterstützung/);
  const at = html.indexOf('<b>Dips mit Unterstützung</b>');
  assert.doesNotMatch(html.slice(at, html.indexOf('</li>', at)), /Volumen|1RM|Gewicht/);
  V.histView = 'sessions';
});
