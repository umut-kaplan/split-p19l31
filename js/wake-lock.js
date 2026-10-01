/* Bildschirm wach halten, solange ein Training läuft (Screen Wake Lock; iOS ab 18.4 in der Home-Bildschirm-App).
   Der Browser gibt die Sperre selbst frei, sobald die App in den Hintergrund geht; sync() fordert sie beim Zurückkommen neu an.
   nav und doc lassen sich für Tests ersetzen, sonst gelten navigator und document. want(): soll der Bildschirm gerade an bleiben? */

/* Einstellung in S.settings.wakeLock, Standard an. Nur false schaltet ab. */
export const wakeOn = settings => !(settings && settings.wakeLock === false);

export function createWakeLock({ want = () => true, nav = null, doc = null } = {}) {
  const N = () => nav || (typeof navigator !== 'undefined' ? navigator : null);
  const D = () => doc || (typeof document !== 'undefined' ? document : null);
  let lock = null;
  let pending = null;

  const supported = () => { const n = N(); return !!(n && n.wakeLock && typeof n.wakeLock.request === 'function'); };
  const visible = () => { const d = D(); return !d || d.visibilityState === 'visible'; };
  const should = () => !!want() && visible() && supported();
  const held = () => !!(lock && !lock.released);

  function release() {
    const l = lock;
    lock = null;
    if (l && !l.released) Promise.resolve().then(() => l.release()).catch(() => { /* schon frei */ });
  }

  /* Anfordern oder freigeben, je nach Lage. Liefert ein Promise mit true, wenn die Sperre danach gehalten wird. */
  function sync() {
    if (!should()) { release(); return Promise.resolve(false); }
    if (held()) return Promise.resolve(true);
    if (pending) return pending;
    let req;
    try { req = Promise.resolve(N().wakeLock.request('screen')); } catch (e) { req = Promise.reject(e); }
    pending = req.then(l => {
      pending = null;
      /* Während der Anfrage beendet, abgeschaltet oder in den Hintergrund gegangen: gleich wieder freigeben */
      if (!should()) { Promise.resolve().then(() => l.release()).catch(() => {}); return false; }
      lock = l;
      if (l && typeof l.addEventListener === 'function') l.addEventListener('release', () => { if (lock === l) lock = null; });
      return true;
    }, () => { pending = null; lock = null; return false; });
    return pending;
  }

  return { sync, release, held, supported };
}
