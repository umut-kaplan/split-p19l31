/* Geräte des Smart-Zirkels (4.7), z. B. EGYM. Jedes Gerät ist eine eigene Übung: Die kg am Display sind nicht mit
   Steckgewicht-Maschinen vergleichbar, getrennte Übungen halten Verlauf und Rekorde sauber. Namen neutral
   „… (Smart-Zirkel)“, der Alias „EGYM …“ dient der Suche. autoLoad 'smart': Das Gerät stellt das Gewicht ein,
   die App schlägt keine Steigerung vor. Eine Zirkelrunde ist ein Satz; Methode je Satz siehe domain/settypes.js.
   Grundlage: Recherche „Übungen und Geräte“ (30.09.2026), Abschnitt 4. */
import { exercise } from './exercise-schema.js';

/* Tempo und Kurve hängen von der Methode ab (Explonic explosiv, isokinetisch mit festem Tempo), darum legen die
   Anleitungen kein Tempo fest: Sie verweisen auf die Anzeige und sagen nur „kontrolliert“ für den Rückweg. */
const LOGIN = 'Am Gerät anmelden; Sitz, Bewegungsweg und Gewicht stellt das Gerät selbst ein.';
const CURVE = 'Dabei der Anzeige auf dem Display folgen.';
const PACE = 'Nicht auf die Anzeige am Display achten.';

const X = (id, device, d) => exercise(id, `${device} (Smart-Zirkel)`, {
  ...d,
  aliases: [`EGYM ${device}`, `${device} Zirkel`, ...(d.aliases || [])],
  unit: 'reps',
  equipment: ['smart-zirkel'],
  autoLoad: 'smart',
});

