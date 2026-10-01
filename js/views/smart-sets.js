/* Smart-Zirkel in der laufenden Einheit (4.7): kurzer Hinweis statt Gewichtsvorschlag, ein Chip „Methode“ an der
   Übungskarte für alle Sätze, je Satz überschreibbar im Sheet, ein Schild unter Sätzen mit eigener Methode.
   Nur Bausteine zum Zeichnen; die Aktionen stehen in workout.js (Rekorde neu prüfen), die Regeln in domain/smart-sets.js. */
import { esc } from '../util.js';
import { SET_METHODS, setMethod, setName } from '../domain/settypes.js';
import { METHOD_IDS, METHOD_HINTS, cardMethod, methodOf, methodName, overridden } from '../domain/smart-sets.js';

export const AUTO_HINT = 'Das Gerät stellt das Gewicht ein – trag ein, was es anzeigt.';
export const AUTO_MISSING = 'Trag das Gewicht ein, das das Gerät anzeigt.';

/* Statt Gewichtsvorschlag */
export const autoHint = () => `<div class="hint auto">${esc(AUTO_HINT)}</div>`;

/* Chip an der Übungskarte: Methode für alle Sätze, daneben wie viele Sätze eine eigene haben */
export function methodChip(x, i) {
  const name = methodName(cardMethod(x));
  const n = (x.log || []).filter(s => overridden(x, s)).length;
  const other = n ? `${n} ${n === 1 ? 'Satz' : 'Sätze'} anders` : '';
  return `<div class="sm-row"><button class="sm-chip" data-act="smethod" data-i="${i}" aria-haspopup="dialog"
      aria-label="Methode ${esc(name)}${other ? `, ${other}` : ''}. Tippen zum Ändern"><small>Methode</small>${esc(name)}</button>${other
    ? `<span class="sm-note">${esc(other)}</span>` : ''}</div>`;
}

/* Schild unter einem Satz, dessen Methode von der Karte abweicht */
export const methodTag = (x, s) => (overridden(x, s) ? `<span class="set-m">${esc(methodName(methodOf(x, s)))}</span>` : '');

/* Inhalt des Sheets: oben die Methode für alle Sätze, darunter je Satz eine eigene */
export function methodSheetBody(x, i) {
  const cur = cardMethod(x) || 'regular';
  return `<div class="sm-sheet">
    <p class="label">Für alle Sätze</p>
    <div class="choices" role="radiogroup" aria-label="Methode für alle Sätze">${METHOD_IDS.map(m => `
      <button class="choice ${m === cur ? 'on' : ''}" role="radio" aria-checked="${m === cur}" data-act="smethodall" data-i="${i}" data-v="${m}">
        <b>${esc(SET_METHODS[m])}</b><span>${esc(METHOD_HINTS[m])}</span></button>`).join('')}</div>
    <p class="label">Einzelne Sätze</p>
    <div class="sm-sets">${(x.log || []).map((s, j) => `
      <label class="field">${esc(setName(x.log, j))}<select data-in="smset" data-i="${i}" data-j="${j}">
        <option value="" ${setMethod(s) ? '' : 'selected'}>wie alle (${esc(SET_METHODS[cur])})</option>
        ${METHOD_IDS.map(m => `<option value="${m}" ${setMethod(s) === m ? 'selected' : ''}>${esc(SET_METHODS[m])}</option>`).join('')}
      </select></label>`).join('')}</div>
    <p class="small-print" style="margin-top:12px">Rekorde zählen nur aus Sätzen mit „Regulär“. Fürs Wochenvolumen zählt jeder Satz.</p>
  </div>`;
}
