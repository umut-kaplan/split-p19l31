# Geräte, Übungen, Smart-Zirkel (4.7): Schnittstellen

Stand 01.10.2026, Branch `release-4.7`, nach dem Abschluss der Arbeitspakete A (Kern-Übungen), B (Oberfläche) und C (Plan-Vorlagen, Coach) und den Korrekturen aus der Prüfung von 4.7. Grundlage: Recherchen „Übungen und Geräte“ und „Trainingspläne“ (30.09.2026), Entscheidungen Q5, Q6, Q17, Q28 bis Q32, Q34 bis Q37. Diese Seite beschreibt die Daten und Funktionen rund um Geräte, Übungen, Smart-Zirkel und Pläne.

## Dateien

| Datei | Inhalt | Paket |
|---|---|---|
| `js/data/equipment.js` | 59 Gerätetypen in sechs Gruppen, Smart-Zirkel, Schnellauswahl, Regeln, Umzugstabellen | Fundament |
| `js/domain/equipment.js` | reine Funktionen für Geräte (siehe unten), hinten die Helfer für die Oberfläche | Fundament, B |
| `js/data/exercise-schema.js` | Schema einer Übung, Baustein `exercise()` | Fundament |
| `js/data/exercises.js` | 54 Übungen (50 bis 4.6, dazu Schrägbank-Curls, Seitheben am Kabel, Rückenstrecker und Rudern mit Band), Zusammenführen, `ALIAS_MOVES`, `RESERVED_IDS` | Fundament, Prüfung |
| `js/data/exercises-kern.js` | 55 Kern-Übungen (`EXERCISES_KERN`) und Rückverweise (`ALTERNATIVES_ADD`) | A |
| `js/data/exercises-smart.js` | 18 Smart-Zirkel-Übungen mit Anleitung | Fundament |
| `docs/kern-uebungen.json` | Arbeitsliste der 55 Kern-Übungen, Grundlage von `test/exercises-kern.test.js` | Fundament |
| `js/domain/muscles.js` | 15 Muskelgruppen, Wochenziele je Muskel | Fundament |
| `js/domain/smart-sets.js` | Methode je Satz in der laufenden Einheit | B |
| `js/views/gear.js`, `css/gear.css` | Geräteseite (Einstellungen · Studio, Einrichtung), Kurzhantel-Steigerung | B |
| `js/views/smart-sets.js` | Hinweis, Chip „Methode“, Schild je Satz, Sheet | B |
| `js/views/library.js`, Picker in `js/views/planedit.js` | „Nur meine Geräte“, Gerätefilter, Editor eigener Übungen | B |
| `js/data/plan-templates.js` | sechs Vorlagen (`PLAN_TEMPLATES`, `findTemplate`) | C |
| `js/plans.js` | 3er-Split 4.7 (`DEFAULT_PLAN`), alter Split (`LEGACY_SPLIT`), Pläne aus Vorlagen, Geräte-Ersatz | C, Abschluss |
| `js/domain/plan-choice.js` | Planwahl und Empfehlung in der Einrichtung | C |
| `js/domain/plan-stats.js` | Dauer, Kurzversion, Sätze pro Muskel eines Plan-Tags | C |
| `js/domain/plan-update.js`, `js/views/plan-update.js` | Angebot „Überarbeiteter 3er-Split verfügbar“ | C |
| `js/views/short-start.js` | Knopf „Kurz, ca. 30 min“ | C |
| `js/coach/training.js`, `js/coach/nutrition.js` | Schlaf und Schichten vor dem Deload, ruhigerer Kalorienvorschlag | C |
| `sw.js` | neue Dateien in `GEAR_UI` (B) und `GEAR_PLANS` (C); `GEAR_KERN` bleibt leer, solange die Kern-Übungen keine Bilder haben | alle |

## Datenformate