export const EXERCISES_SMART = [
  /* ---------- Oberkörper ---------- */
  X('smart-brustpresse', 'Brustpresse', {
    type: 'compound', primary: ['chest'], secondary: ['triceps', 'shoulders'],
    steps: [
      LOGIN,
      'Den Rücken an die Lehne legen, die Füße fest auf den Boden stellen und die Griffe etwa auf Brusthöhe fassen.',
      'Die Griffe nach vorn drücken, bis die Arme fast gestreckt sind. ' + CURVE,
      'Kontrolliert zurückführen, bis die Brust gedehnt ist; die Schultern bleiben unten.',
    ],
    mistakes: ['Die Schultern nach vorn rollen lassen.', 'Die Arme vorn ganz durchdrücken.', PACE],
    stresses: ['Ellenbogen'],
    alternatives: ['brustpresse', 'butterfly', 'kh-bankdruecken'],
  }),
  X('smart-butterfly', 'Butterfly', {
    type: 'isolation', primary: ['chest'], secondary: ['shoulders'],
    steps: [
      LOGIN,
      'Den Rücken an die Lehne legen und Unterarme oder Hände an die Polster bringen; die Ellenbogen sind leicht gebeugt.',
      'Die Arme im Bogen vor der Brust zusammenführen. ' + CURVE,
      'Kontrolliert öffnen, bis die Brust gedehnt ist, ohne dass die Schultern nach vorn kippen.',
    ],
    mistakes: ['Mit den Händen drücken, statt die Arme im Bogen zu führen.', 'Den Rücken von der Lehne lösen.', PACE],
    stresses: ['Schulter'],
    alternatives: ['butterfly', 'kabel-flys', 'brustpresse'],
  }),
  X('smart-schulterpresse', 'Schulterpresse', {
    type: 'compound', primary: ['shoulders'], secondary: ['triceps'],
    steps: [
      LOGIN,
      'Den Rücken an die Lehne legen und die Griffe etwa auf Schulterhöhe fassen.',
      'Die Griffe nach oben drücken, bis die Arme fast gestreckt sind. ' + CURVE,
      'Kontrolliert zurück bis knapp unter Kinnhöhe.',
    ],
    mistakes: ['Ins Hohlkreuz drücken.', 'Die Schultern zu den Ohren ziehen.', PACE],
    stresses: ['Schulter'],
    alternatives: ['schulterpresse-maschine', 'kh-schulterdruecken', 'reverse-flys'],
  }),
  X('smart-butterfly-reverse', 'Butterfly Reverse', {
    aliases: ['EGYM Reverse Butterfly'],
    type: 'isolation', primary: ['shoulders'], secondary: ['back', 'traps'],
    steps: [
      LOGIN,
      'Mit der Brust zur Lehne sitzen und die Griffe vor dem Körper fassen; die Ellenbogen sind leicht gebeugt.',
      'Die Arme im Bogen nach hinten außen führen, bis sie etwa in einer Linie mit den Schultern sind. ' + CURVE,
      'Kontrolliert wieder nach vorn führen.',
    ],
    mistakes: ['Die Schulterblätter kräftig zusammenziehen, dann arbeitet vor allem der Rücken.', 'Die Brust von der Lehne lösen.', PACE],
    stresses: [],
    alternatives: ['reverse-flys', 'face-pulls'],
  }),
  X('smart-latzug', 'Latzug', {
    type: 'compound', primary: ['back'], secondary: ['biceps'],
    steps: [
      LOGIN,
      'Die Oberschenkel unter die Polster schieben und den Griff etwas breiter als schulterbreit fassen.',
      'Den Griff zur oberen Brust ziehen, die Ellenbogen gehen nach unten und hinten. ' + CURVE,
      'Kontrolliert nach oben führen, bis die Arme fast gestreckt sind.',
    ],
    mistakes: ['Weit nach hinten lehnen und mit Schwung ziehen.', 'Die Schultern hochziehen.', PACE],
    stresses: ['Schulter'],
    alternatives: ['latzug', 'enger-latzug', 'klimmzuege'],
  }),
  X('smart-ruderzug', 'Ruderzug', {
    aliases: ['EGYM Rudern'],
    type: 'compound', primary: ['back'], secondary: ['biceps', 'shoulders'],
    steps: [
      LOGIN,
      'Die Brust an das Polster legen und die Griffe mit gestreckten Armen fassen.',
      'Die Griffe zum Körper ziehen und die Schulterblätter zusammenführen. ' + CURVE,
      'Kontrolliert nach vorn führen, bis die Arme wieder gestreckt sind.',
    ],
    mistakes: ['Die Brust vom Polster lösen und mit dem Oberkörper ziehen.', 'Die Schultern zu den Ohren ziehen.', PACE],
    stresses: [],
    alternatives: ['rudern-sitzend', 'brustgestuetztes-rudern', 'kh-rudern'],
  }),
  X('smart-bizeps', 'Bizeps', {
    type: 'isolation', primary: ['biceps'], secondary: ['forearms'],
    steps: [
      LOGIN,
      'Die Oberarme flach auf das Polster legen, die Ellenbogen auf Höhe der Drehachse.',
      'Die Griffe zu den Schultern beugen. ' + CURVE,
      'Kontrolliert ablassen, bis die Arme fast gestreckt sind.',
    ],
    mistakes: ['Die Oberarme vom Polster heben.', 'Unten nicht weit genug strecken.', PACE],
    stresses: [],
    alternatives: ['kh-curls', 'sz-curls', 'hammercurls'],
  }),
  X('smart-trizeps', 'Trizeps', {
    type: 'isolation', primary: ['triceps'],
    steps: [
      LOGIN,
      'Die Griffe fassen; die Ellenbogen sind auf Höhe der Drehachse, die Oberarme bleiben ruhig.',
      'Die Arme strecken, bis sie fast gerade sind. ' + CURVE,
      'Kontrolliert zurückbeugen.',
    ],
    mistakes: ['Mit den Schultern nachdrücken.', 'Die Ellenbogen vom Körper wegwandern lassen.', PACE],
    stresses: ['Ellenbogen'],
    alternatives: ['trizepsdruecken-kabel', 'ueberkopf-trizeps-kabel'],
  }),

  /* ---------- Beine und Gesäß ---------- */
  X('smart-beinpresse', 'Beinpresse', {
    type: 'compound', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'adductors'],
    steps: [
      LOGIN,
      'Den Rücken an die Lehne legen und die Füße hüftbreit mitten auf die Platte stellen.',
      'Die Platte wegdrücken, bis die Beine fast gestreckt sind; die Knie zeigen in Richtung Zehen. ' + CURVE,
      'Kontrolliert beugen, bis die Knie etwa im rechten Winkel stehen, ohne dass das Becken abhebt.',
    ],
    mistakes: ['Die Knie oben durchdrücken.', 'Die Knie nach innen fallen lassen.', PACE],
    stresses: ['Knie'],
    alternatives: ['beinpresse', 'hackenschmidt', 'hip-thrust'],
  }),
  X('smart-squat', 'Squat', {
    aliases: ['EGYM Kniebeuge', 'Kniebeuge (Smart-Zirkel)'],
    type: 'compound', primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings'],
    steps: [
      LOGIN,
      'Die Schultern unter die Polster bringen und die Füße etwa schulterbreit auf die Platte stellen.',
      'In die Knie gehen, bis die Oberschenkel etwa waagerecht sind; der Rücken bleibt gerade. ' + CURVE,
      'Über die ganze Fußsohle wieder hochdrücken.',
    ],
    mistakes: ['Die Fersen abheben.', 'Die Knie nach innen fallen lassen.', PACE],
    stresses: ['Knie', 'Unterer Rücken'],
    alternatives: ['hackenschmidt', 'beinpresse', 'hip-thrust'],
  }),
  X('smart-beinstrecker', 'Beinstrecker', {
    type: 'isolation', primary: ['quads'],
    steps: [
      LOGIN,
      'Den Rücken an die Lehne legen; die Knie sind auf Höhe der Drehachse, die Rolle liegt vorn über den Knöcheln.',
      'Die Beine strecken, bis sie fast gerade sind. ' + CURVE,
      'Kontrolliert beugen, ohne das Gewicht abzulegen.',
    ],
    mistakes: ['Mit dem Oberkörper Schwung holen.', 'Das Gesäß vom Sitz heben.', PACE],
    stresses: ['Knie'],
    alternatives: ['beinstrecker', 'beinpresse', 'hip-thrust'],
  }),
  X('smart-beinbeuger', 'Beinbeuger', {
    type: 'isolation', primary: ['hamstrings'], secondary: ['calves'],
    steps: [
      LOGIN,
      'Den Rücken an die Lehne legen; die Knie sind auf Höhe der Drehachse, die Rolle liegt hinten über den Fersen, das Oberschenkelpolster sitzt fest.',
      'Die Unterschenkel nach unten und hinten beugen. ' + CURVE,
      'Kontrolliert zurück, bis die Beine fast gestreckt sind.',
    ],
    mistakes: ['Das Becken vom Sitz heben.', 'Nur eine halbe Bewegung machen.', PACE],
    stresses: [],
    alternatives: ['beinbeuger-sitzend', 'beinbeuger', 'rumaenisches-kreuzheben'],
  }),
  X('smart-hip-thrust', 'Hip Thrust', {
    type: 'compound', primary: ['glutes'], secondary: ['hamstrings'],
    steps: [
      LOGIN,
      'Den oberen Rücken an das Polster legen; das Hüftpolster liegt über der Hüfte, die Füße stehen hüftbreit.',
      'Die Hüfte nach oben drücken, bis Oberkörper und Oberschenkel eine Linie bilden. ' + CURVE,
      'Oben den Po anspannen, dann kontrolliert absenken.',
    ],
    mistakes: ['Oben ins Hohlkreuz gehen, statt die Hüfte zu strecken.', 'Über die Zehen statt über die Fersen drücken.', PACE],
    stresses: ['Hüfte'],
    alternatives: ['hip-thrust', 'beinbeuger-sitzend', 'rumaenisches-kreuzheben'],
  }),
  X('smart-abduktor', 'Abduktor', {
    type: 'isolation', primary: ['abductors'], secondary: ['glutes'],
    steps: [
      LOGIN,
      'Den Rücken an die Lehne legen; die Polster liegen an den Außenseiten der Knie.',
      'Die Beine gegen den Widerstand nach außen drücken. ' + CURVE,
      'Kontrolliert wieder schließen.',
    ],
    mistakes: ['Das Becken auf dem Sitz nach vorn schieben.', 'Mit dem Oberkörper Schwung holen.', PACE],
    stresses: [],
    alternatives: ['abduktoren', 'hip-thrust'],
  }),
  X('smart-adduktor', 'Adduktor', {
    type: 'isolation', primary: ['adductors'],
    steps: [
      LOGIN,
      'Den Rücken an die Lehne legen; die Polster liegen an den Innenseiten der Knie.',
      'Die Beine gegen den Widerstand zusammendrücken. ' + CURVE,
      'Kontrolliert öffnen, bis innen im Oberschenkel eine leichte Dehnung kommt.',
    ],
    mistakes: ['Weiter öffnen, als es angenehm ist.', 'Mit dem Oberkörper Schwung holen.', PACE],
    stresses: [],
    alternatives: ['adduktoren', 'goblet-squat'],
  }),

  /* ---------- Rumpf ---------- */
  X('smart-bauchtrainer', 'Bauchtrainer', {
    aliases: ['EGYM Bauch'],
    type: 'isolation', primary: ['abs'],
    steps: [
      LOGIN,
      'Den Rücken an die Lehne legen; die Polster liegen vorn an Brust oder Schultern.',
      'Den Oberkörper einrollen, als würdest du die Rippen zum Becken ziehen. ' + CURVE,
      'Kontrolliert wieder aufrichten.',
    ],
    mistakes: ['Mit den Armen drücken.', 'Aus der Hüfte beugen, statt den Rumpf einzurollen.', PACE],
    stresses: ['Unterer Rücken'],
    alternatives: ['bauchmaschine', 'kabel-crunch', 'plank'],
  }),
  X('smart-rueckentrainer', 'Rückentrainer', {
    aliases: ['EGYM Rückenstrecker'],
    type: 'isolation', primary: ['lower_back'], secondary: ['glutes'],
    steps: [
      LOGIN,
      'Das Polster liegt am oberen Rücken, die Füße stehen fest.',
      'Den Oberkörper gegen das Polster nach hinten aufrichten, bis er etwa senkrecht ist. ' + CURVE,
      'Kontrolliert wieder nach vorn beugen, der Rücken bleibt dabei gerade.',
    ],
    mistakes: ['Hinten ins Hohlkreuz überstrecken.', 'Aus der Hüfte Schwung holen.', PACE],
    stresses: ['Unterer Rücken'],
    alternatives: ['rueckenstrecker', 'hip-thrust', 'rumaenisches-kreuzheben'],
  }),
  X('smart-rotator', 'Rotator', {
    aliases: ['EGYM Rumpfrotation'],
    type: 'isolation', primary: ['abs'],
    steps: [
      LOGIN,
      'Aufrecht sitzen; die Beine sind fixiert, Griffe oder Polster liegen vor der Brust.',
      'Den Oberkörper ruhig zur Seite drehen, die Hüfte bleibt stehen. ' + CURVE,
      'Kontrolliert zurück zur Mitte.',
    ],
    mistakes: ['Mit den Armen Schwung holen.', 'Die Hüfte mitdrehen.', PACE],
    stresses: ['Unterer Rücken'],
    alternatives: ['kabel-crunch', 'plank', 'bauchmaschine'],
  }),
];
