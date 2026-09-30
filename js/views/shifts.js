/* Schichtplan als eigene Seite: Einrichtung (Vorlage oder eigenes Muster), Monatskalender mit Einzeländerungen,
   Import aus einer Kalender-Datei, die nächsten 2 Wochen mit Übernahme in den iPhone-Kalender, Zeiten.
   Geöffnet über data-act="shiftopen" von „Heute“, aus dem Training-Tab und aus den Einstellungen; app.js zeigt die Seite,
   solange V.shiftView gesetzt ist. */
import { S, V, save } from '../state.js';
import { esc, ymd, dShort } from '../util.js';
import { render } from '../render.js';
import { toast } from '../ui/toast.js';
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';
import { fDays } from './profile-fields.js';
import {
  TEMPLATE_28, PATTERN_MIN, PATTERN_MAX, SHIFT_CODES, SHIFT_LABEL, SHIFT_SHORT, WORK,
  shiftClass, hasShiftPlan, shiftOn, baseShift, setOverride, shiftDays, defaultShifts,
  timesText, isYmd, isTime, addDays, dayNum, weekdayOf, localMs, toMin,
} from '../domain/shifts.js';
import { shiftsFromIcs } from '../domain/ics-parse.js';
import { trainingsIcs, ICS_FILE, ALARM_MINUTES } from '../domain/ics-write.js';
import { MAX_PER_WEEK } from '../domain/shift-plan.js';
import { planFor, twoWeeks, nextTwoWeeks, shiftBadge, dayLong, dayShort, shiftText, trainingLine, sessionsByDay } from './shift-today.js';

const SUBS = [['calendar', 'Kalender'], ['plan', '2 Wochen'], ['settings', 'Einstellungen']];
const CHIP_LABEL = { F: 'Früh', S: 'Spät', N: 'Nacht', '-': 'Frei', U: 'Urlaub' };
const CYCLE = { F: 'S', S: 'N', N: '-', '-': 'F', U: 'F' };
/* Geplante Trainings zeigt der Kalender bis so weit im Voraus */
const HORIZON_DAYS = 120;
const CHEV = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const LEFT = CHEV('M15 6l-6 6 6 6');
const RIGHT = CHEV('M9 6l6 6-6 6');
const pad = n => String(n).padStart(2, '0');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const ddmm = d => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
/* Satzende ohne doppelten Punkt nach einem Datum wie „05.11.“ */
const endDot = s => (s.endsWith('.') ? s : s + '.');

/* „vom 01.10. bis 31.01.“, mit Jahr, wenn der Zeitraum nicht im laufenden Jahr liegt */
export function rangeText(from, to, year = ymd().slice(0, 4)) {
  const withYear = from.slice(0, 4) !== year || to.slice(0, 4) !== year;
  const f = d => (withYear ? `${ddmm(d)}${d.slice(0, 4)}` : ddmm(d));
  return `vom ${f(from)} bis ${f(to)}`;
}

export function importSummary(info) {
  const n = info.shifts;
  const u = info.unknown;
  return `${n} ${n === 1 ? 'Schicht' : 'Schichten'} ${rangeText(info.from, info.to)} übernommen${u ? `, ${u} ${u === 1 ? 'Termin' : 'Termine'} nicht erkannt` : ''}`;
}

/* ---------- Seite ---------- */
export function view() {
  const on = hasShiftPlan(S.shifts);
  const sub = !on || V.shiftView === 'setup' ? 'setup' : SUBS.some(s => s[0] === V.shiftView) ? V.shiftView : 'calendar';
  const body = sub === 'setup' ? vSetup(on) : sub === 'plan' ? vPlan() : sub === 'settings' ? vSettings() : vCalendar();
  return `<div class="day-blue sh-page">
    <div class="sh-top"><button class="link" data-act="shiftclose">Zurück</button></div>
    <h1 class="page-title">Schichtplan</h1>
    ${sub === 'setup' ? '' : `<div class="seg wide sh-seg" role="tablist" aria-label="Schichtplan">${SUBS.map(([k, l]) =>
      `<button role="tab" aria-selected="${sub === k}" class="${sub === k ? 'on' : ''}" data-act="shiftsub" data-sub="${k}">${l}</button>`).join('')}</div>`}
    ${body}
  </div>`;
}

