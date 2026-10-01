/* Vorlagen für neue Pläne (4.7, Recherche „Trainingspläne“ vom 30.09.2026). Übungen stehen mit ihrem Namen aus der
   Bibliothek: [Name, Sätze, Wdh. von, Wdh. bis, Pause in s, Steigerung in kg, Einheit ('reps' | 'sec'), Optionen]
   Optionen: { ss: true } verbindet die Übung mit der nächsten zum Supersatz (domain/superset.js).
   Regeln für alle Vorlagen:
   - Wichtigstes zuerst: Die Kurzversion (domain/plan-stats.js) nimmt die ersten vier Übungen.
   - Große Muskeln 10 bis 20 Sätze pro Woche bei perWeek Einheiten, mitbeanspruchte Muskeln zählen halb
     (Pelland 2025). Ausnahmen mit Absicht: Ganzkörper 2× (zwei Einheiten unter 60 Minuten tragen 8 bis 11)
     und der Smart-Zirkel (zwei Runden, etwa 30 Minuten).
   - Jeder große Muskel zweimal pro Woche, außer im 3er-Split. Höchstens etwa 11 Sätze pro Muskel und Einheit.
   - Einheiten höchstens 60 Minuten (Schätzung wie dayMinutes). Pausen: Grundübungen 120 bis 180 s,
     Isolation 60 bis 90 s; Supersätze nur aus Gegenspielern.
   - Kurzhantel-Übungen steigen um die Einstellung „Kurzhantel-Steigerung“; die 2 hier ist nur der Standard.
   perWeek: Einheiten pro Woche, für die die Vorlage gedacht ist (Empfehlung in der Einrichtung). */
const SS = { ss: true };

