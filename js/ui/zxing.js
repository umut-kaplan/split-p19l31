/* Lädt die mitgelieferte ZXing-Bibliothek erst, wenn ein Scanner oder QR-Code sie braucht. Liefert window.ZXing. */
let zxPromise = null;
export function loadZxing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!zxPromise) {
    zxPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/zxing.min.js';
      s.onload = () => (window.ZXing ? resolve(window.ZXing) : reject(new Error('ZXing ließ sich nicht laden.')));
      s.onerror = () => { zxPromise = null; s.remove(); reject(new Error('ZXing ließ sich nicht laden.')); };
      document.head.appendChild(s);
    });
  }
  return zxPromise;
}
