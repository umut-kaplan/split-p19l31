import { S, save } from './state.js';
import { esc, mmss } from './util.js';
import { render } from './render.js';
import { ICON } from './ui/icons.js';

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
let lock = null;
export async function wake() {
  if (!S.active || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try { lock = await navigator.wakeLock.request('screen'); } catch (e) { lock = null; }
}
export function release() { if (lock) { lock.release().catch(() => {}); lock = null; } }

/* ---------- Pausentimer ---------- */
export function startRest(seconds, label) {
  S.active.timer = seconds > 0
    ? { endAt: Date.now() + seconds * 1000, total: seconds * 1000, label, fired: false }
    : null;
}

export function vTimer() {
  const t = S.active && S.active.timer;
  if (!t) return '';
  return `<div class="timer day-${S.active.color}" id="timer" role="timer" aria-live="off">
    <svg class="t-ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="7"/>
      <circle id="t-ring" cx="32" cy="32" r="28" fill="none" stroke="var(--c)" stroke-width="7" stroke-linecap="round"
        transform="rotate(-90 32 32)" stroke-dasharray="175.93" stroke-dashoffset="0"/>
      <circle cx="32" cy="32" r="9" fill="#9AA1AA"/><circle cx="32" cy="32" r="4.5" fill="#1E2124"/>
    </svg>
    <div style="min-width:0"><div class="t-time" id="t-time">0:00</div><div class="t-label" id="t-label">Pause nach ${esc(t.label)}</div></div>
    <div class="t-btns">
      <button data-act="t-minus" aria-label="15 Sekunden weniger">−15</button>
      <button data-act="t-plus" aria-label="15 Sekunden mehr">+15</button>
      <button data-act="t-stop" aria-label="Pause beenden">${ICON.check}</button>
    </div>
  </div>`;
}

/* Rechnet mit der Uhrzeit, darum stimmt der Timer auch nach dem Entsperren */
export function tick() {
  const a = S.active;
  if (!a) return;
  const el = document.getElementById('elapsed');
  if (el) el.textContent = mmss((Date.now() - a.startedAt) / 1000);
  const t = a.timer;
  const box = document.getElementById('timer');
  if (!t || !box) return;
  const left = (t.endAt - Date.now()) / 1000;
  const over = left <= 0;
  document.getElementById('t-time').textContent = over ? '0:00' : mmss(Math.ceil(left));
  document.getElementById('t-label').textContent = over ? 'Pause vorbei. Nächster Satz!' : 'Pause nach ' + t.label;
  const frac = over || !t.total ? 0 : Math.min(1, left * 1000 / t.total);
  document.getElementById('t-ring').setAttribute('stroke-dashoffset', (175.93 * (1 - frac)).toFixed(2));
  box.classList.toggle('over', over);
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
};
