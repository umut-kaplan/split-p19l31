# Split

Trainings- und Fitness-App für eine Person. Eine statische PWA ohne Server, ohne Konten und ohne Kosten. Alle Daten bleiben im Browser des Geräts. Nur die Suche nach Lebensmitteln fragt bei Open Food Facts nach, alles andere läuft offline.

## Was die App kann

**Heute:** Begrüßung, nächste Einheit als Hantelscheibe, Wochenbericht jeden Montag (als Bild teilbar), Erholungsampel mit Begründung und „Was soll ich heute trainieren?“ mit Alternative, Check-in vor dem Training (Schlaf, Gefühl), bis zu zwei offene Vorschläge, Serie in Trainingswochen mit einem Joker pro Monat, Wochenziele (Training, Protein, Wasser), Tagesziele, Körperkarte mit Foto-Erinnerung oder Gewichtstrend, BMI. Unterseite „Erfolge“ mit Zielen, Meilensteinen und 17 Abzeichen.

**Training**
- Einheit: Satz-Log (kg, Wdh., RIR), Doppelprogression, Pausentimer pro Übung mit Ton, Rekord-Feier beim Abhaken, Anleitung zu jeder Übung.
- Verlauf: Liste und Monatskalender, Diagramm pro Übung (Gewicht, 1RM, Volumen), Rekorde (bestes Gewicht, 1RM nach Epley, bestes Volumen), Sätze pro Muskelgruppe und Woche gegen den Zielbereich 10 bis 20.
- Plan: mehrere Pläne, Vorlagen (Ganzkörper 2×, Oberkörper/Unterkörper 4×, Push/Pull/Legs), Tage mit Farben, Übungen aus der Bibliothek.
- Übungen: 50 Übungen mit Bild, Schritten, typischen Fehlern, Muskeln und Geräten; eigene Übungen mit Foto.
- Vorschläge nach festen Regeln: Deload nach zwei verfehlten Einheiten, zusätzlicher Satz bei Volumenlücken, Tausch bei eingetragenen Einschränkungen.

**Körper:** Gewicht mit 7-Tage-Schnitt, Zielgewicht mit Prognose und Spanne, Umfänge, Körperfett gemessen oder nach US-Navy geschätzt, fettfreie Masse, Silhouette aus den Umfängen, Fortschrittsfotos in drei Posen mit Vergleich. Unterseite Aktivität: Schritte, Ruhepuls, Schlaf, Cardio (kcal nach MET), gemessener Tagesverbrauch, jeweils mit Quelle.

**Ernährung:** Kalorienziel nach Katch-McArdle (mit Körperfett) oder Mifflin-St Jeor, Alltag plus tatsächliches Krafttraining, Cardio und Schritte über der Grundlinie, Makroziele, beides von Hand überschreibbar; Mahlzeiten mit Suche, Barcode-Scanner, eigenen Lebensmitteln, gespeicherten Mahlzeiten und Rezepten; Tages- und Wochenübersicht; Wasser; wöchentlicher Abgleich mit dem Gewichtstrend.

**Profil:** Eckdaten, Ziel, Alltag, Trainingstage, Geräte, Einschränkungen, Backup, Import aus dem Apple-Health-Export (Gewicht, Schritte, Ruhepuls, Schlaf; gestreamt, manuelle Werte gewinnen).

Jede Empfehlung nennt in einem Satz, warum die App sie gibt, und ist nur ein Vorschlag. Kalorien-, BMI- und Körperfettwerte sind Schätzungen aus Formeln.

## Lokal starten

Module und Service Worker brauchen http. Ein Doppelklick auf `index.html` reicht nicht.

```sh
./start.sh                # dann http://localhost:8080 öffnen
PORT=9000 ./start.sh      # anderer Port
```

## Tests

Die Rechenlogik ist ohne Build testbar: Kalorien, Makros, BMI, Navy-Formel, Trend und Prognose, Serie mit Joker, Progression, Rekorde, Volumen, Vorschlagsregeln, Erholungsampel, Tagesvorschlag, Wochenbericht, Abzeichen, MET und Schritte, Health-Import, Nährwerte, Lebensmitteldaten, Migration, Backup, Offline-Dateiliste.

```sh
node --test "test/*.test.js"
```

## Auf GitHub Pages bringen

Veröffentlicht wird nur ein Schnappschuss des aktuellen Stands auf dem Branch `gh-pages`. Jeder Schnappschuss hängt am vorigen, nicht an der Entwicklungs-Historie; so bleibt die Historie privat, und es braucht kein Force-Push:

