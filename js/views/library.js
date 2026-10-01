/* Übungsbibliothek (Stufe 2): Liste, Suche, Details, eigene Übungen mit Foto. */
import { S, V, save } from '../state.js';
import { esc, uid, dShort } from '../util.js';
import { render } from '../render.js';
import { MUSCLES } from '../domain/muscles.js';
import {
  EQUIPMENT_GROUPS, SMART_CIRCUIT, groupEquipment, equipmentName, equipmentById, requirementText, requirementTerms,
  doable, missingText, splitRequirement, buildRequirement,
} from '../domain/equipment.js';
import { SET_METHODS } from '../domain/settypes.js';
import {
  allExercises, findExercise, searchExercises, matchesQuery, equipmentOf, limitationHits, safeAlternatives, nameClashes,
} from '../domain/library.js';
import { plateSVG } from '../ui/plate.js';
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { resizeImage } from '../ui/image.js';
import { dbGet, dbPut, dbDel } from '../store/db.js';
import { libNoteBlock } from './exercise-notes.js';
import { personalRecords, mergeRecords, bestSummary } from '../domain/prs.js';

const custom = () => S.exercisesCustom || (S.exercisesCustom = []);
const tags = () => (S.profile.limitations && S.profile.limitations.tags) || [];
const muscleNames = list => (list || []).map(m => MUSCLES[m]).filter(Boolean).join(', ');
const lines = s => String(s || '').split('\n').map(l => l.trim()).filter(Boolean);

/* ---------- Bilder ---------- */
/* Eigene Fotos liegen in IndexedDB. Die Anzeige holt sie einmal und setzt die Adresse direkt ins Bild, ohne neu zu zeichnen. */
const urls = new Map();
const none = new Set();
const loading = new Set();

function customImageUrl(id) {
  if (urls.has(id)) return urls.get(id);
  if (none.has(id) || loading.has(id)) return null;
  loading.add(id);
  dbGet('exerciseImages', id)
    .then(rec => {
      if (!rec || !rec.blob) { none.add(id); return; }
      const u = URL.createObjectURL(rec.blob);
      urls.set(id, u);
      document.querySelectorAll('img[data-libimg]').forEach(img => {
        if (img.dataset.libimg === id) { img.src = u; img.hidden = false; }
      });
    })
    .catch(() => none.add(id))
    .finally(() => loading.delete(id));
  return null;
}

function forgetImage(id) {
  if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
  urls.delete(id);
  none.delete(id);
}

/* Nach einem Backup-Import oder „Alle Daten löschen“ gelten die gemerkten Bildadressen nicht mehr */
export function resetImageCache() {
  urls.forEach(u => URL.revokeObjectURL(u));
  urls.clear();
  none.clear();
}

/* Bild einer Übung mit kleiner Scheibe als Platzhalter dahinter */
export function exImage(e, cls) {
  const ph = `<span class="lib-ph">${plateSVG('steel', '', '', { small: true })}</span>`;
  let img = '';
  if (e && e.custom && e.image) {
    const u = customImageUrl(e.id);
    img = `<img alt="" data-libimg="${esc(e.id)}" ${u ? `src="${u}"` : 'hidden'}>`;
  } else if (e && e.image) {
    img = `<img alt="" src="${esc(e.image)}" loading="lazy" onerror="this.remove()">`;
  }
  return `<span class="${cls}">${ph}${img}</span>`;
}

/* ---------- Liste ---------- */
const myGear = () => (S.profile && Array.isArray(S.profile.equipment) ? S.profile.equipment : []);
const nOf = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* Was die Liste zeigt (4.7). Standard: nur Übungen, die mit den eigenen Geräten gehen (leere Auswahl: alle).
   V.libAll schaltet auf alle um. Liefert { base, shown, hidden, mine, gear }: base nach Muskel und Gerät gefiltert,
   shown davon sichtbar, hidden die wegen der Geräte ausgeblendeten. */