/* ---------- Einrichtung ---------- */
function draft() {
  if (!V.shiftDraft) {
    const p = S.shifts.pattern;
    const isTpl = p && p.template === TEMPLATE_28.id && p.days.join('') === TEMPLATE_28.days.join('');
    V.shiftDraft = p
      ? { mode: isTpl ? 'template' : 'custom', start: p.start, days: [...p.days] }
      : { mode: 'template', start: '', days: [...TEMPLATE_28.days] };
  }
  return V.shiftDraft;
}

function vTemplate() {
  return `<p class="muted sh-hint">${esc(TEMPLATE_28.name)} in drei Blöcken. Tag 1 ist der erste Frühdienst von Block 1.</p>
    <div class="sh-blocks">${TEMPLATE_28.blocks.map((b, i) => `<div class="sh-block">
      <span class="small-print">Block ${i + 1}</span>
      <div class="sh-pills">${[...b].map(c => shiftBadge(c)).join('')}</div></div>`).join('')}</div>`;
}

function vCustom(d) {
  const n = d.days.length;
  return `<p class="muted sh-hint">Tippe auf einen Tag, um zwischen Früh, Spät, Nacht und frei zu wechseln.</p>
    <div class="sh-len"><span class="label" style="margin:0">Länge</span>
      <div class="stepper">
        <button class="icon" data-act="shiftlen" data-d="-7" aria-label="Eine Woche kürzer" ${n - 7 < PATTERN_MIN ? 'disabled' : ''}>−7</button>
        <button class="icon" data-act="shiftlen" data-d="-1" aria-label="Einen Tag kürzer" ${n <= PATTERN_MIN ? 'disabled' : ''}>−</button>
        <b class="num" aria-live="polite">${n}</b>
        <button class="icon" data-act="shiftlen" data-d="1" aria-label="Einen Tag länger" ${n >= PATTERN_MAX ? 'disabled' : ''}>+</button>
        <button class="icon" data-act="shiftlen" data-d="7" aria-label="Eine Woche länger" ${n + 7 > PATTERN_MAX ? 'disabled' : ''}>+7</button>
      </div></div>
    <div class="sh-cells">${d.days.map((c, i) => `<button class="sh-cell ${shiftClass(c)}" data-act="shiftcell" data-i="${i}"
      aria-label="Tag ${i + 1}: ${esc(CHIP_LABEL[c])}"><small>${i + 1}</small><b>${esc(SHIFT_SHORT[c])}</b></button>`).join('')}</div>
    <button class="link" data-act="shiftfromtpl">Vorlage „${esc(TEMPLATE_28.name)}“ übernehmen</button>`;
}

function preview(d) {
  if (!isYmd(d.start)) return '<p class="small-print sh-hint">Wähle den Starttag, dann siehst du hier die nächsten zwei Wochen.</p>';
  const today = ymd();
  const list = shiftDays({ pattern: { start: d.start, days: d.days } }, today, 14);
  return `<p class="label" style="margin-top:16px">So sehen die nächsten zwei Wochen aus</p>
    <div class="sh-preview">${list.map(x => `<div class="sh-pv ${x.date === today ? 'today' : ''}">
      <small>${esc(dayShort(x.date).replace(',', ''))}</small>${shiftBadge(x.code)}</div>`).join('')}</div>`;
}

function vSetup(on) {
  const d = draft();
  const tpl = d.mode === 'template';
  const ok = isYmd(d.start) && d.days.some(c => WORK.includes(c));
  return `<p class="page-sub">Trag deinen Schichtplan ein. Die App plant daraus, an welchen Tagen und zu welcher Uhrzeit du am besten trainierst.</p>
    <section class="block card sh-setup">
      <h2>Muster</h2>
      <div class="seg wide sh-seg" role="group" aria-label="Art des Musters">
        <button class="${tpl ? 'on' : ''}" aria-pressed="${tpl}" data-act="shiftmode" data-v="template">Vorlage 28 Tage</button>
        <button class="${tpl ? '' : 'on'}" aria-pressed="${!tpl}" data-act="shiftmode" data-v="custom">Eigenes Muster</button>
      </div>
      ${tpl ? vTemplate() : vCustom(d)}
      <label class="field sh-start">${tpl ? 'Erster Frühdienst von Block 1' : 'Tag 1 des Musters'}
        <input type="date" data-in="shiftstart" value="${esc(d.start)}"></label>
      <p class="small-print" style="margin-top:6px">Ein Tag in der Vergangenheit ist richtig, wenn der Block schon läuft.</p>
      ${preview(d)}
      <div class="stack">
        <button class="btn primary" data-act="shiftsave" ${ok ? '' : 'disabled'}>Muster speichern</button>
        ${on ? '<button class="btn ghost" data-act="shiftsub" data-sub="settings">Abbrechen</button>' : ''}
      </div>
    </section>
    ${importSection()}`;
}

