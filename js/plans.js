import { clone, uid } from './util.js';
import { exerciseIdFor, findExercise, usesDumbbells, cleanDumbbellInc, defaultsFor, limitationHits } from './domain/library.js';
import { EXERCISES } from './data/exercises.js';
import { doable, missingText } from './domain/equipment.js';

const E = (id, names, sets, repMin, repMax, rest, inc, unit = 'reps', ss = false) => {
  const e = { id, names: [].concat(names), sets, repMin, repMax, rest, inc, unit };
  if (ss) e.ss = true;
  return e;
};

/* Der 3er-Split, mit dem die App startet (überarbeitet in 4.7, Recherche „Trainingspläne“ 7.4).
   Übungen, die bleiben, behalten ihre ids von früher, damit Verlauf und Progression weiterlaufen.
   Neue Einträge tragen die Bibliotheks-id. Jeder Tag höchstens 60 Minuten, jeder große Muskel 10 bis 11 Sätze pro Woche.
   Der Plan eines Nutzers wird nie überschrieben; wer den alten Split nutzt, bekommt einmal das Angebot (domain/plan-update.js). */
export const DEFAULT_PLAN = {
  id: 'split',
  name: '3er-Split',
  order: ['push', 'pull', 'legs'],
  days: {
    push: {
      id: 'push', name: 'Push', muscles: 'Brust, Schultern, Trizeps', color: 'red',
      exercises: [
        E('bank', 'Bankdrücken', 4, 6, 10, 150, 2.5),
        E('schraeg', 'Schrägbankdrücken', 3, 8, 10, 150, 2.5),
        E('schulter', 'Schulterdrücken', 2, 6, 10, 150, 2.5),
        E('fly', 'Kabel-Flys', 3, 12, 15, 75, 2.5),
        E('seit', 'Seitheben', 2, 12, 20, 60, 2),
        E('trizoh', 'Überkopf-Trizeps am Kabel', 3, 10, 15, 75, 2.5),
        E('trizkabel', 'Trizepsdrücken am Kabel', 3, 10, 15, 60, 2.5),
      ],
    },
    pull: {
      id: 'pull', name: 'Pull', muscles: 'Rücken, hintere Oberschenkel, Bizeps', color: 'blue',
      exercises: [
        E('latzug', ['Latzug', 'Klimmzüge'], 3, 6, 10, 120, 2.5),
        E('rudern', 'Rudern sitzend', 3, 8, 12, 120, 2.5),
        E('rumaenisches-kreuzheben', 'Rumänisches Kreuzheben', 3, 8, 10, 150, 2.5),
        E('brustrudern', 'Brustgestütztes Rudern', 3, 8, 12, 120, 2),
        E('facepull', 'Face Pulls', 2, 12, 15, 60, 2.5),
        E('curls', ['Langhantel-Curls', 'SZ-Curls'], 3, 8, 12, 75, 2.5),
        E('schraegbank-curls', 'Schrägbank-Curls', 3, 10, 15, 60, 2),
      ],
    },
    legs: {
      id: 'legs', name: 'Legs', muscles: 'Beine, Gesäß, Waden, Bauch', color: 'green',
      exercises: [
        E('squat', ['Kniebeugen', 'Hackenschmidt'], 4, 6, 10, 180, 2.5),
        E('presse', 'Beinpresse', 3, 8, 12, 120, 5),
        E('beinbeuger-sitzend', 'Beinbeuger sitzend', 4, 10, 15, 75, 2.5, 'reps', true),
        E('strecker', 'Beinstrecker', 4, 10, 15, 75, 2.5),
        E('waden', 'Wadenheben', 4, 10, 15, 60, 2.5),
        E('bauch', 'Bauchmaschine', 4, 10, 15, 60, 2.5),
      ],
    },
  },
};

/* Der 3er-Split bis 4.6, unverändert. Nur zum Erkennen und Vergleichen (domain/plan-update.js) und damit Vorlagen
   gleiche Übungen weiter unter den ids von früher anlegen (Verlauf bleibt zusammen). Wird nie als Plan angelegt. */