export function libraryView(list, { muscle = null, equipment = null, all = false, have = myGear() } = {}) {
  const base = searchExercises(list, { muscle, equipment });
  const gear = have.length > 0;
  const mine = gear && !all;
  const ok = doable(have);
  const shown = mine ? base.filter(ok) : base;
  return { base, shown, hidden: mine ? base.filter(e => !ok(e)) : [], mine, gear };
}

/* Zeile unter dem Schalter und Text, wenn die Suche nichts zeigt. n: sichtbare Treffer, h: ausgeblendete Treffer */
const hiddenLine = (mine, h) => (!mine ? 'Aus: auch Übungen für andere Geräte' : h ? `${nOf(h, 'Übung', 'Übungen')} ausgeblendet` : 'Keine Übung ausgeblendet');
const noneText = h => (h
  ? `Mit deinen Geräten nichts gefunden. ${h === 1 ? 'Ein Treffer braucht' : `${h} Treffer brauchen`} andere Geräte.`
  : 'Keine Übung gefunden. Du kannst sie als eigene Übung anlegen.');

/* Gerätefilter, nach Gruppen geordnet; Smart-Zirkel am Ende */
function equipOptions(list) {
  const ids = equipmentOf(list);
  const groups = EQUIPMENT_GROUPS.map(g => [g.name, ids.filter(id => (equipmentById(id) || {}).group === g.id)])
    .concat([['Zusatz', ids.filter(id => id === SMART_CIRCUIT.id)]])
    .filter(([, l]) => l.length);
  return groups.map(([name, l]) => `<optgroup label="${esc(name)}">${l.map(eq =>
    `<option value="${esc(eq)}" ${V.libEquip === eq ? 'selected' : ''}>${esc(equipmentName(eq))}</option>`).join('')}</optgroup>`).join('');
}

export function vLibrary() {
  const list = allExercises(custom());
  const q = V.libQ || '';
  const lv = libraryView(list, { muscle: V.libMuscle || null, equipment: V.libEquip || null, all: !!V.libAll });
  const visible = lv.shown.filter(e => matchesQuery(e, q)).length;
  const hiddenHits = lv.hidden.filter(e => matchesQuery(e, q)).length;
  const t = tags();
  const credited = list.some(e => e.credit);
  return `<div class="lib">
    ${clashCard()}
    <label class="field lib-search"><span class="vh">Übung suchen</span>
      <input type="search" data-in="libq" value="${esc(q)}" placeholder="Übung suchen, z. B. Rudern" autocomplete="off" enterkeyhint="search"></label>
    <div class="chips lib-muscles" role="group" aria-label="Muskelgruppe">
      <button class="chip ${V.libMuscle ? '' : 'on'}" aria-pressed="${!V.libMuscle}" data-act="libmuscle" data-v="">Alle</button>
      ${Object.entries(MUSCLES).map(([k, l]) =>
        `<button class="chip ${V.libMuscle === k ? 'on' : ''}" aria-pressed="${V.libMuscle === k}" data-act="libmuscle" data-v="${k}">${esc(l)}</button>`).join('')}
    </div>
    <label class="field">Gerät
      <select data-in="libequip">
        <option value="">Alle Geräte</option>
        ${equipOptions(list)}
      </select></label>
    ${lv.gear ? `<button class="cmp-switch lib-mine" role="switch" aria-checked="${lv.mine}" data-act="libmine">
      <span class="gear-t"><b>Nur meine Geräte</b><small class="lib-hid">${esc(hiddenLine(lv.mine, hiddenHits))}</small></span><i aria-hidden="true"></i></button>`
    : '<p class="small-print lib-gearnote">Alle Übungen. Deine Geräte wählst du unter Profil · Einstellungen · Studio.</p>'}
    <p class="small-print lib-count" aria-live="polite">${nOf(visible, 'Übung', 'Übungen')}</p>
    <ul class="lib-list">${lv.shown.map(e => libItem(e, t, q, lv.gear && !lv.mine)).join('')}</ul>
    <div class="empty lib-none" ${visible ? 'hidden' : ''}><span class="lib-none-t">${esc(noneText(lv.mine ? hiddenHits : 0))}</span>
      <button class="link lib-none-all" data-act="libmine" ${lv.mine && hiddenHits ? '' : 'hidden'}>Alle Übungen zeigen</button></div>
    <div class="stack"><button class="btn" data-act="libnew">Eigene Übung anlegen</button></div>
    ${credited ? '<p class="small-print" style="margin-top:14px">Übungsbilder von wger.de unter CC BY-SA 3.0 und 4.0, verkleinert und weiß hinterlegt. Urheber und Lizenz stehen in den Details jeder Übung.</p>' : ''}
  </div>`;
}

