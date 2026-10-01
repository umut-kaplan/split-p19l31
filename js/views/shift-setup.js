/* Einrichtung des Schichtplans: Vorlage oder eigenes Muster wählen, eigenes Muster in Wochenzeilen bearbeiten,
   dann im Muster antippen, welcher Tag heute ist. Ist das nicht eindeutig, fragt die App nach den nächsten Tagen
   oder zeigt die passenden Kandidaten mit Vorschau (domain/shift-entry.js). Teil der Seite aus views/shifts.js.

   V.shiftDraft: { step: 'choose' | 'edit' | 'today', tpl, days, pick, answers, list, chosen, brush, clip }
   tpl ist die id der Vorlage oder Variante (null bei eigenem Muster), pick der angetippte Tag, chosen ein
   ausgewählter Kandidat, brush die Schichtart zum Eintragen, clip eine kopierte Woche. */
import { S, V, save } from '../state.js';
import { esc, ymd } from '../util.js';
import { render } from '../render.js';
import { toast } from '../ui/toast.js';
import { openSheet, closeSheet } from '../ui/sheet.js';
import {
  PATTERN_MIN, PATTERN_MAX, DEFAULT_TYPES, TYPE_TIMES, typesOf, typeOf, isWork, isTimedCat, shortOf, shiftClass,
  shiftDays, fmtTimes, patternIndex, addDays, weekdayOf,
} from '../domain/shifts.js';
import { TEMPLATES, TEMPLATE_GROUPS, templateById, templateOf } from '../domain/shift-templates.js';
import { entryState, sameDays, startFor, weekIndex, importFit, previewTwins } from '../domain/shift-entry.js';
import { shiftBadge, dayShort, dayLong, dateText } from './shift-today.js';

const nameOf = c => { const t = typeOf(S.shifts, c); return t ? t.name : 'ohne Angabe'; };
const top = () => window.scrollTo(0, 0);

/* ---------- Entwurf ---------- */
export function draft() {
  if (!V.shiftDraft) {
    const p = S.shifts.pattern;
    const t = p ? templateOf(p) : null;
    const today = ymd();
    /* Ein vorhandenes Muster öffnet mit dem heutigen Tag, ohne Rückfrage */
    V.shiftDraft = p
      ? { step: 'today', tpl: t ? t.id : null, days: [...p.days], pick: patternIndex(p, today), answers: [], list: false, chosen: patternIndex(p, today) }
      : { step: 'choose', tpl: null, days: [], pick: null, answers: [], list: false, chosen: null };
  }
  const d = V.shiftDraft;
  if (!d.brush || !typeOf(S.shifts, d.brush)) d.brush = (typesOf(S.shifts).find(t => isWork(S.shifts, t.id)) || typesOf(S.shifts)[0]).id;
  return d;
}

const tplOf = d => (d.tpl ? templateById(d.tpl) : null);
/* Mo–Fr-Vorlagen: jede Zeile ist eine Woche ab Montag */
const weekly = d => { const t = tplOf(d); return !!(t && t.weekStart && t.days.join('') === d.days.join('')); };

/* Tag des Musters für heute oder null, solange er nicht feststeht */
export function resolvedIndex(d) {
  if (d.pick == null) return null;
  if (d.chosen != null) return d.chosen;
  if (weekly(d)) return d.pick;
  return entryState(d.days, d.pick, d.answers).index;
}

/* ---------- Bausteine ---------- */
const strip = days => `<span class="sh-strip" aria-hidden="true">${days.map(c => `<i class="${shiftClass(S.shifts, c)}"></i>`).join('')}</span>`;
const timesLine = times => Object.entries(times).map(([c, t]) => `${nameOf(c)} ${fmtTimes(t).replace(' Uhr', '')}`).join(', ') + ' Uhr';

/* Muster in Zeilen zu 7 Tagen. cls(i) liefert die Klasse je Tag, row(r) den Kopf einer Zeile, pressed(i) macht die
   Tage zu Umschaltknöpfen mit aria-pressed. */
function grid(days, { act, cls = () => '', row, pressed = null }) {
  const rows = [];
  for (let r = 0; r * 7 < days.length; r++) {
    const cells = days.slice(r * 7, r * 7 + 7).map((c, k) => {
      const i = r * 7 + k;
      return `<button class="sh-cell ${shiftClass(S.shifts, c)} ${cls(i)}" data-act="${act}" data-i="${i}"${pressed ? ` aria-pressed="${pressed(i)}"` : ''}
        aria-label="Tag ${i + 1}: ${esc(nameOf(c))}"><small>${i + 1}</small><b>${esc(shortOf(S.shifts, c))}</b></button>`;
    }).join('');
    rows.push(`<div class="sh-wrow">${row ? row(r) : ''}<div class="sh-cells">${cells}</div></div>`);
  }
  return `<div class="sh-rows">${rows.join('')}</div>`;
}