export const LEGACY_SPLIT = {
  id: 'split',
  name: '3er-Split',
  order: ['push', 'pull', 'legs'],
  days: {
    push: {
      id: 'push', name: 'Push', muscles: 'Brust, Schulter, Trizeps', color: 'red',
      exercises: [
        E('bank', 'Bankdrücken', 4, 6, 8, 150, 2.5),
        E('schraeg', 'Schrägbankdrücken', 3, 8, 10, 150, 2.5),
        E('schulter', 'Schulterdrücken', 3, 6, 10, 150, 2.5),
        E('seit', 'Seitheben', 3, 12, 15, 75, 1),
        E('dip', 'Dip-Maschine', 3, 8, 12, 120, 2.5),
        E('fly', 'Kabel-Flys', 2, 12, 15, 75, 2.5),
        E('flyup', 'Kabel-Flys von unten nach oben', 2, 12, 15, 75, 2.5),
        E('trizkabel', 'Trizepsdrücken am Kabel', 3, 10, 15, 75, 2.5),
        E('trizoh', 'Überkopf-Trizeps am Kabel', 2, 10, 15, 75, 2.5),
      ],
    },
    pull: {
      id: 'pull', name: 'Pull', muscles: 'Rücken, Bizeps', color: 'blue',
      exercises: [
        E('latzug', ['Latzug', 'Klimmzüge'], 4, 6, 10, 150, 2.5),
        E('rudern', 'Rudern sitzend', 3, 8, 12, 120, 2.5),
        E('brustrudern', 'Brustgestütztes Rudern', 3, 8, 12, 120, 2.5),
        E('englat', 'Enger Latzug', 2, 10, 12, 90, 2.5),
        E('facepull', 'Face Pulls', 3, 12, 15, 75, 2.5),
        E('curls', ['Langhantel-Curls', 'SZ-Curls'], 3, 8, 12, 90, 2.5),
        E('hammer', 'Hammercurls', 2, 10, 15, 75, 1),
      ],
    },
    legs: {
      id: 'legs', name: 'Legs', muscles: 'Beine, Adduktoren, Abduktoren, Bauch', color: 'green',
      exercises: [
        E('squat', ['Kniebeugen', 'Hackenschmidt'], 4, 6, 10, 180, 2.5),
        E('presse', 'Beinpresse', 3, 8, 12, 150, 5),
        E('beuger', 'Beinbeuger', 3, 10, 15, 75, 2.5),
        E('strecker', 'Beinstrecker', 3, 10, 15, 75, 2.5),
        E('waden', 'Wadenheben', 4, 10, 15, 75, 2.5),
        E('adduktoren', 'Adduktoren', 3, 12, 15, 75, 2.5),
        E('abduktoren', 'Abduktoren', 3, 12, 15, 75, 2.5),
        E('bauch', 'Bauchmaschine', 3, 12, 20, 75, 2.5),
        E('plank', 'Plank', 3, 30, 60, 60, 0, 'sec'),
      ],
    },
  },
};

export const defaultPlan = () => clone(DEFAULT_PLAN);

/* Neuer Tag mit eindeutiger id */
export const newDay = (name, color = 'red', muscles = '') => ({ id: 'd' + uid(), name, muscles, color, exercises: [] });

export function emptyPlan(name = 'Neuer Plan') {
  const d = newDay('Tag 1', 'red');
  return { id: 'p' + uid(), name, order: [d.id], days: { [d.id]: d } };
}

/* Pläne, nach denen sich Übungs-ids richten: zuerst der 3er-Split von heute und von früher, dann die vorhandenen */
const knownPlans = (plans = []) => [DEFAULT_PLAN, LEGACY_SPLIT, ...plans];

/* ---------- Geräte ---------- */
/* Ersatz für eine Übung, die mit den Geräten nicht geht. In Frage kommen nur Übungen der Bibliothek, nie eigene, und
   nur, was dieselbe Hauptmuskelgruppe trainiert (der erste Hauptmuskel der Übung steht unter ihren Hauptmuskeln),
   damit der Tag trainiert, wofür er gedacht ist: erst die Alternativen der Übung in ihrer Reihenfolge, dann deren
   Alternativen, zuletzt die Bibliothek mit gleicher Einheit (genau dieser Hauptmuskel zuerst, dann gleiche Art, dann
   gleich beim Smart-Zirkel, dann mehr gemeinsame Hauptmuskeln). Nicht genommen wird, was schon im Tag steht (Name
   oder id). Belastet ein Kandidat eine eingetragene Einschränkung (tags), geht der erste vor, der sie nicht belastet;
   gibt es keinen, bleibt es beim ersten. null, wenn nichts passt: Dann bleibt die Übung stehen. */
