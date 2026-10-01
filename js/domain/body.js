export function bmi(kg, cm) {
  if (!(kg > 0 && cm > 0)) return null;
  const m = cm / 100;
  return kg / (m * m);
}

/* Einteilung der WHO für Erwachsene */
export function bmiCategory(b) {
  if (b == null) return null;
  if (b < 18.5) return 'Untergewicht';
  if (b < 25) return 'Normalgewicht';
  if (b < 30) return 'Übergewicht';
  return 'Adipositas';
}

/* Position auf der Skala 15 bis 35 in Prozent, für die Markierung */
export function bmiScalePos(b) {
  if (b == null) return null;
  return Math.max(0, Math.min(100, (b - 15) / 20 * 100));
}

/* ---------- Kalendertage ---------- */
/* 'YYYY-MM-DD' als fortlaufende Tageszahl, unabhängig von Zeitzone und Sommerzeit */
export function dayNumber(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
}
export function dateFromDayNumber(n) {
  return new Date(n * 864e5).toISOString().slice(0, 10);
}
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const lastByDate = list => (list && list.length ? [...list].sort(byDate).pop() : null);

/* ---------- Körperfett ---------- */
/* US-Navy-Formel (Hodgdon und Beckett), alle Maße in cm.
   Männer: Hals und Bauchumfang auf Höhe des Nabels. Frauen: Hals, Taille an der schmalsten Stelle und Hüfte. */
export function navyBodyFat({ sex, heightCm, neckCm, waistCm, hipCm }) {
  if (!(heightCm > 0 && neckCm > 0 && waistCm > 0)) return null;
  let bf = null;
  if (sex === 'm') {
    if (waistCm - neckCm <= 0) return null;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
  } else if (sex === 'f') {
    if (!(hipCm > 0) || waistCm + hipCm - neckCm <= 0) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450;
  }
  return bf != null && bf > 2 && bf < 70 ? bf : null;
}

export const leanMass = (kg, bfPct) => (kg > 0 && bfPct >= 0 ? kg * (1 - bfPct / 100) : null);

/* Schätzung aus einem Umfang-Eintrag. Bei Männern zählt der Bauch (Nabelhöhe), sonst die Taille. */
export function navyFromMeasurement(profile, m) {
  if (!m) return null;
  const waist = profile.sex === 'm' ? (m.belly || m.waist) : m.waist;
  return navyBodyFat({ sex: profile.sex, heightCm: profile.heightCm, neckCm: m.neck, waistCm: waist, hipCm: m.hip });
}

/* Jüngster Körperfettwert: gemessen oder nach Navy geschätzt. Am selben Tag gewinnt der gemessene.
   Liefert { date, bfPct, measured, method } oder null. */
export function latestComposition(profile, body) {
  const measured = lastByDate((body.composition || []).filter(c => c.bfPct > 0));
  const withNavy = (body.measurements || [])
    .map(m => ({ m, bf: navyFromMeasurement(profile, m) }))
    .filter(x => x.bf != null)
    .sort((a, b) => byDate(a.m, b.m));
  const est = withNavy.length ? withNavy[withNavy.length - 1] : null;
  const fromMeasured = measured && { date: measured.date, bfPct: measured.bfPct, measured: true, method: measured.method || 'other' };
  const fromNavy = est && { date: est.m.date, bfPct: est.bf, measured: false, method: 'navy' };
  if (fromMeasured && fromNavy) return fromMeasured.date >= fromNavy.date ? fromMeasured : fromNavy;
  return fromMeasured || fromNavy || null;
}

/* ---------- Gewichtstrend ---------- */
/* Gleitender Durchschnitt über die letzten `days` Kalendertage je Eintrag. points: [{ date, kg }] */
export function movingAverage(points, days = 7) {
  const sorted = [...points].sort(byDate);
  return sorted.map((p, i) => {
    const n = dayNumber(p.date);
    const win = sorted.slice(0, i + 1).filter(q => dayNumber(q.date) > n - days);
    return { date: p.date, avg: win.reduce((a, q) => a + q.kg, 0) / win.length };
  });
}

/* Kleinste Quadrate. Liefert Steigung, Achsenabschnitt, Standardfehler der Steigung und Streuung. */
export function linearRegression(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, x) => a + x, 0) / n, my = ys.reduce((a, y) => a + y, 0) / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  if (sxx === 0) return null;
  const slope = sxy / sxx, intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i] - (intercept + slope * xs[i])) ** 2;
  const sd = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;
  return { slope, intercept, sd, slopeSE: n > 2 ? sd / Math.sqrt(sxx) : Infinity, n };
}

