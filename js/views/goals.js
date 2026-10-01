/* Motivation (Stufe 5): Serie mit Joker, Wochenziele, Ziele und Meilensteine, Abzeichen. */
import { S, V, save, activePlan } from '../state.js';
import { esc, fmt, fmt1, fmtIn, dShort, uid, toNum, ymd, plural } from '../util.js';
import { render } from '../render.js';
import { weekStreakWithJokers, weekHistoryWithJokers } from '../domain/streaks.js';
import { weeklyGoals, evaluateGoal, weightGoalStatus, syncGoals, GOAL_KINDS } from '../domain/motivation.js';
import { BADGES, syncBadges } from '../domain/badges.js';
import { targetsFromState, waterGoal } from '../domain/energy.js';
import { currentWeight } from '../domain/body.js';
import { personalRecords } from '../domain/prs.js';
import { allExercises } from '../domain/library.js';
import { plateSVG } from '../ui/plate.js';
import { badgeSVG } from '../ui/badge.js';
import { toast } from '../ui/toast.js';
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';
import { backLink, compareRow } from '../ui/navlinks.js';

const mot = () => {
  if (!S.motivation) S.motivation = { goals: [], weekly: { proteinDays: 5, waterDays: 5 }, badges: {}, reportSeen: null };
  if (!S.motivation.goals) S.motivation.goals = [];
  if (!S.motivation.weekly) S.motivation.weekly = { proteinDays: 5, waterDays: 5 };
  if (!S.motivation.badges) S.motivation.badges = {};
  return S.motivation;
};
const monthName = t => new Date(t).toLocaleDateString('de-DE', { month: 'long' });
const pctW = p => Math.round(Math.max(0, Math.min(1, p)) * 100);

/* ---------- Abzeichen und Ziele abgleichen ---------- */
/* Läuft beim Zeichnen der Startseite (Überblick und Wochenziele). Nur wenn sich die Daten geändert haben, und gespeichert wird nur bei Neuem. */
let lastSig = null;
function signature() {
  const log = (S.nutrition && S.nutrition.log) || {};
  return [
    S.sessions.length, S.body.photos.length, S.body.measurements.length, S.body.weights.length,
    Object.values(log).reduce((a, l) => a + l.length, 0), Object.keys(S.water || {}).length,
    JSON.stringify(S.water || {}).length, (S.nutrition.recipes || []).length, S.plans.length,
    S.profile.targetWeightKg, S.profile.daysPerWeek, mot().goals.length, Object.keys(mot().badges).length, ymd(),
  ].join('|');
}

export function syncAll() {
  const sig = signature();
  if (sig === lastSig) return;
  lastSig = sig;
  const now = Date.now();
  const badges = syncBadges(S, now);
  const goals = syncGoals(S, now);
  if (!badges.length && !goals.length) return;
  save();
  lastSig = signature();
  V.badgeFresh = new Set([...(V.badgeFresh || []), ...badges.map(b => b.id)]);
  /* Beim ersten Start mit vorhandenen Daten kommen mehrere auf einmal; dann nur die Zahl nennen */
  const msg = badges.length > 2 ? `${badges.length} neue Abzeichen verdient, zu sehen unter Ziele und Abzeichen`
    : badges.length ? `Neues Abzeichen: ${badges.map(b => b.title).join(', ')}`
      : `Ziel erreicht: ${goals.map(g => g.title).join(', ')}`;
  setTimeout(() => toast(msg), 60);
}

