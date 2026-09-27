/* Scheibenrechner. Reine Funktionen, darum per node --test prüfbar.
   Gewichte werden intern in Viertel-Kilogramm gerechnet, damit 1,25 und 0,5 kg ohne Rundungsfehler aufgehen. */

/* Alle Scheiben, die man im Profil an- oder abschalten kann, schwerste zuerst */
export const PLATE_CATALOG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];

export const DEFAULT_PLATES = { barKg: 20, szKg: 10, available: [25, 20, 15, 10, 5, 2.5, 1.25] };

const Q = kg => Math.round(kg * 4);
const KG = q => q / 4;

/* Einstellungen aus S.settings.plates, fehlende oder unsinnige Werte durch die Vorgabe ersetzt */
export function plateSettings(raw) {
  const r = raw || {};
  const barKg = r.barKg > 0 ? r.barKg : DEFAULT_PLATES.barKg;
  const szKg = r.szKg > 0 ? r.szKg : DEFAULT_PLATES.szKg;
  const list = Array.isArray(r.available) ? r.available : DEFAULT_PLATES.available;
  const available = [...new Set(list.map(Number).filter(p => p > 0))].sort((a, b) => b - a);
  return { barKg, szKg, available: available.length ? available : DEFAULT_PLATES.available.slice() };
}

/* Welche Stange? Langhantel oder SZ-Stange laut Bibliothek, sonst kein Scheibenrechner (Maschine, Kurzhanteln, Kabel). */
export function barFor(exercise, settings) {
  if (!exercise || exercise.unit === 'sec') return null;
  const eq = exercise.equipment || [];
  const s = plateSettings(settings);
  if (eq.includes('SZ-Stange')) return { kind: 'sz', label: 'SZ-Stange', kg: s.szKg };
  if (eq.includes('Langhantel')) return { kind: 'barbell', label: 'Langhantel', kg: s.barKg };
  return null;
}

/* Kleinste Scheibenzahl für jedes Gewicht pro Seite bis maxQ. Beim Zusammenstellen kommen schwere Scheiben zuerst. */
function table(available, maxQ) {
  const plates = available.map(Q).filter(p => p > 0).sort((a, b) => b - a);
  const best = new Array(maxQ + 1).fill(Infinity);
  best[0] = 0;
  for (let v = 1; v <= maxQ; v++) {
    for (const p of plates) if (p <= v && best[v - p] + 1 < best[v]) best[v] = best[v - p] + 1;
  }
  const build = v => {
    const out = [];
    while (v > 0) {
      const p = plates.find(pl => pl <= v && best[v - pl] === best[v] - 1);
      if (p == null) return null;
      out.push(KG(p));
      v -= p;
    }
    return out;
  };
  return { best, build };
}

/* Beladung für ein Gesamtgewicht.
   Liefert { status, total, barKg, perSide, perSideKg, below, above }:
   status 'exact'    genau ladbar
          'nearest'  nicht genau ladbar, below und above nennen die nächsten ladbaren Gesamtgewichte
          'bar'      nur die Stange
          'underbar' leichter als die Stange */
export function loadBar(totalKg, barKg, available) {
  const total = Math.round(totalKg * 4) / 4;
  const barQ = Q(barKg);
  const totalQ = Q(total);
  if (!(total > 0) || totalQ < barQ) {
    return { status: 'underbar', total, barKg, perSide: [], perSideKg: 0, below: null, above: { total: barKg, perSide: [] } };
  }
  if (totalQ === barQ) return { status: 'bar', total, barKg, perSide: [], perSideKg: 0, below: null, above: null };
  const sideQ = (totalQ - barQ) / 2;
  const smallest = Math.min(...available.map(Q).filter(p => p > 0));
  const maxQ = Math.ceil(sideQ) + (isFinite(smallest) ? smallest : 1) * 2 + 8;
  const { best, build } = table(available, maxQ);
  const pick = q => ({ total: KG(barQ + 2 * q), perSide: build(q) });
  if (Number.isInteger(sideQ) && best[sideQ] < Infinity) {
    return { status: 'exact', total, barKg, perSide: build(sideQ), perSideKg: KG(sideQ), below: null, above: null };
  }
  let lo = Math.floor(sideQ);
  while (lo > 0 && best[lo] === Infinity) lo--;
  let hi = Math.ceil(sideQ);
  if (hi === sideQ) hi++;
  while (hi <= maxQ && best[hi] === Infinity) hi++;
  return {
    status: 'nearest', total, barKg, perSide: [], perSideKg: KG(sideQ),
    below: lo >= 0 ? pick(lo) : null,
    above: hi <= maxQ ? pick(hi) : null,
  };
}

/* Nächstes ladbares Gesamtgewicht, bei Gleichstand das leichtere. Nie leichter als die Stange. */
export function nearestLoadable(totalKg, barKg, available) {
  const r = loadBar(totalKg, barKg, available);
  if (r.status === 'exact' || r.status === 'bar') return r.total;
  if (r.status === 'underbar') return barKg;
  const cands = [r.below, r.above].filter(Boolean).map(c => c.total);
  if (!cands.length) return r.total;
  return cands.sort((a, b) => Math.abs(a - totalKg) - Math.abs(b - totalKg) || a - b)[0];
}

/* Kurztext „25 + 5 + 1,25“ */
export const perSideText = (plates, fmt = v => String(v).replace('.', ',')) => plates.map(fmt).join(' + ');
