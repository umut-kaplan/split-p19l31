import { V } from '../state.js';
import { esc } from '../util.js';
import { render } from '../render.js';

export function openSheet(o) { V.sheet = o; render(); }

/* ---------- Fokus ----------
   Beim Öffnen springt der Fokus ins Sheet (auf die Überschrift, wenn das Sheet nicht selbst ein Feld fokussiert),
   beim Schließen zurück auf den Knopf, der es geöffnet hat. Das Sheet kann auf vielen Wegen zugehen (Knopf, Wischgeste,
   Escape, Speichern), darum gleicht app.js nach jedem Zeichnen mit syncFocus() ab. Weil jedes Zeichnen die Seite neu
   aufbaut, merkt sich die App den Auslöser als Selektor samt Position und sucht ihn danach wieder. */
let lastTap = null;   // { sel, i } des zuletzt angetippten Bedienelements außerhalb eines Sheets
let opener = null;    // { sel, i } des Auslösers des offenen Sheets
let shown = null;     // zuletzt gezeichnetes Sheet

const cssEsc = v => String(v).replace(/["\\]/g, '\\$&');
/* Selektor aus id oder data-Attributen, z. B. button[data-act="qweight"] */
export function triggerSelector(tag, id, attrs) {
  if (id) return `#${cssEsc(id)}`;
  const data = attrs.filter(([k]) => k.startsWith('data-')).map(([k, v]) => `[${k}="${cssEsc(v)}"]`).join('');
  return data ? tag + data : null;
}
function describe(el) {
  if (!el || !el.isConnected) return null;
  const sel = triggerSelector(el.tagName.toLowerCase(), el.id, [...el.attributes].map(a => [a.name, a.value]));
  return sel ? { sel, i: [...document.querySelectorAll(sel)].indexOf(el) } : null;
}
const focusQuiet = el => { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } };

if (typeof document !== 'undefined') {
  document.addEventListener('click', ev => {
    /* Nur Knöpfe und Links: Ein Textfeld zurückzufokussieren öffnete die Tastatur */
    const t = ev.target && ev.target.closest && ev.target.closest('button, a, [data-act]');
    if (t && !t.closest('.sheet, .sheet-back')) lastTap = { ...describe(t), at: Date.now() };
  }, true);
}

export function syncFocus() {
  const s = V.sheet;
  const box = s && document.querySelector('.sheet');
  if (s && box && s !== shown) {
    /* Ein Sheet, das ohne Tipp aufgeht (z. B. „Neu in Split“ beim Start), hat keinen Auslöser */
    if (!shown) opener = lastTap && lastTap.sel && Date.now() - lastTap.at < 3000 ? lastTap : null;
    if (!box.contains(document.activeElement)) { const h = box.querySelector('#sheet-t'); if (h) focusQuiet(h); }
  } else if (!s && shown) {
    const list = opener ? [...document.querySelectorAll(opener.sel)] : [];
    const el = list[opener && opener.i >= 0 ? opener.i : 0] || list[0];
    if (el) focusQuiet(el);
    opener = null;
  }
  shown = box ? s : null;
}
export function closeSheet() { V.sheet = null; render(); }
export const confirmSheet = (title, text, label, fn, kind = 'danger') =>
  openSheet({ title, text, actions: [{ label, kind, fn }, { label: 'Abbrechen', kind: 'ghost', fn: closeSheet }] });

export function vSheet(tone) {
  const s = V.sheet;
  if (!s) return '';
  return `<div class="sheet-back" data-act="sheetclose"></div>
  <div class="sheet day-${tone}" role="dialog" aria-modal="true" aria-labelledby="sheet-t">
    <h2 id="sheet-t" tabindex="-1">${esc(s.title)}</h2>
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
