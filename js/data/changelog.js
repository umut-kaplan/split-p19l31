/* Was ist neu. Neueste Version zuerst. Nach einem Update zeigt die App einmal die Einträge seit der zuletzt gesehenen Version.
   Vor jeder Veröffentlichung hier einen Eintrag anlegen; die Version muss zu CACHE in sw.js passen, ein Test prüft das. */
export const CHANGES = [
  {
    version: '4.5',
    date: '2026-10-01',
    items: [
      'Schichtplan für viele Schichtsysteme: 13 Vorlagen von der 2-Schicht über Konti und 12-Stunden-Dienste bis zur Feuerwehr 24/48, dazu eigene Muster mit bis zu 371 Tagen.',
      'Einrichten ohne Rechnen: Du tippst im Muster an, welcher Tag heute ist. Ist das nicht eindeutig, fragt Split, was du morgen hast.',
      'Eigene Schichtarten mit Kürzel, Farbe und Uhrzeiten, etwa Tagdienst, 24-Stunden-Dienst, Dispo oder Krank. Für einzelne Tage kannst du andere Uhrzeiten eintragen.',
      'Der Kalender-Import erkennt Tagschichten und merkt sich, welche Schichtart zu deinen eigenen Titeln gehört. Lücken kannst du als Urlaub markieren.',
      'Der Planer achtet mehr auf deinen Schlaf: Vor einer Frühschicht endet das Training rechtzeitig, nach der Nachtschicht beginnt es frühestens 8 Stunden nach Schichtende, und ein Tag mit Spätschicht, an dem du vor der Schicht trainierst, geht vor einem Tag mit Frühschicht. Zwei Tage in Folge plant Split jetzt, wenn die Muskeln wechseln. So passen bis zu 6 Trainings in eine Woche.',
      'Neu unter Training: Wissen. 20 kurze Karten zu Schicht, Schlaf, Ernährung und Training, jede mit Quelle. „Warum?“ an den Hinweisen des Planers führt direkt zur passenden Karte.',
    ],
  },
  {
    version: '4.4',
    date: '2026-09-30',
    items: [
      'Neu: Schichtplan. Trag deine Schichten als Muster ein oder importiere sie aus deinem Kalender. Split plant daraus, an welchen Tagen und zu welcher Uhrzeit du trainierst, und zeigt es auf „Heute“ in einer Zeile. Ein Tipp darauf öffnet den Schichtkalender.',
      '„Heute“ ist beim Zurückholen der App wieder aktuell: Datum, Schicht und Trainingsvorschlag springen auf den neuen Stand, auch über Mitternacht.',
      'Die geplanten Trainings einer Woche übernimmst du mit Erinnerung in den iPhone-Kalender.',
      'Das Profil ist aufgeräumt: Dort steht nur noch, was dich beschreibt. Scheiben, Backup, Export, Apple Health und Schichtplan findest du unter dem Zahnrad oben rechts in den Einstellungen.',
      'Im Profil steht jetzt dein Geburtsdatum statt des Alters. So stimmt dein Kalorienbedarf auch nach dem nächsten Geburtstag. Der Import aus Apple Health bietet dir Geburtsdatum, Geschlecht und Größe an, du hakst an, was übernommen wird.',
      'Scheiben und Stangen wie in deinem Studio: eigene Gewichte wie 2 kg oder 0,5 kg, eine Farbe pro Scheibe oder alle schwarz, eigene Stangen wie eine Trap-Bar. Im Scheibenrechner wählst du die Stange pro Übung, die App merkt sie sich.',
    ],
  },
  {
    version: '4.3',
    date: '2026-09-30',
    items: [
      'Satztypen: Tippe im Training auf die Satznummer, um einen Satz als Aufwärmen (A), Drop (D) oder bis Versagen (V) zu markieren. Aufwärmsätze zählen für keine Auswertung, Dropsätze nur beim Volumen. Die Aufwärmrampe übernimmst du mit einem Tipp als Aufwärmsätze.',
      'Supersätze: Verbinde im Plan zwei Übungen. Im Training stehen sie zusammen, und die Pause startet erst nach der zweiten Übung.',
      'Vergleichen: Unter Training zeigst du deinen Stand als QR-Code, dein Trainingspartner scannt ihn mit seinem Handy. Ihr seht Rekorde, die letzte Woche, eure Serie und auf Wunsch das Körpergewicht nebeneinander. Die Daten gehen direkt von Handy zu Handy.',
      'Ist dein letztes Backup länger her, erinnert dich „Heute“ daran. Wie oft, stellst du unter Einstellungen bei Backup ein: nach 7, 14 oder 30 Tagen oder gar nicht.',
      'Neu unter Einstellungen: „Trainings als CSV“. Damit kannst du deine Trainings zum Beispiel in Hevy übernehmen.',
      'Mehr Schutz für deine Daten: Ist der Speicher voll, sagt dir die App das sofort und bietet ein Backup an, statt still weiterzumachen. Ein Backup oder ein Health-Import, der nicht mehr passt, ändert nichts mehr halb. Und ein beschädigter Speicherstand wird nicht mehr überschrieben.',
    ],
  },
  {
    version: '4.2',
    date: '2026-09-30',
    items: [
      'Mengen und Ziele ab 1.000 werden jetzt richtig gespeichert. Vorher konnte ein Eintrag mit 1.000 g beim Bearbeiten zu 1 g werden. Hast du einen großen Eintrag geändert, schau ihn dir im Tagebuch kurz an.',
      'Eingaben mit Tausenderpunkt wie „8.500“ Schritte liest die App jetzt als 8500.',
      'Die erste Seite der Einrichtung reagiert beim Start vom Home-Bildschirm wieder zuverlässig auf Tipps.',
      'Neu: diese Übersicht. Nach einem Update zeigt Split einmal, was sich geändert hat. Unter Einstellungen bei „Was ist neu“ findest du sie jederzeit.',
    ],
  },
];

export const APP_VERSION = CHANGES[0].version;
