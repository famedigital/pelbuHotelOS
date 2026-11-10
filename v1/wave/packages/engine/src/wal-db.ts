import Dexie, { type Table } from "dexie";
import type { DeskSnapshot, WalLogEntry } from "./types";

export class HotelOsWalDb extends Dexie {
  wal!: Table<WalLogEntry, string>;
  snapshots!: Table<DeskSnapshot & { id: string }, string>;

  constructor() {
    super("hotel_os_v2_wal");
    this.version(1).stores({
      wal: "opId, status, timestamp, opType",
      snapshots: "id, propertyId, syncedAt",
    });
  }
}

let dbSingleton: HotelOsWalDb | null = null;

export function getWalDb(): HotelOsWalDb {
  if (typeof indexedDB === "undefined") {
    throw new Error("@hotel-os/engine: IndexedDB unavailable (SSR?)");
  }
  if (!dbSingleton) dbSingleton = new HotelOsWalDb();
  return dbSingleton;
}

export async function appendWal(entry: WalLogEntry): Promise<void> {
  await getWalDb().wal.put(entry);
}

export async function listPendingWal(): Promise<WalLogEntry[]> {
  return getWalDb().wal.where("status").anyOf(["pending", "failed"]).toArray();
}

export async function markWalStatus(
  opId: string,
  status: WalLogEntry["status"],
  lastError?: string,
): Promise<void> {
  await getWalDb().wal.update(opId, { status, lastError });
}

export async function saveSnapshot(snapshot: DeskSnapshot): Promise<void> {
  await getWalDb().snapshots.put({ ...snapshot, id: snapshot.propertyId });
}

export async function loadSnapshot(
  propertyId: string,
): Promise<DeskSnapshot | undefined> {
  return getWalDb().snapshots.get(propertyId);
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
