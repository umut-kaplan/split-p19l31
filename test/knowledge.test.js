import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KNOWLEDGE, KNOWLEDGE_GROUPS, EVIDENCE_LABEL, findKnowledge } from '../js/data/knowledge.js';
import { knowledgeLink, showKnowledge, vKnowledge, KNOWLEDGE_NOTE, actions } from '../js/views/knowledge.js';
import { V } from '../js/state.js';

const GROUPS = KNOWLEDGE_GROUPS.map(g => g[0]);
/* Satzenden grob zählen: Punkt, Frage- oder Ausrufezeichen vor Leerzeichen oder Textende.
   „7.000“ und „1,6“ zählen so nicht mit, Abkürzungen wie „z. B.“ werden vorher entfernt. */
const sentences = s => (s.replace(/\b(z|d|u)\. ?[BhaÄ]\./g, '').match(/[.!?](?=\s|$)/g) || []).length;

test('Genau 20 Karten, jede id einmal und in kebab-case', () => {
  assert.equal(KNOWLEDGE.length, 20);
  const ids = KNOWLEDGE.map(k => k.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
  ids.forEach(id => assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, id));
});

test('Jede Karte hat eine gültige Gruppe, jede Gruppe mindestens eine Karte', () => {
  assert.deepEqual(GROUPS, ['schicht', 'ernaehrung', 'training']);
  KNOWLEDGE.forEach(k => assert.ok(GROUPS.includes(k.group), `${k.id}: Gruppe ${k.group}`));
  GROUPS.forEach(g => assert.ok(KNOWLEDGE.some(k => k.group === g), g + ' ist leer'));
});

test('Titel, Teaser und Text sind gefüllt; Teaser ein Satz, Text 2 bis 4 Sätze', () => {
  KNOWLEDGE.forEach(k => {
    ['title', 'teaser', 'text'].forEach(f => assert.ok(typeof k[f] === 'string' && k[f].trim(), `${k.id}: ${f} fehlt`));
    assert.equal(sentences(k.teaser), 1, `${k.id}: Teaser „${k.teaser}“`);
    const n = sentences(k.text);
    assert.ok(n >= 2 && n <= 4, `${k.id}: ${n} Sätze`);
    assert.ok(/[.!?]$/.test(k.text.trim()), `${k.id}: Text endet ohne Satzzeichen`);
  });
});

test('Satzzählung erkennt Zahlen und Abkürzungen nicht als Satzende', () => {
  assert.equal(sentences('Bis etwa 7.000 Schritte, z. B. beim Gehen. Mit 1,6 Gramm.'), 2);
});

test('Evidenz ist belegt oder abgeleitet und hat eine Beschriftung', () => {
  KNOWLEDGE.forEach(k => assert.ok(['belegt', 'abgeleitet'].includes(k.evidence), `${k.id}: ${k.evidence}`));
  assert.equal(EVIDENCE_LABEL.belegt, 'Gut belegt');
  assert.equal(EVIDENCE_LABEL.abgeleitet, 'Abgeleitet aus Studien zu verwandten Fragen');
});

