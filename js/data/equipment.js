/* Geräteliste (4.7): 59 Gerätetypen ohne Markennamen in sechs Gruppen, dazu der Zusatzschalter Smart-Zirkel.
   Grundlage: Recherche „Übungen und Geräte“ vom 30.09.2026. Reine Daten; die Logik steht in domain/equipment.js.

   Eintrag: { id, group, name, note, avail: { gross, discount, zuhause } }
   avail: wie oft das Gerät in so einem Studio steht, 3 meist, 2 oft, 1 selten, 0 kaum.
   Die Schnellauswahl leitet sich daraus ab (PRESETS). ids sind stabil, sie stehen in S.profile.equipment
   und in der Geräte-Anforderung jeder Übung. */

export const EQUIPMENT_GROUPS = [
  { id: 'frei', name: 'Freie Gewichte' },
  { id: 'bank', name: 'Bänke und Racks' },
  { id: 'kabel', name: 'Kabelzüge' },
  { id: 'steck', name: 'Maschinen mit Steckgewicht' },
  { id: 'hebel', name: 'Hebelmaschinen mit Scheiben' },
  { id: 'funktional', name: 'Funktional und Körpergewicht' },
];

const G = (group, id, name, note, gross, discount, zuhause) => ({ id, group, name, note, avail: { gross, discount, zuhause } });