**Gerät** (`EQUIPMENT` in `data/equipment.js`): `{ id, group, name, note, avail: { gross, discount, zuhause } }`, avail 3 meist, 2 oft, 1 selten, 0 kaum. Gruppen (`EQUIPMENT_GROUPS`): `frei` 5, `bank` 14, `kabel` 4, `steck` 20, `hebel` 9, `funktional` 7. Dazu `SMART_CIRCUIT = { id: 'smart-zirkel', name: 'Smart-Zirkel', label: 'Smart-Zirkel (z. B. EGYM)' }`: ein Zusatzschalter, keine Gruppe, kein Studiotyp.

**Schnellauswahl** (`PRESETS`): `gross` (alles mit avail.gross ≥ 2, 59 Geräte), `discount` (avail.discount = 3, 38), `zuhause` (avail.zuhause = 3: Kurzhanteln, Widerstandsbänder).

**Auswahl im Profil** `S.profile.equipment`: sortierte Liste von Geräte-ids, `'smart-zirkel'` eingeschlossen. **Leer heißt: alles erlaubt** (wie bis 4.6).

**Geräte-Anforderung einer Übung** `exercise.equipment`: Liste von Termen, jeder muss erfüllt sein. Ein Term ist eine id oder eine Liste von ids, von denen eine genügt. `[]` = Körpergewicht.

```js
['langhantel', ['kniebeugenstaender', 'multipresse']]   // Kniebeugen: Langhantel UND (Rack ODER Multipresse)
['kurzhanteln', ['flachbank', 'plyobox']]               // Step-ups
['smart-zirkel']                                        // jede Smart-Zirkel-Übung
```

Tiefer verschachtelt wird nicht. „Bankdrückstation oder Flachbank + Rack“ löst die Regel in `IMPLIES` (Bankdrücken verlangt `['langhantel', 'bankdrueckstation']`).

**Übung**: Schema in `data/exercise-schema.js`. Neu sind die Geräte-Anforderung oben, `autoLoad: null | 'smart'` (das Gerät stellt das Gewicht ein) und `assisted: true | false` (Gegengewicht: die kg sind Unterstützung, bei `dips-assistiert` und `klimmzuege-assistiert`). Muskel-ids neu: `traps` (Nacken/Trapez), `lower_back` (Unterer Rücken).

**Satz** in `sessions[].ex[].sets` und `active.ex[].log`: `{ w, r, rir, t?, m? }`. Neu ist `m`, die Methode am Smart-Zirkel: `regular`, `negative`, `adaptive`, `isokinetic`, `explonic`, `maxout` (Anzeigenamen in `SET_METHODS`). Fehlt `m`, gilt der Satz als regulär. Unbekannte Werte entfernt `cleanSet` beim Laden.

**Einstellung** `S.settings.dumbbellInc`: 1, 2 oder 2,5 (kg), Standard 2.

**Wochenziele** `WEEKLY_SET_TARGETS` in `domain/muscles.js`: Standard 10 bis 20, Waden und Bauch 4 bis 10. Die neuen Gruppen Nacken/Trapez und unterer Rücken haben keinen Zielbereich (`UNRATED_MUSCLES`, `weeklyTarget` liefert `null`, `volumeRating` `'none'`): Die Muskelansicht und der Wochenbericht zeigen ihre Sätze ohne Ampel und Zielzone und zählen sie bei „x von y im Ziel“ nicht mit. Im Fließtext heißt es „unterer Rücken“ (`muscleInText`).

**Methode an der laufenden Übung** `active.ex[].m`: gilt für alle Sätze ohne eigene `log[].m`. Gespeichert wird je Satz die geltende Methode (`savedSet`).

**Vorlage** (`PLAN_TEMPLATES`): `{ id, name, perWeek, hint, smart?, fromDefault?, days: [{ name, color, muscles, exercises: [[Name, Sätze, Wdh. von, Wdh. bis, Pause s, Steigerung kg, Einheit?, { ss: true }?]] }] }`. ids: `fullbody2`, `fullbody3`, `upperlower4`, `split` (`fromDefault`, der 3er-Split), `ppl6`, `smart` (nur mit Smart-Zirkel). Namen wie in der Bibliothek.

**Plan** `S.plans[]`: wie bisher, dazu `template` (`'split'`, `'empty'` oder eine Vorlagen-id) an Plänen aus der Einrichtung oder dem Angebot; Plan-Einträge können `ss: true` tragen.

