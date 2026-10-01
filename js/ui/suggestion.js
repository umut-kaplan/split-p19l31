import { S, save } from '../state.js';
import { esc } from '../util.js';
import { render } from '../render.js';
import { pendingSuggestions, decide } from '../coach/index.js';
import { toast } from './toast.js';

/* Karten für offene Vorschläge eines Bereichs (oder aller, wenn area null ist) */
export function suggestionCards(area = null, limit = 99) {
  return suggestionCardList(area, limit).join('');
}

/* Dasselbe als Liste, eine Karte je Eintrag */
export function suggestionCardList(area = null, limit = 99) {
  const list = pendingSuggestions(S, Date.now(), area).slice(0, limit);
  return list.map(s => `<section class="card suggestion">
    <h2>${esc(s.title)}</h2>
    <p class="muted">${esc(s.reason)}</p>
    <div class="sug-btns">
      <button class="btn small primary" data-act="sugaccept" data-id="${esc(s.id)}">${esc(s.acceptLabel || 'Übernehmen')}</button>
      <button class="btn small ghost" data-act="sugdecline" data-id="${esc(s.id)}">Ablehnen</button>
    </div>
  </section>`);
}

const find = id => pendingSuggestions(S, Date.now()).find(s => s.id === id);

export const actions = {
  sugaccept: el => { const s = find(el.dataset.id); if (!s) return; decide(S, s, 'accepted'); save(); render(); toast('Übernommen'); },
  sugdecline: el => { const s = find(el.dataset.id); if (!s) return; decide(S, s, 'declined'); save(); render(); toast('Abgelehnt'); },
};
