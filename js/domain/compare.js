/* Vergleich zweier Stände per QR-Code. Reine Funktionen: Zusammenfassung bauen, kodieren, prüfen, gegenüberstellen.

   Format Version 1: kompaktes JSON nur aus ASCII-Zeichen (Umlaute als ü), damit jeder QR-Leser es gleich liest.
   { a: 'split-cmp', v: 1,
     d: 'JJJJ-MM-TT',                      Datum des Stands
     n: 'Vorname',                         nur wenn gesetzt, höchstens 20 Zeichen
     r: [['bankdruecken', 102.5], ['~Eigene Übung', 80]],
                                           geschätztes 1RM der Grundübungen, höchstens 6, auf 0,5 kg gerundet.
                                           Bibliotheksübungen mit ihrer id, eigene mit ~ und Namen.
     w: [Arbeitssätze, bewegte kg],        die letzten 7 Tage
     s: [Wochen, Einheiten pro Woche],     Serie mit Joker wie auf der Startseite
     b: [7-Tage-Schnitt, Änderung über 4 Wochen oder null] }   nur wenn Körpergewicht mitgeteilt wird */
import { personalRecords } from './prs.js';
import { weekStreakWithJokers } from './streaks.js';
import { dayNumber } from './body.js';
import { findExercise, exerciseTonnage } from './library.js';
import { workSets } from './settypes.js';
import { ymd } from '../util.js';

export const CMP_APP = 'split-cmp';
export const CMP_VERSION = 1;
export const MAX_LIFTS = 6;
export const MAX_NAME = 20;
export const MAX_EX_NAME = 20;
/* Obergrenze für den kodierten Text. Ein typischer Stand hat 170 bis 240 Zeichen (QR-Version 9 bis 11);
   mehr als 400 ergäben so feine Module, dass die Kamera sie aus 30 bis 50 cm nicht mehr sicher auflöst. */
export const MAX_CODE = 400;
/* Längere Eingaben prüft die App gar nicht erst */
export const MAX_INPUT = 2000;

/* Die großen Grundübungen zuerst, damit zwei Handys möglichst dieselben Übungen zeigen */
export const LIFT_PRIORITY = [
  'kniebeugen', 'bankdruecken', 'kreuzheben', 'schulterdruecken', 'langhantelrudern', 'klimmzuege', 'latzug',
  'beinpresse', 'rumaenisches-kreuzheben', 'schraegbankdruecken', 'hip-thrust', 'kh-bankdruecken',
];

export const MSG = {
  empty: 'Da steht noch nichts. Füge den Code-Text ein.',
  foreign: 'Das ist kein Vergleichs-Code aus Split.',
  broken: 'Der Code ist unvollständig oder beschädigt. Lass ihn dir noch einmal zeigen.',
  newer: 'Der Code stammt aus einer neueren Version von Split. Aktualisiere die App und scanne noch einmal.',
};

const round05 = x => Math.round(x * 2) / 2;
const round1 = x => Math.round(x * 10) / 10;
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/* Text ohne Steuer- und Richtungszeichen, getrimmt, höchstens max Zeichen (Emoji zählen als eines) */
export function cleanText(s, max) {
  if (typeof s !== 'string') return '';
  const t = s.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
  return Array.from(t.replace(/\s+/g, ' ').trim()).slice(0, max).join('').trim();
}

/* Alles außerhalb von ASCII als \uXXXX, gültiges JSON und für jeden QR-Leser eindeutig */
const ascii = s => s.replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

/* ---------- Eigener Stand ---------- */

/* Geschätztes 1RM aller Grundübungen, wichtigste zuerst. Liefert [{ key, e1rm }].
   key: id der Bibliothek, bei eigenen Übungen '~' + Name. Varianten derselben Übung aus verschiedenen Plänen zählen zusammen. */
export function liftRecords(sessions, custom = []) {
  const map = new Map();
  personalRecords(sessions || []).forEach(r => {
    if (r.unit === 'sec' || !r.e1rm) return;
    const e = findExercise(r.name, custom);
    if (!e || e.type !== 'compound') return;
    const key = e.custom ? '~' + cleanText(e.name, MAX_EX_NAME) : e.id;
    if (key === '~') return;
    const cur = map.get(key);
    if (!cur) map.set(key, { key, e1rm: r.e1rm.value, count: r.count });
    else { cur.e1rm = Math.max(cur.e1rm, r.e1rm.value); cur.count += r.count; }
  });
  const rank = k => { const i = LIFT_PRIORITY.indexOf(k); return i < 0 ? Infinity : i; };
  return [...map.values()]
    .sort((a, b) => rank(a.key) - rank(b.key) || b.count - a.count || b.e1rm - a.e1rm || (a.key < b.key ? -1 : 1))
    .map(x => ({ key: x.key, e1rm: round05(x.e1rm) }));
}

