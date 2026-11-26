/**
 * Where scan corrections wait on this device until they are exported: one IndexedDB row
 * per sample. Not localStorage — its small quota is shared with saved teams, and images
 * would fill it.
 *
 * Every function rejects when IndexedDB is missing or blocked (jsdom, some private modes);
 * callers treat that as "nothing saved".
 */
export interface CorrectionSample {
  /** Content hash of the crop (see cropKey): the same crop always lands on the same row. */
  key: string;
  /** The species the user picked. */
  id: number;
  /** What the scan showed for this slot before the user changed it; null when it showed nothing. */
  predicted: number | null;
  /** The crop as base64 PNG. */
  png: string;
}

/** The file ScanCorrectionsExport downloads and scripts/import-scan-corrections.ts reads. */
export interface CorrectionsExport { version: 1; samples: CorrectionSample[] }

/** Most users never export, so the store must not grow without bound. */
export const MAX_SAMPLES = 200;

const DB_NAME = 'vgc-scan-corrections';
const STORE = 'samples';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE, { keyPath: 'key' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// One short-lived connection per call: a cached one would be held open for as long as the
// page lives, and writes here are a few per session.
async function inStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => T): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Saves samples, replacing any with the same key. Once the store is full, further samples — replacements included — are dropped until it is cleared. */
export async function putSamples(samples: CorrectionSample[]): Promise<void> {
  await inStore('readwrite', (store) => {
    const counting = store.count();
    counting.onsuccess = () => {
      for (const sample of samples.slice(0, Math.max(0, MAX_SAMPLES - counting.result))) store.put(sample);
    };
  });
}

export async function listSamples(): Promise<CorrectionSample[]> {
  return (await inStore('readonly', (store) => store.getAll() as IDBRequest<CorrectionSample[]>)).result;
}

export async function countSamples(): Promise<number> {
  return (await inStore('readonly', (store) => store.count())).result;
}

export async function clearSamples(): Promise<void> {
  await inStore('readwrite', (store) => { store.clear(); });
}