**Ersetzung** beim Anlegen eines Plans: `{ day, from, to, missing? }`. `to` ist der Ersatz; `to: null` heißt: kein Ersatz mit derselben Hauptmuskelgruppe, die Übung bleibt stehen, `missing` nennt die fehlenden Geräte („Latzugstation“).

**Kurzversion**: `S.active.short = true` in einer als Kurzversion gestarteten Einheit, `sessions[].short = true` im gespeicherten Training. Fehlt das Feld, war es eine volle Einheit.

**Angebot zum 3er-Split** `S.suggestions['plan-update:split-4.7'] = { status: 'accepted' | 'declined', date }`, wie die Coach-Vorschläge.

## Funktionen

`domain/equipment.js`

| Funktion | macht |
|---|---|
| `canDo(exercise, equipment)` | geht die Übung mit der Auswahl? Leere Auswahl: ja |
| `doable(equipment)` | dasselbe als Filter, einmal gebaut: `list.filter(doable(S.profile.equipment))` |
| `expandEquipment(list)` | Auswahl plus Regeln: doppelter Kabelzug → einzelner, Schrägbank → Flachbank, Rack + Flachbank → Bankdrückstation, Rack + Schrägbank → Schrägbankstation; Landmine fällt ohne Langhantel weg |
| `requirementTerms(req)`, `requirementIds(req)`, `requirementText(req)` | Anforderung bereinigt, alle ids, Text „A + B oder C“ |
| `presetEquipment(id)`, `applyPreset(current, id)`, `matchingPreset(current)` | Schnellauswahl; `applyPreset` lässt den Smart-Zirkel, wie er war |
| `toggleEquipment(current, id)`, `toggleSmartCircuit(current)`, `hasSmartCircuit(current)` | Abhaken, liefert eine neue sortierte Liste |
| `groupEquipment(groupId)`, `equipmentName(id)`, `isEquipmentId(id)` | Anzeige |
| `migrateProfileEquipment(list)`, `migrateExerciseEquipment(req)` | Umzug der neun Kategorien bis 4.6, idempotent; alle neun ergeben „Großes Studio“ (59), „Maschinen“ sind 32 Geräte (`LEGACY_MACHINES`: Steckgewicht ohne Beinpresse, alle Hebelmaschinen, Multipresse, Scottbank, Hyperextension-Bank, Bauchbank) |
| `hasLegacyEquipment(list)` | steht noch eine Kategorie bis 4.6 in der Auswahl? Dann setzt `normalize` `S.settings.gearCheck`, und „Heute“ zeigt einmal „Neu: Geräte deines Studios“ (`gearCheckCard` in `views/gear.js`, Hinweisart `gear`) |
| `isMachinesTerm(t)`, `MACHINES_TEXT` | „Maschinen“ an einer eigenen Übung: Anzeige „eine der Maschinen“ statt aller Namen |

`domain/library.js`: `findExercise(key, custom)` sucht in dieser Reihenfolge: id, genau gleicher Name (die eigene Übung vor der Bibliothek), zuletzt Alias; ein Alias der Bibliothek verdrängt also keine eigene Übung. `nameClashes(custom)` liefert eigene Übungen, die wie eine Übung der Bibliothek heißen (Name oder Alias), `[{ custom, lib }]`; die Bibliothek nennt sie einmal („Gleiche Namen“, `S.settings.nameClashSeen`), geändert wird nichts. `searchExercises(list, { q, muscle, equipment, have })` mit `equipment` als Geräte-id und `have` als Auswahl („geht mit meinen Geräten“). Außerdem `equipmentOf(list)` (ids, nach Namen sortiert), `safeAlternatives(e, custom, tags, equipment)`, `defaultsFor(e, settings)`, `usesDumbbells(e)`, `DUMBBELL_INCS`, `cleanDumbbellInc(v)`, `isAssisted(x, custom)` (Gegengewicht? für Bibliothek, Plan-Eintrag oder Übung einer Einheit) und `exerciseTonnage(x)` (bewegtes Gewicht ohne Übungen auf Zeit und mit Gegengewicht).

