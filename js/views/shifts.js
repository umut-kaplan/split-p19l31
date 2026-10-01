/* Schichtplan als eigene Seite: Einrichtung (Vorlage oder eigenes Muster, views/shift-setup.js), Monatskalender mit
   Einzeländerungen samt Uhrzeit, Import aus einer Kalender-Datei (views/shift-import.js), die nächsten 2 Wochen mit
   Übernahme in den iPhone-Kalender, Schichtarten (views/shift-types.js) und Trainingszeiten.
   Geöffnet über data-act="shiftopen" von „Heute“ und aus dem Training-Tab (Reiter „Kalender“) und aus den Einstellungen
   (Reiter „Einstellungen“); app.js zeigt die Seite, solange V.shiftView gesetzt ist. „‹ Zurück“ geht wie die Wischgeste
   eine Ebene zurück (js/nav.js): aus Schichtart und „Muster ändern“ auf die Seite darunter, sonst aus dem Schichtplan. */
import { S, V, save } from '../state.js';
import { esc, ymd, dShort, plural } from '../util.js';
import { render } from '../render.js';
import { toast } from '../ui/toast.js';
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';
import { fDays } from './profile-fields.js';
import {
  typesOf, typeOf, isWork, isTimedCat, shiftClass, hasShiftPlan, shiftOn, baseShift, dayShift, setOverride, defaultShifts,
  fmtTimes, overnight, isTime, addDays, dayNum, weekdayOf, localMs, toMin, patternIndex,
} from '../domain/shifts.js';
import { templateOf } from '../domain/shift-templates.js';
import { trainingsIcs, ICS_FILE, ALARM_MINUTES } from '../domain/ics-write.js';
import { MAX_PER_WEEK, PLAN_RULES } from '../domain/shift-plan.js';
import { planFor, twoWeeks, nextTwoWeeks, shiftBadge, dayLong, dayShort, shiftText, trainingLine, sessionsByDay, planHints, hintHtml } from './shift-today.js';
import * as setup from './shift-setup.js';
import * as types from './shift-types.js';
import * as imp from './shift-import.js';
import { knowledgeLink } from './knowledge.js';
import { backLink } from '../ui/navlinks.js';

export const modules = [setup, types, imp];

const SUBS = [['calendar', 'Kalender'], ['plan', '2 Wochen'], ['settings', 'Einstellungen']];
/* Geplante Trainings zeigt der Kalender bis so weit im Voraus */
const HORIZON_DAYS = 120;
const CHEV = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const LEFT = CHEV('M15 6l-6 6 6 6');
const RIGHT = CHEV('M9 6l6 6-6 6');
const pad = n => String(n).padStart(2, '0');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const nameOf = c => { const t = typeOf(S.shifts, c); return t ? t.name : 'ohne Angabe'; };
const top = () => window.scrollTo(0, 0);

/* ---------- Seite ---------- */
export function view() {
  const on = hasShiftPlan(S.shifts);
  let sub = V.shiftView;
  if (sub === 'type' && !V.shiftType) sub = null;
  if (sub !== 'type') sub = !on || sub === 'setup' ? 'setup' : SUBS.some(s => s[0] === sub) ? sub : 'calendar';
  const body = sub === 'type' ? types.vTypeEdit()
    : sub === 'setup' ? setup.vSetup(on) + imp.importSection()
      : sub === 'plan' ? vPlan() : sub === 'settings' ? vSettings() : vCalendar();
  const tabs = sub === 'setup' || sub === 'type' ? '' : `<div class="seg wide sh-seg" role="tablist" aria-label="Schichtplan">${SUBS.map(([k, l]) =>
    `<button role="tab" aria-selected="${sub === k}" class="${sub === k ? 'on' : ''}" data-act="shiftsub" data-sub="${k}">${l}</button>`).join('')}</div>`;
  return `<div class="day-blue sh-page">
    ${backLink()}
    <h1 class="page-title">Schichtplan</h1>
    ${tabs}
    ${body}
  </div>`;
}

