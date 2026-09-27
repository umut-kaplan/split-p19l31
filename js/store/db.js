/* IndexedDB für Bilder und größere Daten. Alle Stores werden in Version 1 angelegt,
   damit kein Modul die Datenbank-Version hochzählen muss. Jeder Eintrag hat ein Feld id. */
const DB_NAME = 'split';
const DB_VERSION = 1;
export const STORES = ['photos', 'exerciseImages', 'foodCache'];

let dbp = null;
function open() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('Dieser Browser hat kein IndexedDB.'));
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbp = null; reject(req.error); };
    });
  }
  return dbp;
}

function run(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const dbGet = (store, id) => run(store, 'readonly', s => s.get(id));
export const dbAll = store => run(store, 'readonly', s => s.getAll());
export const dbPut = (store, obj) => run(store, 'readwrite', s => s.put(obj));
export const dbDel = (store, id) => run(store, 'readwrite', s => s.delete(id));
export const dbClear = store => run(store, 'readwrite', s => s.clear());
