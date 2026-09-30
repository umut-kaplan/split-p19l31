/* Was ist neu. Neueste Version zuerst. Nach einem Update zeigt die App einmal die Einträge seit der zuletzt gesehenen Version.
   Vor jeder Veröffentlichung hier einen Eintrag anlegen; die Version muss zu CACHE in sw.js passen, ein Test prüft das. */
export const CHANGES = [
  {
    version: '4.3',
    date: '2026-09-30',
    items: [
      'Satztypen: Tippe im Training auf die Satznummer, um einen Satz als Aufwärmen (A), Drop (D) oder bis Versagen (V) zu markieren. Aufwärmsätze zählen für keine Auswertung, Dropsätze nur beim Volumen. Die Aufwärmrampe übernimmst du mit einem Tipp als Aufwärmsätze.',
      'Supersätze: Verbinde im Plan zwei Übungen. Im Training stehen sie zusammen, und die Pause startet erst nach der zweiten Übung.',
      'Vergleichen: Unter Training zeigst du deinen Stand als QR-Code, dein Trainingspartner scannt ihn mit seinem Handy. Ihr seht Rekorde, die letzte Woche, eure Serie und auf Wunsch das Körpergewicht nebeneinander. Die Daten gehen direkt von Handy zu Handy.',
      'Ist dein letztes Backup länger her, erinnert dich „Heute“ daran. Wie oft, stellst du im Profil unter Backup ein: nach 7, 14 oder 30 Tagen oder gar nicht.',
      'Neu im Profil: „Trainings als CSV“. Damit kannst du deine Trainings zum Beispiel in Hevy übernehmen.',
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
      'Neu: diese Übersicht. Nach einem Update zeigt Split einmal, was sich geändert hat. Im Profil unter „Was ist neu“ findest du sie jederzeit.',
    ],
  },
];

export const APP_VERSION = CHANGES[0].version;
