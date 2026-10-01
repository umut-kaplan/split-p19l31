/* Übungsbibliothek. Anleitungen selbst geschrieben, Bilder von wger.de (Quellen in data/QUELLEN.md).
   Schema eines Eintrags und Aufteilung auf mehrere Dateien: data/exercise-schema.js.
   Hier stehen die Übungen bis 4.6 und die Grundübungen für die Plan-Vorlagen; die Datei führt am Ende alles zusammen. */
import { exercise } from './exercise-schema.js';
import { EXERCISES_KERN, ALTERNATIVES_ADD } from './exercises-kern.js';
import { EXERCISES_SMART } from './exercises-smart.js';

/* Bildquellen: [Urheber, Lizenz, Übungsnummer auf wger.de]. „wger.de“ steht dort, wo wger keinen Namen nennt. */
const CREDITS = {
  'bankdruecken': ['Everkinetic', 'CC BY-SA 3.0', 73],
  'schraegbankdruecken': ['Everkinetic', 'CC BY-SA 3.0', 538],
  'schulterdruecken': ['Everkinetic', 'CC BY-SA 3.0', 566],
  'seitheben': ['Everkinetic', 'CC BY-SA 3.0', 348],
  'kabel-flys': ['Everkinetic', 'CC BY-SA 3.0', 323],
  'kabel-flys-unten': ['JackSparrow', 'CC BY-SA 4.0', 1296],
  'trizepsdruecken-kabel': ['nishant0712', 'CC BY-SA 4.0', 1900],
  'latzug': ['Franpol', 'CC BY-SA 4.0', 1136],
  'klimmzuege': ['Imobard', 'CC BY-SA 4.0', 475],
  'rudern-sitzend': ['Everkinetic', 'CC BY-SA 3.0', 394],
  'brustgestuetztes-rudern': ['carlos3c', 'CC BY-SA 4.0', 1283],
  'enger-latzug': ['Franpol', 'CC BY-SA 4.0', 158],
  'langhantel-curls': ['Everkinetic', 'CC BY-SA 3.0', 91],
  'sz-curls': ['Franpol', 'CC BY-SA 4.0', 94],
  'hammercurls': ['Everkinetic', 'CC BY-SA 3.0', 272],
  'kniebeugen': ['Workout Guru', 'CC BY-SA 4.0', 1801],
  'hackenschmidt': ['Everkinetic', 'CC BY-SA 3.0', 375],
  'beinpresse': ['Franpol', 'CC BY-SA 4.0', 373],
  'beinbeuger': ['Everkinetic', 'CC BY-SA 3.0', 365],
  'beinbeuger-sitzend': ['Everkinetic', 'CC BY-SA 3.0', 366],
  'beinstrecker': ['Franpol', 'CC BY-SA 4.0', 369],
  'wadenheben': ['clafal', 'CC BY-SA 4.0', 622],
  'wadendruecken-beinpresse': ['wger.de', 'CC BY-SA 4.0', 146],
  'adduktoren': ['wger.de', 'CC BY-SA 4.0', 12],
  'abduktoren': ['wger.de', 'CC BY-SA 4.0', 1748],
  'plank': ['utkb', 'CC BY-SA 4.0', 458],
  'kh-bankdruecken': ['Everkinetic', 'CC BY-SA 3.0', 75],
  'kh-schraegbankdruecken': ['Everkinetic', 'CC BY-SA 3.0', 537],
  'brustpresse': ['roneydya', 'CC BY-SA 4.0', 129],
  'butterfly': ['Everkinetic', 'CC BY-SA 3.0', 135],
  'liegestuetze': ['Settebello', 'CC BY-SA 4.0', 1551],
  'kh-schulterdruecken': ['Everkinetic', 'CC BY-SA 3.0', 567],
  'schulterpresse-maschine': ['wger.de', 'CC BY-SA 3.0', 543],
  'reverse-flys': ['cshep442', 'CC BY-SA 4.0', 487],
  'rumaenisches-kreuzheben': ['AlucardEvil40', 'CC BY-SA 4.0', 1652],
  'kreuzheben': ['philip', 'CC BY-SA 4.0', 184],
  'langhantelrudern': ['Everkinetic', 'CC BY-SA 3.0', 83],
  'kh-rudern': ['Franpol', 'CC BY-SA 4.0', 81],
  'ausfallschritte': ['Everkinetic', 'CC BY-SA 3.0', 206],
  'bulgarian-split-squat': ['Franpol', 'CC BY-SA 4.0', 988],
  'hip-thrust': ['AlucardEvil40', 'CC BY-SA 4.0', 1642],
  'goblet-squat': ['philip', 'CC BY-SA 4.0', 203],
  'barren-dips': ['cshep442', 'CC BY-SA 4.0', 194],
  'kh-curls': ['Everkinetic', 'CC BY-SA 3.0', 92],
};

/* Baut einen Eintrag und hängt Bild und Quelle an, wenn es eines gibt */
const X = (id, name, d) => exercise(id, name, d, CREDITS[id]);

