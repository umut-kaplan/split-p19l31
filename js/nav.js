/* Unterseiten und Zurück, ohne DOM (per node --test geprüft).
   Jede offene Unterseite und ein offenes Sheet ist eine Ebene. layers() zählt sie aus dem Ansichtszustand V,
   closeTop() schließt die oberste, closeAll() alle (Tipp auf einen Tab). historySync() hält für jede Ebene genau
   einen Eintrag im Browser-Verlauf: Die Wischgeste vom linken Rand, die Android-Zurücktaste und Browser-Zurück
   gehen so eine Ebene zurück, genau wie „‹ Zurück“ oben links. Die Verbindung zur App steht in views/navigation.js. */

/* Ebenen in fester Reihenfolge von unten nach oben.
   on(V, c): offen? Bei Stapeln count(V, c) statt on. close(V): schließt nur diese eine Ebene.
   c: { app: normale Seite statt Einrichtung oder Zusammenfassung, active: läuft ein Training, shiftOn: gibt es einen Schichtplan } */
export const LAYERS = [
  /* Heute: Wochenbericht und Erfolge ersetzen die Startseite, Erfolge liegt oben, wenn beide offen sind */
  { id: 'report', on: V => V.tab === 'today' && V.repView != null, close: V => { V.repView = null; } },
  { id: 'goals', on: V => V.tab === 'today' && V.motView === 'goals', close: V => { V.motView = null; V.badgeFresh = null; } },
  /* Training: ein Tag, geöffnet über den Stift an seiner Karte. Ein laufendes Training zeigt die Einheit. */
  { id: 'planday', on: (V, c) => V.tab === 'training' && !c.active && !!V.planEdit, close: V => { V.planEdit = null; } },
  /* Profil: Einstellungen, darüber eine ihrer Unterseiten */
  { id: 'settings', on: V => V.tab === 'profile' && !!V.setView, close: V => { V.setView = null; } },
  { id: 'settings-sub', on: V => V.tab === 'profile' && !!V.setView && V.setView !== 'main', close: V => { V.setView = 'main'; } },
  /* Ernährung: Suche, Scanner und Formulare liegen als Stapel übereinander, jede Ansicht ist eine Ebene.
     Kam die unterste Ansicht aus einem anderen Bereich (from, z. B. „+ Essen“ auf Heute), führt ihr Schließen dorthin zurück */
  {
    id: 'food', count: V => (V.tab === 'nutrition' && Array.isArray(V.foodStack) ? V.foodStack.length : 0),
    close: V => { const v = V.foodStack.pop(); if (v && v.from && !V.foodStack.length) V.tab = v.from; },
  },
  /* Vergleichen und Schichtplan liegen über jedem Bereich; app.js zeigt den Schichtplan vor dem Vergleich */
  { id: 'compare', on: V => !!V.cmpView, close: V => { V.cmpView = null; } },
  { id: 'compare-scan', on: V => V.cmpView === 'scan', close: V => { V.cmpView = 'main'; } },
  {
    id: 'shift', on: V => !!V.shiftView,
    close: V => { Object.assign(V, { shiftView: null, shiftImport: null, shiftDraft: null, shiftType: null, shiftFit: null }); },
  },
  /* „Muster ändern“ liegt über den Einstellungen des Schichtplans; ohne Plan ist die Einrichtung die Seite selbst */
  {
    id: 'shift-setup',
    on: (V, c) => !!c.shiftOn && (V.shiftView === 'setup' || (V.shiftView === 'type' && !!V.shiftType && V.shiftType.back === 'setup')),
    close: V => { Object.assign(V, { shiftView: 'settings', shiftDraft: null, shiftType: null, shiftImport: null }); },
  },
  { id: 'shift-type', on: V => V.shiftView === 'type' && !!V.shiftType, close: V => { V.shiftView = V.shiftType.back || 'settings'; V.shiftType = null; } },
  /* Ein Sheet liegt immer ganz oben, auch in der Einrichtung */
  { id: 'sheet', always: true, on: V => !!V.sheet, close: V => { V.sheet = null; } },
];

const countOf = (l, V, c) => {
  if (!c.app && !l.always) return 0;
  return l.count ? l.count(V, c) : l.on(V, c) ? 1 : 0;
};
const ctxOf = c => ({ app: true, active: false, shiftOn: false, ...c });

/* Offene Ebenen von unten nach oben, z. B. ['settings', 'settings-sub', 'sheet'] */
export function layers(V, c = {}) {
  const cx = ctxOf(c);
  return LAYERS.flatMap(l => Array(countOf(l, V, cx)).fill(l.id));
}
export const depth = (V, c = {}) => layers(V, c).length;

/* Oberste Ebene schließen. hooks[id](V) läuft vorher, z. B. um eine Kamera auszuschalten. Liefert die id oder null. */
export function closeTop(V, c = {}, hooks = {}) {
  const cx = ctxOf(c);
  for (let i = LAYERS.length - 1; i >= 0; i--) {
    const l = LAYERS[i];
    if (!countOf(l, V, cx)) continue;
    if (hooks[l.id]) hooks[l.id](V);
    l.close(V);
    return l.id;
  }
  return null;
}

