/* Scheibenrechner, Stangen und Scheiben. Reine Funktionen, darum per node --test prüfbar.
   Gewichte werden intern in Viertel-Kilogramm gerechnet, damit 1,25 und 0,5 kg ohne Rundungsfehler aufgehen.

   Einstellungen in S.settings.plates:
     bars:      [{ id, name, kg }]    Stangen. 'barbell' (Langhantel) und 'sz' (SZ-Stange) gibt es immer,
                                      eigene Stangen kommen dazu.
     available: [{ kg, color }]       vorhandene Scheiben, schwerste zuerst, color ist ein Schlüssel aus PLATE_COLORS.
                                      Keine Anzahl: der Rechner nimmt jede Scheibe so oft wie nötig.
     barFor:    { 'exId|Name': id }   im Scheibenrechner gewählte Stange pro Übung (Schlüssel wie bei Notizen und Rekorden)
   Ältere Stände hatten { barKg, szKg, available: [Zahlen] }; plateSettings macht daraus die neue Form. */

/* Schnellauswahl beim Hinzufügen, schwerste zuerst */
export const PLATE_CATALOG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
/* Eigene Scheiben: 0,25 bis 50 kg in Schritten von 0,25 kg */
export const PLATE_MIN = 0.25;
export const PLATE_MAX = 50;
export const PLATE_LIMIT = 20;
/* Stangen: 3 bis 30 kg, Name bis 30 Zeichen */
export const BAR_MIN = 3;
export const BAR_MAX = 30;
export const BAR_LIMIT = 12;
export const BAR_NAME_MAX = 30;

/* Farben zur Auswahl, in dieser Reihenfolge angeboten.
   ink: Schrift auf der Scheibe (die Farbe mit dem besseren Kontrast), edge: Rand, damit dunkle Scheiben
   auf dem dunklen Grund der App sichtbar bleiben. Getrennt von den Farben der Trainingstage. */
export const PLATE_COLORS = {
  red: { name: 'Rot', fill: '#E0403F', ink: '#FFFFFF' },
  blue: { name: 'Blau', fill: '#2F7BE0', ink: '#FFFFFF' },
  yellow: { name: 'Gelb', fill: '#F2C230', ink: '#1E2124' },
  green: { name: 'Grün', fill: '#2FA85A', ink: '#1E2124' },
  white: { name: 'Weiß', fill: '#E9E6DF', ink: '#1E2124' },
  black: { name: 'Schwarz', fill: '#141518', ink: '#EEEBE4', edge: 'rgba(238, 235, 228, .55)' },
  grey: { name: 'Grau', fill: '#565B62', ink: '#FFFFFF', edge: 'rgba(238, 235, 228, .35)' },
  silver: { name: 'Silber', fill: '#C9CDD2', ink: '#1E2124' },
  orange: { name: 'Orange', fill: '#EE7A2E', ink: '#1E2124' },
};
export const COLOR_IDS = Object.keys(PLATE_COLORS);
const isColor = c => typeof c === 'string' && COLOR_IDS.includes(c);

/* Wettkampffarben: 25 rot, 20 blau, 15 gelb, 10 grün, 5 weiß; Wechselscheiben 2,5 rot, 2 blau, 1,5 gelb,
   1,25 verchromt, 1 grün, 0,5 weiß. Andere Gewichte silbern wie bisher unbekannte Scheiben. */
const COMP = { 25: 'red', 20: 'blue', 15: 'yellow', 10: 'green', 5: 'white', 2.5: 'red', 2: 'blue', 1.5: 'yellow', 1.25: 'silver', 1: 'green', 0.5: 'white' };
export const compColor = kg => COMP[kg] || 'silver';

export const STD_BARS = [{ id: 'barbell', name: 'Langhantel', kg: 20 }, { id: 'sz', name: 'SZ-Stange', kg: 10 }];
export const isStdBar = id => STD_BARS.some(b => b.id === id);
/* Gerät aus der Bibliothek, das eine Standardstange verlangt */
const EQUIPMENT = { barbell: 'Langhantel', sz: 'SZ-Stange' };

