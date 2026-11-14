import { create } from "zustand";
import { newIdempotencyKey, runCommand } from "./api";
import { useFrontOfficeStore, type HkStatus } from "./front-office-store";
import {
  GARMENT_LABEL,
  laundryBagDescription,
  laundryBagPreviewNet,
  type LaundryGarmentLine,
  type LaundryService,
  type LaundrySpeed,
} from "./laundry-pricing";

export type {
  GarmentKind,
  LaundryGarmentLine,
  LaundryService,
  LaundrySpeed,
} from "./laundry-pricing";
export {
  CATALOG_GARMENTS,
  GARMENT_LABEL,
  GARMENT_RATES,
  SERVICE_LABEL,
  catalogLineDefaults,
  laundryBagDescription,
  laundryBagPreviewNet,
  laundryLineNet,
  laundryServiceSpeedMult,
} from "./laundry-pricing";

export type Maid = {
  id: string;
  name: string;
  floor: number;
  activeRooms: string[];
};

export type WorkOrder = {
  id: string;
  roomNumber: string;
  roomId: string;
  category: "ac" | "plumbing" | "electrical" | "furniture";
  title: string;
  costNu: number;
  status: "open" | "in_progress" | "done";
  createdAt: string;
};

export type LaundryBag = {
  id: string;
  bagNo: string;
  stayId: string;
  roomNumber: string;
  guestName: string;
  service: LaundryService;
  speed: LaundrySpeed;
  garments: LaundryGarmentLine[];
  netAmount: number;
  status: "intake" | "in_plant" | "ready" | "delivered" | "posted";
  createdAt: string;
  dueAt: string;
};

