export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Zahlen im deutschen Format */
export const fmt = n => (Math.round(n * 100) / 100).toLocaleString('de-DE');
export const fmt0 = n => Math.round(n).toLocaleString('de-DE');
export const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString('de-DE');
export const toNum = v => (v === '' || v == null) ? NaN : parseFloat(String(v).trim().replace(',', '.'));

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