export const EQUIPMENT = [
  /* Freie Gewichte (5) */
  G('frei', 'langhantel', 'Langhantel mit Scheiben', 'Olympiastange 20 kg; feste Langhanteln zählen mit', 3, 3, 2),
  G('frei', 'kurzhanteln', 'Kurzhanteln', '', 3, 3, 3),
  G('frei', 'sz-stange', 'SZ-Stange', 'auch feste SZ-Hanteln', 3, 3, 2),
  G('frei', 'kettlebell', 'Kettlebells', '', 3, 3, 2),
  G('frei', 'trap-bar', 'Trap-Bar (Hexagonstange)', '', 2, 1, 0),
  /* Bänke und Racks (14) */
  G('bank', 'flachbank', 'Flachbank', '', 3, 3, 2),
  G('bank', 'schraegbank', 'Verstellbare Bank (Schrägbank)', 'lässt sich flach stellen', 3, 3, 2),
  G('bank', 'bankdrueckstation', 'Bankdrückstation mit Ablage', 'flach', 3, 3, 0),
  G('bank', 'schraegbankstation', 'Schrägbankstation mit Ablage', '', 3, 2, 0),
  G('bank', 'kniebeugenstaender', 'Power Rack / Kniebeugenständer', 'auch Half Rack, Rig mit Ablagen', 3, 3, 1),
  G('bank', 'multipresse', 'Multipresse (Smith-Maschine)', '', 3, 3, 0),
  G('bank', 'scottbank', 'Scottbank', '', 3, 3, 0),
  G('bank', 'hyperextension', 'Hyperextension-Bank', '45° oder 90°', 3, 3, 0),
  G('bank', 'bauchbank', 'Bauchbank / Negativbank', '', 3, 3, 0),
  G('bank', 'dip-station', 'Dip-Barren', 'oft mit Beinhebe-Station kombiniert', 3, 3, 1),
  G('bank', 'klimmzugstange', 'Klimmzugstange', 'auch am Rig oder Kabelturm', 3, 3, 2),
  G('bank', 'beinhebestation', 'Beinhebe-Station (Kapitänsstuhl)', '', 3, 3, 0),
  G('bank', 'landmine', 'Landmine (Stangenhalter am Boden)', 'braucht eine Langhantel', 2, 2, 0),
  G('bank', 'ghd', 'Glute-Ham-Bank (GHD)', '', 2, 1, 0),
  /* Kabelzüge (4) */
  G('kabel', 'kabelturm', 'Kabelzug, einzeln (Rolle verstellbar)', 'Griffe, Seil, Fußschlaufe inklusive', 3, 3, 1),
  G('kabel', 'kabelzug-doppelt', 'Doppelter Kabelzug (Crossover)', 'schließt „Kabelzug, einzeln“ ein', 3, 3, 0),
  G('kabel', 'latzug', 'Latzugstation', 'oft Kombigerät mit Ruderzug', 3, 3, 0),
  G('kabel', 'ruderzug', 'Ruderzug sitzend (Kabel)', '', 3, 3, 0),
  /* Maschinen mit Steckgewicht (20) */
  G('steck', 'brustpresse', 'Brustpresse', 'Steckgewicht oder Hebel', 3, 3, 0),
  G('steck', 'butterfly', 'Butterfly / Reverse-Butterfly', 'meist ein Kombigerät', 3, 3, 0),
  G('steck', 'schulterpresse', 'Schulterpresse', 'Steckgewicht oder Hebel', 3, 3, 0),
  G('steck', 'seitheben-maschine', 'Seitheben-Maschine', '', 2, 2, 0),
  G('steck', 'rudermaschine', 'Rudermaschine mit Brustauflage', 'Kraftgerät, nicht Rudergerät', 3, 3, 0),
  G('steck', 'bizepsmaschine', 'Bizepsmaschine', '', 3, 3, 0),
  G('steck', 'trizepsmaschine', 'Trizepsmaschine', 'Strecker oder sitzender Dip', 3, 3, 0),
  G('steck', 'dipmaschine', 'Dip-Maschine sitzend', '', 2, 2, 0),
  G('steck', 'assist-maschine', 'Klimmzug-/Dip-Maschine mit Unterstützung', 'Gegengewicht', 3, 2, 0),
  G('steck', 'beinpresse', 'Beinpresse', 'sitzend (Steckgewicht) oder 45° (Scheiben)', 3, 3, 0),
  G('steck', 'beinstrecker', 'Beinstrecker', '', 3, 3, 0),
  G('steck', 'beinbeuger-liegend', 'Beinbeuger liegend', '', 3, 2, 0),
  G('steck', 'beinbeuger-sitzend', 'Beinbeuger sitzend', '', 3, 3, 0),
  G('steck', 'adduktoren', 'Adduktorenmaschine', 'oft Kombigerät mit Abduktoren', 3, 3, 0),
  G('steck', 'abduktoren', 'Abduktorenmaschine', '', 3, 3, 0),
  G('steck', 'gesaessmaschine', 'Gesäßmaschine (Kickback / Multi-Hip)', '', 3, 2, 0),
  G('steck', 'wadenmaschine-stehend', 'Wadenmaschine stehend', '', 3, 2, 0),
  G('steck', 'bauchmaschine', 'Bauchmaschine (Crunch)', '', 3, 3, 0),
  G('steck', 'rueckenstrecker-maschine', 'Rückenstrecker-Maschine', '', 3, 3, 0),
  G('steck', 'rotationsmaschine', 'Rumpfrotations-Maschine', '', 2, 2, 0),
  /* Hebelmaschinen mit Scheiben (9) */
  G('hebel', 'hackenschmidt', 'Hackenschmidt-Maschine', '', 3, 2, 0),
  G('hebel', 'pendel-kniebeuge', 'Kniebeuge-Hebelmaschine (Pendel / V-Squat)', '', 2, 1, 0),
  G('hebel', 'belt-squat', 'Belt-Squat-Maschine', '', 2, 1, 0),
  G('hebel', 'hip-thrust-maschine', 'Hip-Thrust-Maschine', '', 2, 2, 0),
  G('hebel', 't-bar-rudern', 'T-Bar-Rudermaschine', 'mit Brustauflage', 3, 2, 0),
  G('hebel', 'hebel-rudern', 'Hebel-Rudermaschine (tief/hoch)', 'einarmig nutzbar', 3, 3, 0),
  G('hebel', 'hebel-latzug', 'Hebel-Latzug', '', 2, 2, 0),
  G('hebel', 'schraeg-brustpresse', 'Schräge Brustpresse', 'Hebel oder Steckgewicht', 3, 3, 0),
  G('hebel', 'wadenmaschine-sitzend', 'Wadenmaschine sitzend', '', 2, 2, 0),
  /* Funktional und Körpergewicht (7) */
  G('funktional', 'widerstandsband', 'Widerstandsbänder / Minibands', '', 3, 2, 3),
  G('funktional', 'schlingentrainer', 'Schlingentrainer', '', 3, 3, 2),
  G('funktional', 'bauchroller', 'Bauchroller', '', 2, 2, 2),
  G('funktional', 'plyobox', 'Plyo-Box', '', 3, 3, 0),
  G('funktional', 'medizinball', 'Medizinball / Wall Ball', '', 3, 3, 1),
  G('funktional', 'battle-rope', 'Battle Rope', '', 3, 3, 0),
  G('funktional', 'schlitten', 'Schlitten (Sled)', '', 2, 1, 0),
];

