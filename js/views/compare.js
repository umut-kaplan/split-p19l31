/* Vergleichen: eigenen Stand als QR-Code zeigen, den eines Trainingspartners scannen oder einfügen, beide gegenüberstellen.
   Es geht nichts über das Internet. Gespeichert wird nur der zuletzt gelesene Stand (S.compare), er gehört zum Backup. */
import { S, V, save } from '../state.js';
import { esc, fmt, fmt0, fmt1, dShort, ymd } from '../util.js';
import { render } from '../render.js';
import { standOf, encodeStand, decodeStand, compareStands, liftLabel, MAX_INPUT } from '../domain/compare.js';
import { dayNumber } from '../domain/body.js';
import { qrSVG } from '../ui/qr.js';
import { loadZxing } from '../ui/zxing.js';
import { toast } from '../ui/toast.js';
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';
import * as scan from './compare-scan.js';

const shareWeight = () => S.settings.compareWeight !== false;
const dateOf = d => new Date(d + 'T12:00');
const signedKg = v => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt1(Math.abs(v))} kg`;
const weeksText = n => `${n} ${n === 1 ? 'Woche' : 'Wochen'}`;
const go = () => { render(); window.scrollTo(0, 0); };

/* Gespeicherter Stand, gelesen wie beim Scannen. Liefert { stand, scannedAt } oder null. */
export function storedStand() {
  const c = S.compare;
  if (!c || typeof c.code !== 'string') return null;
  const r = decodeStand(c.code);
  return r.ok ? { stand: r.stand, scannedAt: c.scannedAt } : null;
}
const partnerName = st => st.name || 'Partner';

/* Code übernehmen. Liefert das Ergebnis von decodeStand. */
function acceptCode(text) {
  const r = decodeStand(text);
  if (!r.ok) return r;
  S.compare = { code: text.trim(), scannedAt: Date.now() };
  save();
  return r;
}

function accepted(r) {
  V.cmpView = 'main';
  V.cmpPaste = '';
  toast(`Stand von ${partnerName(r.stand)} übernommen`);
  go();
}

/* ---------- Einstieg auf der Trainingsseite ---------- */
export function entryCard() {
  const st = storedStand();
  return `<section class="block card cmp-entry">
    <h2>Vergleichen</h2>
    <p class="muted">Zeig deinen Stand als QR-Code oder scanne den Code eines Trainingspartners. Die Daten gehen direkt von Handy zu Handy.</p>
    ${st ? `<p class="small-print">Zuletzt verglichen mit ${esc(partnerName(st.stand))}${st.scannedAt ? ` am ${esc(dShort(st.scannedAt))}` : '.'}</p>` : ''}
    <div class="stack" style="margin-top:12px"><button class="btn" data-act="cmpopen">Vergleichen</button></div>
  </section>`;
}

/* ---------- Unterseite ---------- */
export function subview() {
  if (V.cmpView === 'scan') return scanPage();
  if (V.cmpView === 'main') return mainPage();
  return null;
}

function pasteCard(open) {
  return `<section class="block card cmp-paste">
    <details class="more" ${open ? 'open' : ''}><summary>Ohne Kamera: Code-Text einfügen</summary>
      <p class="small-print">Unter dem QR-Code steht „Code als Text“. Von dort lässt er sich kopieren und dir schicken.</p>
      <label class="field" style="margin-top:10px">Code-Text
        <textarea id="cmp-paste" data-in="cmppaste" maxlength="${MAX_INPUT}" rows="4" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder='{"a":"split-cmp",…}'>${esc(V.cmpPaste || '')}</textarea></label>
      <div class="stack" style="margin-top:10px"><button class="btn" data-act="cmppaste">Übernehmen</button></div>
    </details>
  </section>`;
}

function mainPage() {
  const st = storedStand();
  return `<div class="cmp day-yellow">
    <div class="mot-top"><button class="link" data-act="cmpclose">Zurück zum Training</button></div>
    <h1 class="page-title">Vergleichen</h1>
    <p class="page-sub">Einer zeigt seinen Stand als QR-Code, der andere scannt ihn. Nichts geht über das Internet.</p>
    ${st ? comparison(st) : (S.compare ? '<p class="empty block">Der gespeicherte Stand lässt sich nicht mehr lesen. Scanne ihn noch einmal.</p>' : '')}
    <section class="block card">
      <h2>Mein Stand</h2>
      <p class="muted" style="margin-top:2px">Rekorde der Grundübungen, die letzten 7 Tage, deine Serie${shareWeight() ? ' und dein Körpergewicht' : ''}.</p>
      <button class="cmp-switch" role="switch" aria-checked="${shareWeight()}" data-act="cmpweight">
        <span>Körpergewicht mitteilen</span><i aria-hidden="true"></i></button>
      <div class="stack" style="margin-top:12px"><button class="btn primary" data-act="cmpshow">Meinen Stand zeigen</button></div>
    </section>
    <section class="block card">
      <h2>Stand des anderen</h2>
      <p class="muted" style="margin-top:2px">Lass dir den Code zeigen und scanne ihn. Gespeichert wird nur der zuletzt gescannte Stand.</p>
      <div class="stack" style="margin-top:12px"><button class="btn primary" data-act="cmpscan">Code scannen</button></div>
    </section>
    ${pasteCard(false)}
  </div>`;
}

function scanPage() {
  setTimeout(scan.attach, 0);
  return `<div class="cmp day-yellow">
    <div class="mot-top"><button class="link" data-act="cmpscanclose">Abbrechen</button></div>
    <h1 class="page-title">Code scannen</h1>
    <p class="page-sub">Der andere öffnet in Split <b>Training, Vergleichen, Meinen Stand zeigen</b>.</p>
    ${scan.cameraFailed() ? '' : `<div class="scan-box cmp-scan-box">
      <video id="cmp-video" playsinline muted autoplay aria-label="Kamerabild"></video>
      <div class="cmp-frame" aria-hidden="true"></div>
    </div>`}
    <p class="muted scan-status" id="cmp-scan-status" role="status">${esc(V.cmpScanStatus || '')}</p>
    <div class="scan-btns"><button class="btn small" id="cmp-retry" data-act="cmpscanretry" ${scan.cameraFailed() ? '' : 'hidden'}>Noch einmal versuchen</button></div>
    ${pasteCard(scan.cameraFailed())}
  </div>`;
}

/* ---------- Gegenüberstellung ---------- */
const DASH = '<span class="cmp-none">–</span>';

/* Eine Zeile: Bezeichnung, eigener Wert, Wert des anderen. Der höhere Wert ist dezent hervorgehoben. */
function row(label, c, f, sub = '') {
  const val = (v, side) => {
    if (v == null) return DASH;
    const lead = c.lead === side;
    const diff = lead && c.diff ? `<small class="cmp-diff">+${esc(f(Math.abs(c.diff)).replace(/ kg$/, ''))}</small>` : '';
    return `<b class="num">${esc(f(v))}</b>${diff}`;
  };
  return `<div class="cmp-row">
    <span class="cmp-l">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>
    <span class="cmp-v ${c.lead === 'me' ? 'lead' : ''}">${val(c.me, 'me')}</span>
    <span class="cmp-v ${c.lead === 'them' ? 'lead' : ''}">${val(c.them, 'them')}</span>
  </div>`;
}

function comparison({ stand, scannedAt }) {
  const mine = standOf(S, { weight: true });
  const c = compareStands(mine, stand);
  const name = partnerName(stand);
  const kg = v => `${fmt(v)} kg`;
  const age = dayNumber(mine.date) - dayNumber(stand.date);
  const scanDay = scannedAt ? ymd(scannedAt) : null;
  const head = `<div class="cmp-row cmp-cols"><span></span><b>Ich</b><b>${esc(name)}</b></div>`;
  const section = (title, rows, note = '') => (rows ? `<h3 class="cmp-sub">${esc(title)}${note ? ` <small>${esc(note)}</small>` : ''}</h3>${rows}` : '');
  const lifts = c.lifts.map(r => row(liftLabel(r.key, S.exercisesCustom), r, kg)).join('');
  const hasBody = c.weight.me != null || c.weight.them != null;
  const target = stand.streak.target;
  return `<section class="block cmp-table" aria-label="Vergleich mit ${esc(name)}">
    <h2>Du und ${esc(name)}</h2>
    <p class="small-print">Stand von ${esc(name)} vom ${esc(dShort(dateOf(stand.date)))}, deiner von heute.${scanDay && scanDay !== stand.date ? ` Gescannt am ${esc(dShort(scannedAt))}` : ''}
      ${age > 14 ? ' Der Stand ist älter als zwei Wochen; lass dir bei Gelegenheit einen neuen zeigen.' : ''}</p>
    <div class="card cmp-card">
      ${head}
      ${section('Rekorde', lifts || `<p class="small-print cmp-empty">Noch keine Rekorde bei Grundübungen.</p>`, '1RM geschätzt')}
      ${section('Letzte 7 Tage', row('Arbeitssätze', c.sets, fmt0) + row('Bewegt', c.kg, v => `${fmt0(v)} kg`))}
      ${section('Serie', row('Wochen am Stück', c.streak, fmt0,
        target ? `Ziel pro Woche: du ${S.profile.daysPerWeek || 3}, ${name} ${target}` : ''))}
      ${hasBody ? section('Körpergewicht', row('7-Tage-Schnitt', c.weight, v => `${fmt1(v)} kg`)
        + row('In 4 Wochen', c.change, signedKg), stand.body ? '' : `von ${name} nicht mitgeteilt`) : ''}
    </div>
    <p class="small-print" style="margin-top:8px">1RM nach Epley aus Sätzen mit bis zu 12 Wiederholungen. Farbig ist jeweils der höhere Wert; beim Körpergewicht gibt es kein Besser.</p>
    <div class="stack"><button class="btn ghost" data-act="cmpdel">Vergleich löschen</button></div>
  </section>`;
}

/* ---------- Eigener Code im Sheet ---------- */
/* Was tatsächlich im Code steckt: aus dem kodierten Text zurückgelesen, falls die Größengrenze etwas weggelassen hat */
function contents(code, hadName) {
  const r = decodeStand(code);
  if (!r.ok) return '';
  const st = r.stand;
  const lifts = st.lifts.map(l => liftLabel(l.key, S.exercisesCustom));
  const body = !shareWeight() ? 'nicht enthalten'
    : st.body ? `${fmt1(st.body.avg)} kg${st.body.delta != null ? `, ${signedKg(st.body.delta)} in 4 Wochen` : ''}`
      : 'keine Einträge der letzten zwei Wochen';
  return `<ul class="rules cmp-contents">
    <li>Vorname: <b>${st.name ? esc(st.name) : hadName ? 'nicht enthalten' : 'keiner eingetragen'}</b></li>
    <li>Rekorde: <b>${lifts.length ? esc(lifts.join(', ')) : 'noch keine bei Grundübungen'}</b></li>
    <li>Letzte 7 Tage: <b>${fmt0(st.week.sets)} Sätze, ${fmt0(st.week.kg)} kg</b></li>
    <li>Serie: <b>${weeksText(st.streak.weeks)}</b></li>
    <li>Körpergewicht: <b>${esc(body)}</b></li>
  </ul>`;
}

async function showMine() {
  const st = standOf(S, { weight: shareWeight() });
  const code = encodeStand(st);
  let qr = null;
  /* qrSVG prüft den Code an nachgestellten Kamerabildern und wählt eine Maske, die ZXing auf dem iPhone sicher liest */
  try { qr = qrSVG(await loadZxing(), code, { label: 'QR-Code mit deinem Stand' }); } catch (e) { qr = null; }
  V.cmpCode = code;
  openSheet({
    title: 'Mein Stand',
    body: `${qr ? `<div class="cmp-qr" data-version="${qr.version}" data-mask="${qr.mask}">${qr.svg}</div>
        <p class="cmp-qr-hint">Der andere scannt ihn in Split unter <b>Training, Vergleichen, Code scannen</b>. Dreh die Helligkeit hoch, falls es nicht klappt.</p>`
      : '<p class="banner">Der QR-Code ließ sich nicht erzeugen. Der andere kann den Code-Text unten einfügen.</p>'}
      <p class="small-print cmp-in">Darin steckt nur diese Zusammenfassung:</p>
      ${contents(code, !!st.name)}
      <details class="more cmp-text"><summary>Code als Text</summary>
        <textarea class="cmp-code" readonly rows="4" aria-label="Code als Text">${esc(code)}</textarea>
        <button class="btn small" data-act="cmpcopy">Kopieren</button>
      </details>`,
    actions: [{ label: 'Fertig', kind: 'primary', fn: closeSheet }],
  });
}

async function copyCode() {
  const code = V.cmpCode || '';
  try {
    await navigator.clipboard.writeText(code);
    toast('Code kopiert');
  } catch (e) {
    const ta = document.querySelector('.cmp-code');
    if (ta) { ta.focus(); ta.select(); }
    toast('Markiert. Tippe auf Kopieren im Menü.');
  }
}

export const actions = {
  cmpopen: () => { V.cmpView = 'main'; go(); },
  cmpclose: () => { scan.stopScanner(); V.cmpView = null; go(); },
  cmpweight: () => { S.settings.compareWeight = !shareWeight(); save(); render(); },
  cmpshow: showMine,
  cmpcopy: copyCode,
  cmpscan: () => {
    scan.resetScanner(text => {
      const r = acceptCode(text);
      if (r.ok) { accepted(r); return true; }
      scan.status(`${r.reason} Halte den QR-Code aus Split in den Rahmen.`);
      return false;
    });
    V.cmpView = 'scan';
    go();
  },
  cmpscanclose: () => { scan.stopScanner(); V.cmpView = 'main'; go(); },
  cmpscanretry: () => { actions.cmpscan(); },
  cmppaste: () => {
    const el = document.getElementById('cmp-paste');
    const r = acceptCode(el ? el.value : '');
    if (!r.ok) { toast(r.reason); return; }
    if (el) el.blur();
    scan.stopScanner();
    accepted(r);
  },
  cmpdel: () => {
    const st = storedStand();
    confirmSheet('Vergleich löschen?', `Der gespeicherte Stand${st ? ` von ${partnerName(st.stand)}` : ''} wird von diesem Handy entfernt.`, 'Vergleich löschen', () => {
      S.compare = null;
      save();
      V.sheet = null;
      render();
      toast('Vergleich gelöscht');
    });
  },
};

export const inputs = {
  /* Eingefügter Text bleibt stehen, wenn die Seite neu gezeichnet wird */
  cmppaste: (el, type) => { if (type === 'input') V.cmpPaste = el.value.slice(0, MAX_INPUT); },
};
