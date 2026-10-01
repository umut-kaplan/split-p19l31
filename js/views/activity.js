/* Aktivität (Stufe 6): Schritte, Ruhepuls, Schlaf, Cardio, Kalorienverbrauch von Hand eintragen.
   Importierte Werte (source 'apple-health') stehen in denselben Listen und werden nie stillschweigend überschrieben. */
import { S, V, save } from '../state.js';
import { esc, fmt0, fmt1, toNum, ymd, dShort, dMid, uid, plural } from '../util.js';
import { render } from '../render.js';
import { currentWeight } from '../domain/body.js';
import { ACTIVITY, DEFAULT_ACTIVITY } from '../domain/energy.js';
import {
  CARDIO, cardioMet, cardioKcal, cardioKcalPerDay, STEP_BASELINE,
  upsertByDate, lastDays, parseHours, hoursLabel, inWindow,
} from '../domain/activity.js';
import { toast } from '../ui/toast.js';
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';

const SOURCE = { manual: 'eingetragen', 'apple-health': 'aus Apple Health' };
const sourceLabel = s => SOURCE[s] || (s ? `aus ${s}` : '');
const day = d => dShort(d + 'T12:00');
const longDay = d => dMid(d + 'T12:00');

/* Größen mit einem Wert pro Tag */
const KINDS = {
  steps: {
    title: 'Schritte', field: 'steps', unit: 'Schritte', mode: 'numeric', ph: 'z. B. 8500',
    min: 0, max: 100000, round: 0, show: v => fmt0(v), say: v => `${fmt0(v)} ${plural(fmt0(v), 'Schritt', 'Schritte')}`,
    hint: 'Pro Tag, zum Beispiel aus der Health-App. Heute zählt fürs Kalorienziel erst ab morgen, der Tag läuft noch.',
    error: 'Schritte als ganze Zahl eintragen, z. B. 8500',
  },
  sleep: {
    title: 'Schlaf', field: 'hours', unit: 'Stunden', mode: 'decimal', ph: 'z. B. 7:30 oder 7,5',
    min: 0.5, max: 16, show: v => hoursLabel(v), parse: parseHours,
    hint: 'Datum ist der Morgen, an dem die Nacht endet. Fließt in die Erholungsampel ein.',
    error: 'Schlaf in Stunden eintragen, z. B. 7:30 oder 7,5',
  },
  restingHr: {
    title: 'Ruhepuls', field: 'bpm', unit: 'Schläge pro Minute', mode: 'numeric', ph: 'z. B. 58',
    min: 30, max: 120, round: 0, show: v => `${fmt0(v)} /min`,
    hint: 'Morgens vor dem Aufstehen gemessen oder der Tageswert der Uhr. Ein erhöhter Ruhepuls fließt in die Erholungsampel ein.',
    error: 'Ruhepuls zwischen 30 und 120 eintragen',
  },
  burn: {
    title: 'Kalorienverbrauch', field: 'kcal', unit: 'kcal', mode: 'numeric', ph: 'z. B. 2900',
    min: 800, max: 8000, round: 0, show: v => `${fmt0(v)} kcal`,
    hint: 'Gesamtverbrauch eines ganzen Tages von einer Uhr. Die App zeigt ihn beim Kalorienziel nur zum Vergleich.',
    error: 'Tagesverbrauch zwischen 800 und 8000 kcal eintragen',
  },
};

/* Zustand anlegen, falls ein älterer Stand ihn noch nicht hat */
function A() {
  if (!S.activity) S.activity = {};
  ['steps', 'restingHr', 'sleep', 'cardio', 'burn'].forEach(k => { if (!Array.isArray(S.activity[k])) S.activity[k] = []; });
  return S.activity;
}

const weightNow = () => currentWeight(S.profile, S.body.weights);
const avg = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

