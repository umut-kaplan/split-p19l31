/* Wissen: kurze Karten mit ihren Quellen (js/data/knowledge.js), unter Training · Übungen per Umschalter „Übungen · Wissen“.
   knowledgeLink(id) setzt auf jeder Seite einen kleinen „Warum?“-Knopf, der die Karte als Sheet öffnet.
   app.js sammelt die Aktion „knowshow“ ein, sie gilt deshalb überall. */
import { esc } from '../util.js';
import { ICON } from '../ui/icons.js';
import { openSheet, closeSheet } from '../ui/sheet.js';
import { KNOWLEDGE, KNOWLEDGE_GROUPS, EVIDENCE_LABEL, findKnowledge } from '../data/knowledge.js';

export const KNOWLEDGE_NOTE = 'Allgemeine Information, keine persönliche Beratung.';

/* Kleiner Link-Knopf auf eine Karte, z. B. hinter einer Regel oder Begründung.
   Unbekannte id: leerer Text, damit ein Tippfehler keinen toten Knopf erzeugt. */
export function knowledgeLink(id, label = 'Warum?') {
  const k = findKnowledge(id);
  if (!k) return '';
  return `<button type="button" class="link know-link" data-act="knowshow" data-id="${esc(k.id)}" aria-haspopup="dialog"`
    + ` aria-label="${esc(`${label} (${k.title})`)}">${esc(label)}</button>`;
}

/* ---------- Liste ---------- */
const item = k => `<li><button type="button" class="know-item" data-act="knowshow" data-id="${esc(k.id)}" aria-haspopup="dialog"
    aria-label="${esc(k.title)}" aria-describedby="know-d-${esc(k.id)}">
    <span class="know-txt"><b>${esc(k.title)}</b><span id="know-d-${esc(k.id)}">${esc(k.teaser)}</span></span>${ICON.chevron}
  </button></li>`;

export function vKnowledge() {
  return `<div class="know">
    <p class="muted know-intro">Kurz erklärt, worauf die Vorschläge der App beruhen. Jede Karte nennt ihre Quellen.</p>
    ${KNOWLEDGE_GROUPS.map(([g, label]) => `<section class="know-group" aria-labelledby="know-g-${g}">
      <h2 id="know-g-${g}">${esc(label)}</h2>
      <ul class="know-list">${KNOWLEDGE.filter(k => k.group === g).map(item).join('')}</ul>
    </section>`).join('')}
    <p class="small-print know-foot">${KNOWLEDGE_NOTE} Bei Beschwerden, Vorerkrankungen oder Schlafproblemen hol dir ärztlichen Rat.</p>
  </div>`;
}

/* ---------- Karte ---------- */
export function showKnowledge(id) {
  const k = findKnowledge(id);
  if (!k) return;
  const n = k.sources.length;
  const body = `<div class="know-detail">
    <p class="know-text">${esc(k.text)}</p>
    <p class="know-ev ${k.evidence === 'belegt' ? 'solid' : 'derived'}">${esc(EVIDENCE_LABEL[k.evidence])}</p>
    <h3>${n === 1 ? 'Quelle' : 'Quellen'}</h3>
    <ul class="know-src">${k.sources.map(s =>
      `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul>
    <p class="small-print know-note">${KNOWLEDGE_NOTE}</p>
  </div>`;
  openSheet({ title: k.title, body, actions: [{ label: 'Schließen', kind: 'ghost', fn: closeSheet }] });
}

export const actions = {
  knowshow: el => showKnowledge(el.dataset.id),
};
