import { create } from "zustand";
import {
  appendWal,
  loadSnapshot,
  markWalStatus,
  newIdempotencyKey,
  saveSnapshot,
} from "./wal-db";
import type {
  DeskSnapshot,
  EngineCashTill,
  EngineExpense,
  EngineFolioCharge,
  EngineRoom,
  EngineStay,
  EngineSyncState,
  RoomHousekeepingStatus,
  WalLogEntry,
} from "./types";
import {
  expectedCashTillBtn,
  isBrowserOnline,
  isMoneySyncOp,
  OfflineMoneyError,
} from "./types";

export interface RamEngineState {
  propertyId: string;
  propertyName: string;
  syncState: EngineSyncState;
  lastSyncedAt: string | null;
  cashTill: EngineCashTill;
  rooms: EngineRoom[];
  stays: EngineStay[];
  expenses: EngineExpense[];
  walQueue: WalLogEntry[];
  staffId: string | null;
  staffName: string | null;

  hydrateEngine: (payload: DeskSnapshot) => Promise<void>;
  hydrateFromCache: (propertyId: string) => Promise<boolean>;
  setStaff: (staffId: string, staffName: string) => void;
  setSyncState: (syncState: EngineSyncState) => void;
  enqueueWal: (
    opType: WalLogEntry["opType"],
    payload: Record<string, unknown>,
    idempotencyKey?: string,
  ) => Promise<WalLogEntry>;
  checkInStay: (
    stayId: string,
    assignedRoomId: string,
    staffId: string,
  ) => Promise<string>;
  checkOutStay: (stayId: string, staffId: string) => Promise<string>;
  shiftRoom: (
    stayId: string,
    targetRoomId: string,
    staffId: string,
  ) => Promise<string>;
  setHousekeepingStatus: (
    roomId: string,
    status: RoomHousekeepingStatus,
    staffId: string,
  ) => Promise<string>;
  postFolioCharge: (charge: EngineFolioCharge) => Promise<string>;
  recordExpense: (expense: EngineExpense) => Promise<string>;
  recordCashSettlement: (amountBtn: number) => void;
  applyAckedOp: (opId: string) => Promise<void>;
  replaceWalQueue: (entries: WalLogEntry[]) => void;
}

const emptyTill: EngineCashTill = {
  openingBalanceBtn: 0,
  collectedCashBtn: 0,
  pettyCashOutflowBtn: 0,
  activeShiftStaffName: "",
  shiftStartedAt: new Date().toISOString(),
  shiftId: null,
};

