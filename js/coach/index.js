/* Regelbasierte Empfehlungen. Jede Quelle liefert eine Liste von Vorschlägen:
   {
     id: 'deload:bank:2026-40',   // stabil, damit eine Ablehnung bestehen bleibt
     area: 'training' | 'body' | 'nutrition',
     title: 'Deload für Bankdrücken',
     reason: 'Ein Satz, warum die App das vorschlägt.',
     acceptLabel: 'Gewicht senken',     // optional
     apply: S => { ... },              // optional, verändert den Zustand beim Annehmen
   }
   Ein späterer KI-Coach kann diese Quellen ersetzen oder ergänzen, solange er dasselbe Format liefert. */
import * as training from './training.js';
import * as nutrition from './nutrition.js';

const SOURCES = [training, nutrition];

export function allSuggestions(S, now = Date.now()) {
  return SOURCES.flatMap(src => {
    try { return src.suggestions(S, now) || []; } catch (e) { return []; }
  });
}

export function pendingSuggestions(S, now = Date.now(), area = null) {
  return allSuggestions(S, now).filter(s => !S.suggestions[s.id] && (!area || s.area === area));
}

export function decide(S, suggestion, status, now = Date.now()) {
  if (status === 'accepted' && suggestion.apply) suggestion.apply(S);
  S.suggestions[suggestion.id] = { status, date: now };
}