/* ---------- Ansicht ---------- */
export function vActivity() {
  A();
  return `
    <p class="small-print act-intro">Hier kommt alles hin, was außerhalb deiner Kraft-Einheiten passiert. Schritte und Cardio fließen ins Kalorienziel, Schlaf und Ruhepuls in die Erholungsampel. Krafttraining zählt die App aus deinen Einheiten, das gehört nicht hierher.</p>
    ${kindCard('steps')}
    ${cardioCard()}
    ${kindCard('sleep')}
    ${kindCard('restingHr')}
    ${kindCard('burn')}`;
}

/* Kleine Balken der letzten 14 Tage mit optionaler Bezugslinie */
function bars(series, { ref = null, refLabel = '', label }) {
  const W = 320, H = 74, top = 6, bottom = 16, gap = 4;
  const vals = series.map(s => s.value).filter(v => v != null);
  const max = Math.max(ref || 0, ...vals, 1) * 1.1;
  const bw = (W - gap * (series.length - 1)) / series.length;
  const y = v => top + (H - top - bottom) * (1 - v / max);
  const last = series.length - 1;
  return `<svg class="act-bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    ${series.map((s, i) => {
      const x = (i * (bw + gap)).toFixed(1);
      if (s.value == null) return `<rect x="${x}" y="${H - bottom - 2}" width="${bw.toFixed(1)}" height="2" rx="1" fill="rgba(238,235,228,.12)"/>`;
      const yy = y(s.value);
      return `<rect x="${x}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2, H - bottom - yy).toFixed(1)}" rx="3" fill="var(--c)" fill-opacity="${i === last ? 1 : 0.55}"/>`;
    }).join('')}
    ${ref ? `<line x1="0" x2="${W}" y1="${y(ref).toFixed(1)}" y2="${y(ref).toFixed(1)}" stroke="#F2C230" stroke-width="1.5" stroke-dasharray="4 4"/>
      <text x="2" y="${(y(ref) - 4).toFixed(1)}" font-size="10" font-weight="700" fill="#F2C230" stroke="#272B30" stroke-width="3" paint-order="stroke">${esc(refLabel)}</text>` : ''}
    <text x="0" y="${H - 3}" font-size="10" fill="#6F7680">${esc(day(series[0].date))}</text>
    <text x="${W}" y="${H - 3}" font-size="10" fill="#6F7680" text-anchor="end">heute</text>
  </svg>`;
}

function kindCard(kind) {
  const k = KINDS[kind];
  const list = [...A()[kind]].sort((a, b) => (a.date < b.date ? 1 : -1));
  const today = ymd();
  const series = lastDays(list, k.field, today, 14);
  const week = inWindow(list, today, 7).map(e => e[k.field]).filter(v => v > 0);
  let ref = null, refLabel = '';
  if (kind === 'steps') {
    const actKey = ACTIVITY[S.profile.activity] ? S.profile.activity : DEFAULT_ACTIVITY;
    ref = STEP_BASELINE[actKey];
    refLabel = `Grundlinie ${fmt0(ref)}`;
  } else if (kind === 'sleep') { ref = 7; refLabel = '7 Stunden'; }
  const latest = list[0];
  return `<section class="block card act-card">
    <div class="act-head">
      <h2>${k.title}</h2>
      ${latest ? `<p class="act-now num">${esc(k.show(latest[k.field]))}<small>${esc(day(latest.date))}</small></p>` : ''}
    </div>
    ${list.length ? bars(series, { ref, refLabel, label: `${k.title} der letzten 14 Tage` })
      + (week.length ? `<p class="small-print">Schnitt der letzten 7 Tage: <b class="num">${esc(k.show(avg(week)))}</b> an ${week.length} ${week.length === 1 ? 'Tag' : 'Tagen'}</p>` : '')
      : `<p class="muted act-empty">${esc(k.hint)}</p>`}
    <div class="stack"><button class="btn" data-act="actadd" data-kind="${kind}">${k.title} eintragen</button></div>
    ${list.length ? `<details class="more"><summary>Einträge (${list.length})</summary>
      <ul class="b-list">${list.slice(0, 30).map(e => `<li>
        <button class="act-row" data-act="actadd" data-kind="${kind}" data-date="${e.date}" aria-label="${esc(k.title)} vom ${esc(day(e.date))} ändern">
          <span>${esc(longDay(e.date))} <small>${esc(sourceLabel(e.source))}</small></span>
          <b class="num">${esc(k.show(e[k.field]))}</b></button>
        <button class="icon b-del" data-act="actdel" data-kind="${kind}" data-date="${e.date}" aria-label="${esc(k.title)} vom ${esc(day(e.date))} löschen">×</button></li>`).join('')}</ul>
    </details>` : ''}
  </section>`;
}

