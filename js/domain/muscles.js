/* Muskelgruppen für Bibliothek und Wochenvolumen. Primär zählt ein Satz voll, sekundär halb.
   4.7: traps und lower_back neu. Gespeicherte Trainings tragen nur Übungsnamen; das Wochenvolumen schlägt die
   Muskeln beim Rechnen in der Bibliothek nach und folgt damit von selbst der neuen Zuordnung. */
export const MUSCLES = {
  chest: 'Brust',
  shoulders: 'Schultern',
  back: 'Rücken',
  lower_back: 'Unterer Rücken',
  traps: 'Nacken/Trapez',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  forearms: 'Unterarme',
  abs: 'Bauch',
  quads: 'Oberschenkel vorne',
  hamstrings: 'Oberschenkel hinten',
  glutes: 'Gesäß',
  calves: 'Waden',
  adductors: 'Adduktoren',
  abductors: 'Abduktoren',
};

export const SECONDARY_WEIGHT = 0.5;

/* Name im Fließtext: „unterer Rücken“ klein, alle anderen wie in MUSCLES (Überschriften und Listen) */
export const muscleInText = m => (m === 'lower_back' ? 'unterer Rücken' : MUSCLES[m] || m);

/* Zielbereich harter Sätze pro Muskelgruppe und Woche. Standard 10 bis 20 (Pelland 2025, Schoenfeld 2017).
   Kleiner bei Waden und Bauch (Entscheidung 4.7). Ohne Zielbereich (Prüfung 4.7): Nacken/Trapez und unterer Rücken
   arbeiten vor allem bei Grundübungen mit (Kreuzheben, Rudern, Schulterdrücken). Ein Mindestziel hielte die Vorlagen
   dauerhaft „unter dem Ziel“; die Muskelansicht zeigt ihre Sätze darum ohne Ampel, der Coach schlägt nichts vor. */
export const WEEKLY_SET_TARGET = [10, 20];
export const WEEKLY_SET_TARGETS = {
  calves: [4, 10],
  abs: [4, 10],
};
export const UNRATED_MUSCLES = ['traps', 'lower_back'];
/* [von, bis] oder null für die Gruppen ohne Zielbereich */
export const weeklyTarget = m => (UNRATED_MUSCLES.includes(m) ? null : WEEKLY_SET_TARGETS[m] || WEEKLY_SET_TARGET);

const andList = l => (l.length > 1 ? `${l.slice(0, -1).join(', ')} und ${l[l.length - 1]}` : l.join(''));

/* Satz für Legenden: „Zielbereich 10 bis 20 Sätze pro Woche (Waden und Bauch: 4 bis 10). Nacken/Trapez und unterer
   Rücken ohne Zielbereich, sie arbeiten bei Grundübungen mit.“ */
export function weeklyTargetText() {
  const [lo, hi] = WEEKLY_SET_TARGET;
  const groups = new Map();
  Object.entries(WEEKLY_SET_TARGETS).forEach(([m, t]) => {
    const k = t.join(' bis ');
    groups.set(k, [...(groups.get(k) || []), MUSCLES[m]]);
  });
  const extra = [...groups].map(([k, names]) => `${andList(names)}: ${k}`).join('; ');
  const free = UNRATED_MUSCLES.map(muscleInText);
  return `Zielbereich ${lo} bis ${hi} Sätze pro Woche${extra ? ` (${extra})` : ''}.`
    + (free.length ? ` ${andList(free)} ohne Zielbereich, sie arbeiten bei Grundübungen mit.` : '');
}
