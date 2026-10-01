process.env.TZ = 'Europe/Berlin';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, TEMPLATE_GROUPS, templateById, templateOf, staffed } from '../js/domain/shift-templates.js';
import { TEMPLATE_28, DEFAULT_TYPES, TYPE_TIMES, isTimedCat, PATTERN_MIN, PATTERN_MAX } from '../js/domain/shifts.js';

const ids = () => TEMPLATES.flatMap(t => [t.id, ...(t.variants || []).map(v => v.id)]);
const lcm = (a, b) => { const g = (x, y) => (y ? g(y, x % y) : x); return a / g(a, b) * b; };
const WORK = DEFAULT_TYPES.filter(t => isTimedCat(t.cat)).map(t => t.id);

test('13 Vorlagen mit Gruppe, Namen und Beschreibung; ids eindeutig; t28 bleibt', () => {
  assert.equal(TEMPLATES.length, 13);
  const all = ids();
  assert.equal(new Set(all).size, all.length);
  TEMPLATES.forEach(t => {
    assert.ok(TEMPLATE_GROUPS.some(([g]) => g === t.group), t.id);
    assert.ok(t.name && t.desc && t.where, t.id);
  });
  const t28 = templateById('t28');
  assert.equal(t28.days.join(''), TEMPLATE_28.days.join(''));
  assert.deepEqual([t28.groups, t28.offset], [4, 7]);
});

test('Ketten, Gruppen und Versatz wie in der Recherche', () => {
  const expect = {
    w2: ['FFFFF--SSSSS--', 2, 7], w3v: ['FFFFF--SSSSS--NNNNN--', 3, 7], 'w3v-so': ['FFFFF--SSSSS-NNNNN---', 3, 7],
    w3r: ['NNNNN--SSSSS--FFFFF--', 3, 7], k4: ['FFSSNN--', 4, 2], t28: ['FFSSSNN--FFFSSNN---FFSSNNN--', 4, 7],
    k4w: ['FFFFFFFSSSSSSSNNNNNNN-------', 4, 7], k5: ['FFSSNN----', 5, 2], k5d: ['FFFSSNN---FFSSNNN--FFSSSNN-DDDDDDD-', 5, 7],
    h12: ['TN--', 4, 1], 'h12-3': ['TN-', 3, 1], h12b: ['TTNN----', 4, 2], fw24: ['X--', 3, 1],
    fwb: ['X--X-X--X--X-X--X----', 3, 7], dn: ['NNNNN--', 1, 7], 'dn-so': ['NNNN--N', 1, 7],
  };
  assert.deepEqual(ids().sort(), Object.keys(expect).sort());
  Object.entries(expect).forEach(([id, [chain, groups, offset]]) => {
    const t = templateById(id);
    assert.deepEqual([t.days.join(''), t.groups, t.offset], [chain, groups, offset], id);
    assert.ok(t.days.length >= PATTERN_MIN && t.days.length <= PATTERN_MAX, id);
    /* Nur Codes der voreingestellten Arten */
    t.days.forEach(c => assert.ok(DEFAULT_TYPES.some(d => d.id === c), `${id}: ${c}`));
  });
});

test('Mit allen Gruppen ist jede Schicht an jedem Tag genau einmal besetzt', () => {
  ids().forEach(id => {
    const t = templateById(id);
    const codes = [...new Set(t.days)].filter(c => WORK.includes(c));
    /* Über ein kleinstes gemeinsames Vielfaches von Zyklus und Woche, damit auch die Wochentage durchlaufen */
    const span = lcm(t.days.length, 7) * t.groups;
    for (let d = 0; d < span; d++) {
      codes.forEach(c => {
        /* Bei Mo–Fr-Modellen ist Tag 1 ein Montag; an den übrigen Tagen arbeitet niemand in dieser Schicht */
        const want = t.cover && t.cover[c] ? (t.cover[c].includes(d % 7) ? 1 : 0) : 1;
        assert.equal(staffed(t.days, t.groups, t.offset, d, c), want, `${id}: ${c} am Tag ${d + 1}`);
      });
    }
  });
});

test('Mo–Fr-Vorlagen beginnen am Montag, Varianten tragen ihre Beschriftung', () => {
  assert.deepEqual(TEMPLATES.filter(t => t.weekStart).map(t => t.id), ['w2', 'w3v', 'w3r', 'dn']);
  const so = templateById('w3v-so');
  assert.equal(so.base, 'w3v');
  assert.equal(so.variant, 'Nachtwoche beginnt Sonntag 22 Uhr');
  assert.equal(so.weekStart, true);
  /* Nächte Sonntag bis Donnerstag: Tag 7 der zweiten Woche ist ein Sonntag */
  assert.deepEqual(so.days.map((c, i) => (c === 'N' ? i % 7 : null)).filter(x => x != null), [6, 0, 1, 2, 3]);
  assert.equal(templateById('h12-3').groups, 3);
  assert.equal(templateById('dn-so').days.join(''), 'NNNN--N');
  assert.equal(templateById('gibtsnicht'), null);
});

test('Jede Vorlage bringt Zeiten für ihre Arbeitsschichten mit', () => {
  ids().forEach(id => {
    const t = templateById(id);
    [...new Set(t.days)].filter(c => WORK.includes(c)).forEach(c => assert.ok(t.times[c], `${id}: ${c}`));
  });
  assert.deepEqual(templateById('h12').times, { T: ['06:00', '18:00'], N: ['18:00', '06:00'] });
  assert.deepEqual(templateById('h12b').times, { T: ['07:00', '19:00'], N: ['19:00', '07:00'] });
  assert.deepEqual(templateById('fw24').times, { X: ['07:00', '07:00'] });
  assert.deepEqual(templateById('k5').times, { F: TYPE_TIMES.F, S: TYPE_TIMES.S, N: TYPE_TIMES.N });
});

test('templateOf erkennt nur unveränderte Vorlagen', () => {
  assert.equal(templateOf({ start: '2026-10-05', days: [...TEMPLATE_28.days], template: 't28' }).id, 't28');
  const changed = [...TEMPLATE_28.days];
  changed[3] = 'U';
  assert.equal(templateOf({ start: '2026-10-05', days: changed, template: 't28' }), null);
  assert.equal(templateOf({ start: '2026-10-05', days: [...TEMPLATE_28.days], template: null }), null);
  assert.equal(templateOf(null), null);
});
