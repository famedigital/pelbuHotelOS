/**
 * IndexedDB offline command buffer — queues money/ops commands when API is
 * unreachable and replays with the original idempotency keys when online.
 */

const DB_NAME = "hos-v2-offline";
const DB_VERSION = 1;
const STORE = "command_queue";

export type OfflineQueuedCommand = {
  id: string;
  command: string;
  input: Record<string, unknown>;
  enqueuedAt: string;
  attempts: number;
  lastError?: string;
};

export type OfflineBufferSnapshot = {
  pending: number;
  online: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
};

type Listener = (snap: OfflineBufferSnapshot) => void;

let dbPromise: Promise<IDBDatabase> | null = null;
let syncing = false;
let lastSyncAt: string | null = null;
let lastError: string | null = null;
const listeners = new Set<Listener>();

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("INDEXEDDB_UNAVAILABLE"));
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
    req.onerror = () =>
      reject(req.error ?? new Error("INDEXEDDB_OPEN_FAILED"));
  });
  return dbPromise;
}

function notify(pending: number): void {
  const snap: OfflineBufferSnapshot = {
    pending,
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    syncing,
    lastSyncAt,
    lastError,
  };
  for (const fn of listeners) fn(snap);
}

async function countPending(): Promise<number> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[offline-buffer] count failed", { err: msg });
    return 0;
  }
}

export function subscribeOfflineBuffer(fn: Listener): () => void {
  listeners.add(fn);
  void countPending().then((n) => fn({
    pending: n,
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    syncing,
    lastSyncAt,
    lastError,
  }));
  return () => {
    listeners.delete(fn);
  };
}

export async function enqueueOfflineCommand(
  command: string,
  input: Record<string, unknown>,
): Promise<OfflineQueuedCommand> {
  const idempotencyKey =
    typeof input.idempotencyKey === "string" && input.idempotencyKey.length > 0
      ? input.idempotencyKey
      : crypto.randomUUID();
  const sealedInput: Record<string, unknown> = {
    ...input,
    idempotencyKey,
  };
  const row: OfflineQueuedCommand = {
    id: crypto.randomUUID(),
    command,
    input: sealedInput,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
  };
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const n = await countPending();
    notify(n);
    return row;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[offline-buffer] enqueue failed", { command, err: msg });
    lastError = msg;
    notify(await countPending());
    throw err;
  }
}

async function listAll(): Promise<OfflineQueuedCommand[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve((req.result as OfflineQueuedCommand[]).sort((a, b) =>
        a.enqueuedAt.localeCompare(b.enqueuedAt),
      ));
    req.onerror = () => reject(req.error);
  });
}

async function remove(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function bumpAttempt(row: OfflineQueuedCommand, error: string): Promise<void> {
  const db = await openDb();
  const next: OfflineQueuedCommand = {
    ...row,
    attempts: row.attempts + 1,
    lastError: error,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(next);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export type ReplayFn = (
  command: string,
  input: Record<string, unknown>,
) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;

export async function flushOfflineBuffer(
  replay: ReplayFn,
): Promise<{ flushed: number; failed: number }> {
  if (syncing) return { flushed: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    notify(await countPending());
    return { flushed: 0, failed: 0 };
  }
  syncing = true;
  lastError = null;
  notify(await countPending());

  let flushed = 0;
  let failed = 0;
  try {
    const rows = await listAll();
    for (const row of rows) {
      const res = await replay(row.command, row.input);
      if (res.ok) {
        await remove(row.id);
        flushed += 1;
      } else if (res.error === "API_UNREACHABLE") {
        failed += 1;
        lastError = res.error;
        break;
      } else {
        await bumpAttempt(row, res.error);
        failed += 1;
        lastError = res.error;
      }
    }
    lastSyncAt = new Date().toISOString();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[offline-buffer] flush failed", { err: msg });
    lastError = msg;
    failed += 1;
  } finally {
    syncing = false;
    notify(await countPending());
  }
  return { flushed, failed };
}

export async function getOfflinePendingCount(): Promise<number> {
  return countPending();
}
