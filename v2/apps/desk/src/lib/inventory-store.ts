import { create } from "zustand";

export type StockSku = {
  id: string;
  code: string;
  name: string;
  uom: string;
  onHand: number;
  reorderAt: number;
  category: "kitchen" | "bar" | "housekeeping" | "other";
};

export type StockMovement = {
  id: string;
  skuId: string;
  delta: number;
  reason: "purchase" | "adjust" | "waste" | "count";
  note: string;
  at: string;
  ref?: string;
};

export type PurchaseLineInput = {
  skuId: string;
  name: string;
  qty: number;
  uom: string;
  unitCost: number;
};

type InventoryState = {
  skus: StockSku[];
  movements: StockMovement[];
  receiveStock: (
    lines: PurchaseLineInput[],
    ref?: string,
  ) => { ok: true; applied: number } | { ok: false; error: string };
  adjustStock: (input: {
    skuId: string;
    delta: number;
    reason: "adjust" | "waste" | "count";
    note: string;
  }) => { ok: true } | { ok: false; error: string };
};

const SEED: StockSku[] = [
  {
    id: "sku-flour",
    code: "KIT-FLOUR",
    name: "All-purpose flour",
    uom: "kg",
    onHand: 42,
    reorderAt: 20,
    category: "kitchen",
  },
  {
    id: "sku-rice",
    code: "KIT-RICE",
    name: "Red rice (Bhutan)",
    uom: "kg",
    onHand: 28,
    reorderAt: 15,
    category: "kitchen",
  },
  {
    id: "sku-oil",
    code: "KIT-OIL",
    name: "Cooking oil",
    uom: "L",
    onHand: 18,
    reorderAt: 10,
    category: "kitchen",
  },
  {
    id: "sku-beer",
    code: "BAR-DRUK",
    name: "Druk Lager 330ml",
    uom: "case",
    onHand: 12,
    reorderAt: 6,
    category: "bar",
  },
  {
    id: "sku-wine",
    code: "BAR-WINE",
    name: "House red wine",
    uom: "btl",
    onHand: 24,
    reorderAt: 8,
    category: "bar",
  },
  {
    id: "sku-spirit",
    code: "BAR-ARA",
    name: "Ara / local spirit",
    uom: "btl",
    onHand: 9,
    reorderAt: 4,
    category: "bar",
  },
  {
    id: "sku-towel",
    code: "HK-TOWEL",
    name: "Bath towels",
    uom: "pc",
    onHand: 86,
    reorderAt: 40,
    category: "housekeeping",
  },
  {
    id: "sku-soap",
    code: "HK-SOAP",
    name: "Guest soap bars",
    uom: "box",
    onHand: 14,
    reorderAt: 5,
    category: "housekeeping",
  },
];

export const useInventoryStore = create<InventoryState>((set, get) => ({
  skus: SEED,
  movements: [],

  receiveStock: (lines, ref) => {
    if (!lines.length) return { ok: false, error: "No stock lines to receive" };
    let applied = 0;
    const moves: StockMovement[] = [];
    set((s) => {
      const skus = s.skus.map((sku) => ({ ...sku }));
      for (const line of lines) {
        if (line.qty <= 0) continue;
        const idx = skus.findIndex((x) => x.id === line.skuId);
        if (idx === -1) continue;
        skus[idx] = {
          ...skus[idx]!,
          onHand: Math.round((skus[idx]!.onHand + line.qty) * 100) / 100,
        };
        moves.push({
          id: crypto.randomUUID(),
          skuId: line.skuId,
          delta: line.qty,
          reason: "purchase",
          note: line.name,
          at: new Date().toISOString(),
          ref,
        });
        applied += 1;
      }
      return {
        skus,
        movements: [...moves, ...s.movements].slice(0, 200),
      };
    });
    if (applied === 0) return { ok: false, error: "No matching SKUs for lines" };
    return { ok: true, applied };
  },

  adjustStock: ({ skuId, delta, reason, note }) => {
    const sku = get().skus.find((s) => s.id === skuId);
    if (!sku) return { ok: false, error: "SKU not found" };
    if (!note.trim()) return { ok: false, error: "Reason note required" };
    const next = Math.round((sku.onHand + delta) * 100) / 100;
    if (next < 0) return { ok: false, error: "On-hand cannot go negative" };
    set((s) => ({
      skus: s.skus.map((x) => (x.id === skuId ? { ...x, onHand: next } : x)),
      movements: [
        {
          id: crypto.randomUUID(),
          skuId,
          delta,
          reason,
          note: note.trim(),
          at: new Date().toISOString(),
        },
        ...s.movements,
      ].slice(0, 200),
    }));
    return { ok: true };
  },
}));

export function lowStockSkus(skus: StockSku[]): StockSku[] {
  return skus.filter((s) => s.onHand <= s.reorderAt);
}