/* Arbeitssätze und bewegtes Gewicht der letzten 7 Kalendertage einschließlich heute. Aufwärmsätze zählen nicht, Dropsätze wie beim Volumen mit. */
export function weekLoad(sessions, now = Date.now()) {
  const t = dayNumber(ymd(now));
  let sets = 0, kg = 0;
  (sessions || []).forEach(s => {
    const n = dayNumber(ymd(s.startedAt));
    if (n > t || n <= t - 7) return;
    (s.ex || []).forEach(x => {
      sets += workSets(x.sets).length;
      kg += exerciseTonnage(x);
    });
  });
  return { sets, kg: Math.round(kg) };
}

/* Körpergewicht: 7-Tage-Schnitt am letzten Eintrag und die Änderung gegen den Schnitt vier Wochen davor.
   Ist der letzte Eintrag älter als zwei Wochen, gibt es keinen aktuellen Wert. Liefert { avg, delta } oder null. */
export function bodyOf(weights, today) {
  const t = dayNumber(today);
  const pts = (weights || [])
    .filter(w => w && w.kg > 0 && /^\d{4}-\d{2}-\d{2}$/.test(w.date || ''))
    .map(w => ({ n: dayNumber(w.date), kg: w.kg }))
    .filter(p => p.n <= t);
  if (!pts.length) return null;
  const last = Math.max(...pts.map(p => p.n));
  if (last <= t - 14) return null;
  const avgEnding = end => {
    const win = pts.filter(p => p.n <= end && p.n > end - 7);
    return win.length ? win.reduce((a, p) => a + p.kg, 0) / win.length : null;
  };
  const avg = avgEnding(last);
  const before = avgEnding(last - 28);
  return { avg: round1(avg), delta: before == null ? null : round1(avg - before) };
}

/* Der ganze eigene Stand. lifts enthält alle Grundübungen; kodiert werden nur die ersten MAX_LIFTS. */
export function standOf(S, { now = Date.now(), weight = true } = {}) {
  const target = (S.profile && S.profile.daysPerWeek) || 3;
  const sessions = S.sessions || [];
  return {
    name: cleanText(S.profile && S.profile.name, MAX_NAME),
    date: ymd(now),
    lifts: liftRecords(sessions, S.exercisesCustom || []),
    week: weekLoad(sessions, now),
    streak: { weeks: weekStreakWithJokers(sessions, target, now).weeks, target },
    body: weight ? bodyOf(S.body && S.body.weights, ymd(now)) : null,
  };
}

/* ---------- Kodieren ---------- */
function toText(o) { return ascii(JSON.stringify(o)); }

export function encodeStand(st) {
  const o = { a: CMP_APP, v: CMP_VERSION, d: st.date };
  if (st.name) o.n = cleanText(st.name, MAX_NAME);
  o.r = (st.lifts || []).slice(0, MAX_LIFTS).map(l => [l.key, round05(l.e1rm)]);
  o.w = [st.week.sets, Math.round(st.week.kg)];
  o.s = [st.streak.weeks, st.streak.target];
  if (st.body) o.b = [round1(st.body.avg), st.body.delta == null ? null : round1(st.body.delta)];
  let text = toText(o);
  /* Lange Namen mit vielen Umlauten: erst die unwichtigsten Übungen weglassen, zuletzt den Namen */
  while (text.length > MAX_CODE && o.r.length) { o.r.pop(); text = toText(o); }
  if (text.length > MAX_CODE) { delete o.n; text = toText(o); }
  return text;
}

/* ---------- Prüfen ---------- */
const num = (x, lo, hi) => (typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? x : null);
const int = (x, lo, hi) => (Number.isInteger(x) && x >= lo && x <= hi ? x : null);

function validDate(d) {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return y >= 2020 && y <= 2100 && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day;
}

function liftFrom(e) {
  if (!Array.isArray(e) || typeof e[0] !== 'string') return null;
  const e1rm = num(e[1], 0.5, 1000);
  if (e1rm == null) return null;
  if (e[0].startsWith('~')) {
    const name = cleanText(e[0].slice(1), MAX_EX_NAME);
    return name ? { key: '~' + name, e1rm: round05(e1rm) } : null;
  }
  return /^[a-z0-9-]{1,40}$/.test(e[0]) ? { key: e[0], e1rm: round05(e1rm) } : null;
}

/* Liest einen gescannten oder eingefügten Code. Liefert { ok: true, stand } oder { ok: false, reason }.
   Unbrauchbare Einzelwerte fallen weg; stimmt der Rahmen nicht, wird der ganze Code abgelehnt. */