test('Jede Karte nennt mindestens eine Quelle mit https-Adresse', () => {
  KNOWLEDGE.forEach(k => {
    assert.ok(Array.isArray(k.sources) && k.sources.length >= 1, `${k.id}: keine Quelle`);
    k.sources.forEach(s => {
      assert.ok(s.label && s.label.trim(), `${k.id}: Quelle ohne Namen`);
      assert.match(s.url, /^https:\/\/[^\s"<>]+$/, `${k.id}: ${s.url}`);
      assert.doesNotThrow(() => new URL(s.url), `${k.id}: ${s.url}`);
      /* DOI-Links in der Form https://doi.org/10.xxxx/… */
      if (s.url.startsWith('https://doi.org/')) assert.match(s.url, /^https:\/\/doi\.org\/10\.\d{4,9}\/\S+$/, `${k.id}: ${s.url}`);
    });
  });
});

test('Keine Heil- oder Leistungsversprechen', () => {
  const banned = /\bheilt\b|\bheilen\b|heilung|garantier|verhinder|vorbeug|therapie|behandel|wunder|immer schneller|sofort mehr/i;
  KNOWLEDGE.forEach(k => [k.title, k.teaser, k.text].forEach(t => assert.doesNotMatch(t, banned, `${k.id}: „${t}“`)));
});

test('Kreatin und Koffein ohne Dosierung', () => {
  const dose = /\bmg\b|milligramm|\d\s*(g|gramm)\b|pro (kilo|kg)|mg\/kg|g\/kg|täglich \d/i;
  const supp = KNOWLEDGE.filter(k => /kreatin|koffein/i.test(k.id + k.title));
  assert.equal(supp.length, 2);
  supp.forEach(k => [k.title, k.teaser, k.text].forEach(t => assert.doesNotMatch(t, dose, `${k.id}: „${t}“`)));
});

test('Karten sprechen mit du, nicht mit Sie', () => {
  KNOWLEDGE.forEach(k => [k.teaser, k.text].forEach(t => assert.doesNotMatch(t, /\b(Ihnen|Ihre[mnrs]?|Ihr)\b/, `${k.id}: „${t}“`)));
});

test('findKnowledge findet per id, sonst null', () => {
  assert.equal(findKnowledge('kreatin').title, 'Kreatin: gut untersucht');
  assert.equal(findKnowledge('gibt-es-nicht'), null);
});

test('knowledgeLink liefert einen Knopf, der die Karte öffnet', () => {
  const html = knowledgeLink('nach-nachtschicht-schlafen');
  assert.match(html, /^<button [^<>]*>[^<>]*<\/button>$/);
  assert.match(html, /\stype="button"/);
  assert.match(html, /\sdata-act="knowshow"/);
  assert.match(html, /\sdata-id="nach-nachtschicht-schlafen"/);
  assert.match(html, />Warum\?<\/button>$/);
  assert.match(html, /\saria-label="Warum\? \(Nach der Nachtschicht: erst schlafen\)"/);
  /* Jedes Attribut sauber in Anführungszeichen */
  const attrs = html.slice('<button '.length, html.indexOf('>'));
  assert.match(attrs, /^(\s*[a-z-]+="[^"]*")+$/);
});

test('knowledgeLink: eigene Beschriftung wird maskiert, unbekannte id ergibt nichts', () => {
  const html = knowledgeLink('kreatin', 'Mehr <dazu> & "so"');
  assert.match(html, />Mehr &lt;dazu&gt; &amp; &quot;so&quot;<\/button>$/);
  assert.doesNotMatch(html.slice(0, html.lastIndexOf('>', html.length - 10)), /<dazu>/);
  assert.equal(knowledgeLink('gibt-es-nicht'), '');
  assert.equal(knowledgeLink(undefined), '');
});

test('Die Aktion „knowshow“ öffnet das Sheet mit Überschrift, Text, Kennzeichen, Quellen und Hinweis', () => {
  const k = findKnowledge('nach-nachtschicht-schlafen');
  actions.knowshow({ dataset: { id: k.id } });
  const s = V.sheet;
  assert.equal(s.title, k.title);
  assert.ok(s.body.includes(k.text));
  assert.ok(s.body.includes('Abgeleitet aus Studien zu verwandten Fragen'));
  k.sources.forEach(src => assert.ok(s.body.includes(`<a href="${src.url}" target="_blank" rel="noopener">`), src.url));
  assert.ok(s.body.includes(KNOWLEDGE_NOTE));
  assert.equal(KNOWLEDGE_NOTE, 'Allgemeine Information, keine persönliche Beratung.');
  assert.deepEqual(s.actions.map(a => a.label), ['Schließen']);
  showKnowledge('kreatin');
  assert.ok(V.sheet.body.includes('Gut belegt'));
  showKnowledge('gibt-es-nicht');
  assert.equal(V.sheet.title, 'Kreatin: gut untersucht');
  V.sheet = null;
});

test('Die Liste zeigt drei Gruppen und jede Karte als Knopf mit Namen', () => {
  const html = vKnowledge();
  const heads = [...html.matchAll(/<h2 id="know-g-([a-z]+)">([^<]+)<\/h2>/g)].map(m => m[1]);
  assert.deepEqual(heads, GROUPS);
  const buttons = [...html.matchAll(/<button type="button" class="know-item" data-act="knowshow" data-id="([^"]+)"[^>]*aria-label="([^"]+)"/g)];
  assert.equal(buttons.length, 20);
  assert.deepEqual(buttons.map(m => m[1]), KNOWLEDGE_GROUPS.flatMap(([g]) => KNOWLEDGE.filter(k => k.group === g).map(k => k.id)));
  buttons.forEach(m => assert.equal(m[2], findKnowledge(m[1]).title.replace(/"/g, '&quot;')));
});