/* ---------- Serie ---------- */
export function streakCard(color) {
  const target = S.profile.daysPerWeek || 3;
  const st = weekStreakWithJokers(S.sessions, target);
  const hist = weekHistoryWithJokers(S.sessions, target);
  const head = st.weeks > 0
    ? `<b class="num">${st.weeks}</b><span>${st.weeks === 1 ? 'Woche' : 'Wochen'} am Stück</span>`
    : '<span>Noch keine Serie. Eine Woche zählt, wenn du deine geplanten Einheiten schaffst.</span>';
  const plate = w => (w.met ? plateSVG(color, '', '', { small: true })
    : w.bridged ? plateSVG('white', '', '', { small: true })
      : plateSVG(color, '', '', { small: true, ghost: true }));
  const label = w => (w.current ? `${w.count}/${target}` : w.bridged ? 'Joker' : esc(dShort(w.start)));
  const title = w => `Woche ab ${esc(dShort(w.start))}: ${w.count} ${w.count === 1 ? 'Einheit' : 'Einheiten'}${w.bridged ? ', vom Joker überbrückt' : ''}`;
  return `<section class="block card">
    <h2>Deine Serie</h2>
    <div class="streak-head">${head}</div>
    <div class="streak" aria-label="Die letzten ${hist.length} Wochen">${hist.map(w => `
      <div class="wk ${w.met ? 'met' : ''} ${w.bridged ? 'joker' : ''} ${w.current ? 'now' : ''}" title="${title(w)}">
        ${plate(w)}
        <span class="num">${label(w)}</span>
      </div>`).join('')}</div>
    <p class="small-print" style="margin-top:10px">Diese Woche ${st.thisWeek} von ${target} ${plural(target, 'Einheit', 'Einheiten')}. Pro Monat überbrückt ein Joker eine verpasste Woche; der Joker für ${esc(monthName(Date.now()))} ist ${st.jokerFree ? 'noch frei' : 'schon eingesetzt'}.</p>
  </section>`;
}

/* ---------- Wochenziele ---------- */
function goalRow(label, done, target, note) {
  const reached = done >= target;
  return `<div class="goal-row mot-row ${reached ? 'reached' : ''}">
    <div class="goal-top"><span>${label}</span><span><b class="num">${done}</b> <small>von ${target} ${plural(target, 'Tag', 'Tagen')}</small></span></div>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(done, target)}" aria-label="${esc(label)}"><i style="width:${pctW(done / target)}%"></i></div>
    ${note ? `<p class="small-print">${note}</p>` : ''}
  </div>`;
}

export function weeklyGoalsCard() {
  syncAll();
  const m = mot();
  const t = targetsFromState(S);
  const kg = currentWeight(S.profile, S.body.weights);
  const wg = weeklyGoals({
    sessions: S.sessions, log: S.nutrition.log, water: S.water,
    proteinTarget: t.ok ? t.protein : null, waterTarget: waterGoal(kg),
    daysPerWeek: S.profile.daysPerWeek || 3, weekly: m.weekly,
  });
  const fresh = Object.entries(m.badges)
    .filter(([, at]) => Date.now() - at < 7 * 864e5)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id]) => BADGES.find(b => b.id === id)).filter(Boolean);
  return `<section class="block card mot-weekly">
    <h2>Wochenziele</h2>
    ${goalRow('Trainingstage', wg.training.done, wg.training.target)}
    ${wg.protein.available
      ? goalRow('Proteinziel geschafft', wg.protein.done, wg.protein.target, `Ein Tag zählt ab ${fmt(wg.protein.perDay)} g Protein.`)
      : `<div class="goal-row mot-row"><div class="goal-top"><span>Proteinziel geschafft</span></div><p class="small-print">Dafür braucht die App ein Proteinziel. Ergänze dein Profil oder setz die Ziele unter Ernährung von Hand.</p></div>`}
    ${goalRow('Wasserziel geschafft', wg.water.done, wg.water.target, `Ein Tag zählt ab ${fmt1(wg.water.perDay / 1000)} l.`)}
    ${fresh.length ? `<div class="mot-fresh"><span class="small-print">Neu verdient</span>${fresh.map(b => `
      <span class="mot-fresh-b ${V.badgeFresh && V.badgeFresh.has(b.id) ? 'pop' : ''}" title="${esc(b.title)}">${badgeSVG(b)}</span>`).join('')}</div>` : ''}
    <div class="sug-btns">
      <button class="btn small primary" data-act="motopen">Ziele und Abzeichen</button>
      <button class="btn small ghost" data-act="motweekly">Wochenziele ändern</button>
      ${S.sessions.length ? '<button class="btn small ghost" data-act="repopen">Wochenbericht</button>' : ''}
    </div>
  </section>`;
}

