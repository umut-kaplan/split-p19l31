/* Importer lesen eine Datei, die der Nutzer selbst auswählt, und liefern Messwerte
   im Format von S.body.weights und S.activity (siehe js/store/migrate.js).

   Schnittstelle eines Importers:
   {
     id: 'apple-health',
     label: 'Apple Health',
     accept: '.zip,.xml',
     parse(file, onProgress) -> Promise<{ weights, steps, restingHr, sleep, profile, stats }>
     profile: { birthDate, sex, heightCm }, jeweils null, wenn unbekannt; ins Profil nur nach Bestätigung
   }

   Live-Anbindungen an Apple Health, Garmin, Fitbit oder Google Fit brauchen eine native App
   oder einen Server mit OAuth. Sie kämen später als weitere Einträge in IMPORTERS dazu. */
import * as appleHealth from './apple-health.js';

export const IMPORTERS = [appleHealth];