/* Einmal nach dem Update auf 4.7: eigene Übungen, die heißen wie eine Übung der Bibliothek (domain/library.js,
   nameClashes). Die App ändert nichts; ein Tipp auf einen Namen öffnet die eigene Übung zum Bearbeiten oder Löschen.
   „Verstanden“ merkt sich die genannten Übungen in S.settings.nameClashSeen. */
const clashesOpen = () => nameClashes(custom()).filter(c => !(S.settings.nameClashSeen || []).includes(c.custom.id));
const andList = l => (l.length > 1 ? `${l.slice(0, -1).join(', ')} und ${l[l.length - 1]}` : l.join(''));
export function clashCard() {
  const list = clashesOpen();
  if (!list.length) return '';
  return `<section class="card notice lib-clash" aria-labelledby="lib-clash-h">
    <h2 id="lib-clash-h">Gleiche Namen</h2>
    <p>${list.length === 1 ? 'Diese eigene Übung heißt' : 'Diese eigenen Übungen heißen'} wie Übungen der Bibliothek: ${esc(andList(list.map(c => c.custom.name)))}. Du kannst sie behalten oder löschen und die aus der Bibliothek nehmen.</p>
    <div class="chips">${list.map(c => `<button class="chip" data-act="libshow" data-id="${esc(c.custom.id)}">${esc(c.custom.name)}</button>`).join('')}</div>
    <div class="sug-btns"><button class="btn small" data-act="libclashok">Verstanden</button></div>
  </section>`;
}

/* withMiss: bei abgeschaltetem Filter nennt jede Übung, was ihr an Geräten fehlt */
function libItem(e, t, q, withMiss = false) {
  const hits = limitationHits(e, t);
  const prim = muscleNames(e.muscles && e.muscles.primary);
  const miss = withMiss ? missingText(e, myGear()) : '';
  return `<li data-libid="${esc(e.id)}" ${matchesQuery(e, q) ? '' : 'hidden'}>
    <button class="lib-item" data-act="libshow" data-id="${esc(e.id)}">
      ${exImage(e, 'lib-thumb')}
      <span class="lib-txt"><b>${esc(e.name)}</b>
        <span>${esc(prim || 'Muskeln nicht angegeben')}${e.custom ? ', eigene Übung' : ''}</span>
        ${miss ? `<span class="lib-miss">fehlt: ${esc(miss)}</span>` : ''}
        ${hits.length ? `<span class="lib-warn">Belastet ${esc(hits.join(', '))}</span>` : ''}</span>
    </button></li>`;
}

/* ---------- Details ---------- */
/* Bestwert aus dem Verlauf (4.6): alle Einträge, deren Name zu dieser Übung gehört, auch aus anderen Plänen */
function bestBlock(e) {
  const recs = [...personalRecords(S.sessions).values()].filter(r => {
    const hit = findExercise(r.name, custom());
    return hit && hit.id === e.id;
  });
  const m = mergeRecords(recs);
  const b = bestSummary(m);
  /* Smart-Zirkel, bisher nur Sätze mit anderer Methode als „Regulär“ */
  if (!b && e.autoLoad && m && m.count) {
    return `<div class="lib-best"><span class="best-k">Dein Bestwert</span>
      <p>Bestwert nur aus regulären Sätzen</p>
      <small>${m.count} ${m.count === 1 ? 'Training' : 'Trainings'}, bisher mit anderen Methoden</small></div>`;
  }
  if (!b) return '';
  return `<div class="lib-best">
    <span class="best-k">Dein Bestwert</span>
    <p>${b.items.map(it => `${it.label ? esc(it.label) + ' ' : ''}<b class="num">${esc(it.text)}</b>`).join(' · ')}</p>
    <small>am ${esc(dShort(b.date))}, ${m.count} ${m.count === 1 ? 'Training' : 'Trainings'}${b.items.some(it => it.kind === 'e1rm') ? ', 1RM geschätzt nach Epley' : ''}</small>
  </div>`;
}

