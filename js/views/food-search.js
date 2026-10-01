/* Suche: erst lokal (Grundnahrungsmittel, eigene, Rezepte, zuletzt benutzt), dann Open Food Facts.
   Oben Mahlzeit (nach Uhrzeit vorgewählt) und Vorschläge für einen Tipp: gespeicherte Mahlzeiten, „wie gestern“, zuletzt gegessen. */
import { V } from '../state.js';
import { esc, fmt, fmt0, dShort, uid, ymd } from '../util.js';
import { MEALS, entryNutrients, sumNutrients } from '../domain/nutrition.js';
import { normalize, searchFoods, pickNutrients, labelHasAmount, entryFromFood } from '../domain/foods.js';
import { quickFoods, lastMeal } from '../domain/food-quick.js';
import { addDays } from '../domain/shifts.js';
import { searchOff, OFF_CREDIT_HTML } from '../store/off.js';
import { ICON } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import {
  nut, topView, openView, closeAllViews, localFoods, recentFoods, remember, foodByKey, customFood, recipeFood, addEntries, markUsed,
  mealNow, focusSearch,
} from './food-state.js';
import { bar, amountSheet, newFoodView, savedMealKcal } from './food-forms.js';

/* Kurze Namen, damit die vier Mahlzeiten auch bei 320 px in eine Reihe passen */
export const MEAL_SHORT = { breakfast: 'Frühstück', lunch: 'Mittag', dinner: 'Abend', snack: 'Snack' };
export const BARCODE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7V5h3M17 5h3v2M20 17v2h-3M7 19H4v-2M7 9v6M10 9v6M13 9v6M16.5 9v6"/></svg>';

/* Suche öffnen: Mahlzeit nach Uhrzeit, Feld fokussiert, damit die Tastatur gleich da ist.
   opts: { date, meal, from: 'today' (zurück nach Heute), scan: true (gleich den Scanner darüber) } */
export function startSearch({ date = ymd(), meal = null, from = null, scan = false } = {}) {
  const v = { kind: 'search', purpose: 'add', date, meal: meal || mealNow(), q: '', off: null, from };
  V.tab = 'nutrition';
  openView(v);
  if (scan) openView({ kind: 'scan', date, meal: v.meal, purpose: 'add' });
  else focusSearch();
}

const SOURCE_LABEL = { custom: 'Eigenes', recipe: 'Rezept' };

function hit(f) {
  const tag = SOURCE_LABEL[f.source];
  const portion = f.portion ? (labelHasAmount(f.portion.label) ? f.portion.label : `${f.portion.label} ${fmt0(f.portion.grams)} g`) : '';
  const sub = [f.brand, tag, portion].filter(Boolean).join(', ');
  const editAct = f.source === 'custom' ? 'foodedit' : f.source === 'recipe' ? 'foodrecipeedit' : '';
  return `<li>
    <button class="food-hit" data-act="foodpick" data-key="${esc(f.key || f.ref)}">
      <span class="fh-name">${esc(f.name)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>
      <span class="fh-kcal num">${esc(fmt0(f.per100.kcal))}<small>kcal/100 g</small></span>
    </button>
    ${editAct ? `<button class="icon" data-act="${editAct}" data-id="${esc(f.id)}" aria-label="${esc(f.name)} bearbeiten">${ICON.edit}</button>` : ''}
  </li>`;
}

const section = (title, items, render = hit) => (items.length
  ? `<section class="food-sec"><h2>${esc(title)}</h2><ul class="food-hits">${items.map(render).join('')}</ul></section>` : '');

function savedRow(m) {
  return `<li>
    <button class="food-hit" data-act="foodsaved" data-id="${esc(m.id)}">
      <span class="fh-name">${esc(m.name)}<small>${m.items.length} ${m.items.length === 1 ? 'Eintrag' : 'Einträge'}</small></span>
      <span class="fh-kcal num">${esc(fmt0(savedMealKcal(m)))}<small>kcal</small></span>
    </button>
    <button class="icon" data-act="foodsavedmanage" data-id="${esc(m.id)}" aria-label="${esc(m.name)} bearbeiten">${ICON.edit}</button>
  </li>`;
}