export const PLAN_TEMPLATES = [
  {
    id: 'fullbody2',
    name: 'Ganzkörper 2×',
    perWeek: 2,
    hint: 'Zwei Einheiten pro Woche, jede für den ganzen Körper. Gut für den Einstieg und für Wochen mit wenig Zeit.',
    days: [
      {
        name: 'Ganzkörper A', muscles: 'Beine, Brust, Rücken, Schultern, Arme', color: 'red',
        exercises: [
          ['Kniebeugen', 3, 6, 10, 180, 2.5],
          ['Bankdrücken', 3, 6, 10, 150, 2.5, 'reps', SS],
          ['Latzug', 3, 8, 12, 120, 2.5],
          ['Beinbeuger sitzend', 3, 10, 15, 90, 2.5],
          ['Kabel-Flys', 3, 12, 15, 75, 2.5, 'reps', SS],
          ['Rudern sitzend', 2, 10, 12, 90, 2.5],
          ['Seitheben', 2, 12, 20, 60, 2],
          ['Überkopf-Trizeps am Kabel', 2, 10, 15, 60, 2.5, 'reps', SS],
          ['Kurzhantel-Curls', 2, 10, 15, 60, 2],
        ],
      },
      {
        name: 'Ganzkörper B', muscles: 'Gesäß, Beine, Brust, Rücken, Schultern, Bauch', color: 'blue',
        exercises: [
          ['Rumänisches Kreuzheben', 3, 8, 10, 150, 2.5],
          ['Beinpresse', 3, 8, 12, 150, 5],
          ['Schrägbank-Kurzhanteldrücken', 3, 8, 12, 120, 2, 'reps', SS],
          ['Brustgestütztes Rudern', 3, 8, 12, 120, 2],
          ['Kurzhantel-Schulterdrücken', 2, 8, 12, 120, 2, 'reps', SS],
          ['Enger Latzug', 2, 10, 12, 90, 2.5],
          ['Beinstrecker', 2, 12, 15, 75, 2.5],
          ['Wadenheben', 2, 10, 15, 60, 2.5],
          ['Kabel-Crunch', 2, 10, 15, 60, 2.5],
        ],
      },
    ],
  },
  {
    id: 'fullbody3',
    name: 'Ganzkörper 3×',
    perWeek: 3,
    hint: 'Drei Einheiten A, B und C im Wechsel, jede für den ganzen Körper. Passt gut zu wechselnden Schichten: Es geht immer mit der nächsten Einheit weiter.',
    days: [
      {
        name: 'Ganzkörper A', muscles: 'Beine, Brust, Rücken, Arme', color: 'red',
        exercises: [
          ['Kniebeugen', 3, 6, 10, 180, 2.5],
          ['Bankdrücken', 3, 6, 10, 150, 2.5, 'reps', SS],
          ['Latzug', 3, 8, 12, 120, 2.5],
          ['Beinbeuger sitzend', 3, 10, 15, 90, 2.5],
          ['Seitheben', 2, 12, 20, 60, 2],
          ['Überkopf-Trizeps am Kabel', 3, 10, 15, 60, 2.5, 'reps', SS],
          ['Kurzhantel-Curls', 3, 10, 15, 60, 2],
          ['Wadenheben', 2, 10, 15, 60, 2.5],
        ],
      },
      {
        name: 'Ganzkörper B', muscles: 'Gesäß, Brust, Rücken, Arme, Bauch', color: 'blue',
        exercises: [
          ['Rumänisches Kreuzheben', 3, 8, 10, 150, 2.5],
          ['Schrägbank-Kurzhanteldrücken', 3, 8, 12, 120, 2, 'reps', SS],
          ['Brustgestütztes Rudern', 3, 8, 12, 120, 2],
          ['Bulgarische Kniebeuge', 2, 8, 12, 90, 2],
          ['Kabel-Flys', 2, 12, 15, 75, 2.5, 'reps', SS],
          ['Face Pulls', 2, 12, 15, 60, 2.5],
          ['Schrägbank-Curls', 3, 10, 15, 60, 2, 'reps', SS],
          ['Trizepsdrücken am Kabel', 3, 10, 15, 60, 2.5],
          ['Kabel-Crunch', 2, 10, 15, 60, 2.5],
        ],
      },
      {
        name: 'Ganzkörper C', muscles: 'Beine, Schultern, Rücken, Brust, Bauch', color: 'green',
        exercises: [
          ['Beinpresse', 3, 8, 12, 150, 5],
          ['Kurzhantel-Schulterdrücken', 3, 8, 12, 120, 2, 'reps', SS],
          ['Klimmzüge', 3, 6, 10, 120, 2.5],
          ['Kabel-Flys', 2, 12, 15, 75, 2.5, 'reps', SS],
          ['Rudern sitzend', 2, 10, 12, 90, 2.5],
          ['Beinstrecker', 2, 10, 15, 75, 2.5, 'reps', SS],
          ['Beinbeuger sitzend', 2, 10, 15, 75, 2.5],
          ['Wadenheben', 2, 10, 15, 60, 2.5],
          ['Hängendes Beinheben', 2, 8, 15, 60, 0],
        ],
      },
    ],
  },
  {
    id: 'upperlower4',
    name: 'Oberkörper/Unterkörper 4×',
    perWeek: 4,
    hint: 'Vier Einheiten, abwechselnd Ober- und Unterkörper. A-Tage schwerer, B-Tage mit mehr Wiederholungen. Jeder Muskel kommt zweimal pro Woche dran.',
    days: [
      {
        name: 'Oberkörper A', muscles: 'Brust, Rücken, Schultern, Arme', color: 'red',
        exercises: [
          ['Bankdrücken', 4, 5, 8, 180, 2.5, 'reps', SS],
          ['Latzug', 3, 6, 10, 150, 2.5],
          ['Brustgestütztes Rudern', 3, 8, 12, 120, 2],
          ['Kurzhantel-Schulterdrücken', 2, 8, 12, 120, 2],
          ['Seitheben', 3, 12, 20, 60, 2],
          ['Überkopf-Trizeps am Kabel', 3, 10, 15, 60, 2.5, 'reps', SS],
          ['SZ-Curls', 2, 8, 12, 60, 2.5],
        ],
      },
      {
        name: 'Unterkörper A', muscles: 'Beine, Gesäß, Waden, Bauch', color: 'green',
        exercises: [
          ['Kniebeugen', 4, 5, 8, 180, 2.5],
          ['Rumänisches Kreuzheben', 3, 6, 10, 150, 2.5],
          ['Beinstrecker', 2, 10, 15, 75, 2.5, 'reps', SS],
          ['Beinbeuger sitzend', 3, 10, 15, 75, 2.5],
          ['Wadenheben', 3, 10, 15, 60, 2.5],
          ['Kabel-Crunch', 2, 10, 15, 60, 2.5],
        ],
      },
      {
        name: 'Oberkörper B', muscles: 'Brust, Rücken, Schultern, Arme', color: 'blue',
        exercises: [
          ['Schrägbank-Kurzhanteldrücken', 3, 8, 12, 120, 2, 'reps', SS],
          ['Klimmzüge', 3, 6, 10, 150, 2.5],
          ['Rudern sitzend', 3, 10, 12, 90, 2.5],
          ['Kabel-Flys', 3, 12, 15, 75, 2.5],
          ['Face Pulls', 2, 12, 15, 60, 2.5],
          ['Seitheben', 2, 12, 20, 60, 2],
          ['Trizepsdrücken am Kabel', 3, 10, 15, 60, 2.5, 'reps', SS],
          ['Schrägbank-Curls', 3, 10, 15, 60, 2],
        ],
      },
      {
        name: 'Unterkörper B', muscles: 'Beine, Gesäß, Waden, Bauch', color: 'yellow',
        exercises: [
          ['Hackenschmidt', 3, 8, 12, 150, 2.5],
          ['Hip Thrust', 3, 8, 12, 120, 2.5],
          ['Bulgarische Kniebeuge', 2, 8, 12, 90, 2],
          ['Beinstrecker', 2, 12, 15, 75, 2.5, 'reps', SS],
          ['Beinbeuger sitzend', 2, 10, 15, 75, 2.5],
          ['Wadenheben', 3, 10, 15, 60, 2.5],
          ['Hängendes Beinheben', 2, 8, 15, 60, 0],
        ],
      },
    ],
  },
  {
    /* Der 3er-Split ist DEFAULT_PLAN in js/plans.js (Übungs-ids von früher), die Vorlage legt eine Kopie an */
    id: 'split',
    name: '3er-Split',
    perWeek: 3,
    hint: 'Push, Pull und Legs, drei Einheiten pro Woche. Jeder Muskel kommt einmal pro Woche dran, dafür mit mehr Sätzen.',
    fromDefault: true,
  },
  {
    id: 'ppl6',
    name: 'Push/Pull/Beine 6×',
    perWeek: 6,
    hint: 'Push, Pull und Beine je zweimal: A schwerer, B mit mehr Wiederholungen. Für Wochen mit viel Zeit; bei weniger Terminen läuft der Plan einfach weiter.',
    days: [
      {
        name: 'Push A', muscles: 'Brust, Schultern, Trizeps', color: 'red',
        exercises: [
          ['Bankdrücken', 4, 5, 8, 180, 2.5],
          ['Schrägbank-Kurzhanteldrücken', 3, 8, 12, 120, 2],
          ['Seitheben', 3, 12, 20, 60, 2],
          ['Kabel-Flys', 2, 12, 15, 75, 2.5],
          ['Überkopf-Trizeps am Kabel', 3, 10, 15, 75, 2.5],
        ],
      },
      {
        name: 'Pull A', muscles: 'Rücken, hintere Schulter, Bizeps', color: 'blue',
        exercises: [
          ['Klimmzüge', 4, 5, 10, 150, 2.5],
          ['Brustgestütztes Rudern', 3, 8, 12, 120, 2],
          ['Face Pulls', 2, 12, 15, 60, 2.5],
          ['Schrägbank-Curls', 3, 10, 15, 75, 2],
          ['Hammercurls', 2, 10, 15, 60, 2],
        ],
      },
      {
        name: 'Beine A', muscles: 'Beine, Gesäß, Waden, Bauch', color: 'green',
        exercises: [
          ['Kniebeugen', 4, 5, 8, 180, 2.5],
          ['Rumänisches Kreuzheben', 3, 8, 10, 150, 2.5],
          ['Beinstrecker', 2, 10, 15, 75, 2.5, 'reps', SS],
          ['Beinbeuger sitzend', 2, 10, 15, 75, 2.5],
          ['Wadenheben', 3, 10, 15, 60, 2.5],
          ['Kabel-Crunch', 3, 10, 15, 60, 2.5],
        ],
      },
      {
        name: 'Push B', muscles: 'Schultern, Brust, Trizeps', color: 'red',
        exercises: [
          ['Schulterdrücken', 3, 6, 10, 150, 2.5],
          ['Brustpresse', 3, 8, 12, 120, 2.5],
          ['Dip-Maschine', 2, 8, 12, 120, 2.5],
          ['Trizepsdrücken am Kabel', 3, 10, 15, 60, 2.5],
        ],
      },
      {
        name: 'Pull B', muscles: 'Rücken, hintere Schulter, Bizeps', color: 'blue',
        exercises: [
          ['Latzug', 3, 8, 12, 120, 2.5],
          ['Rudern sitzend', 3, 8, 12, 120, 2.5],
          ['Enger Latzug', 2, 10, 12, 90, 2.5],
          ['Reverse Flys', 2, 12, 20, 60, 2],
          ['SZ-Curls', 3, 8, 12, 75, 2.5],
        ],
      },
      {
        name: 'Beine B', muscles: 'Beine, Gesäß, Waden, Adduktoren, Bauch', color: 'green',
        exercises: [
          ['Hackenschmidt', 3, 8, 12, 150, 2.5],
          ['Hip Thrust', 3, 8, 12, 120, 2.5],
          ['Beinbeuger sitzend', 3, 10, 15, 75, 2.5],
          ['Beinstrecker', 2, 12, 15, 75, 2.5],
          ['Wadenheben', 3, 10, 15, 60, 2.5],
          ['Adduktoren', 2, 12, 15, 60, 2.5],
          ['Hängendes Beinheben', 2, 8, 15, 60, 0],
        ],
      },
    ],
  },
  {
    /* Zirkel: alle Stationen einer Runde verbunden, zwei Runden (2 Sätze). Das Gerät stellt Gewicht und Wiederholungen
       ein (autoLoad), darum keine eigene Steigerung. 90 s Pause nach der letzten Station, dann die zweite Runde. */
    id: 'smart',
    name: 'Nur Smart-Zirkel',
    perWeek: 2,
    smart: true,
    hint: 'Zirkel an den Smart-Geräten, zwei Runden, etwa 30 Minuten. A und B wechseln sich ab, Gewicht und Wiederholungen stellt das Gerät ein.',
    days: [
      {
        name: 'Zirkel A', muscles: 'Ganzkörper', color: 'red',
        exercises: [
          ['Beinpresse (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Brustpresse (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Latzug (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Beinbeuger (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Schulterpresse (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Butterfly Reverse (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Beinstrecker (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Bauchtrainer (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Adduktor (Smart-Zirkel)', 2, 10, 15, 90, 0],
        ],
      },
      {
        name: 'Zirkel B', muscles: 'Ganzkörper', color: 'blue',
        exercises: [
          ['Squat (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Ruderzug (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Brustpresse (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Hip Thrust (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Butterfly (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Beinbeuger (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Bizeps (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Trizeps (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Rückentrainer (Smart-Zirkel)', 2, 10, 15, 60, 0, 'reps', SS],
          ['Abduktor (Smart-Zirkel)', 2, 10, 15, 90, 0],
        ],
      },
    ],
  },
];

export const findTemplate = id => PLAN_TEMPLATES.find(t => t.id === id) || null;

export const PLAN_COLORS = ['red', 'blue', 'green', 'yellow', 'white'];
export const COLOR_NAMES = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb', white: 'Weiß' };