/* ---------- Import ---------- */
const fileButton = (label, kind = 'primary') => `<label class="btn ${kind}">${esc(label)}
  <input class="vh" type="file" accept=".ics,text/calendar" data-in="shiftfile"></label>`;

function importSection() {
  const info = S.shifts.importInfo;
  const im = V.shiftImport;
  return `<section class="block card sh-import">
    <h2>Aus dem Kalender importieren</h2>
    ${im ? vImport(im) : `<p class="muted">Nimm eine Kalender-Datei (.ics) mit deinen Schichten, z. B. den Export deines Arbeitskalenders aus Google Kalender. Die App liest sie nur auf diesem Handy und merkt sich pro Tag die Schichtart, keine Titel, Orte oder Notizen.</p>
    <ul class="rules sh-rules">
      <li>Google Kalender am Computer: <b>Einstellungen</b>, deinen Kalender wählen, <b>Kalender exportieren</b>. Die ZIP-Datei in der Dateien-App antippen, dann liegt die .ics daneben.</li>
      <li>Erkannt werden Titel wie Früh, Spät, Nacht (auch F, S, N, Frühschicht, Spätdienst) und Urlaub, sonst die Startzeit.</li>
      <li>Im Zeitraum des Imports gilt er vor dem Muster. Ein neuer Import ersetzt den alten.</li>
    </ul>
    ${info ? `<p class="small-print sh-last">${esc(importSummary(info))}${info.at ? ` (Import vom ${esc(dShort(info.at))})` : ''}</p>` : ''}
    <div class="stack">${fileButton(info ? 'Neue Datei importieren' : 'Kalender-Datei wählen', info ? '' : 'primary')}
      ${info ? '<button class="btn ghost" data-act="shiftimportdel">Import entfernen</button>' : ''}</div>`}
  </section>`;
}

function vImport(im) {
  if (im.error) {
    return `<p class="banner" role="alert">${esc(im.error)}</p>
      <div class="stack">${fileButton('Andere Datei wählen')}<button class="btn ghost" data-act="shiftimportdrop">Schließen</button></div>`;
  }
  const r = im.res;
  const parts = [['F', 'Früh'], ['S', 'Spät'], ['N', 'Nacht'], ['U', 'Urlaub']].filter(([k]) => r.byCode[k])
    .map(([k, l]) => `<li>${shiftBadge(k)}<span>${esc(l)}</span><span class="num">${r.byCode[k]} ${r.byCode[k] === 1 ? 'Tag' : 'Tage'}</span></li>`).join('');
  const unknown = r.unknown.slice(0, 6);
  const notes = [
    r.cancelled ? `${r.cancelled} abgesagte ${r.cancelled === 1 ? 'Termin' : 'Termine'} ausgelassen.` : '',
    r.unsupported ? `${r.unsupported === 1 ? 'Eine Serie wiederholt' : `${r.unsupported} Serien wiederholen`} sich monatlich oder jährlich; davon zählt nur der erste Termin.` : '',
    r.conflicts ? `An ${r.conflicts === 1 ? 'einem Tag' : `${r.conflicts} Tagen`} standen mehrere Termine; es zählt Urlaub, sonst die frühere Schicht.` : '',
  ].filter(Boolean);
  const any = !!r.from;
  return `<p class="muted">In <b>${esc(im.name)}</b> ${any ? `gefunden: <b>${r.shifts} ${r.shifts === 1 ? 'Schicht' : 'Schichten'}</b> ${esc(endDot(rangeText(r.from, r.to)))}` : 'ließ sich keine Schicht erkennen.'}</p>
    ${parts ? `<ul class="sh-sum">${parts}</ul>` : ''}
    ${unknown.length ? `<p class="label" style="margin-top:14px">${r.unknown.length} ${r.unknown.length === 1 ? 'Termin' : 'Termine'} nicht erkannt</p>
      <ul class="sh-unknown">${unknown.map(u => `<li><span>${esc(u.title)}</span><span class="num">${esc(ddmm(u.date))}${esc(u.date.slice(0, 4))}</span></li>`).join('')}
      ${r.unknown.length > unknown.length ? `<li class="muted">und ${r.unknown.length - unknown.length} weitere</li>` : ''}</ul>
      <p class="small-print">Diese Termine zählen nicht. Die Titel speichert die App nicht.</p>` : ''}
    ${notes.map(n => `<p class="small-print" style="margin-top:6px">${esc(n)}</p>`).join('')}
    <div class="stack">
      ${any ? '<button class="btn primary" data-act="shiftimportapply">Übernehmen</button>' : fileButton('Andere Datei wählen')}
      <button class="btn ghost" data-act="shiftimportdrop">Verwerfen</button>
    </div>`;
}