/* „Wie gestern“ oder „Wie am Montag“ */
function againLabel(date, forDate) {
  if (date === addDays(forDate, -1)) return 'Wie gestern';
  return `Wie am ${new Date(date + 'T12:00').toLocaleDateString('de-DE', { weekday: 'long' })}`;
}

/* Vorschläge für einen Tipp, nur bei leerem Suchfeld */
function quickSection(v) {
  const n = nut();
  const chips = n.savedMeals.slice(0, 6).map(m => `<button class="chip food-chip" data-act="foodsaved" data-id="${esc(m.id)}">
    <span>${esc(m.name)}</span><small class="num">${esc(fmt0(savedMealKcal(m)))} kcal</small></button>`);
  const again = lastMeal(n.log, v.date, v.meal);
  if (again) {
    const kcal = sumNutrients(again.entries).kcal;
    chips.push(`<button class="chip food-chip" data-act="foodagain" data-date="${esc(again.date)}">
      <span>${esc(againLabel(again.date, v.date))}</span><small class="num">${again.entries.length} ${again.entries.length === 1 ? 'Eintrag' : 'Einträge'}, ${esc(fmt0(kcal))} kcal</small></button>`);
  }
  remember(quickFoods(recentFoods(12), n.log, 6).map(({ food, grams }) => {
    chips.push(`<button class="chip food-chip" data-act="foodquick" data-key="${esc(food.key || food.ref)}" data-g="${grams}">
      <span>${esc(food.name)}</span><small class="num">${esc(fmt(grams))} g</small></button>`);
    return food;
  }));
  if (!chips.length) return '';
  return `<section class="food-sec food-quick"><h2>Mit einem Tipp eintragen</h2><div class="chips">${chips.join('')}</div></section>`;
}

/* Bei leerem Feld unter den Vorschlägen für einen Tipp, beim Suchen über den Treffern */
const tools = adding => `<div class="food-tools">
  <button class="btn small ghost" data-act="foodnew">Eigenes Lebensmittel</button>
  ${adding ? '<button class="btn small ghost" data-act="foodrecipenew">Rezept anlegen</button>' : ''}
</div>`;

function mealPicker(v) {
  return `<div class="food-mealsel" role="group" aria-label="Mahlzeit">${Object.keys(MEALS).map(k =>
    `<button class="${k === v.meal ? 'on' : ''}" aria-pressed="${k === v.meal}" aria-label="${esc(MEALS[k])}" data-act="foodsetmeal" data-meal="${k}">${esc(MEAL_SHORT[k])}</button>`).join('')}</div>`;
}

function offSection(v) {
  const q = normalize(v.q);
  if (q.length < 3) return `<p class="food-note" style="margin-top:18px">Ab drei Buchstaben sucht die App auch bei Open Food Facts.</p>`;
  const o = v.off && v.off.q === q ? v.off : null;
  let inner;
  if (!o || o.state === 'pending') inner = '<p class="food-note">Gleich sucht die App auch bei Open Food Facts.</p>';
  else if (o.state === 'loading') inner = '<p class="food-note"><span class="food-spin" aria-hidden="true"></span>Suche bei Open Food Facts …</p>';
  else {
    remember(o.items);
    const note = o.from === 'cache' ? `<p class="food-note">Gespeichertes Ergebnis vom ${esc(dShort(o.at))}${o.offline ? ', du bist offline.' : ''}</p>` : '';
    const err = o.error ? `<p class="food-note">${esc(o.error)}</p>${o.offline ? '' : '<button class="btn small ghost" data-act="foodoffretry">Erneut versuchen</button>'}` : '';
    inner = o.items.length
      ? `${note}<ul class="food-hits">${o.items.map(hit).join('')}</ul>${err}`
      : (err || `<p class="food-note">Open Food Facts kennt dazu nichts. Probier ein anderes Wort oder lege das Lebensmittel selbst an.</p>`);
  }
  return `<section class="food-sec"><h2>Open Food Facts</h2>${inner}<p class="small-print" style="margin-top:8px">${OFF_CREDIT_HTML}</p></section>`;
}

