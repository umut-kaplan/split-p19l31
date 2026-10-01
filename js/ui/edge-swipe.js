/* Wischen vom linken Rand in der Home-Bildschirm-App (4.6). In Safari geht die Systemgeste über den Browser-Verlauf
   eine Ebene zurück (views/navigation.js). Als App vom Home-Bildschirm tut iOS das nicht, darum erkennt Split die Geste
   dort selbst und löst dieselbe Aktion aus wie „‹ Zurück“ oben links. Ein offenes Sheet ist dabei die oberste Ebene:
   Die Geste schließt dann das Sheet.
   Die Erkennung sind reine Funktionen (per node --test geprüft); bindEdgeSwipe hängt sie an die Seite. */

/* startPx: Start höchstens so weit vom linken Rand. minDx: so weit nach rechts löst aus, oder flickDx bei mindestens
   flickSpeed px/ms (schnelles Wischen). slope: höchstens so viel senkrecht pro waagerecht. lockPx: ab hier entscheidet
   sich, ob die Bewegung waagerecht ist. */
export const EDGE = { startPx: 20, minDx: 70, flickDx: 30, flickSpeed: 0.5, slope: 0.6, lockPx: 10 };

/* Beginnt hier eine Rand-Geste? x: Abstand vom linken Rand */
export const edgeStart = (x, e = EDGE) => x >= 0 && x <= e.startPx;

/* Während der Bewegung: 'wait' (noch kaum bewegt), 'track' (waagerecht nach rechts), 'cancel' (senkrecht oder nach links) */
export function edgeMove(start, p, e = EDGE) {
  const dx = p.x - start.x, dy = p.y - start.y;
  if (Math.abs(dx) < e.lockPx && Math.abs(dy) < e.lockPx) return 'wait';
  return dx > 0 && Math.abs(dy) <= dx * e.slope ? 'track' : 'cancel';
}

/* Beim Loslassen: Zurück? Weit genug oder schnell genug, und überwiegend waagerecht nach rechts */
export function edgeEnd(start, p, e = EDGE) {
  const dx = p.x - start.x, dy = p.y - start.y;
  if (dx <= 0 || Math.abs(dy) > dx * e.slope) return false;
  const dt = Math.max(1, p.t - start.t);
  return dx >= e.minDx || (dx >= e.flickDx && dx / dt >= e.flickSpeed);
}

/* Nicht in Eingabefeldern und nicht in waagerecht rollbaren Bereichen (Reiterleisten, Kalender, Fotos):
   Dort gehört die Bewegung dem Element. styleOf: getComputedStyle oder ein Nachbau im Test. */
export function blocked(el, styleOf) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const tag = n.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || n.isContentEditable) return true;
    if (n.hasAttribute && n.hasAttribute('data-noswipe')) return true;
    if (n.scrollWidth > n.clientWidth + 1 && /^(auto|scroll)$/.test(styleOf(n).overflowX)) return true;
  }
  return false;
}

/* Ablauf einer Geste. opts: canGoBack() gibt es eine Ebene zum Zurückgehen, goBack() wie „‹ Zurück“,
   isBlocked(target), feedback(state, dx, y) für die Anzeige am Rand ('move' | 'ready' | 'end'). Punkte: { x, y, t } */
export function edgeGesture({ canGoBack, goBack, isBlocked = () => false, feedback = () => {} }, e = EDGE) {
  let start = null;
  let tracking = false;
  const stop = () => { if (tracking) feedback('end', 0, 0); start = null; tracking = false; };
  return {
    start(p, target) {
      stop();
      if (!edgeStart(p.x, e) || isBlocked(target) || !canGoBack()) return false;
      start = p;
      return true;
    },
    move(p) {
      if (!start) return;
      const s = edgeMove(start, p, e);
      if (s === 'cancel') { stop(); return; }
      if (s === 'track') {
        tracking = true;
        const dx = p.x - start.x;
        feedback(dx >= e.minDx ? 'ready' : 'move', dx, start.y);
      }
    },
    end(p) {
      if (!start) return false;
      const go = tracking && edgeEnd(start, p, e) && canGoBack();
      stop();
      if (go) goBack();
      return go;
    },
    cancel: stop,
  };
}

/* Läuft die App vom Home-Bildschirm eines iPhones oder iPads? Android hat eine eigene Zurück-Geste, die über den
   Browser-Verlauf schon geht; dort bliebe es sonst bei zwei Schritten zurück. */
export function isIosHomeScreen(win) {
  const nav = win.navigator || {};
  if (nav.standalone === true) return true;
  const standalone = !!(win.matchMedia && win.matchMedia('(display-mode: standalone)').matches);
  const ua = nav.userAgent || '';
  const apple = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  return standalone && apple;
}

/* Rückmeldung: ein runder Pfeil am linken Rand folgt dem Finger und wird kräftig, sobald Loslassen zurückgeht */
function edgeHint(doc) {
  let el = null;
  return (state, dx, y) => {
    if (state === 'end') { if (el) el.classList.remove('on', 'ready'); return; }
    if (!el) {
      el = doc.createElement('div');
      el.className = 'edge-back';
      el.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(el);
    }
    const top = Math.max(60, Math.min(y - 22, doc.documentElement.clientHeight - 160));
    el.style.top = `${top}px`;
    el.style.transform = `translateX(${Math.round(Math.min(dx, 110) * 0.5)}px)`;
    el.classList.add('on');
    el.classList.toggle('ready', state === 'ready');
  };
}

/* An die Seite hängen. Nur in der Home-Bildschirm-App (isIosHomeScreen), sonst ohne Wirkung. */
export function bindEdgeSwipe(win, { canGoBack, goBack }) {
  if (!isIosHomeScreen(win)) return null;
  const doc = win.document;
  const g = edgeGesture({
    canGoBack, goBack,
    isBlocked: t => blocked(t, n => win.getComputedStyle(n)),
    feedback: edgeHint(doc),
  });
  const pt = ev => { const t = ev.changedTouches[0]; return { x: t.clientX, y: t.clientY, t: ev.timeStamp }; };
  doc.addEventListener('touchstart', ev => { if (ev.touches.length === 1) g.start(pt(ev), ev.target); else g.cancel(); }, { passive: true });
  doc.addEventListener('touchmove', ev => { if (ev.touches.length === 1) g.move(pt(ev)); else g.cancel(); }, { passive: true });
  doc.addEventListener('touchend', ev => g.end(pt(ev)), { passive: true });
  doc.addEventListener('touchcancel', () => g.cancel(), { passive: true });
  return g;
}