type OpsState = {
  maids: Maid[];
  assignments: Record<string, string>;
  workOrders: WorkOrder[];
  bags: LaundryBag[];
  assignMaid: (roomId: string, maidId: string) => void;
  cycleHk: (roomId: string) => { ok: true; next: HkStatus } | { ok: false; error: string };
  setHk: (roomId: string, status: HkStatus) => { ok: true } | { ok: false; error: string };
  createWorkOrder: (input: {
    roomId: string;
    category: WorkOrder["category"];
    title: string;
    costNu: number;
    markOoo?: boolean;
  }) => { ok: true; id: string } | { ok: false; error: string };
  completeWorkOrder: (id: string) => { ok: true } | { ok: false; error: string };
  intakeBag: (input: {
    stayId: string;
    service: LaundryService;
    speed: LaundrySpeed;
    garments: LaundryGarmentLine[];
  }) => { ok: true; bag: LaundryBag } | { ok: false; error: string };
  advanceBag: (id: string) => { ok: true } | { ok: false; error: string };
  postBagToFolio: (
    id: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const HK_CYCLE: HkStatus[] = ["dirty", "clean", "inspected", "occupied", "ooo"];

let bagSeq = 40;
let woSeq = 12;

export const useOpsStore = create<OpsState>((set, get) => ({
  maids: [
    { id: "maid-1", name: "Dema Lhamo", floor: 1, activeRooms: [] },
    { id: "maid-2", name: "Pema Yangzom", floor: 2, activeRooms: [] },
    { id: "maid-3", name: "Kinley Choden", floor: 3, activeRooms: [] },
  ],
  assignments: {},
  workOrders: [
    {
      id: "wo-1",
      roomId: "rm-207",
      roomNumber: "207",
      category: "ac",
      title: "AC not cooling — compressor check",
      costNu: 4500,
      status: "in_progress",
      createdAt: new Date().toISOString(),
    },
  ],
  bags: [],

  assignMaid: (roomId, maidId) => {
    set((s) => ({
      assignments: { ...s.assignments, [roomId]: maidId },
      maids: s.maids.map((m) => {
        const without = m.activeRooms.filter((id) => id !== roomId);
        if (m.id === maidId) return { ...m, activeRooms: [...without, roomId] };
        return { ...m, activeRooms: without };
      }),
    }));
  },

  cycleHk: (roomId) => {
    const room = useFrontOfficeStore.getState().rooms.find((r) => r.id === roomId);
    if (!room) return { ok: false, error: "Room not found" };
    const idx = HK_CYCLE.indexOf(room.hkStatus);
    const next = HK_CYCLE[(idx + 1) % HK_CYCLE.length]!;
    const res = useFrontOfficeStore.getState().setRoomHkStatus(roomId, next, "HK Desk");
    if (!res.ok) return res;
    return { ok: true, next };
  },

  setHk: (roomId, status) =>
    useFrontOfficeStore.getState().setRoomHkStatus(roomId, status, "HK Desk"),

  createWorkOrder: ({ roomId, category, title, costNu, markOoo }) => {
    const room = useFrontOfficeStore.getState().rooms.find((r) => r.id === roomId);
    if (!room) return { ok: false, error: "Room not found" };
    if (markOoo) {
      const ooo = useFrontOfficeStore.getState().setRoomHkStatus(roomId, "ooo", "Maintenance");
      if (!ooo.ok) return ooo;
    }
    woSeq += 1;
    const id = `wo-${woSeq}`;
    set((s) => ({
      workOrders: [
        {
          id,
          roomId,
          roomNumber: room.number,
          category,
          title,
          costNu,
          status: "open",
          createdAt: new Date().toISOString(),
        },
        ...s.workOrders,
      ],
    }));
    return { ok: true, id };
  },

  completeWorkOrder: (id) => {
    const wo = get().workOrders.find((w) => w.id === id);
    if (!wo) return { ok: false, error: "Work order not found" };
    set((s) => ({
      workOrders: s.workOrders.map((w) =>
        w.id === id ? { ...w, status: "done" } : w,
      ),
    }));
    const room = useFrontOfficeStore.getState().rooms.find((r) => r.id === wo.roomId);
    if (room?.hkStatus === "ooo") {
      useFrontOfficeStore.getState().setRoomHkStatus(wo.roomId, "dirty", "Maintenance");
    }
    return { ok: true };
  },

  intakeBag: ({ stayId, service, speed, garments }) => {
    const stay = useFrontOfficeStore.getState().stays.find((s) => s.id === stayId);
    if (!stay || stay.status !== "checked_in") {
      return { ok: false, error: "Select an in-house stay" };
    }
    const cleaned: LaundryGarmentLine[] = garments
      .map((g) => ({
        id: g.id?.trim() || crypto.randomUUID(),
        kind: g.kind,
        label: g.label.trim() || (g.kind === "custom" ? "" : GARMENT_LABEL[g.kind]),
        qty: Math.max(0, Math.floor(g.qty)),
        unitNet: Math.max(0, Math.round(g.unitNet)),
      }))
      .filter((g) => g.qty > 0 && g.label.length > 0);
    if (cleaned.length === 0) {
      return { ok: false, error: "Add at least one cloth item" };
    }
    if (cleaned.some((g) => g.kind === "custom" && g.unitNet <= 0)) {
      return { ok: false, error: "Custom cloth needs a rate (Nu)" };
    }
    const netAmount = laundryBagPreviewNet(cleaned, service, speed);
    bagSeq += 1;
    const hours = speed === "express" ? 4 : 24;
    const due = new Date();
    due.setHours(due.getHours() + hours);
    const bag: LaundryBag = {
      id: crypto.randomUUID(),
      bagNo: `LB-${String(bagSeq).padStart(4, "0")}`,
      stayId,
      roomNumber: stay.roomNumber ?? "—",
      guestName: stay.guestName,
      service,
      speed,
      garments: cleaned,
      netAmount,
      status: "intake",
      createdAt: new Date().toISOString(),
      dueAt: due.toISOString(),
    };
    set((s) => ({ bags: [bag, ...s.bags] }));
    return { ok: true, bag };
  },

  advanceBag: (id) => {
    const bag = get().bags.find((b) => b.id === id);
    if (!bag) return { ok: false, error: "Bag not found" };
    const flow: LaundryBag["status"][] = [
      "intake",
      "in_plant",
      "ready",
      "delivered",
      "posted",
    ];
    const idx = flow.indexOf(bag.status);
    if (idx < 0 || idx >= flow.length - 2) {
      return { ok: false, error: "Use Post to Folio for final step" };
    }
    const next = flow[idx + 1]!;
    set((s) => ({
      bags: s.bags.map((b) => (b.id === id ? { ...b, status: next } : b)),
    }));
    return { ok: true };
  },

  postBagToFolio: async (id) => {
    const bag = get().bags.find((b) => b.id === id);
    if (!bag) return { ok: false, error: "Bag not found" };
    if (bag.status === "posted") return { ok: false, error: "Already posted" };
    if (bag.status !== "ready" && bag.status !== "delivered") {
      return { ok: false, error: "Mark ready/delivered before posting" };
    }
    const stay = useFrontOfficeStore.getState().stays.find((s) => s.id === bag.stayId);
    const folioId = stay?.apiFolioId;
    if (!folioId) {
      return { ok: false, error: "Stay missing API folio — cannot post laundry" };
    }
    const desc = laundryBagDescription(bag);
    const posted = await useFrontOfficeStore
      .getState()
      .postCharge(bag.stayId, desc, bag.netAmount, "laundry", "Laundry Desk");
    if (!posted.ok) return posted;
    const deliver = await runCommand("laundry.deliver", {
      orderId: bag.id,
      folioId,
      idempotencyKey: newIdempotencyKey(),
    });
    if (!deliver.ok) {
      return { ok: false, error: deliver.error };
    }
    set((s) => ({
      bags: s.bags.map((b) => (b.id === id ? { ...b, status: "posted" } : b)),
    }));
    return { ok: true };
  },
}));