async function journal(
  set: (
    partial:
      | Partial<RamEngineState>
      | ((s: RamEngineState) => Partial<RamEngineState>),
  ) => void,
  get: () => RamEngineState,
  opType: WalLogEntry["opType"],
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<WalLogEntry> {
  if (isMoneySyncOp(opType) && !isBrowserOnline()) {
    throw new OfflineMoneyError(opType);
  }

  const entry: WalLogEntry = {
    opId: `wal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    opType,
    payload,
    timestamp: new Date().toISOString(),
    idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
    status: "pending",
  };
  try {
    await appendWal(entry);
  } catch (err) {
    console.error("[engine.journal] IndexedDB append failed", {
      opType,
      err,
    });
    if (isMoneySyncOp(opType)) {
      throw new Error(
        `Could not persist ${opType} WAL — money ops require durable storage`,
      );
    }
    // Non-money: keep in-memory queue only (SSR / no IndexedDB)
  }
  set((s) => ({
    walQueue: [...s.walQueue, entry],
    syncState: isBrowserOnline() ? s.syncState : "offline_buffered",
  }));
  void get;
  return entry;
}

export const useRamEngine = create<RamEngineState>((set, get) => ({
  propertyId: "",
  propertyName: "",
  syncState: "synced",
  lastSyncedAt: null,
  cashTill: emptyTill,
  rooms: [],
  stays: [],
  expenses: [],
  walQueue: [],
  staffId: null,
  staffName: null,

  setStaff: (staffId, staffName) => set({ staffId, staffName }),

  hydrateEngine: async (payload) => {
    set({
      propertyId: payload.propertyId,
      propertyName: payload.propertyName,
      rooms: payload.rooms,
      stays: payload.stays,
      cashTill: payload.cashTill,
      expenses: payload.expenses ?? [],
      lastSyncedAt: payload.syncedAt,
      syncState: "synced",
    });
    try {
      await saveSnapshot(payload);
    } catch (err) {
      console.error("[engine.hydrateEngine] saveSnapshot failed", { err });
    }
  },

  hydrateFromCache: async (propertyId) => {
    try {
      const snap = await loadSnapshot(propertyId);
      if (!snap) return false;
      await get().hydrateEngine(snap);
      set({ syncState: "offline_buffered" });
      return true;
    } catch (err) {
      console.error("[engine.hydrateFromCache] failed", { propertyId, err });
      return false;
    }
  },

  setSyncState: (syncState) => set({ syncState }),

  enqueueWal: (opType, payload, idempotencyKey) =>
    journal(set, get, opType, payload, idempotencyKey),

  checkInStay: async (stayId, assignedRoomId, staffId) => {
    const room = get().rooms.find((r) => r.id === assignedRoomId);
    set((state) => ({
      stays: state.stays.map((stay) =>
        stay.id === stayId
          ? {
              ...stay,
              status: "in_house" as const,
              roomId: assignedRoomId,
              roomNumber: room?.roomNumber,
            }
          : stay,
      ),
      rooms: state.rooms.map((r) =>
        r.id === assignedRoomId
          ? { ...r, occupiedStayId: stayId, status: "clean" as const }
          : r,
      ),
    }));
    const entry = await journal(set, get, "check_in", {
      stayId,
      assignedRoomId,
      staffId,
    });
    return entry.idempotencyKey;
  },

  checkOutStay: async (stayId, staffId) => {
    const stay = get().stays.find((s) => s.id === stayId);
    const roomId = stay?.roomId;
    set((state) => ({
      stays: state.stays.map((s) =>
        s.id === stayId ? { ...s, status: "checked_out" as const } : s,
      ),
      rooms: state.rooms.map((r) =>
        r.id === roomId
          ? { ...r, status: "dirty" as const, occupiedStayId: null }
          : r,
      ),
    }));
    const entry = await journal(set, get, "check_out", {
      stayId,
      roomId,
      staffId,
    });
    return entry.idempotencyKey;
  },

  shiftRoom: async (stayId, targetRoomId, staffId) => {
    const stay = get().stays.find((s) => s.id === stayId);
    const oldRoomId = stay?.roomId;
    const target = get().rooms.find((r) => r.id === targetRoomId);
    set((state) => ({
      stays: state.stays.map((s) =>
        s.id === stayId
          ? { ...s, roomId: targetRoomId, roomNumber: target?.roomNumber }
          : s,
      ),
      rooms: state.rooms.map((r) => {
        if (r.id === oldRoomId)
          return { ...r, status: "dirty" as const, occupiedStayId: null };
        if (r.id === targetRoomId) return { ...r, occupiedStayId: stayId };
        return r;
      }),
    }));
    const entry = await journal(set, get, "shift_room", {
      stayId,
      oldRoomId,
      targetRoomId,
      staffId,
    });
    return entry.idempotencyKey;
  },

  setHousekeepingStatus: async (roomId, status, staffId) => {
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, status } : r)),
    }));
    const entry = await journal(set, get, "housekeeping", {
      roomId,
      status,
      staffId,
    });
    return entry.idempotencyKey;
  },

  postFolioCharge: async (charge) => {
    if (!isBrowserOnline()) {
      throw new OfflineMoneyError("post_charge");
    }
    const key = charge.idempotencyKey ?? newIdempotencyKey();
    // Optimistic UI only while online — server RPC is source of truth on flush
    set((state) => ({
      stays: state.stays.map((s) => {
        if (s.id !== charge.stayId) return s;
        const folioCharges = [...s.folioCharges, { ...charge, idempotencyKey: key }];
        const totalBilledBtn = folioCharges.reduce((a, c) => a + c.totalBtn, 0);
        return {
          ...s,
          folioCharges,
          totalBilledBtn,
          balanceDueBtn: totalBilledBtn - s.totalPaidBtn,
        };
      }),
    }));
    const entry = await journal(
      set,
      get,
      "post_charge",
      { charge: { ...charge, idempotencyKey: key } },
      key,
    );
    return entry.idempotencyKey;
  },

  recordExpense: async (expense) => {
    if (!isBrowserOnline()) {
      throw new OfflineMoneyError("record_expense");
    }
    const key = expense.idempotencyKey ?? newIdempotencyKey();
    set((state) => {
      const expenses = [...state.expenses, { ...expense, idempotencyKey: key }];
      let cashTill = state.cashTill;
      if (expense.paidVia === "front_till") {
        cashTill = {
          ...cashTill,
          pettyCashOutflowBtn:
            Number(cashTill.pettyCashOutflowBtn) + Number(expense.amountBtn),
        };
      }
      return { expenses, cashTill };
    });
    const entry = await journal(
      set,
      get,
      "record_expense",
      { expense: { ...expense, idempotencyKey: key } },
      key,
    );
    return entry.idempotencyKey;
  },

  recordCashSettlement: (amountBtn) => {
    if (!isBrowserOnline()) {
      throw new OfflineMoneyError("record_payment");
    }
    set((state) => ({
      cashTill: {
        ...state.cashTill,
        collectedCashBtn:
          Number(state.cashTill.collectedCashBtn) + Number(amountBtn),
      },
    }));
  },

  applyAckedOp: async (opId) => {
    try {
      await markWalStatus(opId, "acked");
    } catch (err) {
      console.error("[engine.applyAckedOp] markWalStatus failed", { opId, err });
    }
    set((s) => ({
      walQueue: s.walQueue.map((e) =>
        e.opId === opId ? { ...e, status: "acked" as const } : e,
      ),
      syncState: s.walQueue.every(
        (e) => e.opId === opId || e.status === "acked",
      )
        ? "synced"
        : s.syncState,
    }));
  },

  replaceWalQueue: (entries) => set({ walQueue: entries }),
}));

export { expectedCashTillBtn };
export function getExpectedCashTillBtn(till: EngineCashTill): number {
  return expectedCashTillBtn(till);
}
