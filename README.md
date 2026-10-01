# Split

Trainings- und Fitness-App für eine Person. Eine statische PWA ohne Server, ohne Konten und ohne Kosten. Alle Daten bleiben im Browser des Geräts. Nur die Suche nach Lebensmitteln fragt bei Open Food Facts nach, alles andere läuft offline.

## Was die App kann

**Heute:** Begrüßung, nächste Einheit als Hantelscheibe, Wochenbericht jeden Montag (als Bild teilbar), Erholungsampel mit Begründung und „Was soll ich heute trainieren?“ mit Alternative, Check-in vor dem Training (Schlaf, Gefühl), bis zu zwei offene Vorschläge, Serie in Trainingswochen mit einem Joker pro Monat, Wochenziele (Training, Protein, Wasser), Tagesziele, Körperkarte mit Foto-Erinnerung oder Gewichtstrend, BMI. Unterseite „Erfolge“ mit Zielen, Meilensteinen und 17 Abzeichen.

**Training**
- Einheit: Satz-Log (kg, Wdh., RIR), Doppelprogression, Pausentimer pro Übung mit Ton, Rekord-Feier beim Abhaken, Anleitung zu jeder Übung, Scheibenrechner für Langhantel und SZ-Stange, Aufwärmrampe bei der ersten Grundübung jeder Muskelgruppe, dauerhafte Notiz pro Übung, Bewertung „Wie hart war es?“ nach der Einheit. Satztypen Aufwärmen, Drop und bis Versagen per Tipp auf die Satznummer; Aufwärmsätze zählen für keine Auswertung, Dropsätze nur fürs Volumen. Supersätze: im Plan zwei oder mehr Übungen verbinden, in der Einheit ein gemeinsamer Rahmen, Pause erst nach der letzten Übung der Runde.
- Verlauf: Liste und Monatskalender, Diagramm pro Übung (Gewicht, 1RM, Volumen), Rekorde (bestes Gewicht, 1RM nach Epley, bestes Volumen), Sätze pro Muskelgruppe und Woche gegen den Zielbereich 10 bis 20.
- Plan: mehrere Pläne, Vorlagen (Ganzkörper 2×, Oberkörper/Unterkörper 4×, Push/Pull/Legs), Tage mit Farben, Übungen aus der Bibliothek.
- Übungen: 50 Übungen mit Bild, Schritten, typischen Fehlern, Muskeln und Geräten; eigene Übungen mit Foto.
- Wissen: 20 kurze Karten zu Schicht und Schlaf, Ernährung und Training (`js/data/knowledge.js`). Jede Karte nennt ihre Quellen als Link (DOI oder Leitlinie) und trägt das Kennzeichen „Gut belegt“ oder „Abgeleitet aus Studien zu verwandten Fragen“. Allgemein formuliert, ohne Heilversprechen und ohne Dosierung für Nahrungsergänzung. `knowledgeLink(id, label = 'Warum?')` aus `js/views/knowledge.js` setzt auf jeder Seite einen kleinen Knopf, der die Karte als Sheet öffnet; er steht an den Regeln des Schichtplans und an den Hinweisen der geplanten Trainings.
- Vergleichen: eigener Stand als QR-Code (Rekorde der Grundübungen, letzte 7 Tage, Serie, auf Wunsch Körpergewicht), den Stand eines Trainingspartners scannen oder als Text einfügen, beide nebeneinander. Die Daten gehen direkt von Handy zu Handy; der zuletzt gescannte Stand liegt in `S.compare` und im Backup.
- Vorschläge nach festen Regeln: Deload nach zwei verfehlten Einheiten, zusätzlicher Satz bei Volumenlücken, Tausch bei eingetragenen Einschränkungen.

**Körper:** Gewicht mit 7-Tage-Schnitt, Zielgewicht mit Prognose und Spanne, Umfänge, Körperfett gemessen oder nach US-Navy geschätzt, fettfreie Masse, Silhouette aus den Umfängen, Fortschrittsfotos in drei Posen mit Vergleich. Unterseite Aktivität: Schritte, Ruhepuls, Schlaf, Cardio (kcal nach MET), gemessener Tagesverbrauch, jeweils mit Quelle.

**Ernährung:** Kalorienziel nach Katch-McArdle (mit Körperfett) oder Mifflin-St Jeor, Alltag plus tatsächliches Krafttraining, Cardio und Schritte über der Grundlinie, Makroziele, beides von Hand überschreibbar; Mahlzeiten mit Suche, Barcode-Scanner, eigenen Lebensmitteln, gespeicherten Mahlzeiten und Rezepten; Tages- und Wochenübersicht; Wasser; wöchentlicher Abgleich mit dem Gewichtstrend.