/* Zusatzschalter, kein Studiotyp: ein Zirkel mit elektronisch gesteuerten Geräten. Gehört zu keiner Gruppe und
   keiner Schnellauswahl; die Schnellauswahl lässt ihn stehen, wie er ist. Übungen dafür: data/exercises-smart.js. */
export const SMART_CIRCUIT = { id: 'smart-zirkel', name: 'Smart-Zirkel', label: 'Smart-Zirkel (z. B. EGYM)' };

/* Schnellauswahl: welche avail-Spalte ab welchem Wert zählt. Großes Studio: meist oder oft (alle 59),
   Discount-Studio: nur „meist“ (38), Zuhause: nur „meist“ (2), den Rest hakt man selbst an. */
export const PRESETS = [
  { id: 'gross', name: 'Großes Studio', col: 'gross', min: 2 },
  { id: 'discount', name: 'Discount-Studio', col: 'discount', min: 3 },
  { id: 'zuhause', name: 'Zuhause', col: 'zuhause', min: 3 },
];

/* Regeln beim Abhaken. IMPLIES: wer alle Geräte aus if hat, hat auch then. NEEDS: ein Gerät taugt nur mit den anderen. */
export const IMPLIES = [
  { if: ['kabelzug-doppelt'], then: 'kabelturm' },
  { if: ['schraegbank'], then: 'flachbank' },
  { if: ['kniebeugenstaender', 'flachbank'], then: 'bankdrueckstation' },
  { if: ['kniebeugenstaender', 'schraegbank'], then: 'schraegbankstation' },
];
export const NEEDS = [
  { id: 'landmine', needs: ['langhantel'] },
];

/* Die neun Kategorien bis 4.6. LEGACY_PROFILE: was ein Häkchen im Profil heute bedeutet (Migration von
   S.profile.equipment). LEGACY_EXERCISE: was die Kategorie an einer eigenen Übung verlangt, eine id oder
   eine Liste, von der eines genügt. Wer alle neun angehakt hatte, bekommt die Schnellauswahl „Großes Studio“
   (domain/equipment.js, migrateProfileEquipment).
   „Maschinen“ (4.7, Prüfung M1): alle Maschinen mit Steckgewicht außer der Beinpresse (eigene Kategorie), alle
   Hebelmaschinen, Multipresse und die Spezialbänke Scottbank, Hyperextension-Bank und Bauchbank. */
export const LEGACY_MACHINES = [
  ...EQUIPMENT.filter(e => (e.group === 'steck' && e.id !== 'beinpresse') || e.group === 'hebel').map(e => e.id),
  'multipresse', 'scottbank', 'hyperextension', 'bauchbank',
];
const MACHINES = LEGACY_MACHINES;

export const LEGACY_PROFILE = {
  'Langhantel': ['langhantel', 'kniebeugenstaender', 'bankdrueckstation', 'schraegbankstation'],
  'Kurzhanteln': ['kurzhanteln'],
  'SZ-Stange': ['sz-stange'],
  'Hantelbank': ['flachbank', 'schraegbank'],
  'Kabelzug': ['kabelturm', 'kabelzug-doppelt', 'latzug', 'ruderzug'],
  'Maschinen': MACHINES,
  'Beinpresse': ['beinpresse'],
  'Klimmzugstange': ['klimmzugstange'],
  'Dip-Station': ['dip-station', 'beinhebestation'],
};

export const LEGACY_EXERCISE = {
  'Langhantel': 'langhantel',
  'Kurzhanteln': 'kurzhanteln',
  'SZ-Stange': 'sz-stange',
  'Hantelbank': 'flachbank',
  'Kabelzug': 'kabelturm',
  'Maschinen': MACHINES,
  'Beinpresse': 'beinpresse',
  'Klimmzugstange': 'klimmzugstange',
  'Dip-Station': 'dip-station',
};
