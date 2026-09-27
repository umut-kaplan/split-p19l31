/* Bewertung nach der Einheit: „Wie hart war es?“ 1 bis 10 und eine Notiz. Gespeichert am Training als rating: { rpe, note, at }.
   In der Zusammenfassung speichert ein Tipp auf die Zahl sofort; im Verlauf lässt sich die Bewertung nachträglich ändern. */
import { S, V, save } from '../state.js';
import { esc, dMid } from '../util.js';
import { RPE_LABEL, makeRating, validRpe } from '../domain/rating.js';
import { NOTE_MAX } from '../domain/notes.js';
import { openSheet, closeSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

const sessionById = id => S.sessions.find(s => s.id === id);
const labelText = rpe => (validRpe(rpe) ? `${rpe} von 10: ${RPE_LABEL[rpe]}` : 'Tippe eine Zahl an.');

/* Auswahl 1 bis 10 in zwei Reihen. ctx: 'sum' (Zusammenfassung) oder 'edit' (Sheet im Verlauf) */
function picker(rpe, ctx, id) {
  return `<div class="rate-grid" role="radiogroup" aria-label="Wie hart war es, 1 bis 10">
    ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button class="rate-n num ${n === rpe ? 'on' : ''}" role="radio" aria-checked="${n === rpe}"
      data-act="rateset" data-ctx="${ctx}" data-id="${esc(id)}" data-v="${n}" aria-label="${n} von 10, ${RPE_LABEL[n]}">${n}</button>`).join('')}
  </div>
  <p class="rate-label" data-rate-label="${ctx}" aria-live="polite">${esc(labelText(rpe))}</p>
  <p class="small-print">1 sehr locker, 5 mittel, 10 am Limit. 9 oder 10 macht die Ampel für zwei Tage gelb.</p>`;
}

/* Nur die geänderten Knöpfe umschalten, damit die Seite nicht neu gezeichnet wird */
function markPicked(ctx, rpe) {
  document.querySelectorAll(`[data-act="rateset"][data-ctx="${ctx}"]`).forEach(b => {
    const on = Number(b.dataset.v) === rpe;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  });
  const l = document.querySelector(`[data-rate-label="${ctx}"]`);
  if (l) l.textContent = labelText(rpe);
}

function writeRating(s, rpe, note) {
  const r = makeRating(rpe, note, Date.now());
  if (r) s.rating = r; else delete s.rating;
  save();
}

/* Block in der Zusammenfassung nach „Beenden“. sessionId: id des gerade gespeicherten Trainings */
export function ratingBlock(sessionId) {
  const s = sessionById(sessionId);
  if (!s) return '';
  const r = s.rating || {};
  return `<section class="card rate-card">
    <h2>Wie hart war es?</h2>
    <p class="muted">Deine Einschätzung für die ganze Einheit. Überspringen geht auch.</p>
    ${picker(r.rpe, 'sum', s.id)}
    <label class="field rate-note">Notiz (optional)
      <textarea id="rate-sum-note" data-in="ratenote" data-id="${esc(s.id)}" maxlength="${NOTE_MAX}" rows="2" placeholder="z. B. Schulter gezwickt, wenig geschlafen">${esc(r.note || '')}</textarea></label>
    <div class="sug-btns"><button class="btn small" data-act="ratesave" data-id="${esc(s.id)}">Bewertung speichern</button></div>
  </section>`;
}

/* Bewertung im Verlauf: Anzeige mit „ändern“ */
export function ratingSummary(s) {
  const r = s.rating;
  const has = r && (validRpe(r.rpe) || r.note);
  return `<div class="rate-hist">
    ${has ? `${validRpe(r.rpe) ? `<p><b class="num">${r.rpe} von 10</b> <span class="muted">${esc(RPE_LABEL[r.rpe])}</span></p>` : ''}
      ${r.note ? `<p class="rate-hist-note">${esc(r.note)}</p>` : ''}` : '<p class="muted">Noch nicht bewertet.</p>'}
    <button class="link" data-act="rateedit" data-id="${esc(s.id)}">${has ? 'Bewertung ändern' : 'Bewerten'}</button>
  </div>`;
}

/* Kleine Marke „9/10“ neben dem Namen in der Liste */
export function ratingBadge(s) {
  const r = s.rating;
  return r && validRpe(r.rpe) ? `<span class="rate-badge num ${r.rpe >= 9 ? 'hard' : ''}" aria-label="Bewertung ${r.rpe} von 10">${r.rpe}/10</span>` : '';
}

function openEdit(id) {
  const s = sessionById(id);
  if (!s) return;
  const r = s.rating || {};
  V.rateEdit = { id, rpe: validRpe(r.rpe) ? r.rpe : null };
  const actions = [{
    label: 'Bewertung speichern', kind: 'primary', fn: () => {
      const note = (document.getElementById('rate-edit-note') || {}).value || '';
      writeRating(s, V.rateEdit.rpe, note);
      V.rateEdit = null;
      closeSheet(); toast('Bewertung gespeichert');
    },
  }];
  if (s.rating) {
    actions.push({ label: 'Bewertung entfernen', kind: 'danger', fn: () => { delete s.rating; save(); V.rateEdit = null; closeSheet(); toast('Bewertung entfernt'); } });
  }
  actions.push({ label: 'Abbrechen', kind: 'ghost', fn: () => { V.rateEdit = null; closeSheet(); } });
  openSheet({
    title: 'Wie hart war es?',
    text: `${s.name}, ${dMid(s.startedAt)}`,
    body: `${picker(V.rateEdit.rpe, 'edit', id)}
      <label class="field rate-note">Notiz (optional)
        <textarea id="rate-edit-note" maxlength="${NOTE_MAX}" rows="2" placeholder="z. B. Schulter gezwickt, wenig geschlafen">${esc(r.note || '')}</textarea></label>`,
    actions,
  });
}

export const actions = {
  rateset: el => {
    const v = Number(el.dataset.v);
    if (!validRpe(v)) return;
    if (el.dataset.ctx === 'edit') {
      if (V.rateEdit) V.rateEdit.rpe = v;
      markPicked('edit', v);
      return;
    }
    const s = sessionById(el.dataset.id);
    if (!s) return;
    const note = (document.getElementById('rate-sum-note') || {}).value;
    writeRating(s, v, note != null ? note : (s.rating && s.rating.note) || '');
    markPicked('sum', v);
  },
  ratesave: el => {
    const s = sessionById(el.dataset.id);
    if (!s) return;
    const note = (document.getElementById('rate-sum-note') || {}).value || '';
    const rpe = s.rating && validRpe(s.rating.rpe) ? s.rating.rpe : null;
    if (rpe == null && !note.trim()) { toast('Tippe zuerst eine Zahl von 1 bis 10 an'); return; }
    writeRating(s, rpe, note);
    toast('Bewertung gespeichert');
  },
  rateedit: el => openEdit(el.dataset.id),
};

export const inputs = {
  /* Notiz in der Zusammenfassung wird beim Tippen mitgespeichert, ohne neu zu zeichnen */
  ratenote: (el, type) => {
    const s = sessionById(el.dataset.id);
    if (!s || (type !== 'input' && type !== 'change')) return;
    const rpe = s.rating && validRpe(s.rating.rpe) ? s.rating.rpe : null;
    writeRating(s, rpe, el.value);
  },
};