/* Die nächsten zwei Wochen mit einem Starttag, optional kompakt. Kompakt stehen nur Wochentag und Tag in zwei Zeilen,
   sonst stoßen die Daten bei 320 px Breite aneinander. */
const miniDay = d => `${esc(dateText(d, { weekday: 'short' }))}<br>${Number(d.slice(8))}.`;
function preview(days, start, small = false) {
  const today = ymd();
  const list = shiftDays({ ...S.shifts, pattern: { start, days }, importInfo: null, overrides: {} }, today, 14);
  return `<div class="sh-preview ${small ? 'mini' : ''}">${list.map(x => `<div class="sh-pv ${x.date === today ? 'today' : ''}">
    <small>${small ? miniDay(x.date) : esc(dayShort(x.date).replace(',', ''))}</small>${shiftBadge(x.code)}</div>`).join('')}</div>`;
}

/* ---------- Schritt 1: Vorlage wählen ---------- */
function vChoose() {
  const groups = TEMPLATE_GROUPS.map(([g, label]) => `<p class="label sh-glabel">${esc(label)}</p>
    <div class="choices">${TEMPLATES.filter(t => t.group === g).map(t => `<button class="choice sh-tpl" data-act="shifttpl" data-id="${t.id}">
      <b>${esc(t.name)}</b><span>${esc(t.desc)}</span>${strip(t.days.split(''))}
      <small>${esc(t.where)}. ${esc(timesLine(t.times))}</small></button>`).join('')}</div>`).join('');
  return `<section class="block sh-choose">
      <h2>Welches Modell hast du?</h2>
      <p class="muted">Wähle das Muster, nach dem du arbeitest. Danach tippst du an, welcher Tag heute ist.</p>
      ${groups}
      <p class="label sh-glabel">Kein festes Muster</p>
      <div class="choices"><button class="choice" data-act="shiftown">
        <b>Eigenes Muster</b><span>Du trägst die Tage selbst ein, Woche für Woche, bis zu 53 Wochen lang.</span></button></div>
      <p class="small-print sh-hint">In der Pflege, im Handel und in vielen Kliniken gibt es meist kein festes Muster. Dann importiere deinen Dienstplan unten als Kalender-Datei oder trag ein eigenes Muster ein.</p>
    </section>`;
}

/* ---------- Schritt 2: eigenes Muster bearbeiten ---------- */
function vEdit(d) {
  const n = d.days.length;
  const types = typesOf(S.shifts);
  const ok = d.days.some(c => isWork(S.shifts, c));
  const step = (delta, label, text, off) => `<button class="icon" data-act="shiftlen" data-d="${delta}" aria-label="${label}" ${off ? 'disabled' : ''}>${text}</button>`;
  return `<section class="block card sh-setup">
      <h2>Eigenes Muster</h2>
      <p class="muted sh-hint">Wähle eine Schichtart und tippe auf die Tage. Jede Zeile hat 7 Tage.</p>
      <div class="chips sh-brush" role="group" aria-label="Schichtart zum Eintragen">${types.map(t => `<button class="chip sh-chip ${shiftClass(S.shifts, t.id)} ${d.brush === t.id ? 'on' : ''}"
        aria-pressed="${d.brush === t.id}" data-act="shiftbrush" data-v="${esc(t.id)}"><span class="sh-chip-k">${esc(t.short)}</span> ${esc(t.name)}</button>`).join('')}</div>
      <button class="link" data-act="shifttypenew" data-back="setup">Schichtart fehlt? Neue anlegen</button>
      <div class="sh-len"><span class="label" style="margin:0">Länge in Tagen</span>
        <div class="stepper">
          ${step(-7, 'Eine Woche kürzer', '−7', n - 7 < PATTERN_MIN)}${step(-1, 'Einen Tag kürzer', '−', n <= PATTERN_MIN)}
          <b class="num" aria-live="polite">${n}</b>
          ${step(1, 'Einen Tag länger', '+', n >= PATTERN_MAX)}${step(7, 'Eine Woche länger', '+7', n + 7 > PATTERN_MAX)}
        </div></div>
      ${grid(d.days, {
    act: 'shiftcell',
    row: r => `<div class="sh-whead"><span>Woche ${r + 1}</span>
          <button class="link" data-act="shiftwcopy" data-r="${r}">Kopieren</button>
          <button class="link" data-act="shiftwpaste" data-r="${r}" ${d.clip ? '' : 'disabled'}>Einfügen</button></div>`,
  })}
      ${d.clip ? `<button class="btn ghost sh-append" data-act="shiftwappend" ${n + d.clip.length > PATTERN_MAX ? 'disabled' : ''}>Kopierte Woche hinten anhängen</button>` : ''}
      <div class="stack">
        <button class="btn primary" data-act="shiftnext" ${ok ? '' : 'disabled'}>Weiter: heute wählen</button>
        ${ok ? '' : '<p class="small-print">Das Muster braucht mindestens eine Schicht.</p>'}
        <button class="btn ghost" data-act="shiftback">Zurück zur Auswahl</button>
      </div>
    </section>`;
}