`domain/settypes.js`: `SET_METHODS`, `setMethod(s)`, `isRegular(s)`, `isRecordSet(s)`, `recordSets(sets)`, `storedSet(logEntry)` (Satz zum Speichern, t und m nur wenn gesetzt).

`domain/prs.js`: Rekorde, 1RM und Volumen-Rekord nur aus Sätzen mit Methode „Regulär“ oder ohne Methode. Mit Gegengewicht (`assisted` am Rekord-Eintrag) gibt es nur Wiederholungen samt Unterstützung (`reps: { value, assist, date }`): ein Rekord sind mehr Wiederholungen bei gleicher oder weniger Unterstützung; `betterAssisted`, `assistText` („8 Wdh. bei 20 kg Unterstützung“).

`domain/progression.js`: `suggest(sessions, planEntry, name, lib)`. Hat `lib` oder der Plan-Eintrag `autoLoad`, kommt `{ kind: 'auto', weight: null, text, sub }`, also kein kg-Vorschlag. Mit Gegengewicht (`lib.assisted`) heißt Fortschritt weniger Unterstützung: alle Sätze oben, dann Gegengewicht minus Steigerung (sonst `ASSIST_STEP` 2,5 kg), bis 0.

`domain/muscles.js`: `weeklyTarget(m)` (`null` ohne Zielbereich), `weeklyTargetText()`, `muscleInText(m)`; `domain/volume.js`: `volumeRating(v, m)` (`'low' | 'ok' | 'high' | 'none'`).

`data/exercises.js`: `EXERCISES` (alles zusammengeführt), `EXERCISES_BASE`, `assembleLibrary(base, extra, links, moves)`, `ALIAS_MOVES`, `RESERVED_IDS`.

`store/migrate.js` `normalize`: Profil-Geräte und Geräte eigener Übungen auf ids, `dumbbellInc` säubern, `m` an Sätzen prüfen. Schema bleibt 2, Backups 4.2 bis 4.6 und ein 4.6-Stand laden ohne Verlust (im Browser geprüft).

### Oberfläche (B)

`domain/equipment.js`, hinten angehängt

| Funktion | macht |
|---|---|
| `clearEquipment(current)` | „Alles abwählen“: leer, der Smart-Zirkel bleibt, wie er war |
| `groupCount(current, groupId)` | `{ on, total }` für den Zähler einer Gruppe |
| `coveredBy(current, id)` | nicht angehakt, aber über eine Regel abgedeckt: die ids, die es einschließen, sonst `null` |
| `shortEquipmentName(id)` | Name ohne Klammerzusatz („Multipresse“) |
| `missingTerms(exercise, equipment)`, `missingText(exercise, equipment)` | was fehlt, als Terme oder Text „Langhantel mit Scheiben, Power Rack / Kniebeugenständer oder Multipresse“; leere Auswahl: nichts |
| `splitByEquipment(list, equipment)` | `{ fit, rest: [{ e, missing }] }` für den Übungs-Picker |
| `splitRequirement(req)`, `buildRequirement(ids, mode)` | Editor eigener Übungen: `{ ids, mode: 'all' \| 'any', simple }` und zurück |

`domain/smart-sets.js`

| Funktion | macht |
|---|---|
| `isAutoLoad(x, lib)` | stellt das Gerät das Gewicht ein? (Plan-Eintrag, Übung der Einheit oder Bibliothek) |
| `cardMethod(x)`, `methodOf(x, s)`, `methodName(m)`, `overridden(x, s)` | Methode der Karte, geltende Methode eines Satzes, Anzeigename, weicht der Satz ab? |
| `savedSet(x, s)` | Satz zum Speichern mit der geltenden Methode |
| `setCardMethod(x, m)`, `setSetMethod(x, j, m)` | Methode für alle Sätze (offene folgen, erledigte behalten ihre) oder einen Satz |
| `lastMethod(sets)` | Startwert der Karte: die Methode vom letzten Mal, wenn alle Arbeitssätze sie hatten und sie nicht regulär war |
| `METHOD_IDS`, `METHOD_HINTS` | Reihenfolge und eine Zeile je Methode, ohne Markennamen und nur Belegtes: Explonic „Leichtes bis mittleres Gewicht, die hebende Phase explosiv.“, Max Out „Folge der Anzeige am Gerät.“ (belegt ist nur, dass es eine neue Methode ist) |

