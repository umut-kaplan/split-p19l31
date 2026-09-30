/* Welche Changelog-Einträge nach einem Update zu zeigen sind. Reine Funktionen. */

/* Einträge, die neuer sind als die zuletzt gesehene Version. Wer noch nie etwas gesehen hat
   (Stand von vor dieser Übersicht) oder eine unbekannte Version gespeichert hat, bekommt nur den neuesten. */
export function unseenChanges(changes, seen) {
  if (!changes.length) return [];
  const i = seen ? changes.findIndex(c => c.version === seen) : -1;
  if (i === 0) return [];
  return i > 0 ? changes.slice(0, i) : changes.slice(0, 1);
}

/* Beim Start zeigen? Nur nach der Einrichtung; wer gerade eingerichtet hat, kennt den Stand schon. */
export const shouldShow = (settings, version) => !!settings.onboardingDone && settings.seenVersion !== version;

/* „2026-09-30“ als „30.09.2026“ */
export const dateDe = ymd => ymd.split('-').reverse().join('.');