/* ---------- Schritt 3: Welcher Tag ist heute? ---------- */
const whenText = (today, dd) => (dd === 1 ? 'morgen' : dd === 2 ? 'übermorgen' : `am ${dayLong(addDays(today, dd))}`);

function vVariants(t) {
  const base = TEMPLATES.find(x => x.id === t.base);
  if (!base || !base.variants) return '';
  const opts = [[base.id, base.option], ...base.variants.map(v => [v.id, v.label])];
  return `<div class="chips sh-variants" role="group" aria-label="Variante">${opts.map(([id, label]) => `<button class="chip ${t.id === id ? 'on' : ''}"
    aria-pressed="${t.id === id}" data-act="shiftvariant" data-id="${id}">${esc(label)}</button>`).join('')}</div>`;
}

function vFit(d, idx) {
  if (!S.shifts.importInfo) return '';
  const fit = importFit(d.days, S.shifts, ymd());
  if (!fit || fit.same / fit.total < 0.7) return '';
  if (idx === fit.index) return `<p class="small-print sh-fitnote">Passt zu deinem Import: ${fit.same} von ${fit.total} Tagen gleich.</p>`;
  return `<div class="sh-fit"><p>Dein Kalender-Import passt am besten, wenn heute <b>Tag ${fit.index + 1}</b> ist (${fit.same} von ${fit.total} Tagen gleich).</p>
    <button class="btn small" data-act="shiftfit" data-i="${fit.index}">So übernehmen</button></div>`;
}

function vAsk(d) {
  const today = ymd();
  const st = entryState(d.days, d.pick, d.answers);
  if (st.index != null) return '';
  const all = sameDays(d.days, d.pick).length;
  if (st.question && !d.list) {
    const q = st.question;
    const intro = d.answers.length ? `Noch ${st.cands.length} Möglichkeiten.` : `Diesen Tag gibt es ${all}-mal im Muster.`;
    return `<div class="sh-ask" role="group" aria-label="Rückfrage">
      <p><b>${esc(intro)}</b> Was hast du ${esc(whenText(today, q.d))}?</p>
      <div class="chips sh-chips">${q.options.map(c => `<button class="chip sh-chip ${shiftClass(S.shifts, c)}" data-act="shiftanswer" data-d="${q.d}" data-v="${esc(c)}">${esc(nameOf(c))}</button>`).join('')}</div>
      <button class="link" data-act="shiftcands">Weiß ich nicht, zeig mir die Möglichkeiten</button>
    </div>`;
  }
  /* Sehen zwei Vorschauen gleich aus, nennt die Karte den ersten Tag, an dem sie sich unterscheiden */
  const twins = previewTwins(d.days, st.cands, 14);
  const twin = j => {
    const dd = twins[j];
    if (dd == null) return '';
    const code = d.days[(j + dd) % d.days.length];
    return `<small class="sh-twin">Diese zwei Wochen sehen bei einer anderen Möglichkeit genauso aus. Der Unterschied kommt ${esc(whenText(today, dd))}: hier ${esc(nameOf(code))}.</small>`;
  };
  return `<div class="sh-ask">
    <p><b>Welche Vorschau passt zu deinen nächsten zwei Wochen?</b></p>
    <div class="choices">${st.cands.map(j => `<button class="choice sh-cand" data-act="shiftchoose" data-i="${j}">
      <b>Heute Tag ${j + 1} von ${d.days.length}</b>${preview(d.days, startFor(today, j), true)}${twin(j)}</button>`).join('')}</div>
  </div>`;
}