/* Smart-Zirkel: ein Satz zur Methode, im Übungs-Sheet der Bibliothek und über „Anleitung“ im Training */
export const smartNote = () => `<p class="lib-smart">Das Gerät stellt das Gewicht ein. Die Methode (${esc(Object.values(SET_METHODS).join(', '))}) wählst du im Training an der Übungskarte; Rekorde zählen nur aus „Regulär“.</p>`;

export function showExercise(id) {
  const e = findExercise(id, custom());
  if (!e) return;
  const t = tags();
  const hits = limitationHits(e, t);
  const safe = safeAlternatives(e, custom(), t);
  const alts = (e.alternatives || []).map(a => findExercise(a, custom())).filter(Boolean);
  const altChips = list => `<div class="chips">${list.map(a =>
    `<button class="chip" data-act="libshow" data-id="${esc(a.id)}">${esc(a.name)}</button>`).join('')}</div>`;
  const sec = muscleNames(e.muscles && e.muscles.secondary);
  const miss = missingText(e, myGear());
  const c = e.credit;
  const body = `<div class="lib-detail">
    ${exImage(e, 'lib-hero')}
    ${bestBlock(e)}
    ${hits.length ? `<div class="lib-limit">
      <b>Belastet ${esc(hits.join(' und '))}</b>
      <span>${hits.length === 1 ? 'Diese Einschränkung steht' : 'Diese Einschränkungen stehen'} in deinem Profil. ${safe.length
        ? 'Schonender sind diese Übungen:'
        : 'Eine schonendere Alternative kennt die App hier nicht. Sprich die Übung mit einem Trainer oder Arzt ab.'}</span>
      ${safe.length ? altChips(safe) : ''}
    </div>` : ''}
    <dl class="lib-facts">
      <div><dt>Hauptsächlich</dt><dd>${esc(muscleNames(e.muscles && e.muscles.primary) || 'Nicht angegeben')}</dd></div>
      ${sec ? `<div><dt>Mit dabei</dt><dd>${esc(sec)}</dd></div>` : ''}
      <div><dt>Geräte</dt><dd>${esc(requirementText(e.equipment) || 'Keine')}${miss ? `<br><span class="lib-miss">fehlt dir: ${esc(miss)}</span>` : ''}</dd></div>
      <div><dt>Art</dt><dd>${e.type === 'compound' ? 'Grundübung' : 'Isolationsübung'}${e.unit === 'sec' ? ', auf Zeit' : ''}</dd></div>
    </dl>
    ${e.autoLoad ? smartNote() : ''}
    ${libNoteBlock(e)}
    ${e.steps && e.steps.length ? `<h3>So geht’s</h3><ol class="lib-steps">${e.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    ${e.mistakes && e.mistakes.length ? `<h3>Typische Fehler</h3><ul class="lib-mistakes">${e.mistakes.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
    ${!hits.length && alts.length ? `<h3>Ähnliche Übungen</h3>${altChips(alts)}` : ''}
    ${c ? `<p class="small-print lib-credit">Bild: ${esc(c.author || 'wger.de')}${c.license
      ? `, ${c.licenseUrl ? `<a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener">${esc(c.license)}</a>` : esc(c.license)}` : ''}, verkleinert und weiß hinterlegt${c.url
      ? `. <a href="${esc(c.url)}" target="_blank" rel="noopener">Quelle: wger.de</a>` : ''}</p>` : ''}
    ${e.custom ? '<p class="small-print lib-credit">Eigene Übung.</p>' : ''}
  </div>`;
  const actions = [];
  if (e.custom) actions.push({ label: 'Bearbeiten', kind: '', fn: () => editCustom(e.id) });
  actions.push({ label: 'Schließen', kind: 'ghost', fn: closeSheet });
  openSheet({ title: e.name, body, actions });
}

/* Knopf „Anleitung“ auf einer Übungskarte im Training. name: Name der Übung im Plan. */
export function infoButton(name) {
  const e = findExercise(name, custom());
  if (!e) return '';
  return `<button class="link lib-info" data-act="libshow" data-id="${esc(e.id)}">Anleitung</button>`;
}

/* ---------- Eigene Übungen ---------- */
/* Geräte im Entwurf (4.7): eqIds angehakt, eqMode 'all' (alle nötig) oder 'any' (eines genügt).
   Mischt die gespeicherte Anforderung beides (z. B. aus den Kategorien bis 4.6), bleibt sie als eqKeep erhalten,
   bis man an den Geräten etwas ändert. eqOpen: aufgeklappte Gruppen. */
function gearDraft(req) {
  const r = splitRequirement(req);
  const eqOpen = {};
  r.ids.forEach(id => { const q = equipmentById(id); if (q && q.group) eqOpen[q.group] = true; });
  return { eqIds: r.ids, eqMode: r.mode, eqKeep: r.simple ? null : requirementTerms(req), eqOpen };
}

/* Anforderung, die der Entwurf speichert */
export const draftRequirement = d => (d.eqKeep ? d.eqKeep : buildRequirement(d.eqIds, d.eqMode));

function draftFrom(e) {
  if (!e) {
    return {
      id: 'c' + uid(), isNew: true, name: '', primary: [], secondary: [], ...gearDraft([]), type: 'isolation', unit: 'reps',
      steps: '', mistakes: '', hasImage: false, blob: null, preview: null, removeImage: false,
    };
  }
  return {
    id: e.id, isNew: false, oldName: e.name, name: e.name,
    primary: [...((e.muscles && e.muscles.primary) || [])], secondary: [...((e.muscles && e.muscles.secondary) || [])],
    ...gearDraft(e.equipment || []), type: e.type || 'isolation', unit: e.unit || 'reps',
    steps: (e.steps || []).join('\n'), mistakes: (e.mistakes || []).join('\n'),
    hasImage: !!e.image, blob: null, preview: null, removeImage: false,
  };
}

/* Geräte im Editor: Schalter alle nötig / eines genügt, Gruppen zum Abhaken, Smart-Zirkel, darunter der Klartext */
function gearPicker(d) {
  const box = (q, label = q.name) => {
    const on = d.eqIds.includes(q.id);
    return `<button class="gear-item ${on ? 'on' : ''}" role="checkbox" aria-checked="${on}" data-act="libdeq" data-v="${esc(q.id)}">
      <i class="gear-box" aria-hidden="true"></i><span class="gear-t"><b>${esc(label)}</b></span></button>`;
  };
  const req = draftRequirement(d);
  const text = requirementText(req);
  return `<div><p class="label">Geräte</p>
    <div class="seg wide" role="radiogroup" aria-label="Wie viele der Geräte">
      <button role="radio" aria-checked="${d.eqMode !== 'any'}" class="${d.eqMode !== 'any' ? 'on' : ''}" data-act="libdeqmode" data-v="all">Alle nötig</button>
      <button role="radio" aria-checked="${d.eqMode === 'any'}" class="${d.eqMode === 'any' ? 'on' : ''}" data-act="libdeqmode" data-v="any">Eines genügt</button></div>
    <div class="gear-groups">${EQUIPMENT_GROUPS.map(g => {
      const n = groupEquipment(g.id).filter(q => d.eqIds.includes(q.id)).length;
      return `<details class="gear-group" ${d.eqOpen[g.id] ? 'open' : ''}>
        <summary data-act="libdeqgrp" data-g="${esc(g.id)}"><span class="gear-gn">${esc(g.name)}</span><span class="gear-cnt num ${n ? 'on' : ''}">${n}/${groupEquipment(g.id).length}</span></summary>
        <div class="gear-items">${groupEquipment(g.id).map(q => box(q)).join('')}</div></details>`;
    }).join('')}
      <div class="gear-items gear-smartrow">${box(SMART_CIRCUIT, SMART_CIRCUIT.name)}</div></div>
    <p class="small-print gear-req">${d.eqKeep
      ? `Bisher: <b>${esc(text)}</b>. Sobald du hier etwas änderst, gilt die neue Auswahl.`
      : text ? `Braucht: <b>${esc(text)}</b>` : 'Kein Gerät angehakt: eine Übung mit Körpergewicht.'}</p></div>`;
}

function editorForm(d) {
  const chip = (act, list, v, label, on) =>
    `<button class="chip ${on ? 'on' : ''}" aria-pressed="${on}" data-act="${act}" data-list="${list}" data-v="${esc(v)}">${esc(label)}</button>`;
  const photo = d.preview || (d.hasImage && !d.removeImage ? customImageUrl(d.id) : null);
  const showPhoto = !!(d.preview || (d.hasImage && !d.removeImage));
  return `<div class="form lib-form">
    <label>Name<input data-in="libdname" value="${esc(d.name)}" maxlength="40" placeholder="z. B. Kabelrudern einarmig" autocomplete="off"></label>
    <div><p class="label">Hauptsächlich trainiert</p><div class="chips">${Object.entries(MUSCLES).map(([k, l]) =>
      chip('libdmus', 'primary', k, l, d.primary.includes(k))).join('')}</div></div>
    <div><p class="label">Mit dabei (optional)</p><div class="chips">${Object.entries(MUSCLES).filter(([k]) => !d.primary.includes(k)).map(([k, l]) =>
      chip('libdmus', 'secondary', k, l, d.secondary.includes(k))).join('')}</div></div>
    ${gearPicker(d)}
    <div class="row2">
      <div><p class="label">Art</p><div class="seg wide">
        <button class="${d.type === 'compound' ? 'on' : ''}" data-act="libdtype" data-v="compound">Grundübung</button>
        <button class="${d.type !== 'compound' ? 'on' : ''}" data-act="libdtype" data-v="isolation">Isolation</button></div></div>
      <div><p class="label">Gezählt in</p><div class="seg wide">
        <button class="${d.unit !== 'sec' ? 'on' : ''}" data-act="libdunit" data-v="reps">Wdh.</button>
        <button class="${d.unit === 'sec' ? 'on' : ''}" data-act="libdunit" data-v="sec">Sek.</button></div></div>
    </div>
    <label class="field">Schritte (optional, eine Zeile pro Schritt)<textarea data-in="libdsteps" maxlength="800">${esc(d.steps)}</textarea></label>
    <label class="field">Typische Fehler (optional, eine Zeile pro Fehler)<textarea data-in="libdmist" maxlength="600">${esc(d.mistakes)}</textarea></label>
    <div><p class="label">Foto (optional)</p>
      ${showPhoto ? `<span class="lib-hero lib-hero-sm"><span class="lib-ph">${plateSVG('steel', '', '', { small: true })}</span><img alt="Vorschau" ${photo ? `src="${photo}"` : 'hidden'} data-libimg="${d.preview ? '' : esc(d.id)}"></span>` : ''}
      <div class="sug-btns">
        <button class="btn small" data-act="libdpick">${showPhoto ? 'Anderes Foto' : 'Foto wählen'}</button>
        ${showPhoto ? '<button class="btn small ghost" data-act="libdnophoto">Foto entfernen</button>' : ''}
      </div>
      <input type="file" id="libPhoto" accept="image/*" data-in="libdphoto" hidden>
    </div>
  </div>`;
}

/* Sheet neu zeichnen, ohne dass es nach oben springt oder erneut hereinfährt */
function openEditor() {
  const d = V.libDraft;
  const old = document.querySelector('.sheet');
  const top = old ? old.scrollTop : 0;
  const actions = [{ label: d.isNew ? 'Übung anlegen' : 'Änderungen speichern', kind: 'primary', fn: saveDraft }];
  if (!d.isNew) actions.push({ label: 'Übung löschen', kind: 'danger', fn: deleteCustom });
  actions.push({ label: 'Abbrechen', kind: 'ghost', fn: cancelDraft });
  openSheet({ title: d.isNew ? 'Eigene Übung' : 'Übung bearbeiten', body: editorForm(d), actions });
  const sh = document.querySelector('.sheet');
  if (old && sh) {
    sh.style.animation = 'none';
    const back = document.querySelector('.sheet-back');
    if (back) back.style.animation = 'none';
    sh.scrollTop = top;
  }
}

function dropPreview() {
  const d = V.libDraft;
  if (d && d.preview) { URL.revokeObjectURL(d.preview); d.preview = null; }
}

function cancelDraft() { dropPreview(); V.libDraft = null; closeSheet(); }

export function editCustom(id) {
  const e = id ? custom().find(x => x.id === id) : null;
  V.libDraft = draftFrom(e);
  openEditor();
}

function saveDraft() {
  const d = V.libDraft;
  const name = d.name.trim();
  if (!name) { toast('Gib der Übung einen Namen.'); return; }
  if (!d.primary.length) { toast('Wähle mindestens eine Muskelgruppe.'); return; }
  /* Unveränderter Name ist immer erlaubt, auch wenn die Bibliothek inzwischen so eine Übung kennt (4.7) */
  const clash = findExercise(name, custom());
  if (clash && clash.id !== d.id && d.oldName !== name) { toast('Eine Übung mit diesem Namen gibt es schon.'); return; }
  const keepImage = !!d.blob || (d.hasImage && !d.removeImage);
  const equipment = draftRequirement(d);
  const e = {
    id: d.id, name, aliases: [], type: d.type, unit: d.unit,
    muscles: { primary: d.primary, secondary: d.secondary.filter(m => !d.primary.includes(m)) },
    equipment, steps: lines(d.steps), mistakes: lines(d.mistakes),
    stresses: [], alternatives: [], image: keepImage ? 'idb' : null, credit: null, media: null, custom: true,
    /* Braucht die Übung den Smart-Zirkel, stellt das Gerät das Gewicht ein */
    autoLoad: requirementTerms(equipment).includes(SMART_CIRCUIT.id) ? 'smart' : null,
  };
  const list = custom();
  const i = list.findIndex(x => x.id === d.id);
  if (i >= 0) list[i] = e; else list.push(e);
  /* Umbenannt: Pläne, die die Übung unter dem alten Namen führen, ziehen mit */
  if (d.oldName && d.oldName !== name) {
    S.plans.forEach(p => Object.values(p.days).forEach(day => day.exercises.forEach(x => {
      x.names = x.names.map(n => (n === d.oldName ? name : n));
    })));
  }
  save();
  const done = msg => { dropPreview(); V.libDraft = null; closeSheet(); toast(msg); };
  const msg = d.isNew ? 'Übung angelegt' : 'Änderungen gespeichert';
  if (d.blob) {
    dbPut('exerciseImages', { id: d.id, blob: d.blob })
      .then(() => { forgetImage(d.id); done(msg); })
      .catch(() => done('Übung gespeichert, das Foto aber nicht. Der Speicher ist vielleicht voll.'));
  } else if (d.hasImage && d.removeImage) {
    dbDel('exerciseImages', d.id).catch(() => {}).finally(() => { forgetImage(d.id); done(msg); });
  } else {
    done(msg);
  }
}

function deleteCustom() {
  const d = V.libDraft;
  confirmSheet(`${d.oldName} löschen?`, 'Die Übung verschwindet aus der Bibliothek. Pläne und Verlauf behalten ihren Namen.', 'Übung löschen', () => {
    S.exercisesCustom = custom().filter(x => x.id !== d.id);
    save();
    dbDel('exerciseImages', d.id).catch(() => {});
    forgetImage(d.id);
    dropPreview();
    V.libDraft = null;
    closeSheet();
    toast('Übung gelöscht');
  });
}

/* ---------- Aktionen ---------- */
const toggle = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); };

