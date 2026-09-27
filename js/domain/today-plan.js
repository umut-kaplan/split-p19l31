/* Was soll ich heute trainieren? Reine Funktion.

   Regeln:
   1. Kandidat ist die nächste Einheit in der Reihenfolge des Plans.
   2. Hauptmuskeln eines Tages sind die primären Muskeln seiner Übungen, die mindestens 20 % seiner Sätze tragen.
   3. Wurde ein Hauptmuskel des Kandidaten vor weniger als 48 Stunden trainiert, schlägt die App den Tag vor,
      dessen Hauptmuskeln am längsten ruhen (bei Gleichstand der, der in der Reihenfolge zuerst kommt).
   4. Ampel rot: Vorschlag Ruhetag oder lockeres Cardio beziehungsweise Mobilität;
      Alternative ist die leichteste Einheit (wenigste Sätze) unter den erholten Tagen.
   5. Ampel gelb: trainieren wie bei grün, mit dem Hinweis, pro Übung einen Satz weniger zu machen oder RIR 3 zu halten.
   Bei grün und gelb ist die Alternative der nächstbeste andere Tag. */
import { MUSCLES } from './muscles.js';

export const REST_HOURS = 48;
const MAIN_SHARE = 0.2;
const H = 36e5;

const labelList = keys => {
  const l = keys.map(k => MUSCLES[k] || k);
  return l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} und ${l[l.length - 1]}`;
};

/* Ruhezeit als Text: „seit 30 Stunden“, „seit 3 Tagen“ */
export function restText(hours) {
  if (!isFinite(hours)) return 'noch nie trainiert';
  if (hours < 48) return `seit ${Math.max(1, Math.round(hours))} Stunden`;
  const d = Math.floor(hours / 24);
  return `seit ${d} Tagen`;
}

/* Zeitpunkt, an dem jeder Muskel zuletzt primär trainiert wurde. resolve(name) -> Bibliothekseintrag oder null */
export function lastTrained(sessions, resolve) {
  const out = {};
  sessions.forEach(s => {
    const t = s.endedAt || s.startedAt;
    (s.ex || []).forEach(x => {
      if (!x.sets || !x.sets.length) return;
      const e = resolve(x.name);
      ((e && e.muscles && e.muscles.primary) || []).forEach(m => { if (!(out[m] >= t)) out[m] = t; });
    });
  });
  return out;
}

/* Hauptmuskeln und Sätze eines Plan-Tages */
export function dayProfile(day, resolve) {
  const sets = {};
  let total = 0;
  (day.exercises || []).forEach(ex => {
    const e = resolve(ex.names[0]);
    const n = ex.sets || 0;
    total += n;
    ((e && e.muscles && e.muscles.primary) || []).forEach(m => { sets[m] = (sets[m] || 0) + n; });
  });
  const primaryTotal = Object.values(sets).reduce((a, v) => a + v, 0);
  const main = Object.keys(sets)
    .filter(m => primaryTotal && sets[m] / primaryTotal >= MAIN_SHARE)
    .sort((a, b) => sets[b] - sets[a]);
  return { main: main.length ? main : Object.keys(sets), totalSets: total };
}

/* plan: { order, days }, nextId: Kandidat aus der Reihenfolge, level: Ampel.
   Liefert null (kein Tag mit Übungen) oder
   { kind: 'train' | 'rest' | 'done', dayId, title, reason, hint, alt: { kind, dayId, title, reason } | null, muscles } */
export function suggestToday({ plan, sessions, resolve, level = 'green', nextId, now = Date.now(), trainedToday = null }) {
  const days = plan.order.filter(id => plan.days[id] && (plan.days[id].exercises || []).length);
  if (!days.length) return null;
  const last = lastTrained(sessions, resolve);
  const since = m => (last[m] ? (now - last[m]) / H : Infinity);
  const info = {};
  days.forEach(id => {
    const p = dayProfile(plan.days[id], resolve);
    const rest = p.main.map(m => ({ m, h: since(m) }));
    const minRest = rest.length ? Math.min(...rest.map(r => r.h)) : Infinity;
    info[id] = { id, name: plan.days[id].name, ...p, rest, minRest, fresh: minRest >= REST_HOURS };
  });
  const cand = days.includes(nextId) ? nextId : days[0];
  /* Reihenfolge ab dem Kandidaten, für Gleichstände */
  const ring = [...days.slice(days.indexOf(cand)), ...days.slice(0, days.indexOf(cand))];
  const byRest = [...ring].sort((a, b) => (info[b].minRest === info[a].minRest ? ring.indexOf(a) - ring.indexOf(b) : info[b].minRest - info[a].minRest));

  const freshText = d => {
    const fresh = d.rest.filter(r => r.h >= REST_HOURS);
    if (!d.rest.length) return '';
    if (fresh.length === d.rest.length) {
      const min = d.minRest;
      return `${labelList(d.main)} ${d.main.length === 1 ? 'ruht' : 'ruhen'} ${restText(min)}`;
    }
    return `${labelList(fresh.map(r => r.m))} ${fresh.length === 1 ? 'ist' : 'sind'} erholt`;
  };

  const muscles = Object.keys(MUSCLES)
    .filter(m => last[m])
    .map(m => ({ key: m, label: MUSCLES[m], hours: since(m) }))
    .sort((a, b) => a.hours - b.hours);

  if (trainedToday) {
    const nxt = info[byRest.find(id => id !== trainedToday.dayId) || cand];
    return {
      kind: 'done', dayId: trainedToday.dayId, title: `Heute schon erledigt: ${trainedToday.name}`,
      reason: 'Gönn deinen Muskeln jetzt Pause, Essen und Schlaf.',
      hint: null,
      alt: nxt ? { kind: 'train', dayId: nxt.id, title: `Nächstes Mal: ${nxt.name}`, reason: `${freshText(nxt)}.` } : null,
      muscles,
    };
  }

  if (level === 'red') {
    const freshDays = days.filter(id => info[id].fresh);
    const pool = freshDays.length ? freshDays : days;
    const light = [...pool].sort((a, b) => info[a].totalSets - info[b].totalSets || ring.indexOf(a) - ring.indexOf(b))[0];
    return {
      kind: 'rest', dayId: null, title: 'Heute lieber Pause',
      reason: 'Die Ampel steht auf Rot. Ein Spaziergang, 20 bis 30 Minuten lockeres Cardio oder Mobilität tun heute besser als schweres Training.',
      hint: null,
      alt: { kind: 'train', dayId: light, title: `Wenn du trotzdem trainierst: ${info[light].name}`, reason: `Das ist die leichteste Einheit mit ${info[light].totalSets} Sätzen, mach sie locker.` },
      muscles,
    };
  }

  const c = info[cand];
  let pick = cand;
  let reason;
  if (c.fresh) {
    reason = `${c.name} ist in der Reihenfolge dran, und ${freshText(c)}.`;
  } else {
    const best = byRest[0];
    const tired = c.rest.filter(r => r.h < REST_HOURS).sort((a, b) => a.h - b.h)[0];
    if (best !== cand && info[best].minRest > c.minRest) {
      pick = best;
      reason = `Eigentlich wäre ${c.name} dran, aber ${MUSCLES[tired.m]} hast du vor ${Math.max(1, Math.round(tired.h))} Stunden trainiert. ${info[best].name} passt besser: ${freshText(info[best])}.`;
    } else {
      reason = `${c.name} ist dran. ${MUSCLES[tired.m]} hattest du vor ${Math.max(1, Math.round(tired.h))} Stunden, darum heute etwas lockerer.`;
    }
  }
  const altId = byRest.find(id => id !== pick) || (pick !== cand ? cand : null);
  const alt = altId ? {
    kind: 'train', dayId: altId, title: `Oder ${info[altId].name}`,
    reason: info[altId].fresh ? `${freshText(info[altId])}.` : `${labelList(info[altId].main)} ${info[altId].main.length === 1 ? 'ist' : 'sind'} noch nicht ganz erholt (${restText(info[altId].minRest)}).`,
  } : null;
  const hint = level === 'yellow'
    ? 'Die Ampel steht auf Gelb: Mach pro Übung einen Satz weniger oder lass 3 Wiederholungen im Tank (RIR 3).'
    : null;
  return { kind: 'train', dayId: pick, title: `Heute: ${info[pick].name}`, reason, hint, alt, muscles };
}