/* Lokale Treffer. Der Open-Food-Facts-Teil steht in einem eigenen Container, damit ein Neuzeichnen dort
   keinen Tipp auf einen lokalen Treffer verschluckt (Verlassen des Suchfelds löst die Suche aus). */
export function results(v) {
  const n = nut();
  const q = normalize(v.q);
  const adding = v.purpose !== 'ingredient';
  if (!q) {
    const recent = remember(recentFoods(10));
    const own = remember(n.customFoods.map(customFood));
    const recipes = adding ? remember(n.recipes.map(recipeFood)) : [];
    const saved = adding ? n.savedMeals : [];
    const any = recent.length || own.length || recipes.length || saved.length;
    return (any ? '' : '<p class="food-note" style="margin-top:18px">Tipp los, zum Beispiel „Haferflocken“, oder scanne den Barcode auf der Verpackung.</p>')
      + (adding ? quickSection(v) : '')
      + tools(adding)
      + section('Gespeicherte Mahlzeiten', saved, savedRow)
      + section('Zuletzt benutzt', recent)
      + section('Rezepte', recipes)
      + section('Eigene Lebensmittel', own);
  }
  const local = remember(searchFoods(localFoods().filter(f => adding || f.source !== 'recipe'), v.q, 30));
  const saved = adding ? n.savedMeals.filter(m => normalize(m.name).includes(q)) : [];
  return tools(adding)
    + section('Gespeicherte Mahlzeiten', saved, savedRow)
    + (local.length ? section('In der App', local) : '<p class="food-note" style="margin-top:18px">In der App nichts gefunden.</p>')
    + `<div id="food-off">${offSection(v)}</div>`;
}

export function view(v) {
  const adding = v.purpose !== 'ingredient';
  const day = adding && v.date && v.date !== ymd() ? ` für ${new Date(v.date + 'T12:00').toLocaleDateString('de-DE', { weekday: 'long' })}` : '';
  return `<div class="day-yellow food-sub">
    ${bar(adding ? `Essen eintragen${day}` : 'Zutat hinzufügen')}
    <div class="food-searchbox">
      <label class="vh" for="food-q">Lebensmittel suchen</label>
      <input id="food-q" type="search" data-in="foodq" value="${esc(v.q || '')}" placeholder="Lebensmittel suchen" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      <button class="food-scanbtn" data-act="foodscan" aria-label="Barcode scannen">${BARCODE_ICON}<span>Barcode</span></button>
    </div>
    ${adding ? mealPicker(v) : ''}
    <div id="food-results">${results(v)}</div>
  </div>`;
}

/* Nur die Trefferliste neu zeichnen, damit Tastatur und Eingabe bleiben */
function refresh(v) {
  const el = document.getElementById('food-results');
  if (el && topView() === v) el.innerHTML = results(v);
}
/* Nur den Open-Food-Facts-Teil neu zeichnen */
function refreshOff(v) {
  const el = document.getElementById('food-off');
  if (el && topView() === v) el.innerHTML = offSection(v);
}

let timer = null;
let enterPressed = false;
async function runOff(v, force = false) {
  const q = normalize(v.q);
  if (q.length < 3 || topView() !== v) return;
  if (!force && v.off && v.off.q === q && v.off.state !== 'pending') return;
  v.off = { q, state: 'loading' };
  refreshOff(v);
  const r = await searchOff(v.q);
  if (!v.off || v.off.q !== q) return; // inzwischen anders gesucht
  v.off = { q, state: 'done', ...r };
  refreshOff(v);
}

