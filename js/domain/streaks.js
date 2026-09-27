/* Serien zählen Trainingswochen (Montag bis Sonntag), nicht Tage */

export function weekStart(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function prevWeek(start) {
  const d = new Date(start);
  d.setDate(d.getDate() - 7);
  return weekStart(d.getTime());
}

function countByWeek(sessions) {
  const m = new Map();
  sessions.forEach(s => { const k = weekStart(s.startedAt); m.set(k, (m.get(k) || 0) + 1); });
  return m;
}

/* Die laufende Woche zählt mit, sobald sie erfüllt ist. Ist sie es noch nicht, bricht sie die Serie nicht. */
export function weekStreak(sessions, target, now = Date.now()) {
  const counts = countByWeek(sessions);
  const cur = weekStart(now);
  const thisWeek = counts.get(cur) || 0;
  let weeks = thisWeek >= target ? 1 : 0;
  for (let k = prevWeek(cur); (counts.get(k) || 0) >= target; k = prevWeek(k)) weeks++;
  return { weeks, thisWeek, target };
}

/* Die letzten n Wochen, älteste zuerst */
export function weekHistory(sessions, target, now = Date.now(), n = 8) {
  const counts = countByWeek(sessions);
  const out = [];
  let k = weekStart(now);
  for (let i = 0; i < n; i++) {
    const count = counts.get(k) || 0;
    out.unshift({ start: k, count, met: count >= target, current: i === 0 });
    k = prevWeek(k);
  }
  return out;
}

/* ---------- Joker ---------- */
/* Monat einer Woche ist der Monat ihres Montags, z. B. '2026-8' für September */
export function monthKey(start) {
  const d = new Date(start);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function firstWeek(sessions) {
  if (!sessions.length) return null;
  return weekStart(Math.min(...sessions.map(s => s.startedAt)));
}

/* Serie mit Joker. Pro Kalendermonat überbrückt ein Joker genau eine verpasste, abgeschlossene Woche:
   die Serie läuft weiter, die Woche zählt aber nicht mit. Die laufende Woche braucht nie einen Joker.
   Ein Joker zählt nur, wenn davor wieder eine erfüllte Woche kommt; am Anfang einer Serie wird keiner verbraucht.
   Liefert { weeks, thisWeek, target, bridged: [Wochenstarts], jokerFree: bool für den laufenden Monat } */
export function weekStreakWithJokers(sessions, target, now = Date.now()) {
  const counts = countByWeek(sessions);
  const cur = weekStart(now);
  const thisWeek = counts.get(cur) || 0;
  const first = firstWeek(sessions);
  const walk = [];
  const used = new Set();
  if (first != null) {
    for (let k = prevWeek(cur); k >= first; k = prevWeek(k)) {
      if ((counts.get(k) || 0) >= target) { walk.push({ k, met: true }); continue; }
      const m = monthKey(k);
      if (used.has(m)) break;
      used.add(m);
      walk.push({ k, met: false });
    }
  }
  /* Joker am Ende der Kette ohne erfüllte Woche davor verbrauchen nichts */
  while (walk.length && !walk[walk.length - 1].met) walk.pop();
  const bridged = walk.filter(w => !w.met).map(w => w.k);
  const weeks = (thisWeek >= target ? 1 : 0) + walk.filter(w => w.met).length;
  const curMonth = monthKey(now);
  return { weeks, thisWeek, target, bridged, jokerFree: !bridged.some(k => monthKey(k) === curMonth) };
}

/* Die letzten n Wochen mit Joker-Markierung, älteste zuerst */
export function weekHistoryWithJokers(sessions, target, now = Date.now(), n = 8) {
  const { bridged } = weekStreakWithJokers(sessions, target, now);
  const set = new Set(bridged);
  return weekHistory(sessions, target, now, n).map(w => ({ ...w, bridged: set.has(w.start) }));
}

/* Längste Serie überhaupt, mit derselben Joker-Regel, von der ersten Woche vorwärts gezählt */
export function longestStreak(sessions, target, now = Date.now()) {
  const counts = countByWeek(sessions);
  const first = firstWeek(sessions);
  if (first == null) return 0;
  const cur = weekStart(now);
  const used = new Set();
  let run = 0, best = 0;
  for (let k = first; k <= cur; ) {
    const met = (counts.get(k) || 0) >= target;
    if (met) { run++; best = Math.max(best, run); }
    else if (k !== cur) {
      const m = monthKey(k);
      if (run > 0 && !used.has(m)) used.add(m);
      else run = 0;
    }
    const d = new Date(k);
    d.setDate(d.getDate() + 7);
    k = weekStart(d.getTime());
  }
  return best;
}

/* Anzahl Wochen mit mindestens einer Einheit */
export function trainingWeeks(sessions) {
  return countByWeek(sessions).size;
}