/* ---------- Kalender ---------- */
/* Endet die Schicht vom Vortag erst nach 06:00 (24-h-Dienst, 12-h-Nacht)? Dann { type, end }, sonst null. */
function carryFrom(d) {
  const prev = dayShift(S.shifts, addDays(d, -1));
  if (!prev.type || !isTimedCat(prev.cat) || !overnight(prev.times) || toMin(prev.times[1]) <= 360) return null;
  return { type: prev.type, end: prev.times[1] };
}

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
  const used = new Set();
  let carries = false;
  for (let d = 1; d <= n; d++) {
    const key = `${month}-${pad(d)}`;
    const { code, source } = shiftOn(S.shifts, key);
    if (code) used.add(code);
    if (isWork(S.shifts, code)) shifts++;
    const carry = carryFrom(key);
    if (carry) carries = true;
    const t = planned.get(key);
    const done = byDay.get(key) || [];
    const dots = done.map(s => `<i class="sh-dot sh-trained day-${esc(s.color)}"></i>`).join('')
      + (t && !done.length ? `<i class="sh-dot sh-planned day-${esc(t.color)}"></i>` : '');
    const label = `${dayLong(key)}: ${shiftText(code, key) || 'keine Schicht eingetragen'}${source === 'override' ? ', von Hand geändert' : ''}`
      + `${carry ? `, bis ${carry.end} Uhr noch ${carry.type.name} vom Vortag` : ''}`
      + `${done.length ? `, trainiert: ${done.map(s => s.name + (s.running ? ' (läuft)' : '')).join(', ')}` : t ? `, geplant: ${trainingLine(t)}` : ''}`;
    cells.push(`<button class="sh-day ${key === today ? 'today' : ''} ${key < today ? 'past' : ''}" data-act="shiftday" data-d="${key}" aria-label="${esc(label)}">
      ${carry ? `<i class="sh-carry ${esc(shiftClass(S.shifts, carry.type.id))}" aria-hidden="true"></i>` : ''}
      <span class="num">${d}</span>${shiftBadge(code, source === 'override' ? 'ov' : '')}<span class="sh-dots">${dots}</span></button>`);
  }
  const trainings = [...planned.values()].filter(t => t.date.startsWith(month)).length;
  const sum = [`${shifts} ${shifts === 1 ? 'Schicht' : 'Schichten'}`, trainings ? `${trainings} ${trainings === 1 ? 'Training' : 'Trainings'} geplant` : ''].filter(Boolean).join(', ');
  const legend = typesOf(S.shifts).filter(t => used.has(t.id))
    .map(t => `<li>${shiftBadge(t.id)}<span>${esc(t.name)}${isTimedCat(t.cat) ? ` ${esc(fmtTimes(S.shifts.times[t.id]).replace(' Uhr', ''))}` : ''}</span></li>`).join('');
  return `${imp.vFitCard()}
    <section class="card cal sh-cal">
      <div class="cal-nav">
        <button class="icon" data-act="shiftmonth" data-d="-1" aria-label="Voriger Monat">${LEFT}</button>
        <div><h2>${esc(new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }))}</h2>
          <p class="small-print">${esc(sum)}</p></div>
        <button class="icon" data-act="shiftmonth" data-d="1" aria-label="Nächster Monat">${RIGHT}</button>
      </div>
      <div class="cal-grid sh-grid">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(w => `<span class="cal-wd" aria-hidden="true">${w}</span>`).join('')}${cells.join('')}</div>
    </section>
    <ul class="sh-legend">
      ${legend}
      <li><i class="sh-dot sh-planned day-steel"></i><span>geplant</span></li><li><i class="sh-dot sh-trained day-steel"></i><span>trainiert</span></li>
      <li><span class="sh-code sh-x ov" aria-hidden="true">–</span><span>von Hand</span></li>
      ${carries ? '<li><span class="sh-legend-carry" aria-hidden="true"></span><span>Dienst vom Vortag bis morgens</span></li>' : ''}
    </ul>
    <p class="small-print cal-hint">Tippe auf einen Tag, um Schicht oder Uhrzeit zu ändern.${month > horizon.slice(0, 7) ? ` Trainings plant die App bis ${HORIZON_DAYS} Tage im Voraus.` : ''}</p>`;
}

