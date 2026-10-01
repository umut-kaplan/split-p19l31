/* Mengen eingeben, eigene Lebensmittel, Rezepte und gespeicherte Mahlzeiten */
import { S, V, save } from '../state.js';
import { esc, fmt, fmt0, fmt1, fmtIn, uid, dShort } from '../util.js';
import { render } from '../render.js';
import { MEALS, entryNutrients, recipeNutrients } from '../domain/nutrition.js';
import { portionsFor, entryFromFood, parseAmount, customFoodFromDraft, recipeError, pickNutrients, labelHasAmount } from '../domain/foods.js';
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { OFF_CREDIT } from '../store/off.js';
import {
  nut, stack, topView, openView, closeView, closeAllViews, popTo, customFood,
  addEntries, markUsed, findEntry,
} from './food-state.js';
import { backLink } from '../ui/navlinks.js';

/* „‹ Zurück“ ist die gemeinsame Aktion back (views/navigation.js): oberste Ansicht zu, Kamera aus, Tastatur zu und
   zurück an die Stelle der Seite darunter, an der man sie verlassen hat */
export const bar = title => `<div class="food-bar">
  ${backLink()}
  <h1>${esc(title)}</h1>
</div>`;

const nutrientLine = n => `${fmt0(n.kcal)} kcal, ${fmt1(n.protein)} g Protein, ${fmt1(n.fat)} g Fett, ${fmt1(n.carbs)} g Kohlenhydrate`;
/* Steht die Menge schon in der Bezeichnung, z. B. „1 Glas (200 ml)“, keine Gramm dahinter wiederholen */
const namesAmount = labelHasAmount;

/* ---------- Menge eingeben ---------- */
/* ctx: { mode: 'add' | 'ingredient' | 'edit', date, meal, entryId, grams } */
export function amountSheet(food, ctx) {
  const portions = portionsFor(food);
  const main = food.portion && food.portion.grams > 0 ? food.portion : null;
  const grams = ctx.grams || (main ? main.grams : 100);
  V.foodAmount = { food, ...ctx, meal: ctx.meal || 'snack' };
  const p = food.per100;
  const notes = [];
  if (food.source === 'off') notes.push(OFF_CREDIT);
  if (food.missing && food.missing.length) notes.push('Einige Werte fehlen bei Open Food Facts und zählen als 0.');
  if (food.estimated) notes.push('Die kcal sind aus den Nährwerten geschätzt.');
  const body = `<div class="food-amount">
    ${food.brand ? `<p class="muted">${esc(food.brand)}</p>` : ''}
    <p class="small-print">Pro 100 g: ${esc(nutrientLine(p))}.${notes.length ? ' ' + esc(notes.join(' ')) : ''}</p>
    <label class="field" style="margin-top:14px">Menge
      <span class="unit-wrap"><input id="food-grams" data-in="foodgrams" inputmode="decimal" enterkeyhint="done" value="${esc(fmtIn(grams))}" autocomplete="off"><span>g</span></span></label>
    ${main ? `<div class="food-count">
      <button class="icon" data-act="foodcount" data-d="-0.5" aria-label="Eine halbe Portion weniger">−</button>
      <b class="num" id="food-count">${esc(fmt1(grams / main.grams))}</b>
      <span>× ${esc(main.label)}${namesAmount(main.label) ? '' : ` <small>${esc(fmt(main.grams))} g</small>`}</span>
      <button class="icon" data-act="foodcount" data-d="0.5" aria-label="Eine halbe Portion mehr">+</button>
    </div>` : ''}
    <div class="chips food-portions">${portions.map(x =>
      `<button class="chip" data-act="foodportion" data-g="${x.grams}">${esc(x.label)}${namesAmount(x.label) ? '' : ` <small>${esc(fmt(x.grams))} g</small>`}</button>`).join('')}</div>
    ${ctx.mode === 'ingredient' ? '' : `<p class="label" style="margin-top:14px">Mahlzeit</p>
      <div class="chips food-mealpick">${Object.entries(MEALS).map(([k, l]) =>
        `<button class="chip ${k === V.foodAmount.meal ? 'on' : ''}" aria-pressed="${k === V.foodAmount.meal}" data-act="foodmeal" data-meal="${k}">${esc(l)}</button>`).join('')}</div>`}
    <p class="food-preview num" id="food-preview" aria-live="polite">${esc(nutrientLine(entryNutrients({ grams, per100: p })))}</p>
  </div>`;
  const actions = [];
  if (ctx.mode === 'edit') {
    actions.push({ label: 'Speichern', kind: 'primary', fn: () => confirmAmount() });
    actions.push({ label: 'Eintrag löschen', kind: 'danger', fn: () => deleteEntry(ctx.date, ctx.entryId) });
  } else {
    actions.push({ label: ctx.mode === 'ingredient' ? 'Zum Rezept hinzufügen' : 'Eintragen', kind: 'primary', fn: () => confirmAmount() });
  }
  actions.push({ label: 'Abbrechen', kind: 'ghost', fn: () => { V.foodAmount = null; closeSheet(); } });
  openSheet({ title: food.name, body, actions });
}

