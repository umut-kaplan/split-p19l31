/* Aufwärm-Vorschlag. Reine Funktionen, darum per node --test prüfbar.
   Aufwärmsätze zählen nicht zu den Arbeitssätzen. Auf Wunsch kommt die Rampe als Sätze vom Typ Aufwärmen
   (t: 'w', siehe settypes.js) in die Einheit; dort zählen sie weder fürs Volumen noch für Rekorde. */

/* Rampe aus dem Arbeitsgewicht: 40 % × 10, 60 % × 5, 80 % × 3 */
export const RAMP = [{ pct: 0.4, reps: 10 }, { pct: 0.6, reps: 5 }, { pct: 0.8, reps: 3 }];
/* Unter etwa 30 kg Arbeitsgewicht reichen zwei leichte Stufen */
export const LIGHT_KG = 30;
export const LIGHT_RAMP = [{ pct: 0.5, reps: 10 }, { pct: 0.75, reps: 5 }];
/* Die leere Stange kommt als eigene Stufe dazu, wenn die 40-%-Stufe mindestens so viel schwerer ist */
export const BAR_GAP_KG = 10;

/* Auf die Steigerung runden (Maschinen, Kabel): nächstgelegenes Vielfaches, mindestens eine Steigerung */
export const roundToStep = step => kg => Math.max(step, Math.round(kg / step) * step);

/* Rampe für ein Arbeitsgewicht.
   workKg: heutiges Arbeitsgewicht; opts.barKg: Stange (nur bei Langhantel/SZ); opts.round: kg -> ladbares Gewicht.
   Liefert [{ kg, reps, bar }], leichteste zuerst, ohne doppelte Gewichte und ohne Stufen ab dem Arbeitsgewicht. */
export function warmupRamp(workKg, { barKg = null, round = roundToStep(2.5) } = {}) {
  if (!(workKg > 0)) return [];
  const light = workKg < LIGHT_KG;
  const stages = [];
  if (barKg != null && barKg < workKg && (light || workKg * RAMP[0].pct - barKg >= BAR_GAP_KG)) {
    stages.push({ kg: barKg, reps: 10, bar: true });
  }
  for (const st of light ? LIGHT_RAMP : RAMP) {
    let kg = round(workKg * st.pct);
    if (barKg != null && kg < barKg) kg = barKg;
    stages.push({ kg, reps: st.reps, bar: barKg != null && kg === barKg });
  }
  const out = [];
  for (const s of stages) {
    if (s.kg >= workKg) continue;
    if (out.some(o => o.kg === s.kg)) continue;
    if (out.length && s.kg < out[out.length - 1].kg) continue;
    out.push(s);
  }
  return light ? out.slice(-2) : out;
}

/* Welche Übungen einer Einheit bekommen einen Aufwärm-Vorschlag?
   Die erste schwere Grundübung des Tages und jede weitere, deren Hauptmuskel (erster primärer Muskel)
   noch in keiner früheren Grundübung dieser Einheit vorkam.
   items: [{ lib, workKg }] in der Reihenfolge der Einheit. Liefert die Indizes. */
export function warmupTargets(items) {
  const seen = new Set();
  const out = [];
  items.forEach((it, i) => {
    const lib = it.lib;
    if (!lib || lib.type !== 'compound' || lib.unit === 'sec') return;
    const primary = (lib.muscles && lib.muscles.primary) || [];
    const main = primary[0];
    if (it.workKg > 0 && main && !seen.has(main)) out.push(i);
    primary.forEach(m => seen.add(m));
  });
  return out;
}

/* Kurztext „20 kg × 10, 40 × 5, 60 × 3“ */
export function rampText(stages, fmt = v => String(v).replace('.', ',')) {
  return stages.map((s, k) => `${fmt(s.kg)}${k === 0 ? ' kg' : ''} × ${s.reps}`).join(', ');
}

/* Die Rampe als Sätze der laufenden Einheit: Typ Aufwärmen, Gewicht und Wiederholungen als graue Vorschläge.
   fmt macht aus kg den Text fürs Eingabefeld. */
export function rampSets(stages, fmt = v => String(v).replace('.', ',')) {
  return stages.map(s => ({ t: 'w', w: '', r: '', rir: 2, done: false, pw: fmt(s.kg), pr: String(s.reps) }));
}