/* Trend der letzten `days` Tage. Braucht mindestens 5 Einträge über mindestens 14 Tage.
   Liefert { ok, perWeek (kg), current (Trendwert heute), slopeSE, n, spanDays } oder { ok: false, reason } */
export function weightTrend(weights, today, days = 28) {
  const t = dayNumber(today);
  const pts = (weights || []).filter(w => { const n = dayNumber(w.date); return n <= t && n > t - days; }).sort(byDate);
  const span = pts.length ? dayNumber(pts[pts.length - 1].date) - dayNumber(pts[0].date) : 0;
  if (pts.length < 5 || span < 14) {
    return { ok: false, n: pts.length, spanDays: span, reason: `Für einen Trend braucht die App mindestens 5 Einträge über 2 Wochen. Bisher: ${pts.length} ${pts.length === 1 ? 'Eintrag' : 'Einträge'} über ${span} ${span === 1 ? 'Tag' : 'Tage'}.` };
  }
  const r = linearRegression(pts.map(p => dayNumber(p.date)), pts.map(p => p.kg));
  return { ok: true, perDay: r.slope, perWeek: r.slope * 7, current: r.intercept + r.slope * t, slopeSE: r.slopeSE, sd: r.sd, n: pts.length, spanDays: span };
}

/* Wann ist das Zielgewicht erreicht? Spanne aus Steigung plus/minus ein Standardfehler. */
export function forecastGoal(weights, targetKg, today) {
  const tr = weightTrend(weights, today);
  if (!tr.ok) return { ok: false, reason: tr.reason };
  const diff = targetKg - tr.current;
  if (Math.abs(diff) < 0.3) return { ok: true, reached: true, trend: tr };
  if (Math.abs(tr.perWeek) < 0.05 || Math.sign(tr.perDay) !== Math.sign(diff)) {
    return { ok: false, trend: tr, reason: 'Der Gewichtstrend der letzten Wochen zeigt nicht in Richtung Ziel.' };
  }
  const t = dayNumber(today);
  const at = slope => (Math.sign(slope) === Math.sign(diff) && Math.abs(slope) > 1e-6 ? t + Math.ceil(diff / slope) : null);
  const mid = at(tr.perDay);
  const fast = at(tr.perDay + Math.sign(diff) * tr.slopeSE);
  const slow = at(tr.perDay - Math.sign(diff) * tr.slopeSE);
  return {
    ok: true, reached: false, trend: tr,
    date: dateFromDayNumber(mid),
    earliest: fast != null ? dateFromDayNumber(Math.min(fast, mid)) : null,
    latest: slow != null ? dateFromDayNumber(Math.max(slow, mid)) : null,
  };
}

/* Das zuletzt eingetragene Gewicht, sonst der Wert aus dem Profil */
export function currentWeight(profile, weights) {
  if (weights && weights.length) {
    const last = [...weights].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).pop();
    return last.kg;
  }
  return profile.weightKg || null;
}

/* ---------- Stufe 3: Gewichtsverlauf und Ziel ---------- */
export const WEIGHT_RANGES = { '4w': 28, '3m': 91, all: Infinity };

/* Einträge im Zeitraum bis heute. range: '4w' | '3m' | 'all' */
export function inRange(points, today, range) {
  const days = WEIGHT_RANGES[range] ?? Infinity;
  const t = dayNumber(today);
  return [...(points || [])].sort(byDate).filter(p => {
    const n = dayNumber(p.date);
    return n <= t && n > t - days;
  });
}

/* Fortschritt vom Start (erster Eintrag) zum Ziel, 0 bis 1. Funktioniert beim Ab- und beim Zunehmen. */
export function goalProgress(startKg, currentKg, targetKg) {
  if (!(startKg > 0 && currentKg > 0 && targetKg > 0)) return null;
  const remaining = targetKg - currentKg;
  const total = targetKg - startKg;
  if (Math.abs(remaining) < 0.3) return { pct: 1, remaining: 0, reached: true };
  if (Math.abs(total) < 0.05) return { pct: 0, remaining, reached: false };
  const pct = Math.max(0, Math.min(1, (currentKg - startKg) / total));
  return { pct, remaining, reached: false };
}

export const firstWeight = weights => ([...(weights || [])].sort(byDate)[0] || null);