function cardioCard() {
  const list = [...A().cardio].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const today = ymd();
  const week = cardioKcalPerDay(list, today);
  const series = lastDays(list, 'minutes', today, 14);
  return `<section class="block card act-card">
    <div class="act-head">
      <h2>Cardio</h2>
      ${week.count ? `<p class="act-now num">${fmt0(week.minutes)}<small>min in 7 Tagen</small></p>` : ''}
    </div>
    ${list.length ? bars(series, { label: 'Cardio-Minuten der letzten 14 Tage' })
      + `<p class="small-print">${week.count
        ? `Letzte 7 Tage: ${week.count} ${week.count === 1 ? 'Einheit' : 'Einheiten'}, ${fmt0(week.kcal)} kcal, also etwa ${fmt0(week.kcalPerDay)} kcal pro Tag fürs Kalorienziel.`
        : 'In den letzten 7 Tagen kein Cardio.'}</p>`
      : '<p class="muted act-empty">Laufen, Radfahren, Rudern und Co. Die App schätzt die kcal nach MET aus Art, Dauer und deinem Gewicht; du kannst den Wert ändern.</p>'}
    <div class="stack"><button class="btn" data-act="actcardio">Cardio eintragen</button></div>
    ${list.length ? `<details class="more" ${list.length <= 3 ? 'open' : ''}><summary>Einheiten (${list.length})</summary>
      <ul class="b-list">${list.slice(0, 30).map(c => `<li>
        <button class="act-row" data-act="actcardio" data-id="${esc(c.id)}" aria-label="Cardio vom ${esc(day(c.date))} ändern">
          <span>${esc(longDay(c.date))} <small>${esc((CARDIO[c.type] || CARDIO.other).label)}, ${fmt0(c.minutes)} min${c.km ? `, ${esc(fmt1(c.km))} km` : ''}, ${esc(sourceLabel(c.source))}</small></span>
          <b class="num">${c.kcal > 0 ? `${fmt0(c.kcal)} kcal` : ''}</b></button>
        <button class="icon b-del" data-act="actcdel" data-id="${esc(c.id)}" aria-label="Cardio vom ${esc(day(c.date))} löschen">×</button></li>`).join('')}</ul>
    </details>` : ''}
  </section>`;
}