const libById = new Map(EXERCISES.map(e => [e.id, e]));
function replacementFor(lib, ok, custom, takenNames, takenIds, known, tags = []) {
  const prim = (lib.muscles && lib.muscles.primary) || [];
  const main = prim[0];
  const primOf = a => (a.muscles && a.muscles.primary) || [];
  const sameMain = a => !main || primOf(a).includes(main);
  /* Heißt eine eigene Übung genauso, fände der Plan-Eintrag später die eigene (findExercise): dann nicht nehmen */
  const ownNames = new Set((custom || []).map(c => c && String(c.name || '').toLowerCase().trim()));
  const free = a => ok(a) && sameMain(a) && !takenNames.has(a.name) && !ownNames.has(a.name.toLowerCase())
    && !takenIds.has(exerciseIdFor(a.name, known, custom));
  const cands = [];
  const seen = new Set([lib.id]);
  let level = [...(lib.alternatives || [])];
  for (let depth = 0; depth < 2 && level.length; depth++) {
    const next = [];
    for (const id of level) {
      if (seen.has(id)) continue;
      seen.add(id);
      const a = libById.get(id);
      if (!a) continue;
      if (free(a)) cands.push(a);
      next.push(...(a.alternatives || []));
    }
    level = next;
  }
  if (main) {
    const score = a => (primOf(a)[0] === main ? 8 : 0) + (a.type === lib.type ? 4 : 0) + (!!a.autoLoad === !!lib.autoLoad ? 2 : 0)
      + prim.filter(m => primOf(a).includes(m)).length / 10;
    cands.push(...EXERCISES
      .filter(a => !seen.has(a.id) && a.unit === lib.unit && free(a))
      .sort((a, b) => score(b) - score(a)));
  }
  return cands.find(a => !limitationHits(a, tags).length) || cands[0] || null;
}

/* Passt einen frisch angelegten Plan an Geräte und Einstellungen an (verändert plan) und liefert die Ersetzungen
   [{ day, from, to, missing? }]. to null heißt: kein Ersatz mit derselben Hauptmuskelgruppe gefunden, die Übung bleibt
   stehen; missing nennt dann, was fehlt („Latzugstation“), und der Plan-Editor zeigt „fehlt: …“ an der Übung.
   - Geht eine Übung mit den Geräten nicht, kommt die nächste passende Alternative an ihre Stelle (canDo + alternatives),
     z. B. Hackenschmidt statt Kniebeugen ohne Langhantel. Von mehreren Varianten bleiben die, die gehen.
   - Kurzhantel-Übungen steigen um die Einstellung „Kurzhantel-Steigerung“.
   Leere Geräteauswahl erlaubt alles, dann wird nichts ersetzt. Eigene Namen ohne Bibliothekseintrag bleiben.
   tags: eingetragene Einschränkungen (S.profile.limitations.tags); der Ersatz meidet sie, wenn es geht. */
export function adaptPlan(plan, { equipment = [], custom = [], settings = null, plans = [], tags = [] } = {}) {
  const ok = doable(equipment);
  const known = knownPlans(plans);
  const swaps = [];
  plan.order.forEach(dayId => {
    const d = plan.days[dayId];
    if (!d) return;
    d.exercises.forEach(e => {
      const libs = e.names.map(n => findExercise(n, custom));
      const keep = e.names.filter((n, i) => !libs[i] || ok(libs[i]));
      if (keep.length && keep.length < e.names.length) {
        swaps.push({ day: d.name, from: e.names.find(n => !keep.includes(n)), to: keep[0] });
        e.names = keep;
      } else if (!keep.length) {
        const takenNames = new Set(d.exercises.filter(x => x !== e).flatMap(x => x.names));
        const takenIds = new Set(d.exercises.filter(x => x !== e).map(x => x.id));
        const alt = libs[0] ? replacementFor(libs[0], ok, custom, takenNames, takenIds, known, tags) : null;
        swaps.push(alt ? { day: d.name, from: e.names[0], to: alt.name }
          : { day: d.name, from: e.names[0], to: null, missing: missingText(libs[0], equipment) });
        if (alt) {
          /* Andere Einheit oder Gerät stellt das Gewicht ein: Wiederholungen und Steigerung wie bei einer neuen Übung */
          if (alt.unit !== e.unit || !!alt.autoLoad !== !!libs[0].autoLoad) {
            const def = defaultsFor(alt, settings);
            Object.assign(e, { repMin: def.repMin, repMax: def.repMax, unit: def.unit, inc: def.inc });
          }
          e.id = exerciseIdFor(alt.name, known, custom);
          e.names = [alt.name];
        }
      }
      const lib = findExercise(e.names[0], custom);
      if (lib && lib.autoLoad) e.inc = 0;
      else if (usesDumbbells(lib)) e.inc = cleanDumbbellInc(settings && settings.dumbbellInc);
    });
  });
  return swaps;
}