/* ---------- Stufe 3: Umfänge ---------- */
export const MEASURES = [
  { key: 'neck', label: 'Hals', hint: 'Knapp unter dem Kehlkopf, Band leicht nach vorne unten geneigt.' },
  { key: 'shoulders', label: 'Schultern', hint: 'Breiteste Stelle über beide Schultern, Arme locker hängen lassen.' },
  { key: 'chest', label: 'Brust', hint: 'Auf Höhe der Brustwarzen, nach dem Ausatmen.' },
  { key: 'waist', label: 'Taille', hint: 'Schmalste Stelle zwischen Rippen und Becken.' },
  { key: 'belly', label: 'Bauch', hint: 'Auf Höhe des Bauchnabels, entspannt ausatmen, nicht einziehen.' },
  { key: 'hip', label: 'Hüfte', hint: 'Breiteste Stelle über dem Gesäß, Füße zusammen.' },
  { key: 'upperArmL', label: 'Oberarm links', hint: 'Dickste Stelle, Arm locker hängend.' },
  { key: 'upperArmR', label: 'Oberarm rechts', hint: 'Dickste Stelle, Arm locker hängend.' },
  { key: 'forearm', label: 'Unterarm', hint: 'Dickste Stelle knapp unter dem Ellenbogen.' },
  { key: 'thigh', label: 'Oberschenkel', hint: 'Dickste Stelle, stehend, Gewicht auf beiden Beinen.' },
  { key: 'calf', label: 'Wade', hint: 'Dickste Stelle, stehend.' },
];

/* Ein Eintrag pro Tag: ein weiterer am selben Tag ergänzt oder überschreibt einzelne Felder. Liefert eine neue Liste. */
export function mergeByDate(list, entry) {
  const out = (list || []).filter(x => x.date !== entry.date);
  const old = (list || []).find(x => x.date === entry.date);
  out.push(old ? { ...old, ...entry } : entry);
  return out.sort(byDate);
}

/* Pro Maß der jüngste Wert, der Wert davor und die Differenz */
export function measurementDeltas(measurements) {
  const sorted = [...(measurements || [])].sort(byDate);
  const out = {};
  MEASURES.forEach(({ key }) => {
    const withKey = sorted.filter(m => m[key] > 0);
    if (!withKey.length) return;
    const last = withKey[withKey.length - 1];
    const prev = withKey.length > 1 ? withKey[withKey.length - 2] : null;
    out[key] = {
      value: last[key], date: last.date,
      prev: prev ? prev[key] : null, prevDate: prev ? prev.date : null,
      delta: prev ? Math.round((last[key] - prev[key]) * 10) / 10 : null,
    };
  });
  return out;
}

/* Pro Maß erster und jüngster Wert, für die Veränderung seit Beginn */
export function measurementSinceFirst(measurements) {
  const sorted = [...(measurements || [])].sort(byDate);
  const out = {};
  MEASURES.forEach(({ key }) => {
    const withKey = sorted.filter(m => m[key] > 0);
    if (withKey.length < 2) return;
    const first = withKey[0], last = withKey[withKey.length - 1];
    out[key] = { first: first[key], firstDate: first.date, last: last[key], lastDate: last.date, delta: Math.round((last[key] - first[key]) * 10) / 10 };
  });
  return out;
}

/* Was fehlt für die Navy-Schätzung? Liefert eine Liste lesbarer Namen, leer wenn alles da ist. */
export function missingForNavy(profile, measurements) {
  const missing = [];
  if (profile.sex !== 'm' && profile.sex !== 'f') missing.push('Geschlecht im Profil');
  if (!(profile.heightCm > 0)) missing.push('Größe im Profil');
  const last = [...(measurements || [])].sort(byDate).pop() || {};
  if (!(last.neck > 0)) missing.push('Hals');
  if (profile.sex === 'f') {
    if (!(last.waist > 0)) missing.push('Taille');
    if (!(last.hip > 0)) missing.push('Hüfte');
  } else if (!(last.belly > 0 || last.waist > 0)) missing.push('Bauch');
  return missing;
}

/* ---------- Stufe 3: Fortschrittsfotos ---------- */
/* Montag der Woche als 'YYYY-MM-DD' */
export function mondayOf(date) {
  const n = dayNumber(date);
  const weekday = new Date(n * 864e5).getUTCDay();
  return dateFromDayNumber(n - ((weekday + 6) % 7));
}

/* Erinnerung fällig, wenn diese Woche noch kein Foto existiert und sie nicht auf „später“ gesetzt wurde */
export function photoReminderDue(photos, today, lastPrompt) {
  const week = mondayOf(today);
  if (lastPrompt === week) return false;
  return !(photos || []).some(p => mondayOf(p.date) === week);
}

/* Fotos nach Woche gruppiert, jüngste zuerst. Pro Pose zählt das jüngste Foto der Woche. */
export function photoWeeks(photos) {
  const map = new Map();
  [...(photos || [])].sort(byDate).forEach(p => {
    const w = mondayOf(p.date);
    if (!map.has(w)) map.set(w, { week: w, poses: {}, all: [] });
    const entry = map.get(w);
    entry.poses[p.pose] = p;
    entry.all.push(p);
  });
  return [...map.values()].sort((a, b) => (a.week < b.week ? 1 : -1));
}