export const DEFAULT_PLATES = Object.freeze({
  bars: STD_BARS.map(b => ({ ...b })),
  available: [25, 20, 15, 10, 5, 2.5, 1.25].map(kg => ({ kg, color: compColor(kg) })),
  barFor: {},
});

const Q = kg => Math.round(kg * 4);
const KG = q => q / 4;
const quarter = v => Math.round(v * 4) / 4;
const isQuarter = v => Math.abs(v * 4 - Math.round(v * 4)) < 1e-9;
const de = v => String(v).replace('.', ',');
const num = v => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.trim().replace(',', '.')) : NaN);
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const cleanName = s => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, BAR_NAME_MAX) : '');
const barKgOk = v => {
  const n = num(v);
  return Number.isFinite(n) && n >= BAR_MIN && n <= BAR_MAX ? quarter(n) : null;
};
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/* Übungsschlüssel 'exId|Name'; der Name steht hinter dem ersten Strich */
const nameOf = key => key.slice(key.indexOf('|') + 1);
export const barKey = x => `${x.exId}|${x.name}`;

/* Kilogramm aus einer Liste von Scheiben: Objekte { kg } oder Zahlen */
const kgList = list => (Array.isArray(list) ? list : []).map(p => num(p && typeof p === 'object' ? p.kg : p)).filter(p => p > 0);

function cleanPlate(p) {
  const obj = p && typeof p === 'object';
  const kg = num(obj ? p.kg : p);
  if (!Number.isFinite(kg)) return null;
  const q = quarter(kg);
  if (q < PLATE_MIN || q > PLATE_MAX) return null;
  return { kg: q, color: obj && isColor(p.color) ? p.color : compColor(q) };
}

/* Einstellungen aus S.settings.plates in der aktuellen Form, fehlende oder unsinnige Werte durch die Vorgabe ersetzt.
   Liefert immer ein frisches Objekt; der Aufrufer darf es verändern und zurückschreiben. */
export function plateSettings(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const list = Array.isArray(r.bars) ? r.bars.filter(b => b && typeof b === 'object') : [];
  const legacy = { barbell: r.barKg, sz: r.szKg };
  const bars = STD_BARS.map(def => {
    const found = list.find(b => b.id === def.id);
    const kg = barKgOk(found && found.kg) ?? barKgOk(legacy[def.id]) ?? def.kg;
    return { id: def.id, name: cleanName(found && found.name) || def.name, kg };
  });
  for (const b of list) {
    if (bars.length >= BAR_LIMIT) break;
    const id = typeof b.id === 'string' ? b.id : '';
    const name = cleanName(b.name);
    const kg = barKgOk(b.kg);
    if (!/^[\w-]{1,40}$/.test(id) || bars.some(x => x.id === id) || !name || kg == null) continue;
    bars.push({ id, name, kg });
  }

  const plates = [];
  for (const p of Array.isArray(r.available) ? r.available : []) {
    const c = cleanPlate(p);
    if (c && !plates.some(x => x.kg === c.kg)) plates.push(c);
  }
  plates.sort((a, b) => b.kg - a.kg);
  const available = (plates.length ? plates : DEFAULT_PLATES.available).slice(0, PLATE_LIMIT).map(p => ({ ...p }));

  const ids = new Set(bars.map(b => b.id));
  const barFor = {};
  if (r.barFor && typeof r.barFor === 'object' && !Array.isArray(r.barFor)) {
    for (const k of Object.keys(r.barFor)) {
      if (k === '__proto__' || k.length > 200) continue;
      if (ids.has(r.barFor[k])) barFor[k] = r.barFor[k];
    }
  }
  return { bars, available, barFor };
}

/* Gewählte Stange einer Übung: zuerst der genaue Schlüssel, sonst ein Eintrag mit gleichem Namen
   (dieselbe Übung kann in mehreren Plänen unter anderer id stehen). Liefert die id oder null. */
export function chosenBarId(barFor, key) {
  if (!key || !barFor) return null;
  if (own(barFor, key)) return barFor[key];
  const want = norm(nameOf(key));
  const hit = Object.keys(barFor).find(k => norm(nameOf(k)) === want);
  return hit ? barFor[hit] : null;
}