/* „Kniebeugen → Hackenschmidt“, ohne Ersatz „Latzug (fehlt: Latzugstation)“ oder „… (kein passendes Gerät)“ */
export const swapText = s => (s.to ? `${s.from} → ${s.to}` : `${s.from} (${s.missing ? `fehlt: ${s.missing}` : 'kein passendes Gerät'})`);

/* Ersetzungen ohne Wiederholung über die Tage hinweg */
export const uniqueSwaps = swaps => [...new Map(swaps.map(s => [swapText(s), s])).values()];

/* Kurzfassung für Fließtext: bis zu max Ersetzungen einzeln, sonst gezählt mit Beispielen */
export function swapSummary(swaps, max = 4) {
  const list = uniqueSwaps(swaps);
  if (list.length <= max) return list.map(swapText).join(', ');
  const done = list.filter(s => s.to);
  const none = list.length - done.length;
  const parts = [];
  if (done.length) parts.push(`${done.length} ${done.length === 1 ? 'Übung' : 'Übungen'} ersetzt, z. B. ${done.slice(0, 2).map(swapText).join(', ')}`);
  if (none) parts.push(`für ${none} ${none === 1 ? 'Übung' : 'Übungen'} fehlt ein passendes Gerät`);
  return parts.join('; ');
}

/* ---------- Pläne aus Vorlagen ---------- */
/* Plan aus einer Vorlage samt Ersetzungen. Übungs-ids richten sich nach dem 3er-Split, vorhandenen Plänen und der
   Bibliothek, damit Verlauf und Progression derselben Übung planübergreifend zusammenpassen.
   ctx: { plans, custom, equipment, settings, tags }. Liefert { plan, swaps }. */
export function templatePlan(tpl, ctx = {}) {
  const { plans = [], custom = [] } = ctx;
  let plan;
  if (tpl.fromDefault) {
    const p = clone(DEFAULT_PLAN);
    const days = {};
    const order = p.order.map(old => { const d = { ...p.days[old], id: 'd' + uid() }; days[d.id] = d; return d.id; });
    plan = { id: 'p' + uid(), name: tpl.name, order, days };
  } else {
    const known = knownPlans(plans);
    const days = {};
    const order = tpl.days.map(td => {
      const d = newDay(td.name, td.color, td.muscles);
      d.exercises = td.exercises.map(([name, sets, repMin, repMax, rest, inc, unit, opt], i, all) => {
        const lib = findExercise(name, custom);
        const ss = !!(opt && opt.ss === true) && i < all.length - 1;
        return E(exerciseIdFor(name, known, custom), lib ? lib.name : name, sets, repMin, repMax, rest, inc,
          unit || (lib && lib.unit) || 'reps', ss);
      });
      days[d.id] = d;
      return d.id;
    });
    plan = { id: 'p' + uid(), name: tpl.name, order, days };
  }
  const swaps = adaptPlan(plan, ctx);
  return { plan, swaps };
}

/* Wie templatePlan, nur der Plan. opts: { equipment, settings } */
export function planFromTemplate(tpl, existingPlans = [], custom = [], opts = {}) {
  return templatePlan(tpl, { ...opts, plans: existingPlans, custom }).plan;
}

/* Der 3er-Split mit seiner festen id 'split', angepasst an Geräte und Einstellungen. Liefert { plan, swaps }. */
export function defaultPlanFor(ctx = {}) {
  const plan = defaultPlan();
  return { plan, swaps: adaptPlan(plan, ctx) };
}