/* ---------- Unterseite „Erfolge“ ---------- */
/* Die Unterseite schließt sich, sobald jemand über die Navigation zu Heute wechselt:
   app.js setzt dabei V.roll. Beim Öffnen setzen wir es zurück. */
export function subview() {
  if (V.motView !== 'goals') return null;
  if (V.roll) { V.motView = null; return null; }
  syncAll();
  const m = mot();
  const records = personalRecords(S.sessions);
  const wgs = weightGoalStatus(S.profile, S.body.weights);
  const earned = BADGES.filter(b => m.badges[b.id]);
  const goals = [...m.goals].sort((a, b) => (!!a.doneAt - !!b.doneAt) || b.createdAt - a.createdAt);
  return `<div class="day-yellow mot-page">
    ${backLink()}
    <h1 class="page-title">Erfolge</h1>
    <p class="page-sub">Ziele, Meilensteine und Abzeichen.</p>

    <section class="block">
      <h2>Ziele</h2>
      <ul class="mot-goals">
        ${wgs ? `<li class="mot-goal ${wgs.reached ? 'done' : ''}">
          <div class="mot-goal-head"><b>Zielgewicht ${fmt1(wgs.target)} kg</b>${wgs.reached ? '<span class="mot-done">Erreicht</span>' : ''}</div>
          <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pctW(wgs.pct)}" aria-label="Zielgewicht"><i style="width:${pctW(wgs.pct)}%"></i></div>
          <p class="small-print">${esc(wgs.text)}</p>
          <div class="mot-goal-tools">
            <button class="link" data-act="motbody">Im Bereich Körper ansehen</button>
            <button class="icon" data-act="goalweightdel" aria-label="Zielgewicht entfernen">×</button>
          </div>
        </li>` : ''}
        ${goals.map(g => {
          const ev = evaluateGoal(g, { sessions: S.sessions, records });
          const done = !!g.doneAt;
          return `<li class="mot-goal ${done ? 'done' : ''}">
            <div class="mot-goal-head"><b>${esc(g.title)}</b>${done ? `<span class="mot-done">Erreicht am ${esc(dShort(g.doneAt))}</span>` : `<span class="mot-kind">${esc(GOAL_KINDS[g.kind] || '')}</span>`}</div>
            <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pctW(done ? 1 : ev.pct)}" aria-label="${esc(g.title)}"><i style="width:${pctW(done ? 1 : ev.pct)}%"></i></div>
            <p class="small-print">${esc(ev.text)}</p>
            <div class="mot-goal-tools">
              ${g.kind === 'custom' ? `<button class="btn small ${done ? 'ghost' : ''}" data-act="goalcheck" data-id="${g.id}">${done ? 'Wieder offen' : 'Abhaken'}</button>` : '<span></span>'}
              <button class="icon" data-act="goaldel" data-id="${g.id}" aria-label="Ziel ${esc(g.title)} löschen">×</button>
            </div>
          </li>`;
        }).join('')}
      </ul>
      ${!wgs && !goals.length ? '<p class="empty">Noch keine Ziele. Zum Beispiel ein Zielgewicht, „Bankdrücken 100 kg“ oder „12 Wochen dabei“.</p>' : ''}
      <div class="stack"><button class="btn" data-act="goaladd">Ziel hinzufügen</button></div>
    </section>

    <section class="block mot-cmp">${compareRow()}</section>

    <section class="block">
      <h2>Abzeichen</h2>
      <p class="small-print">${earned.length} von ${BADGES.length} verdient</p>
      <ul class="badge-grid">${BADGES.map(b => {
        const at = m.badges[b.id];
        return `<li class="badge ${at ? 'earned' : ''} ${at && V.badgeFresh && V.badgeFresh.has(b.id) ? 'pop' : ''}">
          ${badgeSVG(b, !!at)}
          <b>${esc(b.title)}</b>
          <span>${at ? `am ${esc(dShort(at))}` : esc(b.desc)}</span>
        </li>`;
      }).join('')}</ul>
    </section>
  </div>`;
}

