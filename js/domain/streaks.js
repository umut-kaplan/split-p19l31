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
