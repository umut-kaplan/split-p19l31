/* Open Food Facts: Produktsuche und Barcode. Daten: Open Food Facts, Lizenz ODbL.
   Nur Endpunkte, die dem Browser den Zugriff erlauben (Access-Control-Allow-Origin: *):
   - Barcode: /api/v2/product/<ean>.json
   - Suche:   /cgi/search.pl (die neuere search.openfoodfacts.org sendet keinen CORS-Header)
   Alle Antworten landen im IndexedDB-Store 'foodCache' und stehen offline wieder bereit. */
import { dbGet, dbPut } from './db.js';
import { mapOffProduct, mapOffSearch, normalize } from '../domain/foods.js';

const FIELDS = 'code,product_name,product_name_de,generic_name,generic_name_de,brands,nutriments,serving_quantity,serving_size';
const HOSTS = ['https://world.openfoodfacts.org', 'https://de.openfoodfacts.org'];
const FRESH = 7 * 864e5;          // so lange gilt ein Suchergebnis ohne neue Anfrage
const NOT_FOUND_FRESH = 864e5;    // unbekannte Barcodes nach einem Tag erneut fragen

export const OFF_CREDIT = 'Daten: Open Food Facts, ODbL';

/* ---------- Drosselung: höchstens 8 Suchen pro Minute, mindestens 2 s Abstand ---------- */
let lastCall = 0;
const calls = [];
async function throttle() {
  const now = Date.now();
  while (calls.length && now - calls[0] > 60000) calls.shift();
  if (calls.length >= 8) {
    const err = new Error('Open Food Facts erlaubt nur wenige Suchen pro Minute. Warte kurz und versuche es dann noch einmal.');
    err.kind = 'limit';
    throw err;
  }
  const wait = Math.max(0, lastCall + 2000 - now);
  if (wait) await new Promise(r => setTimeout(r, wait));
  lastCall = Date.now();
  calls.push(lastCall);
}

async function getJson(url, ms = 9000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const type = res.headers.get('content-type') || '';
    if (res.status === 404 && type.includes('json')) return { notFound: true };
    if (!res.ok || !type.includes('json')) {
      const err = new Error('Open Food Facts antwortet gerade nicht.');
      err.kind = 'down';
      throw err;
    }
    return { json: await res.json() };
  } catch (e) {
    if (e.kind) throw e;
    const err = new Error(e.name === 'AbortError' ? 'Open Food Facts antwortet zu langsam.'
      : online() ? 'Open Food Facts antwortet gerade nicht. Versuch es gleich noch einmal.' : 'Keine Verbindung zu Open Food Facts.');
    err.kind = 'network';
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function cacheGet(id) {
  try { return (await dbGet('foodCache', id)) || null; } catch (e) { return null; }
}
async function cachePut(id, data) {
  try { await dbPut('foodCache', { id, data, at: Date.now() }); } catch (e) { /* ohne Cache weiter */ }
}

const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/* Suche. Liefert { items, from: 'network' | 'cache' | null, at, error, offline } */
export async function searchOff(query) {
  const q = normalize(query);
  if (q.length < 3) return { items: [], from: null };
  const id = 'q:' + q;
  const cached = await cacheGet(id);
  if (cached && Date.now() - cached.at < FRESH) return { items: cached.data, from: 'cache', at: cached.at };
  if (!online()) {
    return cached
      ? { items: cached.data, from: 'cache', at: cached.at, offline: true }
      : { items: [], from: null, offline: true, error: 'Offline. Die Suche bei Open Food Facts geht wieder, sobald du Netz hast.' };
  }
  let lastErr = null;
  try { await throttle(); } catch (e) { return cached ? { items: cached.data, from: 'cache', at: cached.at } : { items: [], from: null, error: e.message }; }
  /* Die Suche ist bei Open Food Facts oft überlastet (503). Drei Versuche über beide Hosts, mit kurzer Pause. */
  const tries = [HOSTS[0], HOSTS[1], HOSTS[0]];
  for (let i = 0; i < tries.length; i++) {
    const host = tries[i];
    if (i) await new Promise(r => setTimeout(r, 1200));
    const url = `${host}/cgi/search.pl?search_terms=${encodeURIComponent(query.trim())}&search_simple=1&action=process&json=1`
      + `&page_size=24&sort_by=unique_scans_n&tagtype_0=countries&tag_contains_0=contains&tag_0=germany&fields=${FIELDS}`;
    try {
      const r = await getJson(url);
      const items = r.json ? mapOffSearch(r.json).slice(0, 24) : [];
      await cachePut(id, items);
      items.forEach(f => { if (f.code) cachePut('code:' + f.code, f); });
      return { items, from: 'network', at: Date.now() };
    } catch (e) {
      /* Eine 503-Seite ohne CORS-Header sieht für den Browser wie ein Netzfehler aus, darum den nächsten Host versuchen */
      lastErr = e;
      if (!online()) break;
    }
  }
  if (cached) return { items: cached.data, from: 'cache', at: cached.at, error: lastErr && lastErr.message };
  return { items: [], from: null, error: (lastErr && lastErr.message) || 'Open Food Facts antwortet gerade nicht.' };
}

/* Barcode nachschlagen. Liefert { food, from, notFound, error, offline } */
export async function lookupBarcode(code) {
  const id = 'code:' + code;
  const cached = await cacheGet(id);
  if (cached && cached.data && Date.now() - cached.at < FRESH) return { food: cached.data, from: 'cache' };
  if (cached && cached.data === null && Date.now() - cached.at < NOT_FOUND_FRESH) return { food: null, notFound: true, from: 'cache' };
  if (!online()) {
    return cached && cached.data
      ? { food: cached.data, from: 'cache', offline: true }
      : { food: null, offline: true, error: 'Offline. Den Barcode kann die App erst mit Netz nachschlagen.' };
  }
  try {
    const r = await getJson(`${HOSTS[0]}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
    const product = r.json && r.json.status === 1 ? r.json.product : null;
    const food = product ? mapOffProduct({ ...product, code: product.code || code }) : null;
    await cachePut(id, food);
    return food ? { food, from: 'network' } : { food: null, notFound: true, from: 'network' };
  } catch (e) {
    if (cached && cached.data) return { food: cached.data, from: 'cache', error: e.message };
    return { food: null, error: e.message };
  }
}