/* ---------- Ein Tag ---------- */
/* Sheet eines Tages. Text, Inhalt und Knöpfe als Getter, damit eine geänderte Uhrzeit sofort zu sehen ist. */
function openDay(d) {
  const today = ymd();
  let t = null;
  if (d >= today && dayNum(d) - dayNum(today) <= HORIZON_DAYS) {
    const p = planFor(today, Math.max(14, dayNum(d) - dayNum(today) + 1));
    t = p && p.trainings.find(x => x.date === d);
  }
  const done = sessionsByDay(k => k === d).get(d) || [];
  const src = { override: 'von Hand geändert', import: 'aus dem Kalender-Import', pattern: 'laut Muster' };
  openSheet({
    title: cap(dayLong(d)),
    get text() {
      const x = dayShift(S.shifts, d);
      const now = shiftText(x.code, d);
      return now ? `${cap(now)}${src[x.source] ? `, ${src[x.source]}` : ''}.` : 'Für diesen Tag ist keine Schicht eingetragen.';
    },
    get body() {
      const x = dayShift(S.shifts, d);
      const base = baseShift(S.shifts, d).code;
      const carry = carryFrom(d);
      const h24 = x.cat === 'h24';
      return `<p class="label">Schicht für diesen Tag</p>
      <div class="chips sh-chips">${typesOf(S.shifts).map(ty => `<button class="chip sh-chip ${shiftClass(S.shifts, ty.id)} ${x.code === ty.id ? 'on' : ''}" aria-pressed="${x.code === ty.id}"
        data-act="shiftset" data-d="${d}" data-v="${esc(ty.id)}">${esc(ty.name)}</button>`).join('')}</div>
      ${isTimedCat(x.cat) ? `<p class="label" style="margin-top:14px">Uhrzeit an diesem Tag</p>
        <div class="sh-trange ${h24 ? 'one' : ''}"><span class="muted">${h24 ? 'Beginn' : 'von'}</span>
          <input type="time" class="sh-time" data-in="shiftdaytime" data-d="${d}" data-i="0" value="${esc(x.times[0])}" aria-label="Beginn an diesem Tag">
          ${h24 ? '' : `<span class="muted">bis</span><input type="time" class="sh-time" data-in="shiftdaytime" data-d="${d}" data-i="1" value="${esc(x.times[1])}" aria-label="Ende an diesem Tag">`}</div>
        ${x.ownTimes ? `<p class="small-print" style="margin-top:6px">Sonst: ${esc(fmtTimes(S.shifts.times[x.code]))}. <button class="link" data-act="shiftdaytimereset" data-d="${d}">Übliche Zeit</button></p>` : ''}` : ''}
      ${carry ? `<p class="small-print" style="margin-top:10px">Bis ${esc(carry.end)} Uhr läuft noch ${esc(carry.type.name)} vom Vortag.</p>` : ''}
      ${x.source === 'override' && x.code !== base ? `<p class="small-print" style="margin-top:10px">Im Plan steht: ${esc(shiftText(base) || 'nichts')}.</p>` : ''}
      ${done.length ? `<p class="sh-sheet-train">Trainiert: <b>${esc(done.map(s => s.name + (s.running ? ' (läuft)' : '')).join(', '))}</b></p>`
        : t ? `<p class="sh-sheet-train">Geplant: <b>${esc(trainingLine(t))}</b>${t.note ? `. ${esc(t.note)}` : ''}</p>${planHints(t).length
          ? `<ul class="sh-hints">${planHints(t).map(h => `<li>${hintHtml(h)}</li>`).join('')}</ul>` : ''}` : ''}`;
    },
    get actions() {
      return [
        ...(shiftOn(S.shifts, d).source === 'override' ? [{ label: 'Wie im Plan', kind: '', fn: () => setDay(d, null) }] : []),
        { label: 'Schließen', kind: 'ghost', fn: closeSheet },
      ];
    },
  });
}

function setDay(d, code) {
  S.shifts.overrides = setOverride(S.shifts, d, code);
  V.sheet = null;
  save(); render();
  toast(`${dayShort(d)}: ${code ? nameOf(code) : 'wie im Plan'}`);
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
    <p class="small-print">${at ? `Schon übernommen am ${esc(dShort(at))} ` : ''}<button class="link" data-act="shiftexport" data-w="${mon}" data-file="1">Als Datei laden</button></p>
  </div>`;
}

function vPlan() {
  const p = twoWeeks();
  const over = S.profile.daysPerWeek > MAX_PER_WEEK;
  return `<p class="page-sub">Ziel: ${S.profile.daysPerWeek} ${S.profile.daysPerWeek === 1 ? 'Training' : 'Trainings'} pro Woche. Zwei Tage in Folge nur mit Einheiten für verschiedene Muskeln.</p>
    ${over ? `<p class="small-print" style="margin-top:6px">Ein Tag pro Woche bleibt frei, darum plant die App höchstens ${MAX_PER_WEEK} Trainings.</p>` : ''}
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
  const t = templateOf(p);
  const i = patternIndex(p, ymd());
  const what = t ? `Vorlage „${t.name}“${t.variant ? `, ${t.variant}` : ''}` : `Eigenes Muster mit ${p.days.length} ${plural(p.days.length, 'Tag', 'Tagen')}`;
  return `${what}. Heute ist Tag ${i + 1} von ${p.days.length} (${nameOf(p.days[i])}).`;
}