/* Welche Stange? Nur Übungen mit Langhantel oder SZ-Stange laut Bibliothek bekommen den Scheibenrechner
   (nicht Maschine, Kurzhanteln, Kabel oder Zeit). Hat man im Scheibenrechner für diese Übung eine Stange gewählt
   (key 'exId|Name'), gilt sie; sonst die Standardstange zum Gerät.
   Liefert { id, kind, label, kg, chosen } oder null. kind ist das Gerät: 'barbell' oder 'sz'. */
export function barFor(exercise, settings, key = null) {
  if (!exercise || exercise.unit === 'sec') return null;
  const eq = exercise.equipment || [];
  const kind = eq.includes(EQUIPMENT.sz) ? 'sz' : eq.includes(EQUIPMENT.barbell) ? 'barbell' : null;
  if (!kind) return null;
  const s = plateSettings(settings);
  const picked = s.bars.find(b => b.id === chosenBarId(s.barFor, key));
  const bar = picked || s.bars.find(b => b.id === kind);
  return { id: bar.id, kind, label: bar.name, kg: bar.kg, chosen: !!picked };
}

/* Merkt die Stange für eine Übung, auch unter Einträgen mit gleichem Namen. Unbekannte Stange: nichts ändert sich. */
export function chooseBar(raw, key, id) {
  const st = plateSettings(raw);
  if (!key || !st.bars.some(b => b.id === id)) return st;
  const want = norm(nameOf(key));
  Object.keys(st.barFor).forEach(k => { if (norm(nameOf(k)) === want) st.barFor[k] = id; });
  st.barFor[key] = id;
  return st;
}

/* ---------- Bearbeiten. Jede Funktion liefert { st } mit den neuen Einstellungen oder { error } als Satz für den Nutzer. ---------- */

/* Farbe für eine neue Scheibe: sind alle vorhandenen gleich gefärbt (etwa alle schwarz), dann diese, sonst Wettkampffarbe */
export function newPlateColor(available, kg) {
  const cs = [...new Set((available || []).map(p => p.color))];
  return available && available.length > 1 && cs.length === 1 && isColor(cs[0]) ? cs[0] : compColor(kg);
}

export function addPlate(raw, kgIn, color) {
  const st = plateSettings(raw);
  const kg = num(kgIn);
  if (!Number.isFinite(kg)) return { error: 'Gewicht als Zahl eintragen, z. B. 2 oder 1,25.' };
  if (kg < PLATE_MIN || kg > PLATE_MAX) return { error: 'Scheiben von 0,25 bis 50 kg.' };
  if (!isQuarter(kg)) return { error: 'In Schritten von 0,25 kg, z. B. 1,25 oder 2.' };
  if (st.available.some(p => p.kg === kg)) return { error: `${de(kg)} kg ist schon dabei.` };
  if (st.available.length >= PLATE_LIMIT) return { error: `Mehr als ${PLATE_LIMIT} verschiedene Scheiben gehen nicht.` };
  st.available = [...st.available, { kg, color: isColor(color) ? color : newPlateColor(st.available, kg) }].sort((a, b) => b.kg - a.kg);
  return { st };
}

export function removePlate(raw, kg) {
  const st = plateSettings(raw);
  if (!st.available.some(p => p.kg === kg)) return { st };
  if (st.available.length === 1) return { error: 'Mindestens eine Scheibe muss bleiben.' };
  st.available = st.available.filter(p => p.kg !== kg);
  return { st };
}

export function setPlateColor(raw, kg, color) {
  const st = plateSettings(raw);
  if (!isColor(color)) return { error: 'Unbekannte Farbe.' };
  st.available.forEach(p => { if (p.kg === kg) p.color = color; });
  return { st };
}

/* Alle Scheiben auf einmal: 'black' wie in vielen Studios, 'comp' Wettkampffarben */
export function setAllColors(raw, mode) {
  const st = plateSettings(raw);
  st.available.forEach(p => { p.color = mode === 'black' ? 'black' : compColor(p.kg); });
  return { st };
}