`domain/settypes.js`: `methodSuffix(s)` liefert „ (Negativ)“ für „Letztes Mal“ (`setsSummary` in `domain/session-flow.js`) und den Verlauf, bei „Regulär“ nichts.

`views/gear.js`: `fEquipment(profile)` (Geräteseite), `equipmentStatus(list)`, `dumbbellSection()` und `dumbbellEntries(plans, inc)` (Kurzhantel-Steigerung, „angleichen“). `views/smart-sets.js`: `autoHint()`, `methodChip(x, i)`, `methodTag(x, s)`, `methodSheetBody(x, i)`.

### Pläne, Kurzversion, Coach (C)

`plans.js`

| Funktion | macht |
|---|---|
| `DEFAULT_PLAN`, `defaultPlan()` | 3er-Split 4.7 mit der festen id `split`; bleibende Übungen behalten ihre ids von früher |
| `LEGACY_SPLIT` | der 3er-Split bis 4.6, nur zum Erkennen und für die ids; wird nie angelegt |
| `templatePlan(tpl, ctx)` | Plan aus einer Vorlage samt Ersetzungen, `ctx = { plans, custom, equipment, settings, tags }`, liefert `{ plan, swaps }`; ids nach 3er-Split, vorhandenen Plänen und Bibliothek |
| `planFromTemplate(tpl, plans, custom, opts)` | dasselbe, nur der Plan |
| `defaultPlanFor(ctx)` | der 3er-Split, an Geräte und Einstellungen angepasst, `{ plan, swaps }` |
| `adaptPlan(plan, ctx)` | passt einen frisch angelegten Plan an (verändert ihn): Varianten, die nicht gehen, fallen weg; ohne Variante Ersatz mit derselben Hauptmuskelgruppe (siehe Regeln); Kurzhantel-Steigerung aus der Einstellung, Smart-Zirkel Steigerung 0. Liefert die Ersetzungen |
| `swapText(s)`, `uniqueSwaps(swaps)`, `swapSummary(swaps, max = 4)` | „Kniebeugen → Goblet Squat“, „Latzug (fehlt: Latzugstation)“; ohne Doppel; für Fließtext ab fünf gezählt mit zwei Beispielen |

`domain/plan-choice.js`: `PLAN_CHOICES` (sechs Vorlagen und „Eigener Plan“), `recommendedChoices(daysPerWeek, equipment)` (2 → Ganzkörper 2×, 3 → Ganzkörper 3×, 4 → Oberkörper/Unterkörper, 5 bis 7 → Push/Pull/Beine; mit Smart-Zirkel zusätzlich „Nur Smart-Zirkel“), `choicesFor(state, current)` (Empfehlungen zuerst), `findPlanFor`, `currentChoice`, `untouchedDefault`, `isFreshSetup`, `choosePlan(state, choice, { discardId })` → `{ planId, created, changed, swaps }`. Überschreibt nie einen Plan oder den Verlauf. Bei einer frischen Einrichtung ohne jeden Verlauf (nur der mitgelieferte, unveränderte 3er-Split, keine Einheit, keine laufende) fällt der 3er-Split weg, sobald eine andere Wahl angelegt ist; wählt man ihn wieder, kommt er mit der id `split` zurück.

`domain/plan-stats.js`: `dayMinutes(exercises)` (45 s je Satz plus Pause, im Supersatz 15 s Wechsel, dazu 10 Minuten), `workSeconds`, `SHORT = { exercises: 4, sets: 2 }`, `shortExercises(exercises)` (die ersten vier mit höchstens zwei Sätzen, Supersatz zur abgeschnittenen Übung fällt weg), `shortText(exercises, { first })` (die tatsächliche Kurzversion in Worten, „3 Übungen mit je 2 Sätzen“, für Knopf, Hinweis und Schichtplaner), `hasShortVersion(exercises)`, `dayMuscleSets(exercises, resolve)`, `weekMuscleSetsOfPlan(plan, perWeek, resolve)`.