/* ---------- Ziel anlegen ---------- */
function kindSheet() {
  openSheet({
    title: 'Ziel hinzufügen',
    text: 'Was möchtest du erreichen?',
    body: `<div class="choices">
      <button class="choice" data-act="goalkind" data-kind="weight"><b>Zielgewicht</b><span>Fortschritt aus deinen Gewichtseinträgen</span></button>
      <button class="choice" data-act="goalkind" data-kind="lift"><b>Kraftziel</b><span>Zum Beispiel Bankdrücken 100 kg</span></button>
      <button class="choice" data-act="goalkind" data-kind="weeks"><b>Dabeibleiben</b><span>Zum Beispiel 12 Wochen mit Training</span></button>
      <button class="choice" data-act="goalkind" data-kind="custom"><b>Eigenes Ziel</b><span>Hakst du selbst ab</span></button>
    </div>`,
    actions: [{ label: 'Abbrechen', kind: 'ghost', fn: closeSheet }],
  });
}

function exerciseOptions() {
  const plan = activePlan();
  const inPlan = [...new Set(plan.order.flatMap(d => plan.days[d].exercises.flatMap(e => e.names)))];
  const lib = allExercises(S.exercisesCustom || []).map(e => e.name).filter(n => !inPlan.includes(n))
    .sort((a, b) => a.localeCompare(b, 'de'));
  return `<optgroup label="Aktueller Plan">${inPlan.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</optgroup>
    <optgroup label="Bibliothek">${lib.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</optgroup>`;
}

const addGoal = g => {
  const now = Date.now();
  const goal = { id: 'g' + uid(), createdAt: now, doneAt: null, target: null, ref: null, ...g };
  mot().goals.push(goal);
  const done = syncGoals(S, now);
  save(); closeSheet();
  toast(done.includes(goal) ? 'Ziel angelegt, und schon erreicht' : 'Ziel angelegt');
};

