/* Erholungs- und Belastungsampel. Reine Funktionen, Tage als 'YYYY-MM-DD'.

   Signale und Schwellen:
   - Belastung: harte Sätze der letzten 7 Tage (heute eingeschlossen) geteilt durch den Wochenschnitt
     der 4 Wochen davor (Tag 8 bis 35 zurück). Über 1,3 gelb, über 1,5 rot.
     Gezählt werden nur Wochen ab der ersten mit Training, damit ein neuer Anfang den Schnitt nicht drückt.
     Eine Aussage gibt es erst mit mindestens 2 Vergleichswochen mit Training und im Schnitt mindestens 6 Sätzen.
   - Cardio zählt mit: 10 Minuten entsprechen einem harten Satz.
   - Schlaf: Schnitt der letzten bis zu 3 Nächte (Check-in von heute oder S.activity.sleep). Unter 6 h gelb, unter 5 h rot.
     Die letzte Nacht zählt zusätzlich allein: unter 6 h gelb, unter 4 h rot.
   - Gefühl aus dem Check-in von heute: 2 gelb, 1 rot.
   - Ruhepuls heute gegen den Median der 14 Tage davor (mindestens 5 Werte): 5 Schläge darüber gelb, 10 darüber rot.
   Die Ampel zeigt das schlechteste Signal. Ohne auswertbare Signale bleibt sie grün und sagt das ehrlich. */
import { fmt0, fmt1 } from '../util.js';
import { dayNumber, dateFromDayNumber } from './body.js';

export const THRESHOLDS = {
  load: { yellow: 1.3, red: 1.5, minWeeks: 2, minAvgSets: 6 },
  cardioMinutesPerSet: 10,
  sleep: { yellow: 6, red: 5, nights: 3, lastYellow: 6, lastRed: 4 },
  feeling: { yellow: 2, red: 1 },
  restingHr: { yellow: 5, red: 10, baselineDays: 14, minValues: 5 },
};

export const LEVELS = ['green', 'yellow', 'red'];
const RANK = { green: 0, yellow: 1, red: 2 };
export const LEVEL_LABEL = { green: 'Grün', yellow: 'Gelb', red: 'Rot' };
export const FEELING_LABEL = { 1: 'schlecht', 2: 'eher schlecht', 3: 'normal', 4: 'gut', 5: 'sehr gut' };

const localDay = t => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* Belastung pro Tag: Sätze aus Einheiten plus Cardio umgerechnet. Liefert Map tagNummer -> Sätze */
export function dailyLoad(sessions = [], cardio = []) {
  const m = new Map();
  const add = (n, v) => m.set(n, (m.get(n) || 0) + v);
  sessions.forEach(s => {
    const sets = (s.ex || []).reduce((a, x) => a + ((x.sets && x.sets.length) || 0), 0);
    if (sets) add(dayNumber(localDay(s.startedAt)), sets);
  });
  cardio.forEach(c => {
    if (c && c.date && c.minutes > 0) add(dayNumber(c.date), c.minutes / THRESHOLDS.cardioMinutesPerSet);
  });
  return m;
}

/* Akute gegen chronische Belastung. Liefert { ok, acute, chronic, ratio, weeks } oder { ok: false, reason } */
export function loadRatio(sessions, cardio, today) {
  const t = dayNumber(today);
  const load = dailyLoad(sessions, cardio);
  const sum = (from, to) => { let a = 0; for (let n = from; n <= to; n++) a += load.get(n) || 0; return a; };
  const acute = sum(t - 6, t);
  /* Vier Vergleichswochen, neueste zuerst: Tage t-13..t-7, t-20..t-14, … */
  const chunks = [0, 1, 2, 3].map(i => sum(t - 13 - 7 * i, t - 7 - 7 * i));
  let oldest = -1;
  chunks.forEach((c, i) => { if (c > 0) oldest = i; });
  const active = chunks.filter(c => c > 0).length;
  if (oldest < 0 || active < THRESHOLDS.load.minWeeks) {
    return { ok: false, acute, reason: 'Für die Belastung fehlt noch ein Vergleich: Die App braucht mindestens 2 Wochen Training vor dieser Woche.' };
  }
  const used = chunks.slice(0, oldest + 1);
  const chronic = used.reduce((a, c) => a + c, 0) / used.length;
  if (chronic < THRESHOLDS.load.minAvgSets) {
    return { ok: false, acute, reason: 'Für die Belastung ist das Training der Vorwochen noch zu wenig, um zu vergleichen.' };
  }
  return { ok: true, acute, chronic, ratio: acute / chronic, weeks: used.length };
}

