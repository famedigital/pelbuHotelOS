/**
 * IndexedDB offline queue for desk critical paths.
 * Queues: hold drafts, book drafts, POS park tickets.
 * Money posts (folio charge/payment) are NOT queued — too risky offline.
 */

export type DeskOfflineKind = "hold_draft" | "book_draft" | "pos_park";

export type DeskOfflineItem = {
  id: string;
  kind: DeskOfflineKind;
  createdAt: string;
  payload: Record<string, unknown>;
  attempts: number;
  lastError?: string;
};

const DB_NAME = "pelbu-desk-offline";
const STORE = "queue";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB tx aborted"));
  });
}

export async function enqueueDeskOffline(
  kind: DeskOfflineKind,
  payload: Record<string, unknown>,
): Promise<DeskOfflineItem> {
  const item: DeskOfflineItem = {
    id: crypto.randomUUID(),
    kind,
    createdAt: new Date().toISOString(),
    payload,
    attempts: 0,
  };
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    await txDone(tx);
    return item;
  } finally {
    db.close();
  }
}

export async function listDeskOffline(): Promise<DeskOfflineItem[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const items = await new Promise<DeskOfflineItem[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as DeskOfflineItem[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    await txDone(tx);
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } finally {
    db.close();
  }
}

export async function removeDeskOffline(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function updateDeskOffline(
  id: string,
  patch: Partial<Pick<DeskOfflineItem, "attempts" | "lastError" | "payload">>,
): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const existing = await new Promise<DeskOfflineItem | undefined>((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as DeskOfflineItem | undefined);
      req.onerror = () => reject(req.error);
    });
    if (existing) {
      store.put({ ...existing, ...patch });
    }
    await txDone(tx);
  } finally {
    db.close();
  }
}

export const DESK_OFFLINE_QUEUED_KINDS: Record<DeskOfflineKind, string> = {
  hold_draft: "Room hold draft (dates, guest, room type)",
  book_draft: "Booking draft form payload",
  pos_park: "POS park ticket (items + outlet; settle online)",
};