export const EXERCISES_BASE = [
  /* ---------- Brust ---------- */
  X('bankdruecken', 'Bankdrücken', {
    aliases: ['Flachbankdrücken', 'Bankdrücken Langhantel', 'Bench Press'],
    type: 'compound', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: ['langhantel', 'bankdrueckstation'],
    steps: [
      'Auf die Bank legen, Augen unter der Stange, Füße fest am Boden.',
      'Schulterblätter zusammen und nach unten ziehen, leichtes Hohlkreuz.',
      'Stange etwas breiter als schulterbreit greifen und aus der Ablage heben.',
      'Kontrolliert zur unteren Brust senken, Ellenbogen etwa 45 bis 70 Grad vom Körper.',
      'Kraftvoll nach oben drücken, bis die Arme fast gestreckt sind.',
    ],
    mistakes: ['Stange auf der Brust abfedern lassen.', 'Ellenbogen 90 Grad seitlich abspreizen.', 'Po hebt von der Bank ab.'],
    stresses: ['Schulter', 'Ellenbogen', 'Handgelenk'],
    alternatives: ['kh-bankdruecken', 'brustpresse', 'butterfly'],
  }),
  X('schraegbankdruecken', 'Schrägbankdrücken', {
    aliases: ['Schrägbankdrücken Langhantel', 'Incline Bench Press'],
    type: 'compound', primary: ['chest'], secondary: ['shoulders', 'triceps'], equipment: ['langhantel', 'schraegbankstation'],
    steps: [
      'Bank auf 30 bis 45 Grad stellen, Augen unter der Stange.',
      'Schulterblätter zurück und nach unten ziehen, Füße fest aufsetzen.',
      'Stange schulterbreit bis etwas breiter greifen und ausheben.',
      'Langsam zur oberen Brust unterhalb des Schlüsselbeins senken.',
      'Senkrecht nach oben drücken, ohne die Schultern nach vorn rollen zu lassen.',
    ],
    mistakes: ['Bank zu steil, dann arbeiten fast nur die Schultern.', 'Stange zu weit unten am Bauch absetzen.', 'Schulterblätter lösen sich von der Bank.'],
    stresses: ['Schulter', 'Ellenbogen', 'Handgelenk'],
    alternatives: ['kh-schraegbankdruecken', 'brustpresse', 'kabel-flys-unten'],
  }),
  X('kh-bankdruecken', 'Kurzhantel-Bankdrücken', {
    aliases: ['Bankdrücken Kurzhantel', 'Dumbbell Bench Press'],
    type: 'compound', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: ['kurzhanteln', 'flachbank'],
    steps: [
      'Mit den Hanteln auf den Oberschenkeln hinsetzen und sie beim Zurücklegen mit den Knien nach oben bringen.',
      'Schulterblätter zusammenziehen, Hanteln über der Brust, Handflächen zu den Füßen oder leicht nach innen.',
      'Hanteln seitlich neben die Brust senken, bis eine leichte Dehnung spürbar ist.',
      'Nach oben drücken, die Hanteln kommen oben nah zusammen, ohne anzuschlagen.',
    ],
    mistakes: ['Hanteln unkontrolliert tief fallen lassen.', 'Ellenbogen ganz seitlich auf Schulterhöhe.', 'Hanteln oben zusammenschlagen.'],
    stresses: ['Schulter', 'Ellenbogen'],
    alternatives: ['brustpresse', 'butterfly'],
  }),
  X('kh-schraegbankdruecken', 'Schrägbank-Kurzhanteldrücken', {
    aliases: ['Schrägbankdrücken Kurzhantel', 'Incline Dumbbell Press'],
    type: 'compound', primary: ['chest'], secondary: ['shoulders', 'triceps'], equipment: ['kurzhanteln', 'schraegbank'],
    steps: [
      'Bank auf 30 bis 45 Grad stellen und mit den Hanteln auf den Oberschenkeln hinsetzen.',
      'Zurücklegen, Hanteln über die obere Brust bringen, Schulterblätter zurückziehen.',
      'Hanteln kontrolliert neben die obere Brust senken.',
      'Nach oben drücken, bis die Arme fast gestreckt sind.',
    ],
    mistakes: ['Bank zu steil eingestellt.', 'Unterer Rücken hebt stark von der Lehne ab.', 'Halbe Bewegung ohne Dehnung unten.'],
    stresses: ['Schulter', 'Ellenbogen'],
    alternatives: ['brustpresse', 'kabel-flys-unten'],
  }),
  X('brustpresse', 'Brustpresse', {
    aliases: ['Brustpresse Maschine', 'Chest Press'],
    type: 'compound', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: ['brustpresse'],
    steps: [
      'Sitz so einstellen, dass die Griffe auf Höhe der mittleren Brust sind.',
      'Rücken an die Lehne, Schulterblätter nach hinten und unten.',
      'Griffe nach vorn drücken, bis die Arme fast gestreckt sind.',
      'Langsam zurückführen, bis die Brust leicht gedehnt ist.',
    ],
    mistakes: ['Sitz zu hoch oder zu tief.', 'Schultern rollen beim Drücken nach vorn.', 'Arme am Ende ganz durchstrecken und die Last auf die Gelenke geben.'],
    stresses: ['Ellenbogen'],
    alternatives: ['butterfly', 'kh-bankdruecken'],
  }),
  X('butterfly', 'Butterfly-Maschine', {
    aliases: ['Butterfly', 'Pec Deck'],
    type: 'isolation', primary: ['chest'], secondary: ['shoulders'], equipment: ['butterfly'],
    steps: [
      'Sitz so einstellen, dass die Griffe etwa auf Brusthöhe sind.',
      'Rücken an die Lehne, Ellenbogen leicht gebeugt und fixiert.',
      'Arme in einem Bogen vor der Brust zusammenführen.',
      'Langsam öffnen, bis die Brust gedehnt ist, aber die Schultern nicht nach hinten ziehen.',
    ],
    mistakes: ['Zu weit öffnen, dann zieht es vorn in der Schulter.', 'Mit Schwung arbeiten.', 'Ellenbogen während der Bewegung beugen und strecken.'],
    stresses: ['Schulter'],
    alternatives: ['brustpresse', 'kabel-flys'],
  }),
  X('kabel-flys', 'Kabel-Flys', {
    aliases: ['Cable Flys', 'Kabelzug-Flys', 'Cable Crossover'],
    type: 'isolation', primary: ['chest'], secondary: ['shoulders'], equipment: ['kabelzug-doppelt'],
    steps: [
      'Beide Rollen etwa auf Schulterhöhe oder etwas höher einstellen, Griffe fassen.',
      'Einen Schritt nach vorn, Oberkörper leicht vorgeneigt, Ellenbogen leicht gebeugt.',
      'Hände in einem Bogen vor der Brust zusammenführen.',
      'Langsam zurück, bis die Brust gedehnt ist.',
    ],
    mistakes: ['Die Arme beugen und daraus ein Drücken machen.', 'Oberkörper schwingt mit.', 'Zu weit zurück, Schultern kippen nach vorn.'],
    stresses: ['Schulter'],
    alternatives: ['butterfly', 'brustpresse'],
  }),
  X('kabel-flys-unten', 'Kabel-Flys von unten nach oben', {
    aliases: ['Low-Cable-Flys', 'Kabel-Flys von unten'],
    type: 'isolation', primary: ['chest'], secondary: ['shoulders'], equipment: ['kabelzug-doppelt'],
    steps: [
      'Beide Rollen ganz unten einstellen, Griffe fassen und einen Schritt nach vorn gehen.',
      'Arme leicht gebeugt neben dem Körper, Handflächen nach vorn.',
      'Hände in einem Bogen nach oben vor die obere Brust führen.',
      'Kontrolliert wieder nach unten und außen senken.',
    ],
    mistakes: ['Hände über Kopfhöhe ziehen.', 'Schwung aus dem Oberkörper.', 'Ellenbogen stark beugen.'],
    stresses: ['Schulter'],
    alternatives: ['brustpresse', 'kabel-flys'],
  }),
  X('dip-maschine', 'Dip-Maschine', {
    aliases: ['Dips an der Maschine', 'Dip Maschine'],
    type: 'compound', primary: ['chest', 'triceps'], secondary: ['shoulders'], equipment: ['dipmaschine'],
    steps: [
      'Sitz so einstellen, dass die Griffe neben den unteren Rippen sind.',
      'Oberkörper aufrecht oder leicht vorgeneigt, Schultern nach unten.',
      'Griffe nach unten drücken, bis die Arme fast gestreckt sind.',
      'Langsam zurück, bis die Ellenbogen etwa 90 Grad gebeugt sind.',
    ],
    mistakes: ['Zu tief gehen, die Schultern kippen nach vorn.', 'Schultern zu den Ohren ziehen.', 'Mit Schwung arbeiten.'],
    stresses: ['Schulter', 'Ellenbogen'],
    alternatives: ['trizepsdruecken-kabel', 'brustpresse', 'butterfly'],
  }),
  X('barren-dips', 'Dips am Barren', {
    aliases: ['Dips', 'Barren-Dips'],
    type: 'compound', primary: ['chest', 'triceps'], secondary: ['shoulders'], equipment: ['dip-station'],
    steps: [
      'Im Stütz zwischen die Holme, Arme gestreckt, Schultern nach unten.',
      'Oberkörper leicht nach vorn neigen, Beine hinter dem Körper.',
      'Langsam absenken, bis die Oberarme etwa waagerecht sind.',
      'Kraftvoll nach oben drücken.',
    ],
    mistakes: ['Zu tief absenken.', 'Schultern hochziehen.', 'Unkontrolliert fallen lassen.'],
    stresses: ['Schulter', 'Ellenbogen'],
    alternatives: ['dip-maschine', 'trizepsdruecken-kabel', 'brustpresse'],
  }),
  X('liegestuetze', 'Liegestütze', {
    aliases: ['Liegestütz', 'Push-ups'],
    type: 'compound', primary: ['chest'], secondary: ['triceps', 'shoulders', 'abs'], equipment: [],
    steps: [
      'Hände etwas breiter als schulterbreit aufsetzen, Körper gerade von Kopf bis Ferse.',
      'Bauch und Po anspannen.',
      'Brust kontrolliert Richtung Boden senken, Ellenbogen schräg nach hinten.',
      'Nach oben drücken, bis die Arme gestreckt sind.',
    ],
    mistakes: ['Hüfte hängt durch.', 'Po zu hoch.', 'Nur den Kopf nach unten nicken statt die Brust zu senken.'],
    stresses: ['Handgelenk', 'Schulter'],
    alternatives: ['brustpresse', 'kh-bankdruecken'],
  }),

  /* ---------- Schultern ---------- */
  X('schulterdruecken', 'Schulterdrücken', {
    aliases: ['Schulterdrücken Langhantel', 'Military Press', 'Overhead Press'],
    type: 'compound', primary: ['shoulders'], secondary: ['triceps'], equipment: ['langhantel', ['kniebeugenstaender', 'multipresse']],
    steps: [
      'Auf eine Bank mit senkrechter Lehne setzen, Stange vor dem Kinn etwa schulterbreit greifen.',
      'Rücken an die Lehne, Bauch fest.',
      'Stange senkrecht nach oben drücken, den Kopf dabei kurz zurücknehmen.',
      'Kontrolliert bis etwa auf Kinnhöhe senken.',
    ],
    mistakes: ['Starkes Hohlkreuz beim Drücken.', 'Stange weit vor dem Körper führen.', 'Stange hinter den Nacken senken.'],
    stresses: ['Schulter', 'Ellenbogen', 'Handgelenk'],
    alternatives: ['kh-schulterdruecken', 'schulterpresse-maschine', 'reverse-flys'],
  }),
  /* Geht auch stehend nur mit Kurzhanteln (Zuhause, Prüfung M3); die Bank ist darum keine Anforderung */
  X('kh-schulterdruecken', 'Kurzhantel-Schulterdrücken', {
    aliases: ['Schulterdrücken Kurzhantel', 'Dumbbell Shoulder Press'],
    type: 'compound', primary: ['shoulders'], secondary: ['triceps'], equipment: ['kurzhanteln'],
    steps: [
      'Stehend, Füße hüftbreit, oder sitzend auf einer Bank mit senkrechter Lehne; die Hanteln auf Schulterhöhe.',
      'Handflächen nach vorn oder leicht zueinander, Ellenbogen etwas vor dem Körper, Bauch und Po fest.',
      'Hanteln nach oben drücken, bis die Arme fast gestreckt sind.',
      'Langsam wieder auf Schulterhöhe senken.',
      'Im Sitzen bleibt der Rücken an der Lehne, im Stehen holst du keinen Schwung aus den Beinen.',
    ],
    mistakes: ['Ins Hohlkreuz ausweichen.', 'Hanteln oben zusammenschlagen.', 'Nur halbe Wiederholungen.'],
    stresses: ['Schulter', 'Ellenbogen'],
    alternatives: ['schulterpresse-maschine', 'reverse-flys'],
  }),
  X('schulterpresse-maschine', 'Schulterpresse-Maschine', {
    aliases: ['Schulterpresse', 'Schultermaschine', 'Shoulder Press Machine'],
    type: 'compound', primary: ['shoulders'], secondary: ['triceps'], equipment: ['schulterpresse'],
    steps: [
      'Sitz so einstellen, dass die Griffe etwa auf Schulterhöhe sind.',
      'Rücken an die Lehne, Füße fest am Boden.',
      'Griffe nach oben drücken, bis die Arme fast gestreckt sind.',
      'Kontrolliert zurück auf Schulterhöhe.',
    ],
    mistakes: ['Sitz zu tief, Start unterhalb der Schultern.', 'Rücken löst sich von der Lehne.', 'Gewicht unten ablegen und neu Schwung holen.'],
    stresses: ['Schulter'],
    alternatives: ['reverse-flys', 'seitheben'],
  }),
  X('seitheben', 'Seitheben', {
    aliases: ['Seitheben Kurzhantel', 'Lateral Raises'],
    type: 'isolation', primary: ['shoulders'], equipment: ['kurzhanteln'],
    steps: [
      'Aufrecht stehen, Hanteln neben dem Körper, Ellenbogen leicht gebeugt.',
      'Arme seitlich anheben, bis die Hände etwa auf Schulterhöhe sind.',
      'Die Ellenbogen führen, die Hände bleiben knapp darunter.',
      'Langsam wieder absenken.',
    ],
    mistakes: ['Mit dem Oberkörper Schwung holen.', 'Schultern zu den Ohren ziehen.', 'Arme über Schulterhöhe heben.'],
    stresses: ['Schulter'],
    alternatives: ['reverse-flys', 'face-pulls', 'seitheben-kabel'],
  }),
  X('reverse-flys', 'Reverse Flys', {
    aliases: ['Reverse Butterfly', 'Hintere Schulter', 'Vorgebeugtes Seitheben'],
    type: 'isolation', primary: ['shoulders'], secondary: ['back', 'traps'], equipment: ['kurzhanteln'],
    steps: [
      'Mit geradem Rücken weit nach vorn beugen oder bäuchlings auf eine Schrägbank legen.',
      'Hanteln hängen unter den Schultern, Ellenbogen leicht gebeugt.',
      'Arme seitlich nach außen heben, bis sie etwa waagerecht sind.',
      'Langsam wieder absenken.',
    ],
    mistakes: ['Schulterblätter kräftig zusammenziehen, dann arbeitet vor allem der Rücken.', 'Zu schwer und mit Schwung.', 'Rundrücken im Stand.'],
    stresses: [],
    alternatives: ['face-pulls'],
  }),
  X('face-pulls', 'Face Pulls', {
    aliases: ['Face Pull'],
    type: 'isolation', primary: ['shoulders'], secondary: ['back', 'traps'], equipment: ['kabelturm'],
    steps: [
      'Seilgriff am Kabelzug etwa auf Kopfhöhe einstellen.',
      'Seil mit beiden Händen greifen, Daumen zeigen nach hinten, einen Schritt zurück.',
      'Seil zum Gesicht ziehen und die Enden dabei auseinanderziehen, Ellenbogen hoch.',
      'Kurz halten, dann langsam nach vorn zurück.',
    ],
    mistakes: ['Zu schwer, der Oberkörper lehnt sich weit zurück.', 'Ellenbogen fallen nach unten, dann wird es ein Rudern.', 'Schultern hochziehen.'],
    stresses: [],
    alternatives: ['reverse-flys'],
  }),
  X('seitheben-kabel', 'Seitheben am Kabel', {
    aliases: ['Kabel-Seitheben', 'Cable Lateral Raise', 'Einarmiges Seitheben am Kabel'],
    type: 'isolation', primary: ['shoulders'], equipment: ['kabelturm'],
    steps: [
      'Rolle ganz nach unten stellen und seitlich neben den Kabelzug stellen.',
      'Den Griff mit der Hand fassen, die vom Zug weiter weg ist; das Kabel läuft vor dem Körper.',
      'Den Arm seitlich anheben, bis die Hand etwa auf Schulterhöhe ist, Ellenbogen leicht gebeugt.',
      'Langsam absenken, bis die Hand wieder vor der Hüfte ist, dann die Seite wechseln.',
    ],
    mistakes: ['Mit dem Oberkörper zur Seite lehnen und Schwung holen.', 'Die Schulter zum Ohr ziehen.', 'Den Arm über Schulterhöhe heben.'],
    stresses: ['Schulter'],
    alternatives: ['seitheben', 'reverse-flys', 'face-pulls'],
  }),

  /* ---------- Trizeps ---------- */
  X('trizepsdruecken-kabel', 'Trizepsdrücken am Kabel', {
    aliases: ['Trizepsdrücken', 'Pushdowns', 'Trizepsdrücken am Seil', 'Trizepsdrücken mit Stange'],
    type: 'isolation', primary: ['triceps'], equipment: ['kabelturm'],
    steps: [
      'Stange oder Seil oben am Kabelzug befestigen und greifen.',
      'Aufrecht stehen, Oberarme eng am Körper.',
      'Unterarme nach unten strecken, bis die Arme gerade sind.',
      'Langsam zurück, bis die Unterarme etwa waagerecht sind.',
    ],
    mistakes: ['Ellenbogen wandern nach vorn.', 'Mit dem Oberkörper mitdrücken.', 'Schultern nach vorn rollen.'],
    stresses: [],
    alternatives: ['ueberkopf-trizeps-kabel', 'barren-dips'],
  }),
  X('ueberkopf-trizeps-kabel', 'Überkopf-Trizeps am Kabel', {
    aliases: ['Trizepsstrecken über Kopf am Kabel', 'Overhead-Trizeps'],
    type: 'isolation', primary: ['triceps'], equipment: ['kabelturm'],
    steps: [
      'Seil unten oder mittig am Kabelzug befestigen, mit dem Rücken zur Maschine stellen.',
      'Seil hinter dem Kopf greifen, Schrittstellung, Oberkörper leicht vorgeneigt.',
      'Oberarme neben dem Kopf halten und die Unterarme nach vorn oben strecken.',
      'Langsam zurück hinter den Kopf, bis der Trizeps gedehnt ist.',
    ],
    mistakes: ['Ellenbogen gehen weit auseinander.', 'Hohlkreuz statt fester Bauch.', 'Oberarme bewegen sich mit.'],
    stresses: ['Ellenbogen', 'Schulter'],
    alternatives: ['trizepsdruecken-kabel'],
  }),

  /* ---------- Rücken ---------- */
  X('latzug', 'Latzug', {
    aliases: ['Latziehen', 'Lat-Pulldown', 'Latzug breit'],
    type: 'compound', primary: ['back'], secondary: ['biceps'], equipment: ['latzug'],
    steps: [
      'Knie unter das Polster, Stange etwas breiter als schulterbreit greifen.',
      'Oberkörper leicht zurücklehnen, Brust nach oben.',
      'Stange zur oberen Brust ziehen, Ellenbogen nach unten und hinten.',
      'Langsam nach oben führen, bis die Arme gestreckt sind.',
    ],
    mistakes: ['Stange in den Nacken ziehen.', 'Weit zurücklehnen und mit Schwung ziehen.', 'Schultern bleiben oben an den Ohren.'],
    stresses: ['Schulter'],
    alternatives: ['enger-latzug', 'brustgestuetztes-rudern'],
  }),
  X('enger-latzug', 'Enger Latzug', {
    aliases: ['Latzug eng', 'Latzug mit engem Griff', 'Latzug V-Griff'],
    type: 'compound', primary: ['back'], secondary: ['biceps'], equipment: ['latzug'],
    steps: [
      'Engen Parallelgriff oder enge Stange einhängen, Knie unter das Polster.',
      'Griff mit gestreckten Armen fassen, Brust nach oben.',
      'Griff zur Brust ziehen, Ellenbogen eng am Körper nach unten.',
      'Langsam zurück, bis die Arme gestreckt sind und der Rücken gedehnt ist.',
    ],
    mistakes: ['Mit dem Oberkörper weit nach hinten kippen.', 'Nur mit den Armen ziehen.', 'Oben nicht ganz strecken.'],
    stresses: ['Ellenbogen'],
    alternatives: ['latzug', 'rudern-sitzend'],
  }),
  X('klimmzuege', 'Klimmzüge', {
    aliases: ['Klimmzug', 'Pull-ups'],
    type: 'compound', primary: ['back'], secondary: ['biceps', 'forearms'], equipment: ['klimmzugstange'],
    steps: [
      'Stange etwas breiter als schulterbreit im Obergriff fassen und hängen.',
      'Schultern nach unten ziehen, Bauch fest.',
      'Hochziehen, bis das Kinn über der Stange ist.',
      'Kontrolliert ablassen, bis die Arme gestreckt sind.',
    ],
    mistakes: ['Schwung mit den Beinen.', 'Nur halb herunterlassen.', 'Kinn nach vorn recken statt hochzuziehen.'],
    stresses: ['Schulter', 'Ellenbogen'],
    alternatives: ['latzug', 'enger-latzug'],
  }),
  X('rudern-sitzend', 'Rudern sitzend', {
    aliases: ['Kabelrudern', 'Rudern am Kabel', 'Rudern sitzend am Kabel', 'Seated Cable Row'],
    type: 'compound', primary: ['back'], secondary: ['biceps', 'shoulders'], equipment: ['ruderzug'],
    steps: [
      'Füße auf die Fußstütze, Knie leicht gebeugt, Griff fassen.',
      'Aufrecht sitzen, Brust raus, Rücken gerade.',
      'Griff zum Bauch ziehen, Ellenbogen nah am Körper, Schulterblätter zusammen.',
      'Langsam zurück, bis die Arme gestreckt sind, ohne den Rücken rund zu machen.',
    ],
    mistakes: ['Mit dem Oberkörper weit vor und zurück schaukeln.', 'Rundrücken beim Nachlassen.', 'Schultern hochziehen.'],
    stresses: ['Unterer Rücken'],
    alternatives: ['brustgestuetztes-rudern', 'kh-rudern', 'band-rudern'],
  }),
  /* Mit Kurzhanteln auf der Schrägbank; die Maschine mit Brustpolster ist „Rudern an der Maschine“ (rudermaschine) */
  X('brustgestuetztes-rudern', 'Brustgestütztes Rudern', {
    aliases: ['Kurzhantelrudern mit Brustauflage', 'Rudern an der Brustauflage', 'Kurzhantelrudern auf der Schrägbank', 'Chest Supported Dumbbell Row'],
    type: 'compound', primary: ['back'], secondary: ['biceps', 'shoulders'], equipment: ['kurzhanteln', 'schraegbank'],
    steps: [
      'Bank auf etwa 30 Grad stellen und bäuchlings darauflegen, die Brust liegt oben an der Lehne.',
      'Die Hanteln mit gestreckten Armen hängen lassen.',
      'Ellenbogen nach hinten ziehen, bis die Hände neben den Rippen sind.',
      'Langsam wieder strecken.',
    ],
    mistakes: ['Brust hebt von der Bank ab.', 'Mit Schwung ziehen.', 'Handgelenke abknicken.'],
    stresses: [],
    alternatives: ['rudern-sitzend', 'kh-rudern', 'band-rudern'],
  }),
  X('langhantelrudern', 'Langhantelrudern', {
    aliases: ['Rudern vorgebeugt', 'Langhantelrudern vorgebeugt', 'Barbell Row'],
    type: 'compound', primary: ['back'], secondary: ['biceps', 'shoulders', 'lower_back'], equipment: ['langhantel'],
    steps: [
      'Stange schulterbreit greifen, Knie leicht beugen, Oberkörper mit geradem Rücken vorneigen.',
      'Stange hängt unter den Schultern, Bauch fest.',
      'Stange zum unteren Bauch ziehen, Ellenbogen nach hinten.',
      'Langsam ablassen, ohne den Oberkörper aufzurichten.',
    ],
    mistakes: ['Rundrücken.', 'Oberkörper richtet sich bei jeder Wiederholung auf.', 'Zu schwer mit Schwung aus der Hüfte.'],
    stresses: ['Unterer Rücken'],
    alternatives: ['brustgestuetztes-rudern', 'rudern-sitzend'],
  }),
  X('kh-rudern', 'Kurzhantelrudern einarmig', {
    aliases: ['Kurzhantelrudern', 'Einarmiges Rudern', 'One-Arm Dumbbell Row'],
    type: 'compound', primary: ['back'], secondary: ['biceps'], equipment: ['kurzhanteln', 'flachbank'],
    steps: [
      'Eine Hand und ein Knie auf die Bank, Rücken gerade und waagerecht.',
      'Hantel mit dem freien Arm unter der Schulter hängen lassen.',
      'Hantel Richtung Hüfte ziehen, Ellenbogen nah am Körper.',
      'Langsam ablassen, bis der Arm gestreckt ist.',
    ],
    mistakes: ['Oberkörper dreht sich auf.', 'Hantel zur Brust statt zur Hüfte ziehen.', 'Rundrücken.'],
    stresses: [],
    alternatives: ['brustgestuetztes-rudern', 'rudern-sitzend', 'band-rudern'],
  }),
  /* Rückenübung für Zuhause nur mit Band (4.7, Prüfung M3); sonst ginge mit „Zuhause“ keine Rückenübung */
  X('band-rudern', 'Rudern mit Band', {
    aliases: ['Band Row', 'Rudern mit Widerstandsband', 'Bandrudern'],
    type: 'compound', primary: ['back'], secondary: ['biceps', 'shoulders'], equipment: ['widerstandsband'],
    steps: [
      'Mit fast gestreckten Beinen aufrecht auf den Boden setzen, das Band mittig um die Fußsohlen legen und die Enden fassen.',
      'So weit zurückrücken, dass das Band mit gestreckten Armen schon leicht gespannt ist; Brust raus, Schultern unten.',
      'Die Ellenbogen beim Ausatmen nah am Körper nach hinten ziehen, bis die Hände neben dem Bauch sind, und die Schulterblätter zusammenführen.',
      'Kurz halten, dann langsam nach vorn zurück, bis die Arme gestreckt sind.',
      'Stehend geht es auch: das Band auf Brusthöhe um einen festen Pfosten legen oder mit einem Türanker in einer geschlossenen Tür einhängen.',
      'Schwerer wird es mit einem stärkeren Band oder wenn du die Enden kürzer fasst.',
    ],
    mistakes: [
      'Mit dem Oberkörper nach hinten lehnen, statt mit den Armen zu ziehen.',
      'Die Schultern zu den Ohren ziehen.',
      'Das Band an etwas befestigen, das nachgeben oder kippen kann.',
    ],
    stresses: [],
    alternatives: ['kh-rudern', 'rudern-sitzend', 'brustgestuetztes-rudern', 'invertiertes-rudern'],
  }),

  /* ---------- Bizeps ---------- */
  X('langhantel-curls', 'Langhantel-Curls', {
    aliases: ['Bizepscurls Langhantel', 'Langhantelcurls', 'Barbell Curls'],
    type: 'isolation', primary: ['biceps'], secondary: ['forearms'], equipment: ['langhantel'],
    steps: [
      'Aufrecht stehen, Stange schulterbreit im Untergriff.',
      'Oberarme bleiben am Körper.',
      'Stange zur Brust beugen, ohne die Ellenbogen nach vorn zu schieben.',
      'Langsam ablassen, bis die Arme fast gestreckt sind.',
    ],
    mistakes: ['Mit dem Oberkörper Schwung holen.', 'Ellenbogen wandern nach vorn.', 'Unten nicht ganz ablassen.'],
    stresses: ['Ellenbogen', 'Handgelenk'],
    alternatives: ['sz-curls', 'hammercurls'],
  }),
  X('sz-curls', 'SZ-Curls', {
    aliases: ['SZ-Curl', 'Curls mit SZ-Stange'],
    type: 'isolation', primary: ['biceps'], secondary: ['forearms'], equipment: ['sz-stange'],
    steps: [
      'Aufrecht stehen, SZ-Stange an den schrägen Griffen im Untergriff fassen.',
      'Oberarme bleiben am Körper.',
      'Stange zur Brust beugen.',
      'Langsam ablassen, bis die Arme fast gestreckt sind.',
    ],
    mistakes: ['Schwung aus dem Rücken.', 'Ellenbogen nach vorn schieben.', 'Handgelenke nach hinten abknicken.'],
    stresses: ['Ellenbogen'],
    alternatives: ['hammercurls', 'kh-curls'],
  }),
  X('kh-curls', 'Kurzhantel-Curls', {
    aliases: ['Bizepscurls Kurzhantel', 'Kurzhantelcurls', 'Dumbbell Curls'],
    type: 'isolation', primary: ['biceps'], secondary: ['forearms'], equipment: ['kurzhanteln'],
    steps: [
      'Aufrecht stehen oder sitzen, Hanteln neben dem Körper.',
      'Hanteln nach oben beugen und dabei die Handflächen nach oben drehen.',
      'Oberarme bleiben ruhig am Körper.',
      'Langsam ablassen.',
    ],
    mistakes: ['Schwung aus dem Oberkörper.', 'Ellenbogen wandern nach hinten oder vorn.', 'Zu schnell ablassen.'],
    stresses: [],
    alternatives: ['hammercurls', 'sz-curls', 'schraegbank-curls'],
  }),
  X('hammercurls', 'Hammercurls', {
    aliases: ['Hammer Curls', 'Hammercurl'],
    type: 'isolation', primary: ['biceps'], secondary: ['forearms'], equipment: ['kurzhanteln'],
    steps: [
      'Aufrecht stehen, Hanteln neben dem Körper, Handflächen zeigen zueinander.',
      'Hanteln mit gleichbleibendem Griff nach oben beugen.',
      'Oberarme bleiben am Körper.',
      'Langsam ablassen.',
    ],
    mistakes: ['Hanteln schwingen.', 'Oberkörper lehnt sich zurück.', 'Nur halbe Bewegung.'],
    stresses: [],
    alternatives: ['kh-curls', 'sz-curls'],
  }),
  X('schraegbank-curls', 'Schrägbank-Curls', {
    aliases: ['Incline Curls', 'Kurzhantelcurls auf der Schrägbank'],
    type: 'isolation', primary: ['biceps'], equipment: ['kurzhanteln', 'schraegbank'],
    steps: [
      'Bank auf 45 bis 60 Grad stellen und mit dem ganzen Rücken anlehnen.',
      'Die Hanteln hängen gestreckt neben dem Körper, Handflächen zeigen nach vorn.',
      'Die Hanteln nach oben beugen, die Oberarme bleiben senkrecht nach unten.',
      'Oben kurz anspannen, dann langsam ablassen, bis die Arme wieder gestreckt sind.',
    ],
    mistakes: ['Die Ellenbogen wandern nach vorn.', 'Kopf und Schultern lösen sich von der Bank.', 'Unten nicht ganz strecken und so die Dehnung verschenken.'],
    stresses: ['Schulter'],
    alternatives: ['kh-curls', 'hammercurls', 'sz-curls'],
  }),

  /* ---------- Beine ---------- */
  X('kniebeugen', 'Kniebeugen', {
    aliases: ['Kniebeuge', 'Squat', 'Langhantel-Kniebeugen', 'Back Squat'],
    type: 'compound', primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings', 'lower_back'], equipment: ['langhantel', ['kniebeugenstaender', 'multipresse']],
    steps: [
      'Stange im Rack auf den oberen Rücken legen, nicht auf den Nacken.',
      'Füße etwa schulterbreit, Zehen leicht nach außen.',
      'Tief einatmen, Bauch fest, Hüfte nach hinten und unten beugen.',
      'Knie folgen der Richtung der Zehen, so tief gehen, wie der Rücken gerade bleibt.',
      'Über die ganze Fußsohle nach oben drücken.',
    ],
    mistakes: ['Knie fallen nach innen.', 'Fersen heben ab.', 'Unterer Rücken rundet sich unten.'],
    stresses: ['Knie', 'Unterer Rücken', 'Hüfte'],
    alternatives: ['hackenschmidt', 'beinpresse', 'hip-thrust', 'goblet-squat'],
  }),
  X('hackenschmidt', 'Hackenschmidt', {
    aliases: ['Hackenschmidt-Kniebeugen', 'Hack Squat', 'Hackenschmidt-Maschine'],
    type: 'compound', primary: ['quads'], secondary: ['glutes', 'adductors'], equipment: ['hackenschmidt'],
    steps: [
      'Rücken an das Polster, Schultern unter die Polster, Füße etwa schulterbreit auf die Plattform.',
      'Sicherung lösen, Bauch fest.',
      'Langsam in die Knie gehen, bis die Oberschenkel etwa waagerecht sind.',
      'Über die ganze Fußsohle nach oben drücken, Knie oben nicht durchschlagen.',
    ],
    mistakes: ['Fersen heben ab.', 'Knie fallen nach innen.', 'Oben die Knie ganz durchdrücken.'],
    stresses: ['Knie'],
    alternatives: ['beinpresse', 'hip-thrust'],
  }),
  X('beinpresse', 'Beinpresse', {
    aliases: ['Beinpresse 45 Grad', 'Beinpresse sitzend', 'Leg Press'],
    type: 'compound', primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings'], equipment: ['beinpresse'],
    steps: [
      'Rücken und Po fest an das Polster, Füße schulterbreit mittig auf die Platte.',
      'Sicherung lösen.',
      'Platte langsam ablassen, bis die Knie etwa 90 Grad gebeugt sind.',
      'Nach oben drücken, ohne die Knie ganz durchzustrecken.',
    ],
    mistakes: ['Po hebt unten vom Polster ab, der Rücken rundet sich.', 'Knie oben durchdrücken.', 'Knie fallen nach innen.'],
    stresses: ['Knie', 'Unterer Rücken'],
    alternatives: ['hackenschmidt', 'hip-thrust', 'beinbeuger'],
  }),
  X('goblet-squat', 'Goblet Squat', {
    aliases: ['Goblet-Kniebeuge', 'Kurzhantel-Kniebeuge'],
    type: 'compound', primary: ['quads', 'glutes'], secondary: ['adductors', 'abs'], equipment: [['kurzhanteln', 'kettlebell']],
    steps: [
      'Eine Kurzhantel senkrecht vor der Brust halten.',
      'Füße etwas breiter als schulterbreit, Zehen leicht nach außen.',
      'Zwischen die Knie absenken, Oberkörper bleibt aufrecht.',
      'Über die ganze Fußsohle nach oben drücken.',
    ],
    mistakes: ['Hantel sinkt vom Körper weg.', 'Knie fallen nach innen.', 'Fersen heben ab.'],
    stresses: ['Knie', 'Hüfte'],
    alternatives: ['hip-thrust', 'beinpresse'],
  }),
  X('ausfallschritte', 'Ausfallschritte', {
    aliases: ['Ausfallschritt', 'Lunges'],
    type: 'compound', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'adductors'], equipment: ['kurzhanteln'],
    steps: [
      'Aufrecht stehen, Hanteln neben dem Körper.',
      'Einen großen Schritt nach vorn machen.',
      'Hinteres Knie Richtung Boden senken, vorderes Knie bleibt über dem Fuß.',
      'Mit dem vorderen Bein zurück in den Stand drücken, dann Seite wechseln.',
    ],
    mistakes: ['Schritt zu kurz, das vordere Knie schiebt weit über die Zehen.', 'Oberkörper kippt nach vorn.', 'Knie fällt nach innen.'],
    stresses: ['Knie', 'Hüfte'],
    alternatives: ['hip-thrust', 'beinpresse'],
  }),
  X('bulgarian-split-squat', 'Bulgarische Kniebeuge', {
    aliases: ['Bulgarian Split Squat'],
    type: 'compound', primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings'], equipment: ['kurzhanteln', 'flachbank'],
    steps: [
      'Rücken zur Bank, einen Fuß mit dem Rist hinten auf die Bank legen.',
      'Vorderer Fuß so weit vorn, dass das Knie unten etwa über dem Fuß ist.',
      'Gerade nach unten absenken, bis der vordere Oberschenkel etwa waagerecht ist.',
      'Über den vorderen Fuß nach oben drücken.',
    ],
    mistakes: ['Vorderer Fuß zu nah an der Bank.', 'Mit dem hinteren Bein abdrücken.', 'Knie fällt nach innen.'],
    stresses: ['Knie', 'Hüfte'],
    alternatives: ['hip-thrust', 'beinpresse'],
  }),
  X('beinstrecker', 'Beinstrecker', {
    aliases: ['Beinstrecker-Maschine', 'Leg Extension'],
    type: 'isolation', primary: ['quads'], equipment: ['beinstrecker'],
    steps: [
      'Rückenlehne so einstellen, dass die Knie am Drehpunkt der Maschine liegen.',
      'Fußpolster knapp über den Knöcheln.',
      'Beine strecken, bis sie fast gerade sind, kurz halten.',
      'Langsam wieder beugen.',
    ],
    mistakes: ['Polster auf dem Schienbein zu hoch.', 'Beine mit Schwung hochschleudern.', 'Po hebt vom Sitz ab.'],
    stresses: ['Knie'],
    alternatives: ['beinpresse', 'hip-thrust'],
  }),
  X('beinbeuger', 'Beinbeuger', {
    aliases: ['Beinbeuger liegend', 'Leg Curl', 'Lying Leg Curl'],
    type: 'isolation', primary: ['hamstrings'], secondary: ['calves'], equipment: ['beinbeuger-liegend'],
    steps: [
      'Bäuchlings auf die Maschine legen, Knie knapp über der Polsterkante.',
      'Fußpolster über den Fersen, Griffe fassen.',
      'Fersen Richtung Po beugen, Hüfte bleibt auf dem Polster.',
      'Langsam wieder strecken.',
    ],
    mistakes: ['Hüfte hebt ab.', 'Mit Schwung arbeiten.', 'Unten nicht ganz strecken.'],
    stresses: [],
    alternatives: ['beinbeuger-sitzend', 'rumaenisches-kreuzheben'],
  }),
  X('beinbeuger-sitzend', 'Beinbeuger sitzend', {
    aliases: ['Beinbeuger sitzend Maschine', 'Seated Leg Curl'],
    type: 'isolation', primary: ['hamstrings'], equipment: ['beinbeuger-sitzend'],
    steps: [
      'Lehne so einstellen, dass die Knie am Drehpunkt liegen, Beinpolster über den Knöcheln.',
      'Oberschenkelpolster fest auf die Beine.',
      'Unterschenkel nach unten und hinten beugen.',
      'Langsam zurück, bis die Beine fast gestreckt sind.',
    ],
    mistakes: ['Oberschenkelpolster zu locker.', 'Mit Schwung arbeiten.', 'Nur halbe Bewegung.'],
    stresses: [],
    alternatives: ['beinbeuger'],
  }),
  X('rumaenisches-kreuzheben', 'Rumänisches Kreuzheben', {
    aliases: ['Romanian Deadlift', 'RDL', 'Gestrecktes Kreuzheben'],
    type: 'compound', primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'forearms'], equipment: ['langhantel'],
    steps: [
      'Aufrecht stehen, Langhantel oder zwei Kurzhanteln vor den Oberschenkeln.',
      'Knie leicht beugen und so halten.',
      'Hüfte nach hinten schieben, Gewicht nah an den Beinen nach unten führen, Rücken gerade.',
      'Bis zu einer deutlichen Dehnung hinten im Oberschenkel senken, meist knapp unter die Knie.',
      'Hüfte nach vorn schieben und aufrichten.',
    ],
    mistakes: ['Rundrücken.', 'Gewicht vom Körper weg.', 'Zu tief gehen, bis der Rücken nachgibt.'],
    stresses: ['Unterer Rücken', 'Hüfte'],
    alternatives: ['beinbeuger', 'hip-thrust', 'rueckenstrecker'],
  }),
  X('kreuzheben', 'Kreuzheben', {
    aliases: ['Deadlift', 'Kreuzheben klassisch'],
    type: 'compound', primary: ['glutes', 'hamstrings', 'lower_back'], secondary: ['quads', 'back', 'traps', 'forearms'], equipment: ['langhantel'],
    steps: [
      'Füße hüftbreit, Stange über der Fußmitte.',
      'Hüfte beugen, Stange knapp außerhalb der Knie greifen, Rücken gerade, Brust raus.',
      'Bauch fest, Stange nah am Körper vom Boden drücken.',
      'Oben Hüfte und Knie strecken, ohne nach hinten zu lehnen.',
      'Kontrolliert auf demselben Weg ablegen.',
    ],
    mistakes: ['Rundrücken beim Anheben.', 'Stange weit vor dem Körper.', 'Oben ins Hohlkreuz überstrecken.'],
    stresses: ['Unterer Rücken', 'Hüfte'],
    alternatives: ['rumaenisches-kreuzheben', 'hip-thrust', 'beinbeuger'],
  }),
  X('rueckenstrecker', 'Rückenstrecker', {
    aliases: ['Hyperextensions', 'Hyperextension', 'Rückenstrecken (Hyperextension)', 'Back Extension', '45°-Rückenstrecken'],
    type: 'isolation', primary: ['lower_back'], secondary: ['glutes', 'hamstrings'], equipment: ['hyperextension'],
    steps: [
      'Polster so einstellen, dass die Hüfte knapp darüber frei beugen kann, Fersen unter die Rollen.',
      'Arme vor der Brust kreuzen, der Körper bildet eine gerade Linie.',
      'Den Oberkörper mit geradem Rücken aus der Hüfte absenken, bis hinten im Oberschenkel eine Dehnung kommt.',
      'Mit Gesäß und unterem Rücken wieder hochkommen, bis der Körper eine gerade Linie bildet.',
    ],
    mistakes: ['Oben ins Hohlkreuz überstrecken.', 'Mit Schwung hochschnellen.', 'Den Rücken beim Absenken rund machen.'],
    stresses: ['Unterer Rücken'],
    alternatives: ['hip-thrust', 'rumaenisches-kreuzheben', 'beinbeuger'],
  }),
  X('hip-thrust', 'Hip Thrust', {
    aliases: ['Hip Thrusts', 'Hüftstoß', 'Hip Thrust Langhantel'],
    type: 'compound', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['langhantel', 'flachbank'],
    steps: [
      'Mit dem oberen Rücken an eine Bank lehnen, Stange mit Polster über der Hüfte.',
      'Füße hüftbreit aufstellen, sodass die Schienbeine oben senkrecht sind.',
      'Hüfte nach oben drücken, bis Oberkörper und Oberschenkel eine Linie bilden.',
      'Oben den Po fest anspannen, dann langsam absenken.',
    ],
    mistakes: ['Oben ins Hohlkreuz statt die Hüfte zu strecken.', 'Füße zu weit vorn oder zu nah.', 'Über die Zehen statt die Fersen drücken.'],
    stresses: ['Hüfte'],
    alternatives: ['beinbeuger', 'rumaenisches-kreuzheben'],
  }),
  X('wadenheben', 'Wadenheben', {
    aliases: ['Wadenheben stehend', 'Wadenheben an der Maschine', 'Standing Calf Raise'],
    type: 'isolation', primary: ['calves'], equipment: ['wadenmaschine-stehend'],
    steps: [
      'Fußballen auf die Kante, Schultern unter die Polster.',
      'Fersen langsam absenken, bis die Waden gedehnt sind.',
      'So hoch wie möglich auf die Zehenspitzen drücken.',
      'Oben kurz halten, dann langsam ablassen.',
    ],
    mistakes: ['Wippen statt ganzer Bewegung.', 'Knie beugen und mitschieben.', 'Unten nicht dehnen.'],
    stresses: ['Sprunggelenk'],
    alternatives: ['wadendruecken-beinpresse'],
  }),
  X('wadendruecken-beinpresse', 'Wadendrücken an der Beinpresse', {
    aliases: ['Wadenpresse', 'Calf Press'],
    type: 'isolation', primary: ['calves'], equipment: ['beinpresse'],
    steps: [
      'In die Beinpresse setzen, nur die Fußballen unten auf die Platte.',
      'Beine fast gestreckt, Sicherung bleibt eingelegt oder in Reichweite.',
      'Platte mit den Fußballen wegdrücken, so weit es geht.',
      'Langsam zurück, bis die Waden gedehnt sind.',
    ],
    mistakes: ['Knie beugen und die Beine mitdrücken.', 'Füße rutschen auf der Platte nach oben.', 'Zu schnell und ohne Dehnung.'],
    stresses: [],
    alternatives: ['wadenheben'],
  }),
  X('adduktoren', 'Adduktoren', {
    aliases: ['Adduktoren-Maschine', 'Adduktorenmaschine', 'Hip Adduction'],
    type: 'isolation', primary: ['adductors'], equipment: ['adduktoren'],
    steps: [
      'In die Maschine setzen, Polster an die Innenseiten der Knie.',
      'Startweite so wählen, dass eine leichte Dehnung spürbar ist.',
      'Beine gegen den Widerstand zusammendrücken.',
      'Langsam wieder öffnen.',
    ],
    mistakes: ['Startweite zu groß.', 'Beine zusammenschlagen lassen.', 'Oberkörper nach vorn beugen.'],
    stresses: [],
    alternatives: ['goblet-squat'],
  }),
  X('abduktoren', 'Abduktoren', {
    aliases: ['Abduktoren-Maschine', 'Abduktorenmaschine', 'Hip Abduction'],
    type: 'isolation', primary: ['abductors'], secondary: ['glutes'], equipment: ['abduktoren'],
    steps: [
      'In die Maschine setzen, Polster an die Außenseiten der Knie.',
      'Rücken an die Lehne, Griffe fassen.',
      'Beine gegen den Widerstand nach außen drücken.',
      'Langsam wieder schließen.',
    ],
    mistakes: ['Mit Schwung arbeiten.', 'Nur halbe Bewegung.', 'Po rutscht auf dem Sitz nach vorn.'],
    stresses: [],
    alternatives: ['hip-thrust'],
  }),

  /* ---------- Bauch ---------- */
  X('bauchmaschine', 'Bauchmaschine', {
    aliases: ['Crunch-Maschine', 'Bauchpresse'],
    type: 'isolation', primary: ['abs'], equipment: ['bauchmaschine'],
    steps: [
      'Sitz so einstellen, dass die Griffe oder Polster auf Brusthöhe sind.',
      'Füße fixieren, Bauch leicht anspannen.',
      'Oberkörper einrollen, als würdest du die Rippen zum Becken ziehen.',
      'Langsam wieder aufrichten.',
    ],
    mistakes: ['Mit den Armen ziehen.', 'Aus der Hüfte beugen statt den Rumpf einzurollen.', 'Zu schwer und mit Schwung.'],
    stresses: ['Unterer Rücken'],
    alternatives: ['plank', 'kabel-crunch'],
  }),
  X('kabel-crunch', 'Kabel-Crunch', {
    aliases: ['Kabelcrunch', 'Crunch am Kabel'],
    type: 'isolation', primary: ['abs'], equipment: ['kabelturm'],
    steps: [
      'Seil oben am Kabelzug befestigen, davor knien und das Seil neben dem Kopf halten.',
      'Hüfte bleibt ruhig über den Knien.',
      'Oberkörper einrollen und die Ellenbogen Richtung Oberschenkel führen.',
      'Langsam wieder aufrollen.',
    ],
    mistakes: ['Mit dem Po nach hinten auf die Fersen setzen.', 'Mit den Armen ziehen.', 'Rücken gerade lassen statt einzurollen.'],
    stresses: [],
    alternatives: ['bauchmaschine', 'plank'],
  }),
  X('beinheben-haengend', 'Hängendes Beinheben', {
    aliases: ['Beinheben hängend', 'Hanging Leg Raises', 'Knieheben hängend'],
    type: 'isolation', primary: ['abs'], secondary: ['forearms'], equipment: ['klimmzugstange'],
    steps: [
      'An der Stange hängen, Schultern leicht nach unten ziehen.',
      'Beine gestreckt oder angewinkelt nach oben heben.',
      'Oben das Becken leicht einrollen.',
      'Langsam ablassen, ohne zu schwingen.',
    ],
    mistakes: ['Schwung mit dem ganzen Körper.', 'Nur die Beine heben, ohne das Becken einzurollen.', 'Zu schnell ablassen.'],
    stresses: ['Schulter'],
    alternatives: ['plank', 'kabel-crunch'],
  }),
  X('plank', 'Plank', {
    aliases: ['Unterarmstütz', 'Planke'],
    type: 'isolation', unit: 'sec', primary: ['abs'], secondary: ['shoulders'], equipment: [],
    steps: [
      'Unterarme unter den Schultern aufsetzen, Beine gestreckt nach hinten.',
      'Körper von Kopf bis Ferse in eine gerade Linie bringen.',
      'Bauch und Po fest anspannen, ruhig weiteratmen.',
      'Position halten, bis die Zeit um ist oder die Form nachlässt.',
    ],
    mistakes: ['Hüfte hängt durch.', 'Po zu hoch.', 'Luft anhalten.'],
    stresses: [],
    alternatives: ['bauchmaschine', 'beinheben-haengend'],
  }),
];