/* ---------- Eintragen: ein Wert pro Tag ---------- */
function openKind(kind, date) {
  const k = KINDS[kind];
  const today = ymd();
  const existing = date ? A()[kind].find(e => e.date === date) : null;
  const val = existing ? existing[k.field] : null;
  const shown = val == null ? '' : kind === 'sleep' ? hoursLabel(val).replace(' h', '') : String(Math.round(val * 10) / 10).replace('.', ',');
  openSheet({
    title: existing ? `${k.title} ändern` : `${k.title} eintragen`,
    text: k.hint,
    body: `<div class="form">
      <label>Datum<input id="act-date" type="date" value="${esc(date || today)}" max="${today}"></label>
      <label>${esc(k.unit)}<input id="act-val" inputmode="${k.mode}" placeholder="${esc(k.ph)}" value="${esc(shown)}" autocomplete="off"></label>
      ${existing && existing.source !== 'manual' ? `<p class="help">Der bisherige Wert stammt ${esc(sourceLabel(existing.source))}.</p>` : ''}
    </div>`,
    actions: [
      { label: 'Speichern', kind: 'primary', fn: () => saveKind(kind) },
      { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
    ],
  });
  setTimeout(() => { const el = document.getElementById('act-val'); if (el && !existing) el.focus(); }, 60);
}

function saveKind(kind) {
  const k = KINDS[kind];
  const today = ymd();
  const date = document.getElementById('act-date').value || today;
  if (date > today) { toast('Das Datum liegt in der Zukunft.'); return; }
  const raw = document.getElementById('act-val').value;
  let v = k.parse ? k.parse(raw) : toNum(raw);
  if (!(v >= k.min && v <= k.max)) { toast(k.error); return; }
  if (k.round === 0) v = Math.round(v);
  else v = Math.round(v * 100) / 100;
  const entry = { date, [k.field]: v, source: 'manual' };
  const prev = A()[kind].find(e => e.date === date);
  const commit = () => {
    S.activity[kind] = upsertByDate(S.activity[kind], entry).list;
    save(); closeSheet(); toast(prev ? `${k.title} vom ${day(date)} ersetzt` : `${k.title} gespeichert`);
  };
  /* Importierte Werte nur nach Rückfrage ersetzen */
  if (prev && prev.source !== 'manual' && prev[k.field] !== v) {
    const say = k.say || k.show;
    confirmSheet(`Wert ${sourceLabel(prev.source)} ersetzen?`,
      `Für den ${day(date)} gibt es schon ${say(prev[k.field])} ${sourceLabel(prev.source)}. Dein Wert ${say(v)} ersetzt ihn.`,
      'Ersetzen', commit, 'primary');
    return;
  }
  commit();
}

/* ---------- Eintragen: Cardio ---------- */
function openCardio(id) {
  const today = ymd();
  const c = id ? A().cardio.find(x => x.id === id) : null;
  const type = c ? c.type : (V.actLastType || 'run');
  openSheet({
    title: c ? 'Cardio ändern' : 'Cardio eintragen',
    text: 'Die kcal schätzt die App nach MET aus Art, Dauer, beim Laufen auch aus dem Tempo, und deinem Gewicht. Hast du einen besseren Wert, trag ihn ein.',
    body: `<div class="form">
      <label>Art<select id="actc-type" data-in="actcest">${Object.entries(CARDIO).map(([k, t]) =>
        `<option value="${k}" ${k === type ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></label>
      <div class="row2">
        <label>Dauer in Minuten<input id="actc-min" data-in="actcest" inputmode="numeric" placeholder="z. B. 30" value="${c ? esc(c.minutes) : ''}"></label>
        <label>Distanz in km<input id="actc-km" data-in="actcest" inputmode="decimal" placeholder="optional" value="${c && c.km ? esc(String(c.km).replace('.', ',')) : ''}"></label>
      </div>
      <label>kcal<input id="actc-kcal" inputmode="numeric" placeholder="Schätzung" value="${c && c.kcal > 0 && c.kcalManual ? esc(c.kcal) : ''}"></label>
      <p class="help" id="actc-est" aria-live="polite">${esc(estimateText(type, c ? c.minutes : null, c ? c.km : null))}</p>
      <label>Datum<input id="actc-date" type="date" value="${esc(c ? c.date : today)}" max="${today}"></label>
    </div>`,
    actions: [
      { label: 'Speichern', kind: 'primary', fn: () => saveCardio(c) },
      { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
    ],
  });
}

function estimateText(type, minutes, km) {
  const kg = weightNow();
  if (!(minutes > 0)) return 'Mit der Dauer erscheint hier die Schätzung.';
  const { met, kmh } = cardioMet(type, minutes, km);
  const pace = (CARDIO[type] || {}).pace && kmh ? ` bei ${fmt1(kmh)} km/h` : '';
  if (!(kg > 0)) return `MET ${fmt1(met)}${pace}. Für eine Schätzung fehlt dein Gewicht; trag die kcal dann selbst ein.`;
  return `Schätzung: ${fmt0(cardioKcal({ type, minutes, km }, kg))} kcal (MET ${fmt1(met)}${pace}, ${fmt1(kg)} kg). Leer lassen, um sie zu übernehmen.`;
}

function readCardioForm() {
  const type = document.getElementById('actc-type').value;
  const minutes = toNum(document.getElementById('actc-min').value);
  const kmRaw = document.getElementById('actc-km').value.trim();
  const km = kmRaw ? toNum(kmRaw) : null;
  const kcalRaw = document.getElementById('actc-kcal').value.trim();
  const kcal = kcalRaw ? toNum(kcalRaw) : null;
  const date = document.getElementById('actc-date').value || ymd();
  return { type, minutes, km, kcal, date };
}

function saveCardio(prev) {
  const f = readCardioForm();
  if (!(f.minutes >= 1 && f.minutes <= 600)) { toast('Dauer in Minuten eintragen, 1 bis 600'); return; }
  if (f.km != null && !(f.km > 0 && f.km <= 300)) { toast('Distanz in km eintragen oder leer lassen'); return; }
  if (f.kcal != null && !(f.kcal >= 0 && f.kcal <= 5000)) { toast('kcal zwischen 0 und 5000 eintragen oder leer lassen'); return; }
  if (f.date > ymd()) { toast('Das Datum liegt in der Zukunft.'); return; }
  const est = cardioKcal(f, weightNow());
  if (f.kcal == null && est == null) { toast('Für die Schätzung fehlt dein Gewicht. Trag die kcal selbst ein.'); return; }
  const entry = {
    id: prev ? prev.id : 'c' + uid(), date: f.date, type: f.type, minutes: Math.round(f.minutes),
    km: f.km != null ? Math.round(f.km * 100) / 100 : null,
    kcal: Math.round(f.kcal != null ? f.kcal : est), kcalManual: f.kcal != null,
    source: prev ? prev.source : 'manual',
  };
  const list = A().cardio.filter(c => !prev || c.id !== prev.id).concat(entry);
  S.activity.cardio = list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  V.actLastType = f.type;
  save(); closeSheet(); toast(prev ? 'Cardio geändert' : 'Cardio gespeichert');
}

/* ---------- Aktionen ---------- */
export const actions = {
  actadd: el => openKind(el.dataset.kind, el.dataset.date || null),
  actdel: el => {
    const k = KINDS[el.dataset.kind];
    const e = A()[el.dataset.kind].find(x => x.date === el.dataset.date);
    if (!e) return;
    confirmSheet(`${k.title} löschen?`, `${(k.say || k.show)(e[k.field])} vom ${day(e.date)} ${sourceLabel(e.source)} wird gelöscht.`, 'Löschen', () => {
      S.activity[el.dataset.kind] = S.activity[el.dataset.kind].filter(x => x.date !== el.dataset.date);
      save(); closeSheet(); toast('Eintrag gelöscht');
    });
  },
  actcardio: el => openCardio(el.dataset.id || null),
  actcdel: el => {
    const c = A().cardio.find(x => x.id === el.dataset.id);
    if (!c) return;
    confirmSheet('Cardio löschen?', `${(CARDIO[c.type] || CARDIO.other).label} vom ${day(c.date)} mit ${fmt0(c.minutes)} ${plural(fmt0(c.minutes), 'Minute', 'Minuten')} wird gelöscht.`, 'Löschen', () => {
      S.activity.cardio = S.activity.cardio.filter(x => x.id !== c.id);
      save(); closeSheet(); toast('Cardio gelöscht');
    });
  },
};

/* Schätzung im Formular sofort nachführen, ohne neu zu zeichnen */
export const inputs = {
  actcest: () => {
    const out = document.getElementById('actc-est');
    if (!out) return;
    const f = readCardioForm();
    out.textContent = estimateText(f.type, f.minutes, f.km);
  },
};
