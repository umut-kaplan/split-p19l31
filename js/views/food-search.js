/* Suche: erst lokal (Grundnahrungsmittel, eigene, Rezepte, zuletzt benutzt), dann Open Food Facts */
import { V } from '../state.js';
import { esc, fmt0, dShort, uid } from '../util.js';
import { MEALS, entryNutrients } from '../domain/nutrition.js';
import { normalize, searchFoods, pickNutrients, labelHasAmount } from '../domain/foods.js';
import { searchOff, OFF_CREDIT } from '../store/off.js';
import { ICON } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { nut, topView, openView, closeAllViews, localFoods, recentFoods, remember, foodByKey, customFood, recipeFood, addEntries } from './food-state.js';
import { bar, amountSheet, newFoodView, savedMealKcal } from './food-forms.js';

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
  return `<section class="food-sec"><h2>Open Food Facts</h2>${inner}<p class="small-print" style="margin-top:8px">${esc(OFF_CREDIT)}</p></section>`;
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
      + section('Gespeicherte Mahlzeiten', saved, savedRow)
      + section('Zuletzt benutzt', recent)
      + section('Rezepte', recipes)
      + section('Eigene Lebensmittel', own);
  }
  const local = remember(searchFoods(localFoods().filter(f => adding || f.source !== 'recipe'), v.q, 30));
  const saved = adding ? n.savedMeals.filter(m => normalize(m.name).includes(q)) : [];
  return section('Gespeicherte Mahlzeiten', saved, savedRow)
    + (local.length ? section('In der App', local) : '<p class="food-note" style="margin-top:18px">In der App nichts gefunden.</p>')
    + `<div id="food-off">${offSection(v)}</div>`;
}

export function view(v) {
  const title = v.purpose === 'ingredient' ? 'Zutat hinzufügen' : `${MEALS[v.meal] || 'Mahlzeit'} hinzufügen`;
  return `<div class="day-yellow food-sub">
    ${bar(title)}
    <div class="food-searchbox">
      <label class="vh" for="food-q">Lebensmittel suchen</label>
      <input id="food-q" type="search" data-in="foodq" value="${esc(v.q || '')}" placeholder="Lebensmittel suchen" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
    </div>
    <div class="food-tools">
      <button class="btn small" data-act="foodscan">Barcode scannen</button>
      <button class="btn small ghost" data-act="foodnew">Eigenes Lebensmittel</button>
      ${v.purpose === 'ingredient' ? '' : '<button class="btn small ghost" data-act="foodrecipenew">Rezept anlegen</button>'}
    </div>
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