/* Schlaf der letzten Nächte: pro Tag der Check-in von heute, sonst der größte eingetragene Wert. */
export function recentSleep(sleep = [], checkins = {}, today) {
  const t = dayNumber(today);
  const nights = [];
  for (let n = t; n > t - THRESHOLDS.sleep.nights; n--) {
    const date = dateFromDayNumber(n);
    const ci = checkins[date];
    let h = ci && ci.sleepH > 0 ? ci.sleepH : null;
    if (h == null) {
      const vals = sleep.filter(s => s && s.date === date && s.hours > 0).map(s => s.hours);
      if (vals.length) h = Math.max(...vals);
    }
    if (h != null) nights.push({ date, hours: h });
  }
  return nights;
}

const median = list => {
  const s = [...list].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/* Ruhepuls heute gegen den Median der 14 Tage davor */
export function restingHrShift(restingHr = [], today) {
  const t = dayNumber(today);
  const todayVals = restingHr.filter(r => r && r.date === today && r.bpm > 0).map(r => r.bpm);
  if (!todayVals.length) return null;
  const base = restingHr.filter(r => {
    if (!r || !(r.bpm > 0) || !r.date) return false;
    const n = dayNumber(r.date);
    return n < t && n >= t - THRESHOLDS.restingHr.baselineDays;
  }).map(r => r.bpm);
  if (base.length < THRESHOLDS.restingHr.minValues) return null;
  const now = Math.min(...todayVals);
  const med = median(base);
  return { bpm: now, median: med, diff: now - med };
}

/* Verhältnis immer mit einer Nachkommastelle, z. B. „1,0“ */
const ratioText = r => (Math.round(r * 10) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const joinClauses = list => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} und ${list[list.length - 1]}`);

/* Die Ampel. input: { sessions, cardio, sleep, restingHr, checkins }, today: 'YYYY-MM-DD'.
   Liefert { level, reasons: [{ signal, level, text, clause }], summary, signals, notes } */
export function recoveryStatus(input, today) {
  const { sessions = [], cardio = [], sleep = [], restingHr = [], checkins = {} } = input || {};
  const reasons = [];
  const notes = [];

  const lr = loadRatio(sessions, cardio, today);
  if (lr.ok) {
    const T = THRESHOLDS.load;
    const level = lr.ratio > T.red ? 'red' : lr.ratio > T.yellow ? 'yellow' : 'green';
    const more = `${fmt0(lr.acute)} harte Sätze in den letzten 7 Tagen, sonst im Schnitt ${fmt0(lr.chronic)} pro Woche`;
    reasons.push({
      signal: 'load', level,
      text: `Belastung: ${more}, Verhältnis ${ratioText(lr.ratio)}.`,
      clause: level === 'green'
        ? (lr.ratio < 0.8 ? 'du diese Woche weniger trainiert hast als sonst' : 'deine Belastung im üblichen Rahmen liegt')
        : `du in den letzten 7 Tagen ${fmt1(lr.ratio)}-mal so viel trainiert hast wie sonst`,
    });
  } else {
    notes.push(lr.reason);
  }

  const nights = recentSleep(sleep, checkins, today);
  if (nights.length) {
    const S = THRESHOLDS.sleep;
    const avg = nights.reduce((a, n) => a + n.hours, 0) / nights.length;
    const last = nights[0].date === today ? nights[0] : null;
    const byAvg = avg < S.red ? 'red' : avg < S.yellow ? 'yellow' : 'green';
    const byLast = !last ? 'green' : last.hours < S.lastRed ? 'red' : last.hours < S.lastYellow ? 'yellow' : 'green';
    const level = RANK[byLast] > RANK[byAvg] ? byLast : byAvg;
    const span = nights.length === 1 ? 'letzte Nacht' : `im Schnitt der letzten ${nights.length} Nächte`;
    const lastWorse = RANK[byLast] > RANK[byAvg];
    reasons.push({
      signal: 'sleep', level,
      text: `Schlaf: ${span} ${fmt1(avg)} Stunden${last && nights.length > 1 ? `, letzte Nacht ${fmt1(last.hours)}` : ''}.`,
      clause: level === 'green'
        ? `du ${span} ${fmt1(avg)} Stunden geschlafen hast`
        : lastWorse
          ? `du letzte Nacht nur ${fmt1(last.hours)} Stunden geschlafen hast`
          : `du ${span} nur ${fmt1(avg)} Stunden geschlafen hast`,
    });
  } else {
    notes.push('Ohne Angaben zum Schlaf fehlt der Ampel ein wichtiges Signal.');
  }

  const ci = checkins[today];
  if (ci && ci.feeling >= 1 && ci.feeling <= 5) {
    const F = THRESHOLDS.feeling;
    const level = ci.feeling <= F.red ? 'red' : ci.feeling <= F.yellow ? 'yellow' : 'green';
    reasons.push({
      signal: 'feeling', level,
      text: `Gefühl heute: ${FEELING_LABEL[ci.feeling]}.`,
      clause: `du dich heute ${FEELING_LABEL[ci.feeling]} fühlst`,
    });
  }

  const hr = restingHrShift(restingHr, today);
  if (hr) {
    const H = THRESHOLDS.restingHr;
    const level = hr.diff >= H.red ? 'red' : hr.diff >= H.yellow ? 'yellow' : 'green';
    const diffText = hr.diff > 0 ? `${fmt0(hr.diff)} Schläge über` : hr.diff < 0 ? `${fmt0(-hr.diff)} Schläge unter` : 'genau auf';
    reasons.push({
      signal: 'hr', level,
      text: `Ruhepuls: heute ${fmt0(hr.bpm)}, ${diffText} deinem Schnitt von ${fmt0(hr.median)}.`,
      clause: level === 'green' ? 'dein Ruhepuls normal ist' : `dein Ruhepuls ${fmt0(hr.diff)} Schläge über deinem Schnitt liegt`,
    });
  }

  const level = reasons.reduce((lv, r) => (RANK[r.level] > RANK[lv] ? r.level : lv), 'green');
  let summary;
  if (!reasons.length) {
    summary = 'Grün, aber mit wenig Daten: Trag Schlaf und Gefühl ein oder trainiere ein paar Wochen, dann wird die Ampel genauer.';
  } else if (level === 'green') {
    summary = `Grün, weil ${joinClauses(reasons.map(r => r.clause))}.`;
  } else {
    const worst = reasons.filter(r => r.level === level).map(r => r.clause);
    summary = `${LEVEL_LABEL[level]}, weil ${joinClauses(worst)}.`;
  }
  return { level, reasons, summary, signals: reasons.length, notes };
}

/* Dasselbe aus dem gespeicherten Zustand */
export function recoveryFromState(S, today) {
  const a = S.activity || {};
  return recoveryStatus({
    sessions: S.sessions,
    cardio: a.cardio || [],
    sleep: a.sleep || [],
    restingHr: a.restingHr || [],
    checkins: S.checkins || {},
  }, today);
}
