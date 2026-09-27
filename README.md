# Split

Trainings- und Fitness-App für eine Person. Eine statische PWA ohne Server, ohne Konten und ohne Kosten. Alle Daten bleiben im Browser des Geräts.

## Was die App kann (Stand Stufe 1)

- **Heute:** Begrüßung, nächste Einheit als Hantelscheibe, Serie in Trainingswochen, Kalorien- und Wasserziel, BMI.
- **Training:** 3er-Split mit Satz-Log (kg, Wdh., RIR), Doppelprogression, Pausentimer pro Übung, Verlauf mit Kurve, Plan-Editor.
- **Körper:** Gewicht eintragen, BMI mit Einordnung.
- **Ernährung:** Kalorienziel nach Mifflin-St Jeor mit aufklappbarer Rechnung, Makroziele, Wasser.
- **Profil:** Eckdaten, Ziel, Aktivität, Trainingstage, Geräte, Einschränkungen, Backup.
- Beim ersten Start fragt eine kurze Einrichtung das Profil ab. Jeder Schritt lässt sich überspringen.

Kalorien, BMI und Körperwerte sind Schätzungen aus Formeln.

## Lokal starten

Module und Service Worker brauchen http. Ein Doppelklick auf `index.html` reicht nicht.

```sh
./start.sh          # dann http://localhost:8080 öffnen
```

## Tests

Die Rechenlogik (Kalorien, Makros, BMI, Serie, Progression, Migration, Offline-Dateiliste) ist ohne Build testbar:

```sh
node --test "test/*.test.js"
```

## Auf GitHub Pages bringen

1. Repo auf GitHub anlegen und den Stand pushen.
2. Unter *Settings → Pages* den Branch als Quelle wählen, Ordner `/ (root)`.
3. Die Adresse auf dem iPhone in Safari öffnen, *Teilen → Zum Home-Bildschirm*.

Nach jeder Änderung in `sw.js` die Konstante `CACHE` hochzählen, sonst sieht das Handy die neue Version erst verzögert. Neue Dateien gehören in die Liste `ASSETS` in `sw.js`; ein Test prüft das.

## Daten, Backup und Wiederherstellung

- Gespeichert wird im `localStorage` unter `fit.v2` (Schema 2). Beim Start bittet die App mit `navigator.storage.persist()` darum, die Daten nicht zu löschen.
- Ein Stand der ersten Version (`split.v1`) wird beim ersten Start automatisch übernommen. Der alte Schlüssel bleibt, bis das erste Backup im neuen Format gespeichert ist.
- **Backup:** *Profil → Backup speichern.* Auf dem iPhone öffnet sich das Teilen-Menü, dort *In Dateien sichern* wählen, am besten in iCloud Drive.
- **Wiederherstellen:** *Profil → Backup laden.* Backups der ersten Version (`app: 'split', version: 1`) enthalten nur Plan und Trainings; beim Laden bleiben Profil und Körperdaten stehen. Backups im neuen Format (`app: 'fit', version: 2`) ersetzen alles.

## Aufbau

```
index.html  manifest.webmanifest  sw.js  icons/
css/        tokens, base, components, views
js/app.js   Start, Navigation, Ereignisse
js/state.js Zustand und Speicher
js/store/   migrate.js (Schema, Migration, Backup-Format), backup.js
js/domain/  reine Rechenfunktionen, per node --test geprüft
js/ui/      Hantelscheibe, Diagramm, Sheet, Karten
js/views/   Heute, Training, Körper, Ernährung, Profil, Einrichtung
test/       Tests ohne Build
```