```sh
REPO=https://github.com/umut-kaplan/split-p19l31.git
git fetch "$REPO" gh-pages
SNAP=$(git commit-tree 'HEAD^{tree}' -p FETCH_HEAD -m 'Split, neuer Stand')
git push "$REPO" "$SNAP":refs/heads/gh-pages
```

Adresse: https://umut-kaplan.github.io/split-p19l31/. Auf dem iPhone in Safari öffnen, *Teilen → Zum Home-Bildschirm*, danach nur über das Symbol öffnen.

Vor jeder Veröffentlichung in `sw.js` die Konstante `CACHE` hochzählen, sonst sieht das Handy die neue Version erst verzögert. Jede neue Datei gehört in eine der Listen in `sw.js`; ein Test prüft das.

## Daten, Backup und Wiederherstellung

- **Speicher:** kleine Daten im `localStorage` unter `fit.v2` (Schema 2), Bilder und der Lebensmittel-Cache in IndexedDB (`split`, Stores `photos`, `exerciseImages`, `foodCache`). Beim Start bittet die App mit `navigator.storage.persist()` darum, nichts zu löschen.
- **Umzug:** Ein Stand der ersten Version (`split.v1`) wird beim ersten Start übernommen. Der alte Schlüssel bleibt, bis das erste Backup im neuen Format gespeichert ist.
- **Backup:** *Profil → Backup speichern*, wahlweise mit oder ohne Fotos. Auf dem iPhone öffnet sich das Teilen-Menü, dort *In Dateien sichern* wählen, am besten in iCloud Drive.
- **Wiederherstellen:** *Profil → Backup laden.* Backups der ersten Version (`app: 'split', version: 1`) enthalten nur Plan und Trainings; beim Laden bleiben Profil und Körperdaten stehen. Backups im neuen Format (`app: 'fit', version: 2`) ersetzen alles, Fotos kommen mit, wenn sie im Backup sind.

## Quellen und Lizenzen

| Was | Quelle | Lizenz |
|---|---|---|
| Übungsbilder | [wger.de](https://wger.de), Einzelnachweise in `data/QUELLEN.md` | CC BY-SA 3.0 / 4.0 |
| Übungsanleitungen, typische Fehler | selbst geschrieben | – |
| Grundnahrungsmittel (`js/data/foods-basic.js`) | Werte nach Bundeslebensmittelschlüssel, USDA FoodData Central und deutschen Etiketten | Richtwerte |
| Lebensmittelsuche und Barcodes | [Open Food Facts](https://openfoodfacts.org) | ODbL |
| Barcode-Leser für iOS | `@zxing/library` 0.23.0, `js/vendor/` | Apache-2.0 |
| Entpacken des Health-Exports | `fflate` 0.8.3, `js/vendor/` | MIT |
| MET-Werte für Cardio | Compendium of Physical Activities | Richtwerte |

## Aufbau

```
index.html  manifest.webmanifest  sw.js  icons/  data/img/exercises/
css/        tokens, base, components, views, training, body, nutrition
js/app.js   Start, Navigation, Ereignisse (sammelt Untermodule ein)
js/state.js Zustand und Speicher
js/store/   migrate.js (Schema, Migration, Backup-Format), backup.js, db.js (IndexedDB), off.js (Open Food Facts)
js/importers/ Datei-Importe, bisher Apple Health (Worker, gestreamt)
js/domain/  reine Rechenfunktionen, per node --test geprüft
js/coach/   regelbasierte Vorschläge in einem Format, das ein späterer KI-Coach übernehmen kann
js/data/    Standardplan, Vorlagen, Übungen, Grundnahrungsmittel
js/ui/      Hantelscheibe, Diagramme, Silhouette, Sheet, Karten, Bilder
js/views/   Heute, Training, Körper, Ernährung, Profil, Einrichtung
js/vendor/  ZXing, fflate
test/       Tests ohne Build
```

## Bewusst noch nicht drin

Diese Punkte brauchen eine native App, Konten oder einen Server. Die Stellen im Code sind vorbereitet:

| Was | Vorbereitet in |
|---|---|
| Live-Anbindung an Apple Health, Garmin, Fitbit, Google Fit | `js/importers/` (Schnittstelle für weitere Quellen) |
| KI-Trainer mit Sprachmodell | `js/coach/` (alle Regeln liefern Vorschläge im selben Format) |
| Freunde und Challenges | – |
| Übungsanimationen | Feld `media` in `js/data/exercises.js` |
| Auswertung von Körperfett-Messreihen | Messwerte tragen Datum, Quelle und Methode |
