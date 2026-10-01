/* Bausteine für Wege durch die App: „‹ Zurück“ oben links und Zeilen, die eine Unterseite öffnen. */
import { esc } from '../util.js';
import { ICON } from './icons.js';

/* „‹ Zurück“ auf jeder Unterseite. Schließt die oberste Ebene, genau wie die Wischgeste vom linken Rand
   (js/nav.js, views/navigation.js). Der Winkel kommt aus dem CSS (.back-link::before), damit Vorlesen nur „Zurück“ sagt.
   act: eigene Aktion statt „back“, wenn eine Seite beim Schließen mehr tun muss. */
export const backLink = (act = 'back') =>
  `<div class="back-row"><button type="button" class="link back-link" data-act="${esc(act)}">Zurück</button></div>`;

/* Zeile mit Name, einer Zeile Erklärung und Pfeil. attrs: data-act und Co. als fertiger Text. */
export const navRow = (title, hint, attrs, cls = '') =>
  `<button type="button" class="nav-row ${esc(cls)}" ${attrs}><span class="nav-row-t"><b>${esc(title)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span>${ICON.chevron}</button>`;

/* Einstieg in „Vergleichen“ aus Training, Erfolge und Wochenbericht. In der laufenden Einheit steht die kurze Fassung,
   damit die Zeile auch bei 320 px einzeilig bleibt. */
export const COMPARE_TITLE = 'Mit Trainingspartner vergleichen (QR-Code)';
export const COMPARE_SHORT = 'Mit Partner vergleichen';
export const compareRow = (hint = 'Rekorde und Serie, direkt von Handy zu Handy', title = COMPARE_TITLE) =>
  navRow(title, hint, 'data-act="cmpopen"', 'cmp-go');