async function readIcs(file) {
  if (file.size > 20 * 1048576) {
    V.shiftImport = { name: file.name, error: 'Die Datei ist größer als 20 MB. Exportiere nur den Kalender mit deinen Schichten.' };
    render(); return;
  }
  try {
    const text = await file.text();
    const res = shiftsFromIcs(text, { times: S.shifts.times, until: addDays(ymd(), 400) });
    V.shiftImport = { name: file.name, res };
  } catch (e) {
    V.shiftImport = { name: file.name, error: e && e.message ? e.message : 'Die Datei ließ sich nicht lesen.' };
  }
  render();
}

/* ---------- Kalender ---------- */
function vCalendar() {
  const today = ymd();
  const month = /^\d{4}-\d{2}$/.test(V.shiftMonth || '') ? V.shiftMonth : today.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const n = new Date(y, m, 0).getDate();
  const last = `${month}-${pad(n)}`;
  const planned = new Map();
  const horizon = addDays(today, HORIZON_DAYS);
  if (last >= today && first <= horizon) {
    const until = last < horizon ? last : horizon;
    const p = planFor(today, dayNum(until) - dayNum(today) + 1);
    if (p) p.trainings.forEach(t => planned.set(t.date, t));
  }
  /* Das laufende Training steht unter heute (#59) */
  const byDay = sessionsByDay(k => k.startsWith(month));
  const cells = [];
  for (let i = 0; i < weekdayOf(first); i++) cells.push('<span class="cal-empty" aria-hidden="true"></span>');
  let shifts = 0;
  for (let d = 1; d <= n; d++) {
    const key = `${month}-${pad(d)}`;
    const { code, source } = shiftOn(S.shifts, key);
    if (WORK.includes(code)) shifts++;
    const t = planned.get(key);
    const done = byDay.get(key) || [];
    const dots = done.map(s => `<i class="sh-dot sh-trained day-${esc(s.color)}"></i>`).join('')
      + (t && !done.length ? `<i class="sh-dot sh-planned day-${esc(t.color)}"></i>` : '');
    const label = `${dayLong(key)}: ${shiftText(code) || 'keine Schicht eingetragen'}${source === 'override' ? ', von Hand geändert' : ''}`
      + `${done.length ? `, trainiert: ${done.map(s => s.name + (s.running ? ' (läuft)' : '')).join(', ')}` : t ? `, geplant: ${trainingLine(t)}` : ''}`;
    cells.push(`<button class="sh-day ${key === today ? 'today' : ''} ${key < today ? 'past' : ''}" data-act="shiftday" data-d="${key}" aria-label="${esc(label)}">
      <span class="num">${d}</span>${shiftBadge(code, source === 'override' ? 'ov' : '')}<span class="sh-dots">${dots}</span></button>`);
  }
  const trainings = [...planned.values()].filter(t => t.date.startsWith(month)).length;
  const sum = [`${shifts} ${shifts === 1 ? 'Schicht' : 'Schichten'}`, trainings ? `${trainings} ${trainings === 1 ? 'Training' : 'Trainings'} geplant` : ''].filter(Boolean).join(', ');
  const T = S.shifts.times;
  return `<section class="card cal sh-cal">
      <div class="cal-nav">
        <button class="icon" data-act="shiftmonth" data-d="-1" aria-label="Voriger Monat">${LEFT}</button>
        <div><h2>${esc(new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }))}</h2>
          <p class="small-print">${esc(sum)}</p></div>
        <button class="icon" data-act="shiftmonth" data-d="1" aria-label="Nächster Monat">${RIGHT}</button>
      </div>
      <div class="cal-grid sh-grid">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(w => `<span class="cal-wd" aria-hidden="true">${w}</span>`).join('')}${cells.join('')}</div>
    </section>
    <ul class="sh-legend">
      ${WORK.map(c => `<li>${shiftBadge(c)}<span>${esc(SHIFT_LABEL[c])} ${esc(timesText(T, c).replace(' Uhr', ''))}</span></li>`).join('')}
      <li>${shiftBadge('-')}<span>frei</span></li><li>${shiftBadge('U')}<span>Urlaub</span></li>
      <li><i class="sh-dot sh-planned day-steel"></i><span>geplant</span></li><li><i class="sh-dot sh-trained day-steel"></i><span>trainiert</span></li>
      <li>${shiftBadge('F', 'ov')}<span>von Hand</span></li>
    </ul>
    <p class="small-print cal-hint">Tippe auf einen Tag, um die Schicht zu ändern.${month > horizon.slice(0, 7) ? ` Trainings plant die App bis ${HORIZON_DAYS} Tage im Voraus.` : ''}</p>`;
}

