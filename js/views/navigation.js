/* Verbindung von js/nav.js zur App: welche Ebenen gerade sichtbar sind, was beim Schließen zusätzlich passiert,
   die Aktion „back“ für „‹ Zurück“ und der Abgleich mit dem Browser-Verlauf nach jedem Zeichnen. */
import { S, V } from '../state.js';
import { render } from '../render.js';
import { layers, closeTop, closeTo, openTab, historySync } from '../nav.js';
import { bindEdgeSwipe } from '../ui/edge-swipe.js';
import { hasShiftPlan } from '../domain/shifts.js';
import { stopScanner } from './compare-scan.js';
import { stopCamera } from './food-scan.js';

/* Was gerade gezeichnet wird: Einrichtung, Wiederherstellen und Zusammenfassung haben keine Unterseiten */
const ctx = () => ({
  app: !V.recover && !!S.settings && !!S.settings.onboardingDone && !V.summary,
  active: !!S.active,
  shiftOn: hasShiftPlan(S.shifts),
});

const blur = () => { const f = document.activeElement; if (f && f.blur) f.blur(); };
/* Beim Schließen: Kamera aus, Tastatur zu */
const HOOKS = {
  compare: () => stopScanner(),
  'compare-scan': () => stopScanner(),
  food: v => { const s = v.foodStack; if (s && s.length && s[s.length - 1].kind === 'scan') stopCamera(); blur(); },
  settings: blur,
  'settings-sub': blur,
};

const hist = historySync(window, {
  count: () => layers(V, ctx()).length,
  backTo: n => closeTo(V, n, ctx(), HOOKS),
  redraw: y => { render(); window.scrollTo(0, y || 0); },
});

/* Nach jedem Zeichnen; y = Scrollposition vor dem Zeichnen */
export const syncHistory = y => hist.sync(y);
export const startHistory = () => {
  hist.start();
  /* Home-Bildschirm-App: Wischen vom linken Rand wie „‹ Zurück“, nur wenn es eine Ebene gibt */
  bindEdgeSwipe(window, { canGoBack: () => layers(V, ctx()).length > 0, goBack: () => actions.back() });
};

/* Tab-Tipp: Startseite des Bereichs, alle Unterseiten zu */
export function goTab(tab, opts) {
  openTab(V, tab, opts, HOOKS);
}

export const actions = {
  /* „‹ Zurück“: oberste Ebene schließen und zur Stelle der Seite darunter springen, an der man sie verlassen hat */
  back: () => {
    if (!closeTop(V, ctx(), HOOKS)) return;
    const n = layers(V, ctx()).length;
    render();
    window.scrollTo(0, hist.scrollOf(n) || 0);
  },
};