export const actions = {
  foodpick: el => {
    const v = topView();
    const food = foodByKey(el.dataset.key);
    if (!v || !food) return;
    clearTimeout(timer);
    if (document.activeElement) document.activeElement.blur();
    amountSheet(food, v.purpose === 'ingredient' ? { mode: 'ingredient' } : { mode: 'add', date: v.date, meal: v.meal });
  },
  foodsaved: el => {
    const v = topView();
    const m = nut().savedMeals.find(x => x.id === el.dataset.id);
    if (!v || !m) return;
    addEntries(v.date, m.items.map(i => ({ id: uid(), meal: v.meal, name: i.name, grams: i.grams, per100: pickNutrients(i.per100), source: i.source, ref: i.ref })));
    const kcal = m.items.reduce((a, i) => a + entryNutrients(i).kcal, 0);
    toast(`${m.name} eingetragen, ${fmt0(kcal)} kcal`);
    closeAllViews();
  },
  /* Dieselbe Mahlzeit wie an einem Tag davor noch einmal */
  foodagain: el => {
    const v = topView();
    const again = v && lastMeal(nut().log, v.date, v.meal);
    if (!again || again.date !== el.dataset.date) return;
    addEntries(v.date, again.entries.map(i => ({ id: uid(), meal: v.meal, name: i.name, grams: i.grams, per100: pickNutrients(i.per100), source: i.source, ref: i.ref })));
    toast(`${MEALS[v.meal]} ${againLabel(again.date, v.date).replace(/^W/, 'w')} eingetragen, ${fmt0(sumNutrients(again.entries).kcal)} kcal`);
    closeAllViews();
  },
  /* Zuletzt gegessen: mit der Menge vom letzten Mal, die auf dem Knopf steht */
  foodquick: el => {
    const v = topView();
    const food = foodByKey(el.dataset.key);
    const grams = Number(el.dataset.g);
    if (!v || !food || !(grams > 0)) return;
    addEntries(v.date, [entryFromFood(food, grams, v.meal, uid())]);
    markUsed(food);
    toast(`${food.name}, ${fmt(grams)} g eingetragen`);
    closeAllViews();
  },
  foodsetmeal: el => {
    const v = topView();
    if (!v || v.kind !== 'search') return;
    v.meal = el.dataset.meal;
    document.querySelectorAll('.food-mealsel button').forEach(b => {
      const on = b.dataset.meal === v.meal;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
    if (!normalize(v.q)) refresh(v);
  },
  foodoffretry: () => { const v = topView(); if (v && v.kind === 'search') runOff(v, true); },
  foodnew: () => {
    const v = topView();
    const q = v && v.kind === 'search' ? (v.q || '').trim() : '';
    openView(newFoodView(v && v.kind === 'search' ? { date: v.date, meal: v.meal, purpose: v.purpose } : null, { name: q }));
  },
  foodscan: () => {
    const v = topView();
    openView({ kind: 'scan', date: v && v.date, meal: v && v.meal, purpose: v && v.purpose });
  },
};

/* „Suchen“ auf der iPhone-Tastatur: Tastatur schließen, dann löst das Verlassen des Feldes die Suche aus */
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target && ev.target.id === 'food-q') { ev.preventDefault(); enterPressed = true; ev.target.blur(); }
  });
}

export const inputs = {
  foodq: (el, type) => {
    const v = topView();
    if (!v || v.kind !== 'search') return;
    if (type === 'input') {
      v.q = el.value;
      const q = normalize(v.q);
      if (q.length >= 3 && !(v.off && v.off.q === q)) v.off = { q, state: 'pending' };
      refresh(v);
      clearTimeout(timer);
      if (q.length >= 3) timer = setTimeout(() => runOff(v), 900);
    } else if (type === 'change' && enterPressed) {
      /* Nur nach „Suchen“ auf der Tastatur sofort suchen. Ein Tipp auf einen Treffer löst keine Anfrage aus. */
      enterPressed = false;
      clearTimeout(timer);
      runOff(v);
    }
  },
};