export function decodeStand(text) {
  const fail = reason => ({ ok: false, reason });
  if (typeof text !== 'string' || !text.trim()) return fail(MSG.empty);
  /* Der Code selbst ist reines ASCII. Typografische Anführungszeichen stammen von einem Messenger oder der Autokorrektur. */
  const t = text.trim().replace(/[\u201c\u201d\u201e\u201f\u2033]/g, '"');
  if (t.length > MAX_INPUT || t[0] !== '{') return fail(MSG.foreign);
  let o;
  try { o = JSON.parse(t); } catch (e) { return fail(t.includes(CMP_APP) ? MSG.broken : MSG.foreign); }
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.a !== CMP_APP) return fail(MSG.foreign);
  if (!Number.isInteger(o.v) || o.v < 1) return fail(MSG.broken);
  if (o.v > CMP_VERSION) return fail(MSG.newer);
  if (!validDate(o.d)) return fail(MSG.broken);

  const seen = new Set();
  const lifts = (Array.isArray(o.r) ? o.r.slice(0, MAX_LIFTS) : []).map(liftFrom).filter(l => {
    if (!l) return false;
    const k = liftMatchKey(l.key);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const w = Array.isArray(o.w) ? o.w : [];
  const s = Array.isArray(o.s) ? o.s : [];
  const b = Array.isArray(o.b) ? o.b : null;
  const avg = b ? num(b[0], 20, 400) : null;
  const delta = b ? num(b[1], -100, 100) : null;
  const kg = num(w[1], 0, 1e6);
  return {
    ok: true,
    stand: {
      name: cleanText(o.n, MAX_NAME),
      date: o.d,
      lifts,
      week: { sets: int(w[0], 0, 2000), kg: kg == null ? null : Math.round(kg) },
      streak: { weeks: int(s[0], 0, 1000), target: int(s[1], 1, 7) },
      body: avg == null ? null : { avg: round1(avg), delta: delta == null ? null : round1(delta) },
    },
  };
}

/* ---------- Gegenüberstellen ---------- */
/* Eigene Übungen passen über den Namen zusammen, ohne Groß- und Kleinschreibung */
export const liftMatchKey = key => (key.startsWith('~') ? '~' + norm(key.slice(1)) : key);

const lead = (me, them) => (me == null || them == null ? null : me > them ? 'me' : them > me ? 'them' : 'even');
function cell(me, them, neutral = false) {
  const diff = me != null && them != null ? Math.round((me - them) * 10) / 10 : null;
  return { me, them, diff, lead: neutral ? null : lead(me, them) };
}

/* mine: eigener Stand mit allen Grundübungen (standOf), theirs: gelesener Stand (decodeStand).
   Übungen, die beide haben, stehen oben in der Reihenfolge des anderen; dann seine übrigen, dann die eigenen wichtigsten. */
export function compareStands(mine, theirs) {
  const myMap = new Map(mine.lifts.map(l => [liftMatchKey(l.key), l]));
  const theirKeys = new Set(theirs.lifts.map(l => liftMatchKey(l.key)));
  const rows = theirs.lifts.map(l => {
    const m = myMap.get(liftMatchKey(l.key));
    return { key: l.key, ...cell(m ? m.e1rm : null, l.e1rm) };
  });
  mine.lifts.slice(0, MAX_LIFTS).forEach(l => {
    if (!theirKeys.has(liftMatchKey(l.key))) rows.push({ key: l.key, ...cell(l.e1rm, null) });
  });
  const both = r => (r.me != null && r.them != null ? 0 : 1);
  const lifts = rows.map((r, i) => ({ r, i })).sort((a, b) => both(a.r) - both(b.r) || a.i - b.i).map(x => x.r);
  return {
    lifts,
    shared: lifts.filter(r => r.me != null && r.them != null).length,
    sets: cell(mine.week.sets, theirs.week.sets),
    kg: cell(mine.week.kg, theirs.week.kg),
    streak: cell(mine.streak.weeks, theirs.streak.weeks),
    weight: cell(mine.body ? mine.body.avg : null, theirs.body ? theirs.body.avg : null, true),
    change: cell(mine.body ? mine.body.delta : null, theirs.body ? theirs.body.delta : null, true),
  };
}

/* Anzeigename einer Übung: eigene mit ihrem Namen, Bibliotheksübungen aus der eigenen Bibliothek.
   Kennt die eigene App die id noch nicht (neuere Version beim anderen), wird sie lesbar gemacht. */
export function liftLabel(key, custom = []) {
  if (key.startsWith('~')) return key.slice(1);
  const e = findExercise(key, custom);
  if (e && !e.custom) return e.name;
  const s = key.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