/* Aliase, die zur passenden Maschine wandern, sobald es sie gibt. Sonst landet ein Plan-Import mit
   „Reverse Butterfly“ bei den vorgebeugten Reverse Flys statt an der Maschine (Recherche, Abschnitt 6). */
export const ALIAS_MOVES = [
  { alias: 'Reverse Butterfly', from: 'reverse-flys', to: 'reverse-butterfly' },
  { alias: 'Rudern an der Brustauflage', from: 'brustgestuetztes-rudern', to: 'rudermaschine' },
];

/* Reservierte ids (4.7): Kern-Übungen, die noch in data/exercises-kern.js kommen (Arbeitsliste docs/kern-uebungen.json).
   Keine andere Datei darf sie vergeben; test/kern-liste.test.js prüft das. Der Alias-Umzug oben wartet auf zwei davon. */
export const RESERVED_IDS = Object.freeze([
  'multipresse-bankdruecken', 'multipresse-schraegbank', 'schraeg-brustpresse', 'kh-flys', 'liegestuetze-erhoeht',
  'dips-assistiert', 'seitheben-maschine', 'reverse-butterfly', 'multipresse-schulterdruecken', 'frontheben',
  'aufrechtes-rudern', 'aussenrotation-kabel', 'kh-shrugs', 'farmers-walk', 'sz-french-press', 'enges-bankdruecken',
  'trizepsmaschine', 'kh-ueberkopf-trizeps', 'trizeps-kickbacks', 'scottcurls', 'bizepsmaschine', 'kabel-curls',
  'konzentrationscurls', 'handgelenkcurls', 'rudermaschine', 't-bar-rudern', 'hohes-rudern', 'klimmzuege-assistiert',
  'chin-ups', 'kabel-ueberzuege', 'invertiertes-rudern', 'rueckenstrecker-maschine', 'crunches', 'negativ-crunches',
  'beinheben-stuetz', 'beinheben-liegend', 'seitstuetz', 'dead-bug', 'pallof-press', 'holzhacker', 'russian-twists',
  'bauchroller', 'multipresse-kniebeugen', 'frontkniebeugen', 'pendel-kniebeuge', 'step-ups',
  'kh-rumaenisches-kreuzheben', 'trapbar-kreuzheben', 'hip-thrust-maschine', 'glute-bridge', 'kabel-kickbacks',
  'gesaessmaschine', 'kettlebell-swing', 'wadenheben-sitzend', 'wadenheben-kh',
]);

const normName = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/* Führt die Bibliothek zusammen: Grundliste, weitere Übungen, zusätzliche Alternativen und Alias-Umzüge.
   Reine Funktion, die Eingaben bleiben unverändert. */
export function assembleLibrary(base, extra = [], links = {}, moves = []) {
  const list = [...base, ...extra].map(e => ({ ...e, aliases: [...e.aliases], alternatives: [...e.alternatives] }));
  const byId = new Map(list.map(e => [e.id, e]));
  moves.forEach(m => {
    const from = byId.get(m.from);
    const to = byId.get(m.to);
    if (!from || !to) return;
    from.aliases = from.aliases.filter(a => normName(a) !== normName(m.alias));
    if (!to.aliases.some(a => normName(a) === normName(m.alias))) to.aliases.push(m.alias);
  });
  Object.entries(links || {}).forEach(([id, alts]) => {
    const e = byId.get(id);
    if (!e) return;
    (alts || []).forEach(a => { if (a !== id && !e.alternatives.includes(a)) e.alternatives.push(a); });
  });
  return list;
}

export const EXERCISES = assembleLibrary(EXERCISES_BASE, [...EXERCISES_KERN, ...EXERCISES_SMART], ALTERNATIVES_ADD, ALIAS_MOVES);
