/* Hinweis-Karten auf „Heute“: welche zwei stehen oben, welche stehen unter „Weitere Hinweise“. Reine Funktionen, per node --test geprüft.
   Reihenfolge, von wichtig nach weniger wichtig:
   1. disclaimer  „Gut zu wissen“, einmal nach der Einrichtung, bis bestätigt
   2. report      Wochenbericht, nur montags bis angesehen oder „Später“
   3. ampel       Die Ampel rät heute etwas anderes als die Scheibe (Pause oder anderer Tag); gilt nur heute
   4. backup      Backup fällig: ohne Backup gehen die Daten mit dem Handy verloren
   5. checkin     Kurzer Check-in, täglich und freiwillig, macht die Ampel genauer
   6. birth       Geburtsdatum fehlt, einmalig, „Später“ möglich
   7. photo       Fortschrittsfoto der Woche fehlt
   8. suggestion  Vorschläge des Coachs; sie stehen auch unter Training, Ernährung und im Wochenbericht */
export const HINT_ORDER = ['disclaimer', 'report', 'ampel', 'backup', 'checkin', 'birth', 'photo', 'suggestion'];
export const MAX_HINTS = 2;

const rank = kind => { const i = HINT_ORDER.indexOf(kind); return i < 0 ? HINT_ORDER.length : i; };

/* list: [{ kind, ... }]. Liefert { shown, more }: die ersten max nach Priorität, der Rest in derselben Ordnung.
   Gleiche Arten (mehrere Vorschläge) bleiben in ihrer Reihenfolge. */
export function pickHints(list, max = MAX_HINTS) {
  const sorted = (list || []).filter(Boolean)
    .map((h, i) => ({ h, i }))
    .sort((a, b) => rank(a.h.kind) - rank(b.h.kind) || a.i - b.i)
    .map(x => x.h);
  return { shown: sorted.slice(0, max), more: sorted.slice(max) };
}

/* Braucht die Ampel eine eigene Karte? Nur wenn sie etwas anderes rät als die Scheibe oben.
   sug: Vorschlag aus domain/today-plan.js { kind: 'train' | 'rest' | 'done', dayId }, heroId: Tag auf der Scheibe.
   shiftRest: Pause nur, weil der Schichtplan heute kein Training vorsieht; das sagt schon die Schichtzeile. */
export function ampelIsHint(sug, heroId, { shiftRest = false } = {}) {
  if (!sug) return false;
  if (sug.kind === 'rest') return !shiftRest;
  if (sug.kind === 'train') return !!sug.dayId && sug.dayId !== heroId;
  return false;
}
