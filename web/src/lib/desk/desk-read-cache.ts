/**
 * Property-scoped IndexedDB read cache for desk FO (SWR).
 * Advisory UI speed only — never authorizes money or KOT.
 */

export const DESK_READ_CACHE_DB = "pelbu-desk-read-cache";
export const DESK_READ_CACHE_STORE = "snapshots";
export const DESK_READ_CACHE_SCHEMA = 1 as const;

export type DeskReadCacheRecord<T = unknown> = {
  key: string;
  propertyId: string;
  schemaVersion: typeof DESK_READ_CACHE_SCHEMA;
  updatedAt: string;
  expiresAt: string;
  payloadHash: string;
  payload: T;
};

export type DeskCacheTtl = {
  softMs: number;
  hardMs: number;
};

export const DESK_CACHE_TTL = {
  posBootstrap: { softMs: 5 * 60_000, hardMs: 24 * 60 * 60_000 },
  posTickets: { softMs: 30_000, hardMs: 2 * 60 * 60_000 },
  reservationsList: { softMs: 2 * 60_000, hardMs: 12 * 60 * 60_000 },
  stayhubSummary: { softMs: 60_000, hardMs: 4 * 60 * 60_000 },
  stayhubMoney: { softMs: 30_000, hardMs: 60 * 60_000 },
  stayhubCatalog: { softMs: 30 * 60_000, hardMs: 7 * 24 * 60 * 60_000 },
} as const satisfies Record<string, DeskCacheTtl>;

export function isDeskReadCacheEnabled(): boolean {
  if (typeof process === "undefined") return true;
  const v =
    process.env.NEXT_PUBLIC_DESK_READ_CACHE ??
    process.env.DESK_READ_CACHE ??
    "1";
  return v !== "0" && v !== "false";
}

export function deskCacheKey(
  surface: string,
  propertyId: string,
  rest?: string,
): string {
  const base = `${surface}:p:${propertyId}`;
  return rest ? `${base}:${rest}` : base;
}

/** Stable hash for toast dedupe / change detection. */
export function hashDeskPayload(payload: unknown): string {
  const s = stableStringify(payload);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function isSoftFresh(record: DeskReadCacheRecord, now = Date.now()): boolean {
  const softEnd =
    new Date(record.updatedAt).getTime() +
    (new Date(record.expiresAt).getTime() - new Date(record.updatedAt).getTime()) *
      0.25;
  // Soft = first quarter of hard window is not enough; use explicit soft via ttl param on write
  return now < new Date(record.expiresAt).getTime();
}

export function isHardExpired(
  record: DeskReadCacheRecord,
  now = Date.now(),
): boolean {
  return now >= new Date(record.expiresAt).getTime();
}

/** Soft expired if older than softMs from updatedAt; hard if past expiresAt. */
export function classifyFreshness(
  record: DeskReadCacheRecord,
  softMs: number,
  now = Date.now(),
): "fresh" | "stale" | "expired" {
  if (now >= new Date(record.expiresAt).getTime()) return "expired";
  if (now >= new Date(record.updatedAt).getTime() + softMs) return "stale";
  return "fresh";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DESK_READ_CACHE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DESK_READ_CACHE_STORE)) {
        const store = db.createObjectStore(DESK_READ_CACHE_STORE, {
          keyPath: "key",
        });
        store.createIndex("propertyId", "propertyId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

export async function getDeskReadCache<T>(
  key: string,
  propertyId: string,
): Promise<DeskReadCacheRecord<T> | null> {
  if (!isDeskReadCacheEnabled()) return null;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DESK_READ_CACHE_STORE, "readonly");
      const req = tx.objectStore(DESK_READ_CACHE_STORE).get(key);
      req.onsuccess = () => {
        const row = req.result as DeskReadCacheRecord<T> | undefined;
        if (!row) {
          resolve(null);
          return;
        }
        if (
          row.schemaVersion !== DESK_READ_CACHE_SCHEMA ||
          row.propertyId !== propertyId
        ) {
          resolve(null);
          return;
        }
        if (isHardExpired(row)) {
          resolve(null);
          return;
        }
        resolve(row);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setDeskReadCache<T>(args: {
  key: string;
  propertyId: string;
  payload: T;
  hardMs: number;
}): Promise<DeskReadCacheRecord<T> | null> {
  if (!isDeskReadCacheEnabled()) return null;
  const now = new Date();
  const record: DeskReadCacheRecord<T> = {
    key: args.key,
    propertyId: args.propertyId,
    schemaVersion: DESK_READ_CACHE_SCHEMA,
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + args.hardMs).toISOString(),
    payloadHash: hashDeskPayload(args.payload),
    payload: args.payload,
  };
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DESK_READ_CACHE_STORE, "readwrite");
      tx.objectStore(DESK_READ_CACHE_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return record;
  } catch {
    return null;
  }
}

export async function deleteDeskReadCache(key: string): Promise<void> {
  if (!isDeskReadCacheEnabled()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DESK_READ_CACHE_STORE, "readwrite");
      tx.objectStore(DESK_READ_CACHE_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function deleteDeskReadCacheByProperty(
  propertyId: string,
): Promise<void> {
  if (!isDeskReadCacheEnabled()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DESK_READ_CACHE_STORE, "readwrite");
      const store = tx.objectStore(DESK_READ_CACHE_STORE);
      const idx = store.index("propertyId");
      const req = idx.openCursor(IDBKeyRange.only(propertyId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function purgeExpiredDeskReadCache(
  now = Date.now(),
): Promise<number> {
  if (!isDeskReadCacheEnabled()) return 0;
  let removed = 0;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DESK_READ_CACHE_STORE, "readwrite");
      const store = tx.objectStore(DESK_READ_CACHE_STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const row = cursor.value as DeskReadCacheRecord;
        if (isHardExpired(row, now)) {
          cursor.delete();
          removed += 1;
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return removed;
  }
  return removed;
}

/** Invalidate common keys after Fast Book / POS writes. */
export async function invalidateDeskCachesAfterBooking(
  propertyId: string,
): Promise<void> {
  const prefixes = [
    deskCacheKey("reservations:list", propertyId),
    deskCacheKey("pos:bootstrap", propertyId),
    deskCacheKey("pos:tickets", propertyId),
  ];
  for (const key of prefixes) {
    await deleteDeskReadCache(key);
  }
  // Also wipe bucket variants by scanning property
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DESK_READ_CACHE_STORE, "readwrite");
      const store = tx.objectStore(DESK_READ_CACHE_STORE);
      const idx = store.index("propertyId");
      const req = idx.openCursor(IDBKeyRange.only(propertyId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const row = cursor.value as DeskReadCacheRecord;
        if (
          row.key.startsWith(`reservations:list:p:${propertyId}`) ||
          row.key.startsWith(`stayhub:summary:p:${propertyId}`) ||
          row.key.startsWith(`stayhub:money:p:${propertyId}`)
        ) {
          cursor.delete();
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}
