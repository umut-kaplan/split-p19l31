/* Vorlagen für neue Pläne. Übungen stehen mit ihrem Namen aus der Bibliothek:
   [Name, Sätze, Wdh. von, Wdh. bis, Pause in s, Steigerung in kg, Einheit (optional 'sec')] */
export const PLAN_TEMPLATES = [
  {
    id: 'fullbody2',
    name: 'Ganzkörper 2×',
    hint: 'Zwei Einheiten pro Woche, jede trainiert den ganzen Körper. Gut für den Einstieg und volle Wochen.',
    days: [
      {
        name: 'Ganzkörper A', muscles: 'Beine, Brust, Rücken, Schultern, Bauch', color: 'red',
        exercises: [
          ['Kniebeugen', 3, 6, 10, 180, 2.5],
          ['Bankdrücken', 3, 6, 10, 150, 2.5],
          ['Langhantelrudern', 3, 8, 12, 150, 2.5],
          ['Kurzhantel-Schulterdrücken', 3, 8, 12, 120, 1],
          ['Beinbeuger', 2, 10, 15, 75, 2.5],
          ['Plank', 3, 30, 60, 60, 0, 'sec'],
        ],
      },
      {
        name: 'Ganzkörper B', muscles: 'Beine, Rücken, Brust, Schultern, Bauch', color: 'blue',
        exercises: [
          ['Rumänisches Kreuzheben', 3, 8, 10, 180, 2.5],
          ['Schrägbank-Kurzhanteldrücken', 3, 8, 12, 120, 1],
          ['Latzug', 3, 8, 12, 120, 2.5],
          ['Ausfallschritte', 2, 10, 12, 90, 1],
          ['Seitheben', 2, 12, 15, 75, 1],
          ['Kabel-Crunch', 2, 12, 15, 60, 2.5],
        ],
      },
    ],
  },
  {
    id: 'upperlower4',
    name: 'Oberkörper/Unterkörper 4×',
    hint: 'Vier Einheiten pro Woche, abwechselnd Ober- und Unterkörper. Jeder Muskel kommt zweimal dran.',
    days: [
      {
        name: 'Oberkörper A', muscles: 'Brust, Rücken, Schultern, Arme', color: 'red',
        exercises: [
          ['Bankdrücken', 4, 6, 8, 150, 2.5],
          ['Langhantelrudern', 4, 6, 10, 150, 2.5],
          ['Schulterdrücken', 3, 8, 10, 120, 2.5],
          ['Latzug', 3, 8, 12, 120, 2.5],
          ['Hammercurls', 2, 10, 15, 75, 1],
          ['Trizepsdrücken am Kabel', 2, 10, 15, 75, 2.5],
        ],
      },
      {
        name: 'Unterkörper A', muscles: 'Beine, Gesäß, Waden, Bauch', color: 'green',
        exercises: [
          ['Kniebeugen', 4, 6, 8, 180, 2.5],
          ['Rumänisches Kreuzheben', 3, 8, 10, 150, 2.5],
          ['Beinpresse', 3, 10, 12, 120, 5],
          ['Beinbeuger', 3, 10, 15, 75, 2.5],
          ['Wadenheben', 3, 10, 15, 75, 2.5],
          ['Plank', 3, 30, 60, 60, 0, 'sec'],
        ],
      },
      {
        name: 'Oberkörper B', muscles: 'Brust, Rücken, Schultern, Arme', color: 'blue',
        exercises: [
          ['Schrägbank-Kurzhanteldrücken', 3, 8, 12, 120, 1],
          ['Klimmzüge', 3, 6, 10, 150, 2.5],
          ['Kurzhantel-Schulterdrücken', 3, 8, 12, 120, 1],
          ['Rudern sitzend', 3, 10, 12, 90, 2.5],
          ['Seitheben', 3, 12, 15, 60, 1],
          ['Kurzhantel-Curls', 2, 10, 12, 75, 1],
        ],
      },
      {
        name: 'Unterkörper B', muscles: 'Beine, Gesäß, Waden, Bauch', color: 'yellow',
        exercises: [
          ['Hackenschmidt', 3, 8, 12, 150, 2.5],
          ['Hip Thrust', 3, 8, 12, 120, 2.5],
          ['Bulgarische Kniebeuge', 2, 8, 12, 90, 1],
          ['Beinstrecker', 3, 10, 15, 75, 2.5],
          ['Wadenheben', 3, 10, 15, 75, 2.5],
          ['Hängendes Beinheben', 3, 10, 15, 60, 0],
        ],
      },
    ],
  },
  {
    id: 'ppl3',
    name: 'Push/Pull/Legs',
    hint: 'Drei Einheiten pro Woche: Drücken, Ziehen, Beine. Aufgebaut wie der 3er-Split, als eigener Plan zum Anpassen.',
    fromDefault: true,
  },
];

export const PLAN_COLORS = ['red', 'blue', 'green', 'yellow', 'white'];
export const COLOR_NAMES = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb', white: 'Weiß' };