const timeInput = (inp, k, v, label) =>
  `<input type="time" class="sh-time" data-in="${inp}" data-k="${k}" value="${esc(v)}" aria-label="${esc(label)}">`;
const PREFER = [['-', 'Frei, Urlaub, Dispo'], ['F', 'Nach Früh- und Tagschicht'], ['S', 'Vor der Spätschicht'], ['N', 'Vor der Nachtschicht']];
/* Regeln der Planung in Kurzform, Zahlen aus PLAN_RULES; „Warum?“ öffnet die passende Wissen-Karte */
const h = m => String(m / 60).replace('.', ',');
const RULES = () => {
  const R = PLAN_RULES;
  return [
    'Nach Früh- und Tagschicht frühestens eine Stunde nach Schichtende.',
    `Vor einer Frühschicht und einer Tagschicht vor ${Number(R.earlyStart.slice(0, 2))} Uhr endet das Training ${h(R.beforeSleep)} Stunden vor der Schlafenszeit (${h(R.earlySleepLead)} Stunden vor Schichtbeginn), bei Beginn um 6 Uhr also um 18:30. ${knowledgeLink('nach-fruehschicht-fertig')}`,
    'Vor der Spätschicht Ende mindestens 90 Minuten vor Schichtbeginn, ebenso vor einer späten Tagschicht.',
    `Vor der Nachtschicht Ende mindestens ${h(R.beforeNight)} Stunden vor Schichtbeginn. ${knowledgeLink('vor-nachtschicht-nachmittag')}`,
    `Nach einer Nachtschicht frühestens ${h(R.afterNight)} Stunden nach Schichtende, nach der letzten Nacht einer Folge Ende bis ${R.afterLastNight} Uhr. ${knowledgeLink('nach-nachtschicht-schlafen')}`,
    `An Tagen mit 24-h-Dienst und an Tagen, an denen du krank bist, plant die App kein Training. Nach einem 24-h-Dienst frühestens ${h(R.after24)} Stunden nach Dienstende.`,
    `Zwei Tage in Folge nur mit Einheiten für verschiedene Hauptmuskeln, sonst ein Ruhetag dazwischen; höchstens ${R.maxInRow} Tage in Folge, jeder Muskel hat 48 Stunden Pause.`,
    `Tagwahl: zuerst das Wochenziel, dann frei vor Dispo vor Spät vor Früh und Tag vor Nacht. Tage mit weniger als ${R.shortRestHours} Stunden Ruhe zwischen zwei Schichten und Tage zwischen zwei Nachtschichten zählen schlechter. ${knowledgeLink('nach-fruehschicht-fertig')}`,
    `Ab der zweiten Nachtschicht in Folge und an Tagen mit kurzer Ruhe: Hinweis auf eine leichtere Einheit. ${knowledgeLink('kurze-nacht-leichter')}`,
    `Endet das Training vor einer Frühschicht oder am Tag nach der letzten Nacht weniger als ${R.caffeineHours} Stunden vor dem Schlafen: Hinweis, den Booster mit Koffein wegzulassen. ${knowledgeLink('koffein-wirkdauer')}`,
  ];
};