export const actions = {
  libshow: el => showExercise(el.dataset.id),
  libmuscle: el => { V.libMuscle = el.dataset.v || null; render(); },
  /* „Nur meine Geräte“ an oder aus (4.7); gilt bis zum Neuladen */
  libmine: () => { V.libAll = !V.libAll; render(); },
  libnew: () => editCustom(null),
  libclashok: () => {
    S.settings.nameClashSeen = [...new Set([...(S.settings.nameClashSeen || []), ...clashesOpen().map(c => c.custom.id)])];
    save(); render();
  },
  libdmus: el => {
    const d = V.libDraft;
    toggle(d[el.dataset.list], el.dataset.v);
    if (el.dataset.list === 'primary') d.secondary = d.secondary.filter(m => !d.primary.includes(m));
    openEditor();
  },
  libdeq: el => { const d = V.libDraft; toggle(d.eqIds, el.dataset.v); d.eqKeep = null; openEditor(); },
  libdeqmode: el => { const d = V.libDraft; d.eqMode = el.dataset.v === 'any' ? 'any' : 'all'; d.eqKeep = null; openEditor(); },
  /* Merkt sich aufgeklappte Gruppen; das Auf- und Zuklappen selbst macht der Browser */
  libdeqgrp: el => {
    const d = V.libDraft;
    if (!d) return;
    const det = el.closest('details');
    d.eqOpen[el.dataset.g] = det ? !det.open : !d.eqOpen[el.dataset.g];
  },
  libdtype: el => { V.libDraft.type = el.dataset.v; openEditor(); },
  libdunit: el => { V.libDraft.unit = el.dataset.v; openEditor(); },
  libdpick: () => { const inp = document.getElementById('libPhoto'); if (inp) inp.click(); },
  libdnophoto: () => { dropPreview(); const d = V.libDraft; d.blob = null; d.removeImage = true; openEditor(); },
};

