/* Vorlagen für verbreitete Schichtmodelle. Reine Daten und Nachschlagen.

   Eine Vorlage ist der Zyklus einer Gruppe als Kette von Codes der voreingestellten Schichtarten
   (F Früh, S Spät, N Nacht, T Tag 12 h, X 24-h-Dienst, D Dispo, - frei). groups und offset beschreiben den Betrieb:
   Gruppe k beginnt k·offset Tage nach Gruppe 1. Damit ist in jeder Vorlage jede Schicht an jedem Tag genau einmal
   besetzt (test/shift-templates.test.js). cover nennt die Wochentage (0 = Montag), an denen eine Schicht besetzt sein
   muss, wenn es nicht alle sind. weekStart: Tag 1 der Kette ist ein Montag (Modelle Mo–Fr).
   variants sind Abwandlungen mit eigener id; option beschriftet die Grundform neben ihnen.
   times sind die Uhrzeiten, die eine Vorlage beim Übernehmen für ihre Arten setzt.
   Quellen und Belege: ifaa-Studie zu 720 Schichtplänen, Hans-Böckler-Stiftung (Betriebsvereinbarungen),
   IG Metall, IG BCE (Schichtkalender LU), Brandenburg „Dienstplanmodelle bei deutschen Feuerwehren“ (2019). */
import { TEMPLATE_28 } from './shifts.js';

const T8 = { F: ['06:00', '14:00'], S: ['14:00', '22:00'], N: ['22:00', '06:00'] };
const MO_FR = [0, 1, 2, 3, 4];
const SO_DO = [6, 0, 1, 2, 3];

export const TEMPLATE_GROUPS = [
  ['w8', '8 Stunden, Wechselschicht'],
  ['konti', 'Konti, rund um die Uhr'],
  ['h12', '12 Stunden'],
  ['fw', 'Feuerwehr, 24-h-Dienst'],
  ['dn', 'Dauernacht'],
];