function openDay(d) {
  const today = ymd();
  const { code, source } = shiftOn(S.shifts, d);
  const base = baseShift(S.shifts, d).code;
  let t = null;
  if (d >= today && dayNum(d) - dayNum(today) <= HORIZON_DAYS) {
    const p = planFor(today, Math.max(14, dayNum(d) - dayNum(today) + 1));
    t = p && p.trainings.find(x => x.date === d);
  }
  const done = sessionsByDay(k => k === d).get(d) || [];
  const src = { override: 'von Hand geändert', import: 'aus dem Kalender-Import', pattern: 'laut Muster' }[source];
  const now = shiftText(code);
  openSheet({
    title: cap(dayLong(d)),
    text: now ? `${cap(now)}${src ? `, ${src}` : ''}.` : 'Für diesen Tag ist keine Schicht eingetragen.',
    body: `<p class="label">Schicht für diesen Tag</p>
      <div class="chips sh-chips">${SHIFT_CODES.map(c => `<button class="chip sh-chip ${shiftClass(c)} ${code === c ? 'on' : ''}" aria-pressed="${code === c}"
        data-act="shiftset" data-d="${d}" data-v="${c}">${esc(CHIP_LABEL[c])}</button>`).join('')}</div>
      ${source === 'override' ? `<p class="small-print" style="margin-top:10px">Im Plan steht: ${esc(shiftText(base) || 'nichts')}.</p>` : ''}
      ${done.length ? `<p class="sh-sheet-train">Trainiert: <b>${esc(done.map(s => s.name + (s.running ? ' (läuft)' : '')).join(', '))}</b></p>`
        : t ? `<p class="sh-sheet-train">Geplant: <b>${esc(trainingLine(t))}</b></p>` : ''}`,
    actions: [
      ...(source === 'override' ? [{ label: 'Wie im Plan', kind: '', fn: () => setDay(d, null) }] : []),
      { label: 'Schließen', kind: 'ghost', fn: closeSheet },
    ],
  });
}

function setDay(d, code) {
  S.shifts.overrides = setOverride(S.shifts, d, code);
  V.sheet = null;
  save(); render();
  toast(`${dayShort(d)}: ${code ? CHIP_LABEL[code] : 'wie im Plan'}`);
}

/* ---------- Die nächsten 2 Wochen und Kalender-Datei ---------- */
/* Nur Trainings, die noch nicht begonnen haben, kommen in den Kalender */
const upcoming = (items, now = Date.now()) => items.filter(t => localMs(t.date, toMin(t.time)) > now);

function exportRow(mon, items) {
  const list = upcoming(items);
  if (!list.length) return '';
  const at = S.shifts.exported[mon];
  return `<div class="sh-export">
    <button class="btn small primary" data-act="shiftexport" data-w="${mon}">${list.length === 1 ? '1 Training' : `${list.length} Trainings`} in den Kalender</button>
    <p class="small-print">${at ? `Schon übernommen am ${esc(dShort(at))}. ` : ''}<button class="link" data-act="shiftexport" data-w="${mon}" data-file="1">Als Datei laden</button></p>
  </div>`;
}

