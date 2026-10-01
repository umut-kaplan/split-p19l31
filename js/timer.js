import { S, save } from './state.js';
import { esc, mmss } from './util.js';
import { render } from './render.js';
import { createWakeLock, wakeOn } from './wake-lock.js';
import { liveBar, takeShown, restText } from './views/live-bar.js';

/* ---------- Ton ---------- */
let actx = null;
export function unlockAudio() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { actx = null; }
}
function beep() {
  /* iOS unterstützt keine Vibration aus dem Browser, Android schon */
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if (!actx) return;
  const t0 = actx.currentTime;
  [0, 0.22, 0.44].forEach((d, k) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    o.frequency.value = k === 2 ? 1175 : 880;
    g.gain.setValueAtTime(0, t0 + d);
    g.gain.linearRampToValueAtTime(0.35, t0 + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + d + 0.18);
    o.connect(g); g.connect(actx.destination);
    o.start(t0 + d); o.stop(t0 + d + 0.2);
  });
}

/* ---------- Bildschirm an lassen ---------- */
/* Solange ein Training läuft und der Schalter in den Einstellungen an ist (S.settings.wakeLock, Standard an).
   wake() beim Start, beim Zurückkommen aus dem Hintergrund (app.js) und nach dem Umschalten; release() beim Beenden. */
const screenLock = createWakeLock({ want: () => !!S.active && wakeOn(S.settings) });
export const wake = () => screenLock.sync();
export const release = () => screenLock.release();

/* ---------- Pausentimer ---------- */
export function startRest(seconds, label) {
  S.active.timer = seconds > 0
    ? { endAt: Date.now() + seconds * 1000, total: seconds * 1000, label, fired: false }
    : null;
}

/* Über der Navigation: auf der Seite der Einheit der Pausentimer, auf allen anderen Seiten die Mini-Leiste (live-bar.js) */
export function vTimer() {
  if (!S.active) return '';
  if (!takeShown()) return liveBar();
  const t = S.active.timer;
  if (!t) return '';
  return `<div class="timer day-${S.active.color}" id="timer" role="timer" aria-live="off">
    <svg class="t-ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="7"/>
      <circle id="t-ring" cx="32" cy="32" r="28" fill="none" stroke="var(--c)" stroke-width="7" stroke-linecap="round"
        transform="rotate(-90 32 32)" stroke-dasharray="175.93" stroke-dashoffset="0"/>
      <circle cx="32" cy="32" r="9" fill="#9AA1AA"/><circle cx="32" cy="32" r="4.5" fill="#1E2124"/>
    </svg>
    <div style="min-width:0"><div class="t-time" id="t-time">0:00</div><div class="t-label" id="t-label">${esc(labelTexts(t, false)[0])}</div></div>
    <div class="t-btns">
      <button data-act="t-minus" aria-label="15 Sekunden weniger">−15</button>
      <button data-act="t-plus" aria-label="15 Sekunden mehr">+15</button>
      <button class="t-skip" data-act="t-stop" aria-label="Pause überspringen">Weiter</button>
    </div>
  </div>`;
}

/* Beschriftung unter der Zeit, längste Fassung zuerst: „Pause nach Bankdrücken“, sonst nur „Bankdrücken“ */
export function labelTexts(t, over) {
  if (over) return ['Pause vorbei. Nächster Satz!', 'Pause vorbei.'];
  const name = String(t.label || '');
  return [`Pause nach ${name}`, name.replace(/^dem /, '')];
}

/* Höchstens zwei Zeilen und nie mitten im Wort abgeschnitten (4.6): Passt „Pause nach …“ nicht, steht nur die Übung da.
   Ist ein einzelnes Wort breiter als die Spalte, darf es getrennt werden; reicht auch das nicht, endet die Beschriftung
   nach dem letzten ganzen Wort mit „…“, zur Not in kleinerer Schrift. Gemessen wird nur, wenn sich Text oder Breite ändern. */
function fitLabel(el, texts) {
  const fits = () => {
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25;
    return el.scrollHeight <= Math.ceil(lh * 2) + 1 && el.scrollWidth <= el.clientWidth + 1;
  };
  el.classList.remove('hy', 'sm');
  for (const v of texts) { el.textContent = v; if (fits()) return; }
  const words = texts[texts.length - 1].split(' ');
  const cut = n => (n < words.length ? words.slice(0, n).join(' ') + '…' : words.join(' '));
  for (const cls of ['hy', 'sm']) {
    el.classList.add(cls);
    for (let n = words.length; n >= 1; n--) {
      el.textContent = cut(n);
      if (fits()) return;
    }
  }
}

/* Rechnet mit der Uhrzeit, darum stimmt der Timer auch nach dem Entsperren.
   Trainingszeit und Pause stehen in der Kopfleiste der Einheit und in der Mini-Leiste (data-tick). Der Ton kommt auf jeder Seite. */
export function tick() {
  const a = S.active;
  if (!a) return;
  const since = mmss((Date.now() - a.startedAt) / 1000);
  document.querySelectorAll('[data-tick="elapsed"]').forEach(el => { el.textContent = since; });
  const t = a.timer;
  if (!t) return;
  const left = (t.endAt - Date.now()) / 1000;
  const over = left <= 0;
  const box = document.getElementById('timer');
  if (box) {
    document.getElementById('t-time').textContent = over ? '0:00' : mmss(Math.ceil(left));
    const label = document.getElementById('t-label');
    const texts = labelTexts(t, over);
    const key = `${texts[0]}|${label.clientWidth}`;
    if (label.dataset.fit !== key) { fitLabel(label, texts); label.dataset.fit = key; }
    const frac = over || !t.total ? 0 : Math.min(1, left * 1000 / t.total);
    document.getElementById('t-ring').setAttribute('stroke-dashoffset', (175.93 * (1 - frac)).toFixed(2));
    box.classList.toggle('over', over);
  }
  document.querySelectorAll('[data-tick="rest"]').forEach(el => { el.textContent = restText(t); });
  document.querySelectorAll('.live-bar').forEach(el => el.classList.toggle('over', over));
  if (over && !t.fired) { t.fired = true; save(); beep(); }
}

export const actions = {
  't-minus': () => { const t = S.active.timer; t.endAt = Math.max(Date.now(), t.endAt - 15000); save(); tick(); },
  't-plus': () => {
    const t = S.active.timer;
    if (t.endAt < Date.now()) { t.endAt = Date.now(); t.total = 0; }
    t.endAt += 15000; t.total += 15000; t.fired = false; save(); tick();
  },
  't-stop': () => { S.active.timer = null; save(); render(); },
  /* Schalter „Bildschirm im Training wach halten“ in Einstellungen · Training (settings.js) */
  wakelock: () => { S.settings.wakeLock = !wakeOn(S.settings); save(); wake(); render(); },
};