/* 'black' alle schwarz, 'comp' alle in Wettkampffarbe, sonst 'mixed' */
export function colorMode(raw) {
  const { available } = plateSettings(raw);
  if (available.every(p => p.color === 'black')) return 'black';
  if (available.every(p => p.color === compColor(p.kg))) return 'comp';
  return 'mixed';
}

/* Stange anlegen (ohne id, newId wird ihre id) oder ändern (mit id). Gewicht auf 0,25 kg gerundet. */
export function saveBar(raw, { id = null, name, kg }, newId) {
  const st = plateSettings(raw);
  const n = cleanName(name);
  if (!n) return { error: 'Gib der Stange einen Namen, z. B. Trap-Bar.' };
  const v = typeof kg === 'number' ? kg : num(kg);
  if (!(v >= BAR_MIN && v <= BAR_MAX)) return { error: `Stangen von ${BAR_MIN} bis ${BAR_MAX} kg, z. B. 15.` };
  const bar = id ? st.bars.find(b => b.id === id) : null;
  if (id && !bar) return { error: 'Diese Stange gibt es nicht mehr.' };
  if (st.bars.some(b => b.id !== id && norm(b.name) === norm(n))) return { error: `„${n}“ gibt es schon.` };
  if (bar) {
    bar.name = n;
    bar.kg = quarter(v);
    return { st, id };
  }
  if (st.bars.length >= BAR_LIMIT) return { error: `Mehr als ${BAR_LIMIT} Stangen gehen nicht.` };
  if (typeof newId !== 'string' || !/^[\w-]{1,40}$/.test(newId) || st.bars.some(b => b.id === newId)) return { error: 'Die Stange ließ sich nicht anlegen.' };
  st.bars.push({ id: newId, name: n, kg: quarter(v) });
  return { st, id: newId };
}

/* Eigene Stange löschen. Übungen, die sie nutzten, nehmen wieder die Standardstange zu ihrem Gerät. */
export function removeBar(raw, id) {
  const st = plateSettings(raw);
  if (isStdBar(id)) return { error: 'Langhantel und SZ-Stange bleiben. Name und Gewicht kannst du ändern.' };
  st.bars = st.bars.filter(b => b.id !== id);
  Object.keys(st.barFor).forEach(k => { if (st.barFor[k] === id) delete st.barFor[k]; });
  return { st };
}

/* Wie viele Übungen haben diese Stange gewählt? */
export const barUsage = (raw, id) => Object.values(plateSettings(raw).barFor).filter(v => v === id).length;

/* ---------- Rechner ---------- */

/* Kleinste Scheibenzahl für jedes Gewicht pro Seite bis maxQ. Beim Zusammenstellen kommen schwere Scheiben zuerst. */
function table(available, maxQ) {
  const plates = [...new Set(available.map(Q).filter(p => p > 0))].sort((a, b) => b - a);
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

/* Beladung für ein Gesamtgewicht. available: Scheiben als { kg, color } oder als Zahlen.
   Liefert { status, total, barKg, perSide, perSideKg, below, above }:
   status 'exact'    genau ladbar
          'nearest'  nicht genau ladbar, below und above nennen die nächsten ladbaren Gesamtgewichte
          'bar'      nur die Stange
          'underbar' leichter als die Stange */
export function loadBar(totalKg, barKg, available) {
  const plates = kgList(available);
  const total = Math.round(totalKg * 4) / 4;
  const barQ = Q(barKg);
  const totalQ = Q(total);
  if (!(total > 0) || totalQ < barQ) {
    return { status: 'underbar', total, barKg, perSide: [], perSideKg: 0, below: null, above: { total: barKg, perSide: [] } };
  }
  if (totalQ === barQ) return { status: 'bar', total, barKg, perSide: [], perSideKg: 0, below: null, above: null };
  const sideQ = (totalQ - barQ) / 2;
  const smallest = Math.min(...plates.map(Q).filter(p => p > 0));
  const maxQ = Math.ceil(sideQ) + (isFinite(smallest) ? smallest : 1) * 2 + 8;
  const { best, build } = table(plates, maxQ);
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
export const perSideText = (plates, fmt = de) => plates.map(fmt).join(' + ');