**Einrichtung:** fragt Eckdaten, Ziel, Plan (3er-Split, Ganzkörper 2×, Oberkörper/Unterkörper 4×, eigener Plan), Alltag, Trainingstage, Geräte und Einschränkungen ab; jeder Schritt lässt sich überspringen.

**Profil:** Vorname, Geburtsdatum (`profile.birthDate`; ohne Datum rechnet die App mit einem früher eingetragenen Alter weiter), Geschlecht, Größe, Gewicht, Ziel, Alltag, Trainingstage, Einschränkungen.

**Einstellungen** (Zahnrad im Profil): Studio mit Stangen und Scheiben (eigene Gewichte ab 0,25 kg, Farbe pro Scheibe, eigene Stangen, gemerkte Stange pro Übung) und Geräten; Daten mit Backup samt Erinnerung auf „Heute“ nach 7, 14 oder 30 Tagen (oder aus), Export der Trainings als CSV im Strong-Format, das Hevy importiert, Import aus dem Apple-Health-Export (Gewicht, Schritte, Ruhepuls, Schlaf; gestreamt, manuelle Werte gewinnen; Geburtsdatum, Geschlecht und Größe nach Bestätigung fürs Profil), Schichtplan und Zurücksetzen; App mit „Was ist neu“, Hinweisen und Quellen samt Lizenzen.

**Schichtplan:** 13 Vorlagen für verbreitete Modelle (2- und 3-Schicht Mo–Fr, Konti mit 4 und 5 Gruppen, 12 Stunden, Feuerwehr 24/48 und Bremer Modell, Dauernacht) oder ein eigenes Muster von 2 bis 371 Tagen, in Wochenzeilen mit „Woche kopieren“ und „Woche einfügen“. Danach tippt man im Muster an, welcher Tag heute ist; gibt es den Tag mehrmals, fragt die App nach den nächsten Tagen oder zeigt die passenden Möglichkeiten mit Vorschau. Eigene Schichtarten mit Name, Kürzel, Farbe, Uhrzeit und Art (Früh, Spät, Nacht, Tag, 24 h, Dispo, frei, Urlaub, Krank); eine Vorlage bringt ihre Uhrzeiten mit. Import aus einer .ics-Datei: gespeichert werden Datum und Schichtart, unbekannte Titel lassen sich einer Art zuordnen (die Zuordnung bleibt für den nächsten Import), Tage ohne Eintrag wahlweise als Urlaub; passt ein anderer Einstieg ins Muster besser zum Import, schlägt die App ihn vor. Monatskalender mit Einzeländerungen, auch mit eigener Uhrzeit für einen Tag. Split plant die Trainings der nächsten zwei Wochen um die Schichten, je nach Art der Schicht (nach Früh- und Tagschicht, vor Spät- und Nachtschicht, am Tag eines 24-h-Dienstes und bei Krankheit keins), mit Uhrzeit und Begründung, und übernimmt sie auf Wunsch als Kalender-Datei in den iPhone-Kalender. Die Regeln (`PLAN_RULES` in `js/domain/shift-plan.js`) sind aus Studien zu verwandten Fragen abgeleitet: vor einem frühen Schichtbeginn Ende 3 Stunden vor der geschätzten Schlafenszeit (Beginn minus 8,5 Stunden), nach einer Nachtschicht frühestens 8 Stunden nach Schichtende, nach der letzten Nacht einer Folge Ende bis 20 Uhr; bei der Tagwahl frei vor Dispo vor Spät vor Früh und Tag vor Nacht, Abschläge für weniger als 11 Stunden Ruhe zwischen zwei Schichten und für Tage zwischen zwei Nachtschichten; zwei Tage in Folge nur mit Einheiten für verschiedene Hauptmuskeln, höchstens 6 Trainings pro Woche. Am geplanten Training stehen Hinweise mit „Warum?“: welche Regel die Uhrzeit verschoben hat, eine leichtere Einheit ab der zweiten Nachtschicht in Folge und an Tagen mit kurzer Ruhe, kein Booster mit Koffein, wenn das Training weniger als 8 Stunden vor dem Schlafen endet. Auf „Heute“ steht eine Zeile mit Schicht und Training, darunter kurz die Hinweise; ein Tipp öffnet den Schichtkalender. Kommt die App aus dem Hintergrund zurück, zeichnet sie neu, wenn seit dem letzten Zeichnen ein neuer Tag oder eine neue Viertelstunde begonnen hat.

Jede Empfehlung nennt in einem Satz, warum die App sie gibt, und ist nur ein Vorschlag. Kalorien-, BMI- und Körperfettwerte sind Schätzungen aus Formeln.

## Lokal starten

Module und Service Worker brauchen http. Ein Doppelklick auf `index.html` reicht nicht.

```sh
./start.sh                # dann http://localhost:8080 öffnen
PORT=9000 ./start.sh      # anderer Port
```

## Tests

