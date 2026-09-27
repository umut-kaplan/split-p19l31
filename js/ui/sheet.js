import { V } from '../state.js';
import { esc } from '../util.js';
import { render } from '../render.js';

export function openSheet(o) { V.sheet = o; render(); }
export function closeSheet() { V.sheet = null; render(); }
export const confirmSheet = (title, text, label, fn, kind = 'danger') =>
  openSheet({ title, text, actions: [{ label, kind, fn }, { label: 'Abbrechen', kind: 'ghost', fn: closeSheet }] });

export function vSheet(tone) {
  const s = V.sheet;
  if (!s) return '';
  return `<div class="sheet-back" data-act="sheetclose"></div>
  <div class="sheet day-${tone}" role="dialog" aria-modal="true" aria-labelledby="sheet-t">
    <h2 id="sheet-t">${esc(s.title)}</h2>
    ${s.text ? `<p>${esc(s.text)}</p>` : ''}
    ${s.body || ''}
    <div class="sheet-actions">${s.actions.map((a, k) =>
      `<button class="btn ${a.kind || ''}" data-act="sheet" data-k="${k}">${esc(a.label)}</button>`).join('')}</div>
  </div>`;
}

export const actions = {
  sheet: el => { const a = V.sheet && V.sheet.actions[+el.dataset.k]; if (a) a.fn(); },
  sheetclose: closeSheet,
};