function vPlan() {
  const p = twoWeeks();
  const over = S.profile.daysPerWeek > MAX_PER_WEEK;
  return `<p class="page-sub">Ziel: ${S.profile.daysPerWeek} ${S.profile.daysPerWeek === 1 ? 'Training' : 'Trainings'} pro Woche, mit mindestens einem Ruhetag dazwischen.</p>
    ${over ? `<p class="small-print" style="margin-top:6px">Mit einem Ruhetag zwischen zwei Trainings passen höchstens ${MAX_PER_WEEK} in eine Woche.</p>` : ''}
    <div class="sh-weeks">${p ? nextTwoWeeks(exportRow) : ''}</div>
    <section class="block card sh-note"><h2>In den iPhone-Kalender</h2>
      <ul class="rules sh-rules">
        <li>Der Knopf legt eine Kalender-Datei mit den Trainings der Woche an, jeweils mit Erinnerung ${ALARM_MINUTES} Minuten vorher.</li>
        <li>Im Teilen-Menü <b>Kalender</b> wählen, falls es angeboten wird. Sonst <b>In Dateien sichern</b>, die Datei in der Dateien-App öffnen und <b>Alle hinzufügen</b> tippen.</li>
        <li>Übernimm jede Woche nur einmal. Der iPhone-Kalender erkennt doppelte Termine aus Dateien nicht zuverlässig; ein zweites Übernehmen kann alles doppelt anlegen.</li>
        <li>Ändert sich der Plan, bleiben die übernommenen Termine im Kalender stehen. Lösch sie dort, bevor du die Woche neu übernimmst.</li>
      </ul>
    </section>`;
}

/* Muss direkt aus einem Tipp heraus laufen, sonst verweigert Safari das Teilen-Menü */
function deliverIcs(mon, asFile) {
  const p = twoWeeks();
  const items = p ? upcoming(p.trainings.filter(t => t.date >= mon && t.date <= addDays(mon, 6))) : [];
  if (!items.length) { toast('In dieser Woche ist kein Training geplant.'); return; }
  const text = trainingsIcs(items, { now: Date.now() });
  const done = () => { S.shifts.exported[mon] = Date.now(); save(); render(); };
  let file = null;
  try { file = new File([text], ICS_FILE, { type: 'text/calendar' }); } catch (e) { file = null; }
  if (!asFile && file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).then(done).catch(() => { /* abgebrochen */ });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url; a.download = ICS_FILE; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  done();
  toast('Kalender-Datei geladen');
}