Die Rechenlogik ist ohne Build testbar: Kalorien, Makros, BMI, Navy-Formel, Trend und Prognose, Serie mit Joker, Progression, Rekorde, Volumen, Vorschlagsregeln, Erholungsampel, Tagesvorschlag, Wochenbericht, Abzeichen, MET und Schritte, Health-Import, Nährwerte, Lebensmitteldaten, Migration, Backup, Backup-Erinnerung, CSV-Export, Satztypen, Supersatz-Pausen, QR-Vergleich, Changelog, Zahleneingabe, Schichtplan (Muster, Vorlagen mit Gruppen und Versatz, Einstieg „heute“, Schichtarten, Import, Planung, Kalender-Datei, Umzug alter Stände), Geburtsdatum, eigene Scheiben und Stangen, Bildnachweise, Wissen-Karten (Anzahl, Quellen, Satzlänge, Wortwahl, „Warum?“-Knopf), Offline-Dateiliste.

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

Vor jeder Veröffentlichung:

- In `js/data/changelog.js` oben einen Eintrag mit Version, Datum und den Änderungen in Alltagssprache anlegen. Nach dem Update zeigt die App ihn einmal beim Start („Neu in Split“), später unter Einstellungen bei „Was ist neu“.
- In `sw.js` die Konstante `CACHE` auf dieselbe Version setzen (`split-v4.2` zu Version 4.2), sonst sieht das Handy die neue Version erst verzögert. Ein Test prüft, dass beide zusammenpassen.
- Jede neue Datei gehört in eine der Listen in `sw.js`; auch das prüft ein Test.

Das Update kommt auf dem Handy in zwei Schritten an: Beim ersten Start nach der Veröffentlichung lädt der Service Worker die neue Version im Hintergrund, beim nächsten Start ist sie da.

## Daten, Backup und Wiederherstellung

Jede Person nutzt die App auf ihrem eigenen Handy. Die Daten liegen nur dort und vermischen sich nie, es gibt keinen Server und kein Konto. GitHub liefert nur die App-Dateien aus.

- **Fotos:** Mit der Kamera aufgenommene Fortschrittsfotos landen nicht in der Mediathek, sondern nur in der App (verkleinert auf etwa 1080 px, IndexedDB). „In Fotos sichern“ legt die Posen einer Woche als ein Bild nebeneinander und speichert es über das Teilen-Menü in der Mediathek.
- **Speicher:** kleine Daten im `localStorage` unter `fit.v2` (Schema 2), Bilder und der Lebensmittel-Cache in IndexedDB (`split`, Stores `photos`, `exerciseImages`, `foodCache`). Beim Start bittet die App mit `navigator.storage.persist()` darum, nichts zu löschen.
- **Umzug:** Ein Stand der ersten Version (`split.v1`) wird beim ersten Start übernommen. Der alte Schlüssel bleibt, bis ein Backup über das Teilen-Menü gespeichert ist. Ein Download ohne Teilen-Menü zählt dafür nicht.
- **Backup:** *Profil → Zahnrad (Einstellungen) → Backup speichern*, wahlweise mit oder ohne Fotos. Auf dem iPhone öffnet sich das Teilen-Menü, dort *In Dateien sichern* wählen, am besten in iCloud Drive.
- **Wiederherstellen:** *Profil → Zahnrad (Einstellungen) → Backup laden.* Backups der ersten Version (`app: 'split', version: 1`) enthalten nur Plan und Trainings; beim Laden bleiben Profil und Körperdaten stehen. Backups im neuen Format (`app: 'fit', version: 2`) ersetzen alles, Fotos kommen mit, wenn sie im Backup sind.

## Quellen und Lizenzen

| Was | Quelle | Lizenz |
|---|---|---|
| Übungsbilder | [wger.de](https://wger.de), Einzelnachweise in `data/QUELLEN.md` | CC BY-SA 3.0 / 4.0 |
| Übungsanleitungen, typische Fehler | selbst geschrieben | – |
| Grundnahrungsmittel (`js/data/foods-basic.js`) | Werte nach Bundeslebensmittelschlüssel, USDA FoodData Central und deutschen Etiketten | Richtwerte |
| Lebensmittelsuche und Barcodes | [Open Food Facts](https://openfoodfacts.org) | ODbL |
| Barcode-Leser für iOS, QR-Codes lesen und schreiben | `@zxing/library` 0.23.0, `js/vendor/` | Apache-2.0 |
| Entpacken des Health-Exports | `fflate` 0.8.3, `js/vendor/` | MIT |
| MET-Werte für Cardio | Compendium of Physical Activities | Richtwerte |
| Wissen-Karten | Studien und Leitlinien, einzeln in `js/data/knowledge.js` und auf jeder Karte | – |

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
js/data/    Standardplan, Vorlagen, Übungen, Grundnahrungsmittel, Wissen-Karten
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
