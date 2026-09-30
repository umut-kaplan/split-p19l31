/* Supersätze und Pausenlogik der laufenden Einheit. Reine Funktionen.
   ss: true an einer Übung (im Plan und in der Einheit) verbindet sie mit der direkt folgenden.
   Zwei oder mehr so verbundene Übungen bilden eine Gruppe; ss an der letzten Übung eines Tages zählt nicht. */
import { setType, isWarmup } from './settypes.js';

/* Pause nach einem Aufwärmsatz: höchstens so lang, kürzer, wenn die Übung selbst weniger vorsieht */
export const WARMUP_REST = 60;

/* Gruppen als Listen von Indizes in Reihenfolge, z. B. [[0], [1, 2], [3]] */
export function groupsOf(list = []) {
  const out = [];
  list.forEach((x, i) => {
    if (i > 0 && list[i - 1] && list[i - 1].ss === true) out[out.length - 1].push(i);
    else out.push([i]);
  });
  return out;
}

/* Die Gruppe, zu der Übung i gehört */
export const groupAt = (list, i) => groupsOf(list).find(g => g.includes(i)) || [i];

const openWork = x => (x.log || []).some(s => !s.done && !isWarmup(s));

/* Was passiert nach dem Abhaken von Satz j der Übung i?
   ex: Übungen der Einheit mit log: [{ done, t }], rest in Sekunden. Der Satz j gilt schon als abgehakt.
   Regeln in dieser Reihenfolge:
   1. Folgt in derselben Übung ein offener Dropsatz, geht es ohne Pause weiter.
   2. Nach einem Aufwärmsatz kommt eine kurze Pause (WARMUP_REST, höchstens die Pause der Übung).
   3. In einem Supersatz gibt es keine Pause, solange eine spätere Übung der Gruppe noch offene Arbeitssätze hat.
      Sonst beginnt die Pause der gerade abgehakten Übung, also nach der letzten Übung der Runde.
   4. Sonst die Pause der Übung.
   Liefert { seconds, label, why }: seconds 0 heißt keine Pause, why 'drop' | 'superset' | 'warmup' | 'round' | 'rest';
   bei why 'superset' nennt next den Index der nächsten Übung. */
export function restAfter(ex, i, j) {
  const x = ex[i];
  const log = x.log || [];
  const s = log[j];
  const next = log[j + 1];
  if (next && !next.done && setType(next) === 'd') return { seconds: 0, label: x.name, why: 'drop' };
  if (isWarmup(s)) return { seconds: Math.min(x.rest || 0, WARMUP_REST), label: x.name, why: 'warmup' };
  const g = groupAt(ex, i);
  if (g.length > 1) {
    const later = g.find(k => k > i && openWork(ex[k]));
    if (later != null) return { seconds: 0, label: x.name, why: 'superset', next: later };
    return { seconds: x.rest || 0, label: 'dem Supersatz', why: 'round' };
  }
  return { seconds: x.rest || 0, label: x.name, why: 'rest' };
}

/* Plan-Editor: Verbindungen gehören zu den Plätzen, nicht zu den Übungen.
   Tauschen zwei Übungen den Platz, bleibt die Gruppe bestehen; so lässt sich die Reihenfolge im Supersatz ändern. */
export function swapKeepLinks(list, i, j) {
  if (i < 0 || j < 0 || i >= list.length || j >= list.length || i === j) return list;
  const a = list[i].ss === true, b = list[j].ss === true;
  [list[i], list[j]] = [list[j], list[i]];
  setLink(list[i], a);
  setLink(list[j], b);
  tidyLinks(list);
  return list;
}

/* Entfernt Übung i. Die Nachbarn bleiben nur verbunden, wenn die Übung in der Mitte einer Gruppe stand. */
export function removeKeepLinks(list, i) {
  if (i < 0 || i >= list.length) return list;
  if (i > 0) setLink(list[i - 1], list[i - 1].ss === true && list[i].ss === true);
  list.splice(i, 1);
  tidyLinks(list);
  return list;
}

/* Die letzte Übung hat keine nächste; eine Verbindung dort würde sonst an eine später angehängte Übung wandern */
export function tidyLinks(list) {
  const last = list[list.length - 1];
  if (last) setLink(last, false);
  return list;
}

export function setLink(e, on) {
  if (!e) return;
  if (on) e.ss = true;
  else delete e.ss;
}

/* Nur ss: true bleibt, andere Werte fallen weg; an der letzten Übung (last) fällt ss immer weg. Verändert e nicht. */
export function cleanLink(e, last = false) {
  if (!e || typeof e !== 'object' || !('ss' in e) || (e.ss === true && !last)) return e;
  const { ss, ...rest } = e;
  return rest;
}