const gramsInput = () => document.getElementById('food-grams');

function updateAmountUI(grams) {
  const a = V.foodAmount;
  if (!a) return;
  const pv = document.getElementById('food-preview');
  if (pv) pv.textContent = grams ? nutrientLine(entryNutrients({ grams, per100: a.food.per100 })) : 'Menge in Gramm eintragen.';
  const cnt = document.getElementById('food-count');
  if (cnt && a.food.portion && grams) cnt.textContent = fmt1(grams / a.food.portion.grams);
}

function confirmAmount() {
  const a = V.foodAmount;
  const grams = parseAmount(gramsInput() && gramsInput().value);
  if (!a) return;
  if (!grams || grams > 5000) { toast('Menge in Gramm eintragen, z. B. 150.'); return; }
  if (a.mode === 'edit') {
    const e = findEntry(a.date, a.entryId);
    if (e) {
      const oldMeal = e.meal;
      e.grams = Math.round(grams * 10) / 10;
      e.meal = a.meal;
      save();
      toast(oldMeal !== e.meal ? `Verschoben nach ${MEALS[e.meal]}` : 'Menge geändert');
    }
    V.foodAmount = null; closeSheet();
    return;
  }
  if (a.mode === 'ingredient') {
    const recipeView = stack().slice().reverse().find(v => v.kind === 'recipe');
    if (recipeView) {
      recipeView.draft.items.push({ name: a.food.brand ? `${a.food.name} (${a.food.brand})` : a.food.name, grams: Math.round(grams * 10) / 10, per100: pickNutrients(a.food.per100), source: a.food.source, ref: a.food.ref || a.food.key });
      markUsed(a.food);
    }
    V.foodAmount = null; V.sheet = null;
    popTo('recipe');
    return;
  }
  addEntries(a.date, [entryFromFood(a.food, grams, a.meal, uid())]);
  markUsed(a.food);
  V.foodAmount = null; V.sheet = null;
  toast(`${a.food.name} eingetragen`);
  closeAllViews();
}

function deleteEntry(date, id) {
  const n = nut();
  n.log[date] = (n.log[date] || []).filter(e => e.id !== id);
  if (!n.log[date].length) delete n.log[date];
  save();
  V.foodAmount = null; closeSheet();
  toast('Eintrag gelöscht');
}

/* Tipp auf einen Eintrag im Tagebuch */
export function editEntry(date, id) {
  const e = findEntry(date, id);
  if (!e) return;
  const food = { key: e.ref, ref: e.ref, name: e.name, brand: '', per100: e.per100, portion: null, source: e.source };
  const known = e.ref && nut().recent.find(r => (r.key || r.ref) === e.ref);
  if (known && known.portion) food.portion = known.portion;
  amountSheet(food, { mode: 'edit', date, meal: e.meal, entryId: id, grams: e.grams });
}

