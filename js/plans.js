import { clone, uid } from './util.js';
import { exerciseIdFor, findExercise } from './domain/library.js';

const E = (id, names, sets, repMin, repMax, rest, inc, unit = 'reps') =>
  ({ id, names: [].concat(names), sets, repMin, repMax, rest, inc, unit });

/* Der 3er-Split, mit dem die App startet */
export const DEFAULT_PLAN = {
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

/* Plan aus einer Vorlage. Übungs-ids richten sich nach vorhandenen Plänen und der Bibliothek,
   damit Verlauf und Progression derselben Übung planübergreifend zusammenpassen. */
export function planFromTemplate(tpl, existingPlans = [], custom = []) {
  const known = [DEFAULT_PLAN, ...existingPlans];
  if (tpl.fromDefault) {
    const p = clone(DEFAULT_PLAN);
    const days = {};
    const order = p.order.map(old => { const d = { ...p.days[old], id: 'd' + uid() }; days[d.id] = d; return d.id; });
    return { id: 'p' + uid(), name: tpl.name, order, days };
  }
  const days = {};
  const order = tpl.days.map(td => {
    const d = newDay(td.name, td.color, td.muscles);
    d.exercises = td.exercises.map(([name, sets, repMin, repMax, rest, inc, unit]) => {
      const lib = findExercise(name, custom);
      return E(exerciseIdFor(name, known, custom), lib ? lib.name : name, sets, repMin, repMax, rest, inc, unit || (lib && lib.unit) || 'reps');
    });
    days[d.id] = d;
    return d.id;
  });
  return { id: 'p' + uid(), name: tpl.name, order, days };
}