function vSettings() {
  const sh = S.shifts;
  const ov = Object.keys(sh.overrides).length;
  return `<section class="block card"><h2>Muster</h2>
      <p class="muted">${esc(sh.pattern ? patternText(sh.pattern) : 'Kein Muster eingetragen. Außerhalb des Imports kennt die App deine Schichten nicht.')}</p>
      <div class="stack"><button class="btn" data-act="shiftedit">${sh.pattern ? 'Muster ändern' : 'Muster eintragen'}</button>
        ${sh.pattern ? '<button class="btn ghost" data-act="shiftpatdel">Muster entfernen</button>' : ''}</div>
    </section>
    ${imp.importSection()}
    ${ov ? `<section class="block card"><h2>Einzeländerungen</h2>
      <p class="muted">${ov === 1 ? 'Ein Tag ist' : `${ov} Tage sind`} von Hand geändert. Sie gelten vor Import und Muster.</p>
      <div class="stack"><button class="btn ghost" data-act="shiftovclear">Alle Einzeländerungen entfernen</button></div></section>` : ''}
    ${types.vTypes()}
    <section class="block card"><h2>Bevorzugte Trainingszeit</h2>
      <div class="sh-times">${PREFER.map(([c, l]) => `<div class="sh-trow pref">${shiftBadge(c)}<span>${esc(l)}</span>
        ${timeInput('shiftpref', c, sh.prefer[c], `Trainingszeit ${l}`)}</div>`).join('')}</div>
      <p class="label" style="margin-top:14px">So plant die App um deine Schichten</p>
      <ul class="rules sh-rules">${RULES().map(r => `<li>${r}</li>`).join('')}</ul>
      <p class="small-print" style="margin-top:10px">Die Regeln sind aus Studien zu verwandten Fragen abgeleitet. Zu Krafttraining bei Schichtarbeit gibt es keine direkten Studien.</p>
    </section>
    <section class="block card"><h2>Trainings pro Woche</h2>${fDays(S.profile)}
      ${S.profile.daysPerWeek > MAX_PER_WEEK ? `<p class="small-print" style="margin-top:8px">Ein Tag pro Woche bleibt frei, darum plant die App höchstens ${MAX_PER_WEEK} Trainings pro Woche.</p>` : ''}</section>
    <section class="block"><button class="btn danger" data-act="shiftwipe">Schichtplan löschen</button></section>`;
}

/* ---------- Aktionen ---------- */
export const actions = {
  shiftopen: el => {
    V.shiftView = el.dataset.sub || 'calendar';
    V.shiftMonth = null; V.shiftDraft = null; V.shiftImport = null; V.shiftType = null;
    render(); top();
  },
  shiftsub: el => { V.shiftView = el.dataset.sub; V.shiftDraft = null; V.shiftImport = null; V.shiftType = null; render(); },
  shiftmonth: el => {
    const cur = /^\d{4}-\d{2}$/.test(V.shiftMonth || '') ? V.shiftMonth : ymd().slice(0, 7);
    const [y, m] = cur.split('-').map(Number);
    const d = new Date(y, m - 1 + Number(el.dataset.d), 1);
    V.shiftMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    render();
  },
  shiftday: el => openDay(el.dataset.d),
  shiftset: el => setDay(el.dataset.d, el.dataset.v),
  shiftdaytimereset: el => {
    const d = el.dataset.d;
    S.shifts.overrides = setOverride(S.shifts, d, shiftOn(S.shifts, d).code);
    save(); render();
  },

  shiftedit: () => { V.shiftDraft = null; V.shiftView = 'setup'; render(); top(); },
  shiftpatdel: () => confirmSheet('Muster entfernen?', 'Außerhalb eines Imports kennt die App deine Schichten dann nicht mehr. Einzeländerungen bleiben.', 'Muster entfernen', () => {
    S.shifts.pattern = null; V.shiftFit = null; V.sheet = null; save(); render(); toast('Muster entfernt');
  }),
  shiftovclear: () => confirmSheet('Einzeländerungen entfernen?', 'Alle von Hand gesetzten Tage folgen wieder Import und Muster.', 'Entfernen', () => {
    S.shifts.overrides = {}; V.sheet = null; save(); render(); toast('Einzeländerungen entfernt');
  }),
  shiftwipe: () => confirmSheet('Schichtplan löschen?', 'Muster, Import, Einzeländerungen, Schichtarten und Zeiten werden gelöscht. Deine Trainings bleiben.', 'Schichtplan löschen', () => {
    S.shifts = defaultShifts();
    V.sheet = null; V.shiftView = 'setup'; V.shiftDraft = null; V.shiftFit = null;
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
  /* Uhrzeit eines einzelnen Tages; der 24-h-Dienst hat nur einen Beginn */
  shiftdaytime: (el, type) => {
    if (type !== 'change') return;
    if (!isTime(el.value)) { toast('Uhrzeit wie 06:00 eintragen'); return; }
    const d = el.dataset.d;
    const x = dayShift(S.shifts, d);
    if (!x.times) return;
    const times = [...x.times];
    times[Number(el.dataset.i)] = el.value;
    if (x.cat === 'h24') times[1] = times[0];
    S.shifts.overrides = setOverride(S.shifts, d, x.code, times);
    save(); render();
  },
  shiftpref: (el, type) => {
    if (type !== 'change') return;
    if (!isTime(el.value)) { toast('Uhrzeit wie 11:00 eintragen'); return; }
    S.shifts.prefer[el.dataset.k] = el.value;
    save(); render();
  },
};