function vToday(d, on) {
  const today = ymd();
  const t = tplOf(d);
  const wk = weekly(d);
  const idx = resolvedIndex(d);
  const cands = d.pick != null && idx == null && !wk ? entryState(d.days, d.pick, d.answers).cands : [];
  const wd = weekdayOf(today);
  const cls = i => [
    i === idx ? 'pick' : '',
    idx == null && cands.includes(i) ? 'cand' : '',
    wk && i % 7 === wd ? 'col' : '',
  ].join(' ');
  const hint = wk
    ? 'Jede Zeile ist eine Woche von Montag bis Sonntag. Tippe auf die Woche, in der du gerade bist.'
    : 'Tippe auf den Tag im Muster, der heute bei dir dran ist. Hast du heute Urlaub oder bist krank, nimm den Tag, der laut Plan wäre.';
  return `<section class="block card sh-setup">
      <h2>${esc(t ? t.name : 'Eigenes Muster')}</h2>
      ${t ? `<p class="muted">${esc(t.desc)} ${esc(timesLine(t.times))}.</p>${vVariants(t)}` : `<p class="muted">${d.days.length} Tage.</p>`}
      <h3 class="sh-h3">Welcher Tag ist heute?</h3>
      <p class="muted sh-hint">${esc(hint)}</p>
      ${vFit(d, idx)}
      ${grid(d.days, { act: 'shiftpick', cls, pressed: i => i === idx, row: r => `<div class="sh-whead"><span>${wk ? `Woche ${r + 1}` : `Tag ${r * 7 + 1}–${Math.min(r * 7 + 7, d.days.length)}`}</span></div>` })}
      ${d.pick != null && idx == null ? vAsk(d) : ''}
      ${idx != null ? `<p class="sh-now"><b>Heute ist Tag ${idx + 1} von ${d.days.length}</b> (${esc(nameOf(d.days[idx]))}).</p>
        <p class="label" style="margin-top:12px">So sehen die nächsten zwei Wochen aus</p>${preview(d.days, startFor(today, idx))}` : ''}
      <div class="stack">
        <button class="btn primary" data-act="shiftsave" ${idx != null ? '' : 'disabled'}>Muster speichern</button>
        ${t ? '<button class="btn ghost" data-act="shiftcustomize">Muster anpassen</button>' : '<button class="btn ghost" data-act="shiftcustomize">Muster bearbeiten</button>'}
        <button class="btn ghost" data-act="shiftback">${t ? 'Andere Vorlage wählen' : 'Zurück zur Auswahl'}</button>
        ${on ? '<button class="link" data-act="shiftsub" data-sub="settings">Abbrechen</button>' : ''}
      </div>
    </section>`;
}

/* Einrichtung ohne den Import-Abschnitt; den hängt views/shifts.js an */
export function vSetup(on) {
  const d = draft();
  const head = '<p class="page-sub">Trag deinen Schichtplan ein. Die App plant daraus, an welchen Tagen und zu welcher Uhrzeit du am besten trainierst.</p>';
  if (d.step === 'edit') return head + vEdit(d);
  if (d.step === 'today' && d.days.length) return head + vToday(d, on);
  return head + vChoose();
}

/* ---------- Speichern ---------- */
/* Fehlende voreingestellte Arten einer Vorlage (vom Nutzer gelöscht) kommen mit ihren Standardzeiten zurück */
function ensureTypes(days) {
  [...new Set(days)].forEach(c => {
    if (typeOf(S.shifts, c)) return;
    const def = DEFAULT_TYPES.find(t => t.id === c);
    if (!def) return;
    S.shifts.types.push({ ...def });
    if (isTimedCat(def.cat)) S.shifts.times[c] = [...TYPE_TIMES[c]];
  });
}

function savePattern(keepTimes) {
  const d = draft();
  const idx = resolvedIndex(d);
  const t = tplOf(d);
  const tpl = t && t.days.join('') === d.days.join('') ? t : null;
  ensureTypes(d.days);
  if (tpl && !keepTimes) Object.entries(tpl.times).forEach(([c, tt]) => { if (typeOf(S.shifts, c)) S.shifts.times[c] = [...tt]; });
  S.shifts.pattern = { start: startFor(ymd(), idx), days: [...d.days], template: tpl ? tpl.id : null };
  V.shiftDraft = null; V.shiftView = 'calendar'; V.shiftMonth = null; V.sheet = null;
  save(); render(); top(); toast('Schichtplan gespeichert');
}

/* ---------- Aktionen ---------- */
const fresh = (d, extra) => Object.assign(d, { pick: null, answers: [], list: false, chosen: null }, extra);

