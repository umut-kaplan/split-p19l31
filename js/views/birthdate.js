/* Geburtsdatum: Feld für Einrichtung und Profil, Karte auf „Heute“ für Bestandsnutzer mit Alter.
   Logik in domain/birthdate.js. Das Feld speichert sofort und zeichnet die Seite dabei nicht neu,
   sonst schlösse sich auf dem iPhone der Datumswähler. */
import { S, V, save } from '../state.js';
import { esc, ymd } from '../util.js';
import { render } from '../render.js';
import { ageFrom, birthDateProblem, birthPromptDue, cleanBirthDate, yearsText, PROBLEM_TEXT, MIN_DATE } from '../domain/birthdate.js';

const ageText = p => { const a = ageFrom(p.birthDate); return a == null ? '' : yearsText(a); };
/* Hinweis unter dem Feld, solange nur das alte Alter da ist */
const fallbackText = p => (!cleanBirthDate(p.birthDate) && p.age > 0
  ? `Bisher rechnet die App mit ${p.age} Jahren. Mit dem Geburtsdatum stimmt es auch nächstes Jahr.` : '');

export const fBirth = p => `<div class="field bd-field">
  <label for="pf-birth">Geburtsdatum</label>
  <div class="bd-row">
    <input id="pf-birth" type="date" data-in="pbirth" min="${MIN_DATE}" max="${ymd()}" value="${esc(cleanBirthDate(p.birthDate) || '')}" autocomplete="bday" aria-describedby="pf-birth-msg">
    <span class="bd-age num" id="pf-birth-age" aria-live="polite">${esc(ageText(p))}</span>
  </div>
  <p class="small-print bd-msg" id="pf-birth-msg" aria-live="polite">${esc(fallbackText(p))}</p>
</div>`;

function paint(msg, warn) {
  const age = document.getElementById('pf-birth-age');
  const out = document.getElementById('pf-birth-msg');
  if (age) age.textContent = warn ? '' : ageText(S.profile);
  if (out) { out.textContent = msg; out.classList.toggle('warn', !!warn); }
}

export function birthCard() {
  if (!birthPromptDue(S, Date.now())) return '';
  return `<section class="block card notice bd-card">
    <h2>Geburtsdatum</h2>
    <p style="margin-bottom:0">Trag dein Geburtsdatum ein, dann stimmt dein Kalorienbedarf auch nächstes Jahr.</p>
    <div class="sug-btns">
      <button class="btn small primary" data-act="bdgo">Eintragen</button>
      <button class="btn small ghost" data-act="bdlater">Später</button>
    </div>
  </section>`;
}

export const actions = {
  /* Zum Profil und ins Feld. Unterseiten schließen wie ein Tipp auf die Navigation. */
  bdgo: () => {
    Object.assign(V, { tab: 'profile', setView: null, motView: null, repView: null, cmpView: null, shiftView: null });
    render();
    const f = document.getElementById('pf-birth');
    if (!f) return;
    f.scrollIntoView({ block: 'center' });
    try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
  },
  bdlater: () => { S.settings.birthPromptSnoozedAt = Date.now(); save(); render(); },
};

export const inputs = {
  pbirth: (el, type) => {
    if (type !== 'change') return;
    const v = el.value;
    if (!v) { S.profile.birthDate = null; save(); paint(fallbackText(S.profile)); return; }
    const problem = birthDateProblem(v, Date.now());
    /* Ohne Toast: Auf dem iPhone kommt beim Drehen am Datumswähler jeder Zwischenstand an */
    if (problem) { paint(PROBLEM_TEXT[problem], true); return; }
    S.profile.birthDate = v;
    save();
    paint('');
  },
};