/* Ebenen schließen, bis höchstens n offen sind. Jede Ebene schließt sich garantiert, die Schranke fängt nur Fehler ab. */
export function closeTo(V, n, c = {}, hooks = {}) {
  for (let guard = 0; guard < 64 && depth(V, c) > n; guard++) if (!closeTop(V, c, hooks)) break;
}
export const closeAll = (V, c = {}, hooks = {}) => closeTo(V, 0, c, hooks);

/* Startseite eines Bereichs: Reiter und Umschalter auf den ersten (Einheit, Gewicht, Ernährung von heute) */
export const FIRST_SUB = {
  training: V => { V.trainSub = 'start'; V.libMode = 'list'; V.histView = 'sessions'; },
  body: V => { V.bodySub = 'weight'; },
  nutrition: V => { V.nutDate = null; },
};

/* Tipp auf einen Tab: immer die Startseite des Bereichs, alle Unterseiten zu (auch der Stapel der Ernährung),
   Reiter auf den ersten. Nur ein gezielter Sprung mit sub (z. B. „Übungen eintragen“ auf Heute) wählt einen anderen.
   Unbedingt ohne c.app-Einschränkung: auch verdeckte Unterseiten anderer Bereiche schließen. */
export function openTab(V, tab, { sub, day } = {}, hooks = {}) {
  closeAll(V, { app: true, active: false, shiftOn: true }, hooks);
  if (Array.isArray(V.foodStack) && V.foodStack.length) V.foodStack = [];
  V.motView = null; V.repView = null; V.setView = null; V.cmpView = null; V.shiftView = null; V.planEdit = null;
  V.tab = tab;
  if (tab === 'training' && sub) V.trainSub = sub;
  else if (FIRST_SUB[tab]) FIRST_SUB[tab](V);
  if (tab === 'training' && day) V.planDay = day;
  if (tab === 'today') V.roll = true;
}

/* ---------- Browser-Verlauf ----------
   win: window (oder ein Nachbau im Test). count(): offene Ebenen jetzt. backTo(n): Ebenen schließen, bis n offen sind.
   redraw(y): neu zeichnen und zur Scrollposition y der Seite darunter springen.
   Jede Ebene bekommt beim Öffnen genau einen Eintrag { splitNav: Tiefe }. Schließt die App eine Ebene selbst
   („‹ Zurück“, Speichern, Tab), geht sie im Verlauf mit history.go zurück und überhört das folgende popstate.
   Neuzeichnen ohne neue Ebene ändert am Verlauf nichts. */
export const NAV_KEY = 'splitNav';
export function historySync(win, { count, backTo, redraw }) {
  const h = win.history;
  const level = s => (s && typeof s[NAV_KEY] === 'number' ? s[NAV_KEY] : 0);
  let cur = 0;        // Einträge der App über dem Grundeintrag
  let skip = 0;       // eigene history.go-Sprünge, deren popstate noch aussteht
  let dirty = false;  // während eines Sprungs geöffnete Ebenen: danach eintragen
  let timer = null;
  const ys = [];      // ys[n]: Scrollposition der Seite auf Tiefe n, als die Ebene darüber aufging

  function jump(d) {
    skip++;
    win.clearTimeout(timer);
    timer = win.setTimeout(settle, 800);
    h.go(d);
  }

  /* Kam das popstate nie (der Browser hat den Sprung nicht ausgeführt), nicht für immer warten und nicht erneut springen:
     den aktuellen Eintrag auf die offene Tiefe umschreiben */
  function settle() {
    if (!skip) return;
    skip = 0;
    dirty = false;
    cur = level(h.state);
    const want = count();
    if (want < cur) { h.replaceState({ [NAV_KEY]: want }, ''); cur = want; } else sync();
  }

  function sync(y) {
    if (skip) { dirty = true; return; }
    const want = count();
    if (want > cur) {
      for (let i = cur; i < want; i++) { ys[i] = y; h.pushState({ [NAV_KEY]: i + 1 }, ''); }
      cur = want;
    } else if (want < cur) {
      const d = want - cur;
      cur = want;
      jump(d);
    }
  }

  function onPop(ev) {
    const n = level(ev.state);
    if (skip) {
      skip--;
      if (!skip) {
        win.clearTimeout(timer);
        cur = n;
        if (dirty) { dirty = false; sync(); }
      }
      return;
    }
    if (n < cur) {
      cur = n;
      backTo(n);
      redraw(ys[n]);
      /* Ließ sich etwas nicht schließen, trägt sync() es wieder ein; so bleibt der Verlauf stimmig */
      sync(ys[n]);
    } else if (n > cur) {
      /* Vorwärts: Die Ebene ist schon zu und lässt sich nicht wiederherstellen, also zurück auf den Stand */
      jump(cur - n);
    }
  }

  function start() {
    try { if ('scrollRestoration' in h) h.scrollRestoration = 'manual'; } catch (e) { /* egal */ }
    win.addEventListener('popstate', onPop);
    const n = level(h.state);
    /* Neu geladen mitten im Verlauf: zurück auf den Grundeintrag, sonst führte Zurück ins Leere */
    if (n > 0) jump(-n);
    else h.replaceState({ [NAV_KEY]: 0 }, '');
  }

  return { start, sync, onPop, scrollOf: n => ys[n], get depth() { return cur; }, get pending() { return skip; } };
}
