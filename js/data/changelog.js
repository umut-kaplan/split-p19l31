/* Was ist neu. Neueste Version zuerst. Nach einem Update zeigt die App einmal die Einträge seit der zuletzt gesehenen Version.
   Vor jeder Veröffentlichung hier einen Eintrag anlegen; die Version muss zu CACHE in sw.js passen, ein Test prüft das. */
export const CHANGES = [
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