/* ---------- Einstellungen ---------- */
function patternText(p) {
  const tpl = p.template === TEMPLATE_28.id && p.days.join('') === TEMPLATE_28.days.join('');
  const start = new Date(p.start + 'T12:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return tpl ? `Vorlage „${TEMPLATE_28.name}“, erster Frühdienst von Block 1 am ${start}.`
    : `Eigenes Muster mit ${p.days.length} Tagen, Tag 1 am ${start}.`;
}

const timeInput = (inp, k, i, v, label) =>
  `<input type="time" class="sh-time" data-in="${inp}" data-k="${k}" ${i != null ? `data-i="${i}"` : ''} value="${esc(v)}" aria-label="${esc(label)}">`;

function vSettings() {
  const sh = S.shifts;
  const ov = Object.keys(sh.overrides).length;
  return `<section class="block card"><h2>Muster</h2>
      <p class="muted">${esc(sh.pattern ? patternText(sh.pattern) : 'Kein Muster eingetragen. Außerhalb des Imports kennt die App deine Schichten nicht.')}</p>
      <div class="stack"><button class="btn" data-act="shiftedit">${sh.pattern ? 'Muster ändern' : 'Muster eintragen'}</button>
        ${sh.pattern ? '<button class="btn ghost" data-act="shiftpatdel">Muster entfernen</button>' : ''}</div>
    </section>
    ${importSection()}
    ${ov ? `<section class="block card"><h2>Einzeländerungen</h2>
      <p class="muted">${ov === 1 ? 'Ein Tag ist' : `${ov} Tage sind`} von Hand geändert. Sie gelten vor Import und Muster.</p>
      <div class="stack"><button class="btn ghost" data-act="shiftovclear">Alle Einzeländerungen entfernen</button></div></section>` : ''}
    <section class="block card"><h2>Schichtzeiten</h2>
      <div class="sh-times">${WORK.map(c => `<div class="sh-trow">${shiftBadge(c)}<span>${esc(SHIFT_LABEL[c])}</span>
        ${timeInput('shifttime', c, 0, sh.times[c][0], `${SHIFT_LABEL[c]}: Beginn`)}<span class="muted">bis</span>${timeInput('shifttime', c, 1, sh.times[c][1], `${SHIFT_LABEL[c]}: Ende`)}</div>`).join('')}</div>
    </section>
    <section class="block card"><h2>Bevorzugte Trainingszeit</h2>
      <div class="sh-times">${[['-', 'Frei, Urlaub'], ['F', 'Früh'], ['S', 'Spät'], ['N', 'Nacht']].map(([c, l]) => `<div class="sh-trow pref">${shiftBadge(c)}<span>${esc(l)}</span>
        ${timeInput('shiftpref', c, null, sh.prefer[c], `Trainingszeit ${l}`)}</div>`).join('')}</div>
      <p class="label" style="margin-top:14px">Die App verschiebt die Zeit, wenn sie nicht passt</p>
      <ul class="rules sh-rules">
        <li>Nach der Frühschicht frühestens eine Stunde nach Schichtende.</li>
        <li>Vor der Spätschicht Ende mindestens 90 Minuten vor Schichtbeginn.</li>
        <li>Vor der Nachtschicht mindestens 3 Stunden bis Schichtbeginn.</li>
        <li>Am Tag nach einer Nachtschicht nicht vor 14 Uhr.</li>
        <li>Zwischen zwei Trainings mindestens ein Ruhetag; jede Muskelgruppe hat 48 Stunden Pause.</li>
        <li>Bei der Tagwahl zählt zuerst das Wochenziel, dann frei vor Früh vor Spät vor Nacht.</li>
      </ul>
    </section>
    <section class="block card"><h2>Trainings pro Woche</h2>${fDays(S.profile)}
      ${S.profile.daysPerWeek > MAX_PER_WEEK ? `<p class="small-print" style="margin-top:8px">Mit einem Ruhetag dazwischen plant die App höchstens ${MAX_PER_WEEK} Trainings pro Woche.</p>` : ''}</section>
    <section class="block"><button class="btn danger" data-act="shiftwipe">Schichtplan löschen</button></section>`;
}

/* ---------- Aktionen ---------- */
const top = () => window.scrollTo(0, 0);

export const actions = {
  shiftopen: el => {
    V.shiftView = el.dataset.sub || 'calendar';
    V.shiftMonth = null; V.shiftDraft = null; V.shiftImport = null;
    render(); top();
  },
  shiftclose: () => { V.shiftView = null; V.shiftImport = null; V.shiftDraft = null; render(); top(); },
  shiftsub: el => { V.shiftView = el.dataset.sub; V.shiftDraft = null; V.shiftImport = null; render(); },
  shiftmonth: el => {
    const cur = /^\d{4}-\d{2}$/.test(V.shiftMonth || '') ? V.shiftMonth : ymd().slice(0, 7);
    const [y, m] = cur.split('-').map(Number);
    const d = new Date(y, m - 1 + Number(el.dataset.d), 1);
    V.shiftMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    render();
  },
  shiftday: el => openDay(el.dataset.d),
  shiftset: el => setDay(el.dataset.d, el.dataset.v),

  shiftmode: el => {
    const d = draft();
    d.mode = el.dataset.v === 'custom' ? 'custom' : 'template';
    if (d.mode === 'template') d.days = [...TEMPLATE_28.days];
    render();
  },
  shiftcell: el => { const d = draft(); const i = Number(el.dataset.i); d.days[i] = CYCLE[d.days[i]] || 'F'; render(); },
  shiftlen: el => {
    const d = draft();
    const n = Math.max(PATTERN_MIN, Math.min(PATTERN_MAX, d.days.length + Number(el.dataset.d)));
    d.days = n > d.days.length ? [...d.days, ...Array(n - d.days.length).fill('-')] : d.days.slice(0, n);
    render();
  },
  shiftfromtpl: () => { draft().days = [...TEMPLATE_28.days]; render(); },
  shiftsave: () => {
    const d = draft();
    if (!isYmd(d.start)) { toast('Wähle den Starttag'); return; }
    if (!d.days.some(c => WORK.includes(c))) { toast('Das Muster braucht mindestens eine Schicht'); return; }
    const tpl = d.mode === 'template' && d.days.join('') === TEMPLATE_28.days.join('');
    S.shifts.pattern = { start: d.start, days: [...d.days], template: tpl ? TEMPLATE_28.id : null };
    V.shiftDraft = null; V.shiftView = 'calendar'; V.shiftMonth = null;
    save(); render(); top(); toast('Schichtplan gespeichert');
  },
  shiftedit: () => { V.shiftDraft = null; V.shiftView = 'setup'; render(); top(); },
  shiftpatdel: () => confirmSheet('Muster entfernen?', 'Außerhalb eines Imports kennt die App deine Schichten dann nicht mehr. Einzeländerungen bleiben.', 'Muster entfernen', () => {
    S.shifts.pattern = null; V.sheet = null; save(); render(); toast('Muster entfernt');
  }),

  shiftimportapply: () => {
    const r = V.shiftImport && V.shiftImport.res;
    if (!r || !r.from) return;
    S.shifts.imported = { ...r.days };
    S.shifts.importInfo = { at: Date.now(), from: r.from, to: r.to, shifts: r.shifts, unknown: r.unknown.length };
    V.shiftImport = null; V.shiftView = 'calendar'; V.shiftMonth = null;
    save(); render(); top(); toast(importSummary(S.shifts.importInfo));
  },
  shiftimportdrop: () => { V.shiftImport = null; render(); },
  shiftimportdel: () => confirmSheet('Import entfernen?', 'Die importierten Schichten werden gelöscht. Wo ein Muster eingetragen ist, gilt wieder das Muster.', 'Import entfernen', () => {
    S.shifts.imported = {}; S.shifts.importInfo = null; V.sheet = null; save(); render(); toast('Import entfernt');
  }),
  shiftovclear: () => confirmSheet('Einzeländerungen entfernen?', 'Alle von Hand gesetzten Tage folgen wieder Import und Muster.', 'Entfernen', () => {
    S.shifts.overrides = {}; V.sheet = null; save(); render(); toast('Einzeländerungen entfernt');
  }),
  shiftwipe: () => confirmSheet('Schichtplan löschen?', 'Muster, Import, Einzeländerungen und Zeiten werden gelöscht. Deine Trainings bleiben.', 'Schichtplan löschen', () => {
    S.shifts = defaultShifts(); V.sheet = null; V.shiftView = 'setup'; V.shiftDraft = null;
    save(); render(); top(); toast('Schichtplan gelöscht');
  }),

  shiftexport: el => {
    const mon = el.dataset.w;
    const asFile = !!el.dataset.file;
    const at = S.shifts.exported[mon];
    if (at && !asFile) {
      confirmSheet('Schon übernommen', `Diese Woche hast du am ${dShort(at)} schon in den Kalender übernommen. Ein zweites Mal legt die Termine womöglich doppelt an. Lösch die alten Termine vorher im Kalender.`,
        'Trotzdem übernehmen', () => { V.sheet = null; deliverIcs(mon, false); render(); }, 'primary');
      return;
    }
    deliverIcs(mon, asFile);
  },
};

export const inputs = {
  shiftstart: (el, type) => { if (type !== 'change') return; draft().start = el.value; render(); },
  shiftfile: (el, type) => {
    if (type !== 'change') return;
    const f = el.files && el.files[0];
    el.value = '';
    if (f) readIcs(f);
  },
  shifttime: (el, type) => {
    if (type !== 'change') return;
    if (!isTime(el.value)) { toast('Uhrzeit wie 06:00 eintragen'); return; }
    S.shifts.times[el.dataset.k][Number(el.dataset.i)] = el.value;
    save(); render();
  },
  shiftpref: (el, type) => {
    if (type !== 'change') return;
    if (!isTime(el.value)) { toast('Uhrzeit wie 11:00 eintragen'); return; }
    S.shifts.prefer[el.dataset.k] = el.value;
    save(); render();
  },
};