export const actions = {
  shifttpl: el => {
    const t = templateById(el.dataset.id);
    if (!t) return;
    fresh(draft(), { step: 'today', tpl: t.id, days: [...t.days] });
    render(); top();
  },
  shiftvariant: el => {
    const t = templateById(el.dataset.id);
    if (t) { fresh(draft(), { tpl: t.id, days: [...t.days] }); render(); }
  },
  shiftown: () => {
    const d = draft();
    const p = S.shifts.pattern;
    const days = p && !templateOf(p) ? [...p.days] : Array(7).fill('-');
    fresh(d, { step: 'edit', tpl: null, days });
    render(); top();
  },
  shiftcustomize: () => { fresh(draft(), { step: 'edit', tpl: null }); render(); top(); },
  shiftback: () => { fresh(draft(), { step: 'choose', tpl: null }); render(); top(); },
  shiftnext: () => {
    const d = draft();
    if (!d.days.some(c => isWork(S.shifts, c))) { toast('Das Muster braucht mindestens eine Schicht'); return; }
    fresh(d, { step: 'today' });
    render(); top();
  },

  shiftbrush: el => { draft().brush = el.dataset.v; render(); },
  shiftcell: el => { const d = draft(); d.days[Number(el.dataset.i)] = d.brush; render(); },
  shiftlen: el => {
    const d = draft();
    const n = Math.max(PATTERN_MIN, Math.min(PATTERN_MAX, d.days.length + Number(el.dataset.d)));
    d.days = n > d.days.length ? [...d.days, ...Array(n - d.days.length).fill('-')] : d.days.slice(0, n);
    render();
  },
  shiftwcopy: el => {
    const d = draft();
    const r = Number(el.dataset.r);
    d.clip = d.days.slice(r * 7, r * 7 + 7);
    render(); toast(`Woche ${r + 1} kopiert`);
  },
  shiftwpaste: el => {
    const d = draft();
    const r = Number(el.dataset.r);
    if (!d.clip) return;
    d.clip.forEach((c, k) => { if (r * 7 + k < d.days.length) d.days[r * 7 + k] = c; });
    render(); toast(`In Woche ${r + 1} eingefügt`);
  },
  shiftwappend: () => {
    const d = draft();
    if (!d.clip || d.days.length + d.clip.length > PATTERN_MAX) return;
    d.days = [...d.days, ...d.clip];
    render();
  },

  shiftpick: el => {
    const d = draft();
    const i = Number(el.dataset.i);
    if (weekly(d)) fresh(d, { pick: weekIndex(d.days, Math.floor(i / 7), ymd()) });
    else fresh(d, { pick: i });
    render();
  },
  shiftanswer: el => { draft().answers.push({ d: Number(el.dataset.d), code: el.dataset.v }); render(); },
  shiftcands: () => { draft().list = true; render(); },
  shiftchoose: el => { const d = draft(); d.chosen = Number(el.dataset.i); render(); },
  shiftfit: el => { const i = Number(el.dataset.i); fresh(draft(), { pick: i, chosen: i }); render(); },

  shiftsave: () => {
    const d = draft();
    if (resolvedIndex(d) == null) { toast('Tippe an, welcher Tag heute ist'); return; }
    if (!d.days.some(c => isWork(S.shifts, c))) { toast('Das Muster braucht mindestens eine Schicht'); return; }
    const t = tplOf(d);
    const tpl = t && t.days.join('') === d.days.join('') ? t : null;
    /* Dieselbe Vorlage wie bisher, nur ein anderer Tag für heute: Zeiten bleiben, wie sie sind, ohne Rückfrage */
    const p = S.shifts.pattern;
    if (tpl && p && p.template === tpl.id) { savePattern(true); return; }
    /* Eigene Zeiten nur nach Rückfrage überschreiben. Eigen heißt: weder voreingestellt noch aus einer Vorlage. */
    const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
    const known = c => [TYPE_TIMES[c], ...TEMPLATES.map(x => x.times[c])];
    const own = tpl ? Object.entries(tpl.times).filter(([c, tt]) => {
      const cur = S.shifts.times[c];
      return cur && !same(cur, tt) && !known(c).some(k => same(cur, k));
    }) : [];
    if (!own.length) { savePattern(false); return; }
    const list = own.map(([c, tt]) => `${nameOf(c)} ${fmtTimes(tt)} (bei dir ${fmtTimes(S.shifts.times[c])})`).join(', ');
    openSheet({
      title: 'Deine Uhrzeiten behalten?',
      text: `Die Vorlage bringt eigene Uhrzeiten mit: ${list}.`,
      actions: [
        { label: 'Meine Zeiten behalten', kind: 'primary', fn: () => savePattern(true) },
        { label: 'Zeiten der Vorlage nehmen', kind: '', fn: () => savePattern(false) },
        { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
      ],
    });
  },
};