function formSheet(kind) {
  const val = id => document.getElementById(id).value.trim();
  if (kind === 'weight') {
    openSheet({
      title: 'Zielgewicht',
      body: `<div class="form"><label>Zielgewicht in kg<input id="goal-kg" inputmode="decimal" value="${S.profile.targetWeightKg ? esc(fmtIn(Math.round(S.profile.targetWeightKg * 10) / 10)) : ''}" placeholder="z. B. 80"></label>
        <p class="help">Das Zielgewicht gilt auch im Bereich Körper, dort stehen Verlauf und Prognose.</p></div>`,
      actions: [
        { label: 'Ziel speichern', kind: 'primary', fn: () => {
          const n = toNum(val('goal-kg'));
          if (!(n >= 30 && n <= 300)) { toast('Zielgewicht in kg eintragen, z. B. 80'); return; }
          S.profile.targetWeightKg = n; save(); closeSheet(); toast('Zielgewicht gespeichert');
        } },
        { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
      ],
    });
  } else if (kind === 'lift') {
    openSheet({
      title: 'Kraftziel',
      body: `<div class="form">
        <label>Übung<select id="goal-ex">${exerciseOptions()}</select></label>
        <label>Zielgewicht in kg<input id="goal-kg" inputmode="decimal" placeholder="z. B. 100"></label>
        <p class="help">Zählt, sobald du bei dieser Übung einen Satz mit mindestens diesem Gewicht abhakst.</p></div>`,
      actions: [
        { label: 'Ziel anlegen', kind: 'primary', fn: () => {
          const name = val('goal-ex'), n = toNum(val('goal-kg'));
          if (!name) { toast('Wähle eine Übung'); return; }
          if (!(n > 0 && n <= 500)) { toast('Zielgewicht in kg eintragen, z. B. 100'); return; }
          addGoal({ kind: 'lift', ref: name, target: n, title: `${name} ${fmt(n)} kg` });
        } },
        { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
      ],
    });
  } else if (kind === 'weeks') {
    openSheet({
      title: 'Dabeibleiben',
      body: `<div class="form"><label>Wochen mit Training<input id="goal-weeks" inputmode="numeric" value="12"></label>
        <p class="help">Zählt jede Woche, in der du mindestens einmal trainiert hast, seit deiner ersten Einheit.</p></div>`,
      actions: [
        { label: 'Ziel anlegen', kind: 'primary', fn: () => {
          const n = parseInt(val('goal-weeks'), 10);
          if (!(n >= 1 && n <= 520)) { toast('Anzahl Wochen eintragen, z. B. 12'); return; }
          addGoal({ kind: 'weeks', target: n, title: `${n} ${n === 1 ? 'Woche' : 'Wochen'} dabei` });
        } },
        { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
      ],
    });
  } else {
    openSheet({
      title: 'Eigenes Ziel',
      body: `<div class="form"><label>Was willst du schaffen?<input id="goal-title" maxlength="60" placeholder="z. B. Zehn Klimmzüge am Stück" autocomplete="off"></label></div>`,
      actions: [
        { label: 'Ziel anlegen', kind: 'primary', fn: () => {
          const t = val('goal-title');
          if (!t) { toast('Beschreib dein Ziel in ein paar Worten'); return; }
          addGoal({ kind: 'custom', title: t });
        } },
        { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
      ],
    });
  }
}

function weeklySheet() {
  const w = mot().weekly;
  openSheet({
    title: 'Wochenziele',
    text: 'An wie vielen Tagen pro Woche willst du die Ziele schaffen?',
    body: `<div class="form">
      <div class="row2">
        <label>Proteinziel<input id="mot-protein" inputmode="numeric" value="${w.proteinDays || 5}"></label>
        <label>Wasserziel<input id="mot-water" inputmode="numeric" value="${w.waterDays || 5}"></label>
      </div>
      <p class="help">Die Trainingstage pro Woche stellst du im Profil ein, sie gelten auch für die Serie.</p></div>`,
    actions: [
      { label: 'Speichern', kind: 'primary', fn: () => {
        const p = parseInt(document.getElementById('mot-protein').value, 10);
        const wa = parseInt(document.getElementById('mot-water').value, 10);
        if (!(p >= 1 && p <= 7) || !(wa >= 1 && wa <= 7)) { toast('Jeweils 1 bis 7 Tage eintragen'); return; }
        mot().weekly = { ...w, proteinDays: p, waterDays: wa };
        save(); closeSheet(); toast('Wochenziele gespeichert');
      } },
      { label: 'Abbrechen', kind: 'ghost', fn: closeSheet },
    ],
  });
}

export const actions = {
  motopen: () => { V.motView = 'goals'; V.roll = false; render(); window.scrollTo(0, 0); },
  motbody: () => { V.motView = null; V.tab = 'body'; V.bodySub = 'weight'; render(); window.scrollTo(0, 0); },
  motweekly: weeklySheet,
  goaladd: kindSheet,
  goalkind: el => formSheet(el.dataset.kind),
  goalcheck: el => {
    const g = mot().goals.find(x => x.id === el.dataset.id);
    if (!g) return;
    g.doneAt = g.doneAt ? null : Date.now();
    save(); render();
    if (g.doneAt) toast(`Geschafft: ${g.title}`);
  },
  goaldel: el => {
    const g = mot().goals.find(x => x.id === el.dataset.id);
    if (!g) return;
    confirmSheet(`${g.title} löschen?`, 'Das Ziel verschwindet aus der Liste. Deine Trainingsdaten bleiben.', 'Ziel löschen', () => {
      mot().goals = mot().goals.filter(x => x.id !== g.id);
      save(); closeSheet(); toast('Ziel gelöscht');
    });
  },
  goalweightdel: () => confirmSheet('Zielgewicht entfernen?', 'Deine Gewichtseinträge bleiben, nur das Ziel fällt weg.', 'Zielgewicht entfernen', () => {
    S.profile.targetWeightKg = null; save(); closeSheet(); toast('Zielgewicht entfernt');
  }),
};

export const inputs = {};