`domain/plan-update.js`: `isLegacySplit(plan)` (Jaccard der ids ≥ 0,6 und näher am alten als am neuen Split), `offerPending(S)`, `planOffer(S)` → `{ current, plan, swaps, days }`, `comparePlans(old, new)`, `offeredPlan(S)`, `acceptOffer(S)` (neuer Plan „3er-Split (überarbeitet)“, aktiv, mit `createdAt`; der alte bleibt), `declineOffer(S)` (Knopf „Behalten, nicht mehr fragen“). `nextDay(order, sessions, planId, days)` in `domain/progression.js`: Hat der Plan noch keine eigene Einheit, geht es nach der zuletzt trainierten Einheit eines anderen Plans mit gleichem Tagesnamen weiter (Push → Pull). Der Coach schlägt für einen Plan mit `createdAt` erst nach einer vollen Kalenderwoche mit ihm Volumen vor.

Kurzversion: `startWorkout(dayId, { short: true })` in `views/workout.js`, Knopf `shortStartButton(dayId, day)` aus `views/short-start.js` auf „Heute“ und unter Training. `finishWorkout` speichert `short: true`; die laufende Einheit zeigt „Kurzversion“, Zusammenfassung und Verlauf „Kurz“. Der Schichtplaner (`domain/shift-plan.js`) plant die Kurzversion, wenn keine volle Einheit ins Fenster passt (`shortMinutes`, Eintrag `shortVersion`, Hinweis „Kurzversion“ mit „Warum?“ zur Karte `saetze-pro-woche`); ein Tag mit voller Einheit geht vor (`PLAN_RULES.shortRank` 1,5).

`coach/training.js`: `strainOf(S, startedAt)` → `{ kind: 'sleep' | 'night' | 'shortRest', text }` oder `null` (unter 6 Stunden Schlaf, nach Nacht- oder 24-h-Schicht, weniger als 11 Stunden Ruhe); erklärt das eine der verfehlten Einheiten, rät der Coach „Gewicht halten“ statt Deload. `nightsInWeek(S, monday)`, `NIGHT_WEEK = 3`: Wochen mit drei oder mehr Nachtschichten zählen nicht als Volumenlücke. `coach/nutrition.js`: `targetRate(goal, kg)` (Aufbau 0,25 bis 0,5 % pro Woche, Abnehmen 0,5 bis 1 %, höchstens 500 kcal Defizit), Vorschlag erst außerhalb von ±1,5 Standardfehlern (`Z`) mit mindestens 10 Wiegungen (`MIN_POINTS`), danach 28 Tage Ruhe (`LOCK_DAYS`), Wochen-id `nut:JJJJ-WW`.

## Regeln

