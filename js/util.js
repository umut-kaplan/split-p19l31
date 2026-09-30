export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Zahlen im deutschen Format */
export const fmt = n => (Math.round(n * 100) / 100).toLocaleString('de-DE');
export const fmt0 = n => Math.round(n).toLocaleString('de-DE');
export const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString('de-DE');
/* Für Eingabefelder: Komma als Dezimalzeichen, aber ohne Tausenderpunkt, sonst liest die App „1.000“ als 1 */
export const fmtIn = n => (Math.round(n * 100) / 100).toLocaleString('de-DE', { useGrouping: false });

/* Zahl aus einer Eingabe. „2.500“ und „2.500,5“ haben Tausenderpunkte, „2,5“ und „2.5“ sind Dezimalzahlen.
   Text nach der Zahl („150 g“) wird ignoriert. */
export const toNum = v => {
  if (v === '' || v == null) return NaN;
  let s = String(v).trim().replace(/[\s  ]/g, '');
  if (/^[+-]?\d{1,3}(\.\d{3})+(,\d*)?(\D.*)?$/.test(s)) s = s.replace(/\./g, '');
  return parseFloat(s.replace(',', '.'));
};

export const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export const unitL = u => u === 'sec' ? 'Sek.' : 'Wdh.';
export const exName = e => e.names.join(' oder ');

export const uid = () => Math.random().toString(36).slice(2, 9);
export const clone = o => JSON.parse(JSON.stringify(o));

export const dLong = t => new Date(t).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
export const dShort = t => new Date(t).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
export const dMid = t => new Date(t).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
/* Kalendertag in Ortszeit als Schlüssel, z. B. 2026-09-27 */
export const ymd = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
