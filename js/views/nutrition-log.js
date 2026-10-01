/* Mahlzeiten eintragen (Stufe 4): Suche, Barcode, eigene Lebensmittel, gespeicherte Mahlzeiten, Rezepte.
   Die Unteransichten liegen als Stapel in V.foodStack; Ernährung zeigt die oberste statt der Übersicht. */
import { V } from '../state.js';
import { esc, fmt, fmt0, ymd } from '../util.js';
import { MEALS, sumNutrients, entryNutrients } from '../domain/nutrition.js';
import { nut, topView } from './food-state.js';
import * as search from './food-search.js';
import * as scan from './food-scan.js';
import * as forms from './food-forms.js';

/* Untermodule, deren actions und inputs app.js einsammelt */
export const modules = [search, scan, forms];

/* Vollbild-Unterseite (Suche, Scanner, Formulare) oder null */
export function subview() {
  const v = topView();
  if (!v) return null;
  if (v.kind === 'search') return search.view(v);
  if (v.kind === 'scan') return scan.view(v);
  if (v.kind === 'food') return forms.foodEditor(v);
  if (v.kind === 'recipe') return forms.recipeEditor(v);
  return null;
}

/* Die Mahlzeiten eines Tages mit ihren Einträgen und Knöpfen zum Hinzufügen. date: 'YYYY-MM-DD' */
export function vMealsSection(date) {
  const entries = nut().log[date] || [];
  return `<section class="block food-meals">
    <h2>Mahlzeiten</h2>
    ${Object.entries(MEALS).map(([meal, label]) => {
      const list = entries.filter(e => e.meal === meal);
      const t = sumNutrients(list);
      return `<div class="card food-meal">
        <div class="fm-head">
          <h3>${esc(label)}</h3>
          ${list.length ? `<span class="num">${esc(fmt0(t.kcal))} kcal, ${esc(fmt0(t.protein))} g Protein</span>` : '<span>noch leer</span>'}
        </div>
        ${list.length ? `<ul class="fm-list">${list.map(e => {
          const n = entryNutrients(e);
          return `<li><button class="fm-row" data-act="foodentry" data-date="${esc(date)}" data-id="${esc(e.id)}"
              aria-label="${esc(e.name)}, ${esc(fmt(e.grams))} g, ${esc(fmt0(n.kcal))} kcal. Tippen zum Ändern">
            <span class="fm-name">${esc(e.name)}</span>
            <span class="fm-g num">${esc(fmt(e.grams))} g</span>
            <span class="fm-kcal num">${esc(fmt0(n.kcal))} kcal</span>
          </button></li>`;
        }).join('')}</ul>` : ''}
        <div class="fm-btns">
          <button class="btn small" data-act="foodadd" data-meal="${meal}" data-date="${esc(date)}">Hinzufügen</button>
          ${list.length ? `<button class="link" data-act="foodsavemeal" data-meal="${meal}" data-date="${esc(date)}">Als Mahlzeit speichern</button>` : ''}
        </div>
      </div>`;
    }).join('')}
  </section>`;
}

/* Haupteinstieg oben auf Ernährung: sieht aus wie ein Suchfeld, daneben der Barcode-Knopf.
   Trägt für den gezeigten Tag ein; die Mahlzeit wählt die App nach der Uhrzeit. */
export function vStart(date) {
  const other = date !== ymd();
  return `<div class="food-start">
    <button class="food-start-q" data-act="foodstart">${ICON_SEARCH}<span>${other ? `Essen für ${esc(new Date(date + 'T12:00').toLocaleDateString('de-DE', { weekday: 'long' }))} eintragen` : 'Essen eintragen'}</span></button>
    <button class="food-scanbtn" data-act="foodstart" data-scan="1" aria-label="Barcode scannen">${search.BARCODE_ICON}<span>Barcode</span></button>
  </div>`;
}
const ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/></svg>';

export const actions = {
  /* Je Mahlzeit „Hinzufügen“: Mahlzeit vorgewählt, in der Suche änderbar */
  foodadd: el => search.startSearch({ date: el.dataset.date, meal: el.dataset.meal }),
  /* Ohne Mahlzeit: nach Uhrzeit. data-from="today": nach dem Eintragen zurück nach Heute */
  foodstart: el => search.startSearch({
    date: el.dataset.from === 'today' ? ymd() : V.nutDate || ymd(),
    from: el.dataset.from || null, scan: el.dataset.scan === '1',
  }),
  foodentry: el => forms.editEntry(el.dataset.date, el.dataset.id),
  foodsavemeal: el => forms.saveMealSheet(el.dataset.date, el.dataset.meal),
};
export const inputs = {};