- Leere Geräteauswahl erlaubt alles. Der Coach schlägt Smart-Zirkel-Übungen trotzdem nur vor, wenn der Schalter an ist.
- Eine Zirkelrunde ist ein Satz. Fürs Muskelvolumen zählt jeder Arbeitssatz, egal mit welcher Methode.
- Am Smart-Zirkel: kein kg-Vorschlag, kein Deload, Startwerte im Plan 2 Sätze, 10 bis 15 Wdh., Steigerung 0.
- Mit Gegengewicht (Klimmzüge und Dips mit Unterstützung): Die Übungskarte beschriftet die kg als „kg Unterstützung“, schlägt weniger Unterstützung statt mehr Gewicht vor und zeigt keine Aufwärmrampe. Kein Deload, kein Gewichts-, 1RM- oder Volumen-Rekord, kein bewegtes Gewicht in Zusammenfassung, Wochenbericht, Vergleich und Abzeichen. Als Ersatz beim Anlegen eines Plans sind sie erlaubt.
- Kurzhantel-Steigerung gilt für jede Übung mit Kurzhanteln in der Anforderung, Grund- wie Isolationsübung. Langhantel und Maschinen bleiben bei 2,5 kg.
- Gespeicherte Trainings ändern sich nie. Muskeln, Volumen und Rekordzuordnung schlagen die Bibliothek beim Rechnen nach.
- Keine Markennamen in Namen und Anleitungen; nur Aliase dürfen „EGYM …“ heißen. Smart-Übungen heißen „… (Smart-Zirkel)“.
- Anleitungen der Smart-Übungen legen kein Tempo und keine Kurve fest, weil das je nach Methode anders ist (Explonic explosiv, Isokinetisch mit festem Tempo): „Dabei der Anzeige auf dem Display folgen.“, der Rückweg „kontrolliert“.
- Alias-Umzüge: „Reverse Butterfly“ wandert von `reverse-flys` zu `reverse-butterfly`, „Rudern an der Brustauflage“ von `brustgestuetztes-rudern` zu `rudermaschine`, sobald es die Ziel-Übung gibt. Pläne behalten ihre ids.
- `RESERVED_IDS` (die 55 aus `docs/kern-uebungen.json`) vergibt nur `exercises-kern.js`.
- Belastung „Hüfte“ (seit der Prüfung einheitlich): alle Kniebeugen-, Ausfallschritt-, Kreuzheben- und Hip-Thrust-Muster mit Gewicht, auch Goblet Squat, Step-ups, Rumänisches Kreuzheben und Kettlebell-Swing; nicht die Maschinen mit Rückenlehne (Beinpresse, Hackenschmidt, Pendel) und nicht leichte Gesäßübungen.
- Jede Übung besteht `test/exercises-data.test.js`: eindeutige ids, Namen und Aliase, gültige Muskeln und Geräte, 3 bis 6 Schritte, 2 bis 4 Fehler (ganze Sätze mit Punkt), gültige Belastungen, Alternativen existieren und für jede Belastung gibt es eine Alternative ohne sie, keine Marken.
- Geräte-Ersatz beim Anlegen eines Plans: Ersatz kommt nur aus Übungen der Bibliothek, nie aus eigenen (auch nicht unter dem Namen einer eigenen), und nur aus Übungen, deren Hauptmuskeln den ersten Hauptmuskel der fehlenden Übung enthalten. Belastet ein Kandidat eine eingetragene Einschränkung (`ctx.tags`), geht der erste schonende vor; gibt es keinen, bleibt es beim ersten. Reihenfolge: Alternativen der Übung, deren Alternativen, dann die Bibliothek mit gleicher Einheit (genau dieser Hauptmuskel zuerst, dann gleiche Art, dann gleich beim Smart-Zirkel). Nichts doppelt im Tag. Ohne Ersatz bleibt die Übung stehen; der Plan-Editor zeigt „fehlt: …“ an jeder Übung, die mit den eigenen Geräten nicht geht.
- Bestehende Pläne passt die App nie an. Den neuen 3er-Split bietet sie einmal an; „Übernehmen“ legt ihn als weiteren Plan an.
- Kurzversion: die ersten vier Übungen mit je höchstens zwei Sätzen, der Plan bleibt unverändert. Vorlagen stehen darum nach Wichtigkeit.
- Vorlagen: Einheiten höchstens 60 Minuten, große Muskeln 10 bis 20 Sätze pro Woche (Ganzkörper 2× und Zirkel bewusst darunter), höchstens etwa 11 Sätze pro Muskel und Einheit, Supersätze nur aus Gegenspielern.

## Wer hat was gemacht

