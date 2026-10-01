/* Schema und Baustein für Übungen der Bibliothek. Die Bibliothek setzt sich aus drei Dateien zusammen,
   damit mehrere Leute gleichzeitig ergänzen können, ohne sich in die Quere zu kommen:
     data/exercises.js        die Übungen bis 4.6 und die Grundübungen für die Plan-Vorlagen, führt alles zusammen
     data/exercises-kern.js   weitere Kern-Übungen (Arbeitsliste docs/kern-uebungen.json)
     data/exercises-smart.js  die Geräte des Smart-Zirkels (z. B. EGYM)

   Eintrag:
   {
     id: 'bankdruecken',                 // stabil, Kleinbuchstaben, Bindestriche; steht in Plänen und Verlauf
     name: 'Bankdrücken',
     aliases: [],                        // weitere Namen für Suche und Plan-Import; über alle Übungen eindeutig
     type: 'compound' | 'isolation',
     unit: 'reps' | 'sec',
     muscles: { primary: ['chest'], secondary: ['triceps', 'shoulders'] },   // ids aus domain/muscles.js
     equipment: ['langhantel', 'bankdrueckstation'],   // Geräte-Anforderung, ids aus data/equipment.js:
                                         //   jeder Term muss erfüllt sein; ['a', 'b'] als Term = eines davon genügt;
                                         //   [] = Körpergewicht. Prüfen mit canDo aus domain/equipment.js.
     steps: ['…'],                       // 3 bis 6 kurze Sätze
     mistakes: ['…'],                    // 2 bis 4 typische Fehler
     stresses: ['Schulter'],             // Einschränkungs-Schlagworte aus domain/profile-options.js
     alternatives: ['kh-bankdruecken'],  // ids schonender oder gleichwertiger Übungen; für jede Belastung eine ohne sie
     autoLoad: null | 'smart',           // 'smart': Das Gerät stellt das Gewicht ein, die App schlägt keine Steigerung vor
     assisted: false | true,             // true: Gegengewicht, die kg sind Unterstützung (weniger ist schwerer);
                                         //   keine kg-Steigerung, kein Deload, kein kg-Rekord, kein Volumen in kg
     image: 'data/img/exercises/bankdruecken.jpg' | null,
     credit: { author, license, licenseUrl, url } | null,   // Quelle des Bildes, url = Seite der Übung auf wger.de
     media: null,                        // später Video oder Animation
   }
   Keine Markennamen in Namen und Anleitungen; nur Aliase dürfen „EGYM …“ heißen (Suche). */

export const LICENSE_URL = {
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/deed.de',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/deed.de',
};

/* Baut einen Eintrag. d: { aliases, type, unit, primary, secondary, equipment, steps, mistakes, stresses,
   alternatives, autoLoad, assisted }. credit: [Urheber, Lizenz, Übungsnummer auf wger.de] oder nichts (dann kein Bild). */
export function exercise(id, name, d, credit = null) {
  return {
    id,
    name,
    aliases: d.aliases || [],
    type: d.type,
    unit: d.unit || 'reps',
    muscles: { primary: d.primary, secondary: d.secondary || [] },
    equipment: d.equipment || [],
    steps: d.steps,
    mistakes: d.mistakes,
    stresses: d.stresses || [],
    alternatives: d.alternatives || [],
    autoLoad: d.autoLoad || null,
    assisted: d.assisted === true,
    image: credit ? `data/img/exercises/${id}.jpg` : null,
    credit: credit ? { author: credit[0], license: credit[1], licenseUrl: LICENSE_URL[credit[1]], url: `https://wger.de/de/exercise/${credit[2]}/view/` } : null,
    media: null,
  };
}