export const inputs = {
  libq: el => {
    V.libQ = el.value;
    let n = 0;
    document.querySelectorAll('.lib-list li[data-libid]').forEach(li => {
      const hit = matchesQuery(findExercise(li.dataset.libid, custom()) || { name: '' }, el.value);
      li.hidden = !hit;
      if (hit) n++;
    });
    /* Treffer unter den wegen der Geräte ausgeblendeten Übungen */
    const lv = libraryView(allExercises(custom()), { muscle: V.libMuscle || null, equipment: V.libEquip || null, all: !!V.libAll });
    const h = lv.mine ? lv.hidden.filter(e => matchesQuery(e, el.value)).length : 0;
    const none = document.querySelector('.lib-none');
    if (none) {
      none.hidden = n > 0;
      const t = none.querySelector('.lib-none-t');
      if (t) t.textContent = noneText(h);
      const all = none.querySelector('.lib-none-all');
      if (all) all.hidden = !h;
    }
    const hid = document.querySelector('.lib-hid');
    if (hid) hid.textContent = hiddenLine(lv.mine, h);
    const count = document.querySelector('.lib-count');
    if (count) count.textContent = nOf(n, 'Übung', 'Übungen');
  },
  libequip: (el, type) => { if (type === 'change') { V.libEquip = el.value || null; render(); } },
  libdname: el => { if (V.libDraft) V.libDraft.name = el.value; },
  libdsteps: el => { if (V.libDraft) V.libDraft.steps = el.value; },
  libdmist: el => { if (V.libDraft) V.libDraft.mistakes = el.value; },
  libdphoto: (el, type) => {
    if (type !== 'change' || !V.libDraft) return;
    const f = el.files && el.files[0];
    if (!f) return;
    resizeImage(f, 1080)
      .then(blob => {
        const d = V.libDraft;
        if (!d) return;
        dropPreview();
        d.blob = blob;
        d.preview = URL.createObjectURL(blob);
        d.removeImage = false;
        openEditor();
      })
      .catch(err => toast(err.message || 'Das Foto ließ sich nicht laden.'));
  },
};