export const TEMPLATES = [
  {
    id: 'w2', group: 'w8', name: '2-Schicht, wöchentlich', desc: 'Eine Woche Früh, eine Woche Spät, Montag bis Freitag.',
    where: 'Metall, Lebensmittel, Logistik', days: 'FFFFF--SSSSS--', groups: 2, offset: 7, weekStart: true,
    times: { F: T8.F, S: T8.S }, cover: { F: MO_FR, S: MO_FR },
  },
  {
    id: 'w3v', group: 'w8', name: '3-Schicht Mo–Fr, vorwärts', desc: 'Je eine Woche Früh, Spät und Nacht.',
    where: 'Metall, Automobil, Lebensmittel', days: 'FFFFF--SSSSS--NNNNN--', groups: 3, offset: 7, weekStart: true,
    times: T8, cover: { F: MO_FR, S: MO_FR, N: MO_FR }, option: 'Nachtwoche Montag bis Freitag',
    variants: [{ id: 'w3v-so', label: 'Nachtwoche beginnt Sonntag 22 Uhr', days: 'FFFFF--SSSSS-NNNNN---', cover: { F: MO_FR, S: MO_FR, N: SO_DO } }],
  },
  {
    id: 'w3r', group: 'w8', name: '3-Schicht Mo–Fr, rückwärts', desc: 'Nachtwoche, Spätwoche, Frühwoche. Der Klassiker.',
    where: 'Metall, Automobil', days: 'NNNNN--SSSSS--FFFFF--', groups: 3, offset: 7, weekStart: true,
    times: T8, cover: { F: MO_FR, S: MO_FR, N: MO_FR },
  },
  {
    id: 'k4', group: 'konti', name: 'Konti kurz, 4 Gruppen', desc: '2 Früh, 2 Spät, 2 Nacht, 2 frei.',
    where: 'Chemie, Metall, Papier', days: 'FFSSNN--', groups: 4, offset: 2, times: T8,
  },
  {
    id: TEMPLATE_28.id, group: 'konti', name: 'Konti 28 Tage, 21 Schichten', desc: 'Drei Blöcke aus Früh, Spät und Nacht mit 2 oder 3 freien Tagen.',
    where: 'Industrie rund um die Uhr', days: TEMPLATE_28.days.join(''), groups: 4, offset: 7, times: T8,
  },
  {
    id: 'k4w', group: 'konti', name: 'Konti wochenweise, 4 Gruppen', desc: '7 Früh, 7 Spät, 7 Nacht, dann eine Woche frei.',
    where: 'ältere Konti-Pläne', days: 'FFFFFFFSSSSSSSNNNNNNN-------', groups: 4, offset: 7, times: T8,
  },
  {
    id: 'k5', group: 'konti', name: '5-Schicht (2-2-2-4)', desc: '2 Früh, 2 Spät, 2 Nacht, 4 frei.',
    where: 'Chemie, Stahl, Energie, Polizei', days: 'FFSSNN----', groups: 5, offset: 2, times: T8,
  },
  {
    id: 'k5d', group: 'konti', name: '5-Schicht mit Dispo-Woche', desc: 'Vier Wochen Früh, Spät und Nacht, dann eine Woche Dispo.',
    where: 'Papier, Druck', days: 'FFFSSNN---FFSSNNN--FFSSSNN-DDDDDDD-', groups: 5, offset: 7, times: T8,
  },
  {
    id: 'h12', group: 'h12', name: '12 h: Tag, Nacht, 2 frei', desc: 'Eine Tagschicht, eine Nachtschicht, dann 2 Tage frei.',
    where: 'Chemie', days: 'TN--', groups: 4, offset: 1, times: { T: ['06:00', '18:00'], N: ['18:00', '06:00'] },
    option: '2 Tage frei (4 Gruppen)', variants: [{ id: 'h12-3', label: 'Nur 1 Tag frei (3 Gruppen)', days: 'TN-', groups: 3 }],
  },
  {
    id: 'h12b', group: 'h12', name: '12 h: 2 Tag, 2 Nacht, 4 frei', desc: 'Zwei Tagschichten, zwei Nachtschichten, 4 Tage frei.',
    where: 'Sicherheit, Rettungsdienst', days: 'TTNN----', groups: 4, offset: 2, times: { T: ['07:00', '19:00'], N: ['19:00', '07:00'] },
  },
  {
    id: 'fw24', group: 'fw', name: 'Feuerwehr 24/48', desc: '24 Stunden Dienst, dann 48 Stunden frei.',
    where: 'Berufsfeuerwehr, 3 Wachabteilungen', days: 'X--', groups: 3, offset: 1, times: { X: ['07:00', '07:00'] },
  },
  {
    id: 'fwb', group: 'fw', name: 'Feuerwehr Bremer Modell', desc: '7 Dienste in 3 Wochen, mit einem langen freien Block.',
    where: 'Berufsfeuerwehr, 3 Wachabteilungen', days: 'X--X-X--X--X-X--X----', groups: 3, offset: 7, times: { X: ['07:00', '07:00'] },
  },
  {
    id: 'dn', group: 'dn', name: 'Dauernacht', desc: 'Nachtschicht von Montag bis Freitag.',
    where: 'Logistik, Industrie, Pflege', days: 'NNNNN--', groups: 1, offset: 7, weekStart: true,
    times: { N: T8.N }, cover: { N: MO_FR }, option: 'Nächte Montag bis Freitag',
    variants: [{ id: 'dn-so', label: 'Nächte Sonntag bis Donnerstag', days: 'NNNN--N', cover: { N: SO_DO } }],
  },
];

/* Vorlage oder Variante nach id: { id, base, variant, name, desc, days: [Code, …], groups, offset, weekStart, times, cover }
   oder null. base ist die id der Vorlage, variant die Beschriftung der Variante oder null. */
export function templateById(id) {
  for (const t of TEMPLATES) {
    const v = t.id === id ? null : (t.variants || []).find(x => x.id === id);
    if (t.id !== id && !v) continue;
    const src = { ...t, ...(v || {}) };
    return {
      id, base: t.id, variant: v ? v.label : null, name: t.name, desc: t.desc, where: t.where,
      days: src.days.split(''), groups: src.groups, offset: src.offset, weekStart: !!t.weekStart,
      times: t.times, cover: src.cover || null,
    };
  }
  return null;
}

/* Passt ein Muster noch zu seiner Vorlage? Dann liefert es die Vorlage, sonst null. */
export function templateOf(pattern) {
  const t = pattern && pattern.template ? templateById(pattern.template) : null;
  return t && t.days.join('') === pattern.days.join('') ? t : null;
}

/* Wie viele Gruppen haben am Tag d (0 = Tag 1 von Gruppe 1) die Schicht code? */
export function staffed(days, groups, offset, d, code) {
  const n = days.length;
  let k = 0;
  for (let g = 0; g < groups; g++) if (days[(((d - g * offset) % n) + n) % n] === code) k++;
  return k;
}