- **Fundament:** Geräteliste, Geräte-Anforderung, Umzug der Kategorien bis 4.6, 18 Smart-Zirkel-Übungen, Methode je Satz in den Daten, Kurzhantel-Steigerung, Schrägbank-Curls, Seitheben am Kabel und Rückenstrecker.
- **A, Kern-Übungen:** 55 Übungen mit Schritten, Fehlern, Belastungen und Alternativen in `exercises-kern.js`, Rückverweise über `ALTERNATIVES_ADD`, Tests gegen die Arbeitsliste. Noch ohne Bilder.
- **B, Oberfläche:** Geräteseite, „Nur meine Geräte“ und Gerätefilter in der Bibliothek, Übungs-Picker nach Geräten, Editor eigener Übungen mit „eines genügt“, Methode je Satz im Training, Einstellung Kurzhantel-Steigerung.
- **C, Pläne und Coach:** sechs Vorlagen, überarbeiteter 3er-Split mit Angebot, Empfehlung in der Einrichtung, Kurzversion beim Start und im Schichtplaner, Geräte-Ersatz, Coach mit Schlaf und Schichten, Ernährungs-Coach (#34).
- **Abschluss:** Kurzversion im Verlauf, Methode in „Letztes Mal“ und im Verlauf, Ersatz zuerst nach Hauptmuskelgruppe mit „fehlt: …“, README, Changelog 4.7.
- **Prüfung:** Gegengewicht (`assisted`), eigene Übung vor der Bibliothek bei gleichem Namen mit Hinweis „Gleiche Namen“, Ersatz nur aus der Bibliothek und mit Blick auf Einschränkungen, Geräte-Umzug (alle neun → großes Studio, Hinweis auf „Heute“), Methodentexte, Zuhause mit Rudern mit Band, frische Einrichtung ohne übrigen 3er-Split, Nacken und unterer Rücken ohne Zielbereich, Angebot zum 3er-Split mit „Behalten, nicht mehr fragen“, Reihenfolge und Coach nach dem Übernehmen, Anleitungen, Changelog in acht Punkten.

## Vor dem App Store prüfen

- Gerätenamen und Methodennamen markenrechtlich prüfen. Sichtbar ist „EGYM“ nur im Schalter „Smart-Zirkel (z. B. EGYM)“, einmal im Changelog 4.7 und als Such-Alias „EGYM …“ der Smart-Übungen; Vorlage und Übungen heißen „Smart-Zirkel“. Die Methodennamen „Explonic“ und „Max Out“ (dazu Negativ, Adaptiv, Isokinetisch) stehen bewusst wie am Gerät, damit man sie wiedererkennt; ob das als Markenbenutzung zählt und ob ein Hinweis auf den Inhaber nötig ist, klären.
- Geräte-Typen in `data/equipment.js` sind ohne Hersteller benannt; Aliase wie „Pendulum Squat“ oder „V-Squat“ ebenfalls prüfen.

## Offene Punkte

- Die Arbeitsliste hat 55 statt 72 Einträge: 122 Kern minus 50 vorhandene ergibt 72, davon sind 14 Smart-Zirkel und 3 schon angelegt.
- Zwei ids weichen von der Recherche ab, weil die Plan-Vorlagen sie so nennen: `seitheben-kabel` (Recherche `kabel-seitheben`), `rueckenstrecker` (Recherche `hyperextensions`).
- Nacken/Trapez und unterer Rücken ohne Zielbereich (nach der Prüfung; vorher 4 bis 10 als Annahme, das hielt die Vorlagen dauerhaft unter dem Ziel). Der Coach schlägt für diese beiden Gruppen bewusst kein Zusatzvolumen vor.
- Die Umbenennungen aus der Recherche („Reverse Flys vorgebeugt“, „Wadenheben stehend“, „Beinbeuger liegend“) sind nicht gemacht; sie würden Rekorde nach Namen trennen.
- Anleitungen der Smart-Geräte Trizeps, Squat, Hip Thrust und Rotator beschreiben die Bauart allgemein; vor Ort im Sportpark Hilden prüfen.
- Die 77 neuen Übungen (55 Kern, 18 Smart-Zirkel, 3 aus dem Fundament, Rudern mit Band) haben vorerst ein Platzhalter-Bild; einheitliche Bilder für alle kommen später.
- Schnellauswahl „Zuhause“ (nur Kurzhanteln und Bänder), nach der Prüfung: Kurzhantel-Schulterdrücken geht stehend, Trizeps-Kickbacks gehen ohne Bank, „Rudern mit Band“ (`band-rudern`) ist die Rückenübung. Ein zweites Rudern am selben Tag bleibt mit „fehlt: …“ stehen, weil ein Tag keine Übung doppelt bekommt.