/* ---------- Gespeicherte Mahlzeiten ---------- */
export function saveMealSheet(date, meal) {
  const items = (nut().log[date] || []).filter(e => e.meal === meal);
  if (!items.length) return;
  const suggestion = items.slice(0, 2).map(e => e.name.replace(/\s*\(.*\)$/, '')).join(', ') + (items.length > 2 ? ' …' : '');
  openSheet({
    title: 'Als Mahlzeit speichern',
    text: `${items.length} ${items.length === 1 ? 'Eintrag' : 'Einträge'} aus ${MEALS[meal]} vom ${dShort(date + 'T12:00')} Danach trägst du sie mit einem Tipp wieder ein.`,
    body: `<div class="form"><label>Name<input id="food-mealname" value="${esc(suggestion)}" maxlength="60" autocomplete="off"></label></div>`,
    actions: [
      { label: 'Mahlzeit speichern', kind: 'primary', fn: () => {
        const name = (document.getElementById('food-mealname').value || '').trim();
        if (!name) { toast('Gib der Mahlzeit einen Namen.'); return; }
        nut().savedMeals.unshift({ id: uid(), name, items: items.map(e => ({ name: e.name, grams: e.grams, per100: pickNutrients(e.per100), source: e.source, ref: e.ref })) });
        save(); closeSheet(); toast('Mahlzeit gespeichert');
      } },
      { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
    ],
  });
}

export function savedMealKcal(m) {
  return m.items.reduce((a, i) => a + entryNutrients(i).kcal, 0);
}

export function manageSavedMeal(id) {
  const m = nut().savedMeals.find(x => x.id === id);
  if (!m) return;
  openSheet({
    title: 'Gespeicherte Mahlzeit',
    body: `<div class="form"><label>Name<input id="food-mealname" value="${esc(m.name)}" maxlength="60" autocomplete="off"></label></div>
      <ul class="rules" style="margin-top:12px">${m.items.map(i => `<li>${esc(i.name)}, <span class="num">${esc(fmt(i.grams))} g</span></li>`).join('')}</ul>
      <p class="small-print" style="margin-top:8px">Zusammen ${esc(fmt0(savedMealKcal(m)))} kcal.</p>`,
    actions: [
      { label: 'Namen speichern', kind: 'primary', fn: () => {
        const name = (document.getElementById('food-mealname').value || '').trim();
        if (!name) { toast('Gib der Mahlzeit einen Namen.'); return; }
        m.name = name; save(); closeSheet(); toast('Gespeichert');
      } },
      { label: 'Mahlzeit löschen', kind: 'danger', fn: () => confirmSheet(`${m.name} löschen?`, 'Die gespeicherte Mahlzeit verschwindet. Bisherige Einträge im Tagebuch bleiben.', 'Löschen', () => {
        const n = nut();
        n.savedMeals = n.savedMeals.filter(x => x.id !== id);
        save(); closeSheet(); toast('Mahlzeit gelöscht');
      }) },
      { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
    ],
  });
}

/* ---------- Eigenes Lebensmittel ---------- */
/* v: { kind: 'food', draft, editId, ctx: { date, meal, purpose } | null } */
export function foodEditor(v) {
  const d = v.draft;
  const f = (k, label, mode = 'decimal', ph = '') => `<label class="field">${label}
    <input data-in="fooddraft" data-k="${k}" inputmode="${mode}" value="${esc(d[k] == null ? '' : d[k])}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
  return `<div class="day-yellow food-sub">
    ${bar(v.editId ? 'Lebensmittel bearbeiten' : 'Eigenes Lebensmittel')}
    <div class="fields" style="margin-top:16px">
      <label class="field">Name<input data-in="fooddraft" data-k="name" value="${esc(d.name || '')}" maxlength="80" placeholder="z. B. Proteinpudding" autocomplete="off"></label>
      <label class="field">Marke (optional)<input data-in="fooddraft" data-k="brand" value="${esc(d.brand || '')}" maxlength="60" autocomplete="off"></label>
    </div>
    <p class="label" style="margin-top:20px">Nährwerte pro 100 g</p>
    <div class="fields">
      <div class="row2">${f('kcal', 'Energie in kcal', 'decimal', 'z. B. 120')}${f('protein', 'Protein in g')}</div>
      <div class="row2">${f('fat', 'Fett in g')}${f('carbs', 'Kohlenhydrate in g')}</div>
    </div>
    <p class="small-print" style="margin-top:6px">Steht auf der Verpackung. Ohne kcal rechnet die App aus Protein, Fett und Kohlenhydraten.</p>
    <p class="label" style="margin-top:20px">Portion (optional)</p>
    <div class="row2">${f('portionLabel', 'Bezeichnung', 'text', 'z. B. 1 Becher')}${f('portionGrams', 'Gramm', 'decimal', 'z. B. 200')}</div>
    <div class="fields" style="margin-top:12px">${f('code', 'Barcode (optional)', 'numeric', 'Nummer unter dem Strichcode')}</div>
    <div class="stack">
      <button class="btn primary" data-act="foodsave">${v.ctx && v.ctx.meal ? 'Speichern und eintragen' : 'Speichern'}</button>
      ${v.editId ? '<button class="btn danger" data-act="fooddelete">Lebensmittel löschen</button>' : ''}
    </div>
  </div>`;
}

export function newFoodView(ctx, preset = {}) {
  return { kind: 'food', draft: { name: '', brand: '', kcal: '', protein: '', fat: '', carbs: '', portionLabel: '', portionGrams: '', code: '', ...preset }, editId: null, ctx };
}

function editFoodView(id) {
  const c = nut().customFoods.find(x => x.id === id);
  if (!c) return null;
  return {
    kind: 'food', editId: id, ctx: null,
    draft: {
      name: c.name, brand: c.brand || '', kcal: fmtIn(c.per100.kcal), protein: fmtIn(c.per100.protein), fat: fmtIn(c.per100.fat), carbs: fmtIn(c.per100.carbs),
      portionLabel: c.portion ? c.portion.label : '', portionGrams: c.portion ? fmtIn(c.portion.grams) : '', code: c.code || '',
    },
  };
}

function saveFood() {
  const v = topView();
  if (!v || v.kind !== 'food') return;
  const r = customFoodFromDraft(v.draft);
  if (r.error) { toast(r.error); return; }
  const n = nut();
  let rec;
  if (v.editId) {
    rec = n.customFoods.find(x => x.id === v.editId);
    Object.assign(rec, r.food);
  } else {
    rec = { id: uid(), ...r.food };
    n.customFoods.unshift(rec);
  }
  save();
  const ctx = v.ctx;
  closeView();
  if (ctx && ctx.meal) amountSheet(customFood(rec), { mode: ctx.purpose === 'ingredient' ? 'ingredient' : 'add', date: ctx.date, meal: ctx.meal });
  else if (ctx && ctx.purpose === 'ingredient') amountSheet(customFood(rec), { mode: 'ingredient' });
  else toast('Lebensmittel gespeichert');
}

/* ---------- Rezepte ---------- */
/* v: { kind: 'recipe', draft: { id, name, portions, items }, editId } */
export function recipeEditor(v) {
  const d = v.draft;
  return `<div class="day-yellow food-sub">
    ${bar(v.editId ? 'Rezept bearbeiten' : 'Neues Rezept')}
    <div class="fields" style="margin-top:16px">
      <label class="field">Name<input data-in="foodrname" value="${esc(d.name)}" maxlength="60" placeholder="z. B. Overnight Oats" autocomplete="off"></label>
      <div><p class="label">Portionen</p>
        <div class="stepper">
          <button class="icon" data-act="foodrport" data-d="-1" aria-label="Eine Portion weniger" ${d.portions <= 1 ? 'disabled' : ''}>−</button>
          <b aria-live="polite">${d.portions}</b>
          <button class="icon" data-act="foodrport" data-d="1" aria-label="Eine Portion mehr" ${d.portions >= 20 ? 'disabled' : ''}>+</button>
        </div></div>
    </div>
    <section class="food-sec"><h2>Zutaten</h2>
      ${d.items.length ? `<ul class="food-hits">${d.items.map((it, i) => `
        <li class="rec-item">
          <span class="fh-name">${esc(it.name)}<small id="food-ri-${i}" class="num">${esc(fmt0(entryNutrients(it).kcal))} kcal</small></span>
          <span class="unit-wrap rec-g"><input data-in="foodrgrams" data-i="${i}" inputmode="decimal" value="${esc(fmtIn(it.grams))}" aria-label="Menge ${esc(it.name)} in Gramm"><span>g</span></span>
          <button class="icon" data-act="foodrdel" data-i="${i}" aria-label="${esc(it.name)} entfernen">×</button>
        </li>`).join('')}</ul>` : '<p class="food-note">Noch keine Zutaten. Füge sie über die Suche oder den Barcode hinzu.</p>'}
      <div class="stack"><button class="btn" data-act="foodradd">Zutat hinzufügen</button></div>
    </section>
    <section class="block card food-sum" id="food-rsum">${recipeSummary(d)}</section>
    <div class="stack">
      <button class="btn primary" data-act="foodrsave">Rezept speichern</button>
      ${v.editId ? '<button class="btn danger" data-act="foodrdelete">Rezept löschen</button>' : ''}
    </div>
  </div>`;
}

function recipeSummary(d) {
  if (!d.items.length) return '<p class="muted">Die Nährwerte erscheinen, sobald Zutaten drin sind.</p>';
  const r = recipeNutrients(d);
  return `<h2>Nährwerte</h2>
    <p class="muted" style="margin-top:4px">Zusammen <span class="num">${esc(fmt0(r.grams))} g</span> und <span class="num">${esc(fmt0(r.total.kcal))} kcal</span>.</p>
    <p style="margin-top:8px">Pro Portion (<span class="num">${esc(fmt0(r.portionGrams))} g</span>): <b class="num">${esc(fmt0(r.perPortion.kcal))} kcal</b>,
      <span class="num">${esc(fmt1(r.perPortion.protein))} g</span> Protein, <span class="num">${esc(fmt1(r.perPortion.fat))} g</span> Fett, <span class="num">${esc(fmt1(r.perPortion.carbs))} g</span> Kohlenhydrate.</p>`;
}

export function newRecipeView() {
  return { kind: 'recipe', editId: null, draft: { name: '', portions: 2, items: [] } };
}

function editRecipeView(id) {
  const r = nut().recipes.find(x => x.id === id);
  if (!r) return null;
  return { kind: 'recipe', editId: id, draft: JSON.parse(JSON.stringify({ name: r.name, portions: r.portions, items: r.items })) };
}

function saveRecipe() {
  const v = topView();
  if (!v || v.kind !== 'recipe') return;
  const d = v.draft;
  d.name = d.name.trim();
  const err = recipeError(d);
  if (err) { toast(err); return; }
  const n = nut();
  if (v.editId) Object.assign(n.recipes.find(x => x.id === v.editId), d);
  else n.recipes.unshift({ id: uid(), createdAt: Date.now(), ...d });
  save();
  closeView();
  toast('Rezept gespeichert');
}

/* ---------- Ereignisse ---------- */
export const actions = {
  foodportion: el => { const g = Number(el.dataset.g); const i = gramsInput(); if (i) i.value = fmtIn(g); updateAmountUI(g); },
  foodcount: el => {
    const a = V.foodAmount;
    if (!a || !a.food.portion) return;
    const cur = parseAmount(gramsInput().value) || 0;
    const count = Math.max(0.5, Math.round((cur / a.food.portion.grams + Number(el.dataset.d)) * 2) / 2);
    const g = Math.round(count * a.food.portion.grams * 10) / 10;
    gramsInput().value = fmtIn(g);
    updateAmountUI(g);
  },
  foodmeal: el => {
    if (!V.foodAmount) return;
    V.foodAmount.meal = el.dataset.meal;
    document.querySelectorAll('.food-mealpick .chip').forEach(c => {
      const on = c.dataset.meal === el.dataset.meal;
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', on);
    });
  },
  foodsave: saveFood,
  fooddelete: () => {
    const v = topView();
    if (!v || !v.editId) return;
    confirmSheet('Lebensmittel löschen?', 'Es verschwindet aus deinen eigenen Lebensmitteln. Bisherige Einträge im Tagebuch bleiben.', 'Löschen', () => {
      const n = nut();
      n.customFoods = n.customFoods.filter(x => x.id !== v.editId);
      n.recent = n.recent.filter(r => (r.key || r.ref) !== 'c:' + v.editId);
      save(); V.sheet = null; closeView(); toast('Lebensmittel gelöscht');
    });
  },
  foodedit: el => { const view = editFoodView(el.dataset.id); if (view) openView(view); },
  foodrecipenew: () => openView(newRecipeView()),
  foodrecipeedit: el => { const view = editRecipeView(el.dataset.id); if (view) openView(view); },
  foodrport: el => {
    const v = topView();
    if (!v || v.kind !== 'recipe') return;
    v.draft.portions = Math.max(1, Math.min(20, v.draft.portions + Number(el.dataset.d)));
    render();
  },
  foodradd: () => openView({ kind: 'search', purpose: 'ingredient', q: '', off: null }),
  foodrdel: el => {
    const v = topView();
    if (!v || v.kind !== 'recipe') return;
    v.draft.items.splice(Number(el.dataset.i), 1);
    render();
  },
  foodrsave: saveRecipe,
  foodrdelete: () => {
    const v = topView();
    if (!v || !v.editId) return;
    confirmSheet('Rezept löschen?', 'Das Rezept verschwindet. Bisherige Einträge im Tagebuch bleiben.', 'Löschen', () => {
      const n = nut();
      n.recipes = n.recipes.filter(x => x.id !== v.editId);
      n.recent = n.recent.filter(r => (r.key || r.ref) !== 'r:' + v.editId);
      save(); V.sheet = null; closeView(); toast('Rezept gelöscht');
    });
  },
  foodsavedmanage: el => manageSavedMeal(el.dataset.id),
};

export const inputs = {
  foodgrams: (el, type) => { if (type === 'input') updateAmountUI(parseAmount(el.value)); },
  fooddraft: (el, type) => {
    const v = topView();
    if (v && v.kind === 'food' && type === 'input') v.draft[el.dataset.k] = el.value;
  },
  foodrname: (el, type) => {
    const v = topView();
    if (v && v.kind === 'recipe' && type === 'input') v.draft.name = el.value;
  },
  foodrgrams: (el, type) => {
    const v = topView();
    if (!v || v.kind !== 'recipe' || type !== 'input') return;
    const it = v.draft.items[Number(el.dataset.i)];
    if (!it) return;
    it.grams = parseAmount(el.value) || 0;
    const small = document.getElementById('food-ri-' + el.dataset.i);
    if (small) small.textContent = `${fmt0(entryNutrients(it).kcal)} kcal`;
    const sum = document.getElementById('food-rsum');
    if (sum) sum.innerHTML = recipeSummary(v.draft);
  },
};
