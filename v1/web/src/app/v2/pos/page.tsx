"use client";

import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Trash2,
  Plus,
  Minus,
  QrCode,
  CreditCard,
  Building2,
  Printer,
  Flame,
  Info,
  Loader2,
  ChefHat,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { NeoGlassCard, TactileButton, OdometerTicker } from "@/components/ui/neo-spatial";
import { useRamEngine } from "@hotel-os/engine";
import {
  deskFetchJson,
  newIdempotencyKey,
  DeskApiError,
} from "@/lib/v2/desk-api-client";
import { readV2DeskToken } from "@/lib/v2/desk-api";
import { refreshV2DeskEngine } from "@/lib/v2/rehydrate-engine";

type MenuPayload = {
  items: Array<{
    id: string;
    name: string;
    priceBtn: number;
    category: string;
    outletId: string;
    prepStation: string | null;
  }>;
};

type KdsTicket = {
  id: string;
  status: string;
  station: string;
  created_at: string;
  orders: {
    id: string;
    table_label: string | null;
    booking_id: string | null;
    total_btn: number;
    order_lines: Array<{
      id: string;
      name: string;
      qty: number;
      notes: string | null;
      status: string;
    }>;
  };
};

function encodeSimpleReceipt(lines: string[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: number[] = [0x1b, 0x40];
  for (const line of lines) {
    chunks.push(...enc.encode(line), 0x0a);
  }
  chunks.push(0x1d, 0x56, 0x00);
  return new Uint8Array(chunks);
}

export default function V2PosPage() {
  const { stays } = useRamEngine();
  const signedIn = Boolean(readV2DeskToken());

  const [menu, setMenu] = useState<MenuPayload | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cart, setCart] = useState<
    { itemId: string; name: string; unitPriceBtn: number; qty: number }[]
  >([]);
  const [selectedStayId, setSelectedStayId] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<string>("T-04");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [kdsTickets, setKdsTickets] = useState<KdsTicket[]>([]);
  const [kdsError, setKdsError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const inHouseStays = stays.filter((s) => s.status === "in_house");

  useEffect(() => {
    if (inHouseStays.length === 0) {
      setSelectedStayId("");
      return;
    }
    setSelectedStayId((prev) => {
      if (prev && inHouseStays.some((s) => s.id === prev)) return prev;
      return inHouseStays[0]!.id;
    });
  }, [inHouseStays]);

  const selectedStay = inHouseStays.find((s) => s.id === selectedStayId);

  const loadMenu = useCallback(() => {
    if (!signedIn) return;
    start(async () => {
      try {
        setMenuError(null);
        const data = await deskFetchJson<MenuPayload>("/v1/pos/menu");
        setMenu(data);
      } catch (err) {
        console.error("[v2/pos] menu", err);
        setMenuError(err instanceof Error ? err.message : String(err));
      }
    });
  }, [signedIn]);

  const loadKds = useCallback(() => {
    if (!signedIn) return;
    start(async () => {
      try {
        setKdsError(null);
        const data = await deskFetchJson<{ tickets: KdsTicket[] }>("/v1/kds/tickets");
        setKdsTickets(data.tickets ?? []);
      } catch (err) {
        console.error("[v2/pos] kds", err);
        setKdsError(err instanceof Error ? err.message : String(err));
      }
    });
  }, [signedIn]);

  useEffect(() => {
    loadMenu();
    loadKds();
    const t = window.setInterval(loadKds, 8000);
    return () => window.clearInterval(t);
  }, [loadMenu, loadKds]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const i of menu?.items ?? []) {
      cats.add(i.category || "General");
    }
    return ["all", ...Array.from(cats).sort()];
  }, [menu]);

  const filteredItems = useMemo(() => {
    const items = menu?.items ?? [];
    if (activeCategory === "all") return items;
    return items.filter((i) => (i.category || "General") === activeCategory);
  }, [menu, activeCategory]);

  const addToCart = (item: MenuPayload["items"][0]) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c,
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          unitPriceBtn: item.priceBtn,
          qty: 1,
        },
      ];
    });
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      const next: typeof prev = [];
      for (const c of prev) {
        if (c.itemId !== itemId) {
          next.push(c);
          continue;
        }
        const q = c.qty + delta;
        if (q > 0) next.push({ ...c, qty: q });
      }
      return next;
    });
  };

  const clearCart = () => setCart([]);

  const subtotalBtn = cart.reduce((s, c) => s + c.unitPriceBtn * c.qty, 0);
  const serviceChargeBtn = subtotalBtn * 0.1;
  const bstTaxBtn = (subtotalBtn + serviceChargeBtn) * 0.1;
  const grandTotalBtn = subtotalBtn + serviceChargeBtn + bstTaxBtn;

  const postFolioChargeForCart = async () => {
    if (!signedIn) {
      toast.error("Sign in on /v2 first.");
      return;
    }
    if (!selectedStay) {
      showToast("Select an in-house stay (snapshot) to post a room folio charge.");
      return;
    }
    start(async () => {
      try {
        const idem = newIdempotencyKey();
        const description = `POS [${selectedTable}]: ${cart.map((c) => `${c.qty}× ${c.name}`).join(", ")}`.slice(0, 200);
        await deskFetchJson("/v1/folio/charge", {
          method: "POST",
          body: JSON.stringify({
            bookingId: selectedStay.id,
            description,
            amountBtn: Math.round(grandTotalBtn * 100) / 100,
            kind: "order",
            idempotencyKey: idem,
          }),
        });
        toast.success("Room folio charge posted");
        clearCart();
        await refreshV2DeskEngine();
      } catch (err) {
        console.error("[v2/pos] folio charge", err);
        toast.error(err instanceof DeskApiError ? err.message : String(err));
      }
    });
  };

  const postCashPayment = async () => {
    if (!signedIn) {
      toast.error("Sign in on /v2 first.");
      return;
    }
    if (!selectedStay) {
      showToast("Select an in-house stay to apply walk-in cash to that folio, or use Innora for house cashier.");
      return;
    }
    start(async () => {
      try {
        await deskFetchJson("/v1/folio/payment", {
          method: "POST",
          body: JSON.stringify({
            bookingId: selectedStay.id,
            amountBtn: Math.round(grandTotalBtn * 100) / 100,
            method: "cash",
            kind: "settlement",
            reference: `POS ${selectedTable}`,
            idempotencyKey: newIdempotencyKey(),
          }),
        });
        toast.success("Cash payment recorded on folio");
        clearCart();
        await refreshV2DeskEngine();
      } catch (err) {
        console.error("[v2/pos] payment", err);
        toast.error(err instanceof DeskApiError ? err.message : String(err));
      }
    });
  };

  const submitPosOrder = async (postToFolio: boolean) => {
    if (!signedIn) {
      toast.error("Sign in on /v2 first.");
      return;
    }
    if (cart.length === 0) return;
    start(async () => {
      try {
        const idem = newIdempotencyKey();
        const body = {
          idempotencyKey: idem,
          bookingId: postToFolio ? selectedStay?.id ?? null : null,
          tableLabel: selectedTable,
          fireKot: true,
          lines: cart.map((c) => ({
            menuItemId: c.itemId,
            name: c.name,
            qty: c.qty,
            unitPriceBtn: c.unitPriceBtn,
          })),
        };
        const res = await deskFetchJson<{ orderId: string; kotStatus: string; totalBtn: number }>(
          "/v1/pos/orders",
          { method: "POST", body: JSON.stringify(body) },
        );
        toast.success(`KOT ${res.kotStatus} · Nu. ${res.totalBtn}`);
        clearCart();
        loadKds();
        if (postToFolio) await refreshV2DeskEngine();
      } catch (err) {
        console.error("[v2/pos] order", err);
        toast.error(err instanceof DeskApiError ? err.message : String(err));
      }
    });
  };

  const printKotThermal = async () => {
    if (cart.length === 0) return;
    const nav = navigator as Navigator & { serial?: Serial };
    if (!nav.serial) {
      toast.error("WebSerial not available in this browser.");
      return;
    }
    try {
      const lines = [
        "Hotel OS — KOT",
        `Table ${selectedTable}`,
        ...cart.map((c) => `${c.qty}x ${c.name}  ${c.unitPriceBtn * c.qty}`),
        `Total Nu. ${grandTotalBtn.toFixed(2)}`,
      ];
      const bytes = encodeSimpleReceipt(lines);
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 9600 });
      try {
        const writer = port.writable?.getWriter();
        if (!writer) throw new Error("Port not writable");
        await writer.write(bytes);
        writer.releaseLock();
      } finally {
        await port.close();
      }
      toast.success("Sent to thermal printer");
    } catch (err) {
      console.error("[v2/pos] thermal", err);
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const bumpKot = (kotId: string, status: "preparing" | "ready" | "served") => {
    start(async () => {
      try {
        await deskFetchJson("/v1/kds/status", {
          method: "POST",
          body: JSON.stringify({
            kotId,
            status,
            idempotencyKey: newIdempotencyKey(),
          }),
        });
        loadKds();
      } catch (err) {
        console.error("[v2/pos] kds status", err);
        toast.error(err instanceof DeskApiError ? err.message : String(err));
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden h-[calc(100vh-56px)] bg-[#030712] text-slate-100">
      <div className="flex-1 lg:flex-[2] p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto border-b lg:border-b-0 lg:border-r border-white/[0.08]">
        <NeoGlassCard className="p-3 flex items-start gap-2 text-xs text-slate-400 border-white/10 glass-card [transform:translateZ(0)]">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <span>
            Menu from GET <code className="text-indigo-300">/v1/pos/menu</code>. Orders POST{" "}
            <code className="text-indigo-300">/v1/pos/orders</code> (idempotent). Room folio uses{" "}
            <code className="text-indigo-300">/v1/folio/charge</code> with total BTN (incl. SC/BST breakdown shown for staff only).
          </span>
        </NeoGlassCard>

        {!signedIn ? (
          <p className="text-sm text-amber-400">
            Sign in on <Link href="/v2" className="underline">/v2</Link> to load menu and post orders.
          </p>
        ) : null}

        {menuError ? <p className="text-xs text-rose-400">{menuError}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  activeCategory === cat
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-900/70 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>
          <TactileButton variant="secondary" size="sm" onClick={() => loadMenu()} disabled={!signedIn}>
            <RefreshCw className="w-3.5 h-3.5" />
            Menu
          </TactileButton>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Table:</span>
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-white font-bold"
          >
            {["T-01", "T-02", "T-03", "T-04", "T-05", "Bar-01", "Room-Svc"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {!menu || filteredItems.length === 0 ? (
          <div className="text-sm text-slate-500 py-12 text-center">
            {menu && menu.items.length === 0
              ? "No menu_items rows for this property — seed menu in Innora."
              : "Loading menu…"}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addToCart(item)}
                className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-indigo-500/40 text-left [transform:translateZ(0)]"
              >
                <h4 className="text-sm font-bold text-white">{item.name}</h4>
                <p className="text-[10px] text-slate-500 mt-1">{item.category}</p>
                <p className="text-sm font-mono text-white mt-3">Nu. {item.priceBtn}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-full lg:w-[380px] shrink-0 p-4 flex flex-col gap-3 border-b lg:border-b-0 lg:border-r border-white/[0.08] overflow-y-auto">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          Ticket · {selectedTable}
        </h3>
        <div className="flex-1 max-h-56 overflow-y-auto flex flex-col gap-2">
          {cart.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">Cart empty</p>
          ) : (
            cart.map((c) => (
              <div
                key={c.itemId}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-white/5 text-xs"
              >
                <div className="min-w-0 flex-1 mr-2">
                  <p className="text-white font-medium truncate">{c.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">Nu. {c.unitPriceBtn} × {c.qty}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateQty(c.itemId, -1)}
                    className="w-7 h-7 rounded bg-slate-800 flex items-center justify-center"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center font-mono">{c.qty}</span>
                  <button
                    type="button"
                    onClick={() => updateQty(c.itemId, 1)}
                    className="w-7 h-7 rounded bg-slate-800 flex items-center justify-center"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {cart.length > 0 ? (
          <button type="button" onClick={clearCart} className="text-xs text-rose-400 flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        ) : null}

        <div className="text-[11px] space-y-1 border-t border-white/10 pt-3">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span>
            <span className="font-mono text-white">Nu. {subtotalBtn.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>10% SC</span>
            <span className="font-mono text-white">Nu. {serviceChargeBtn.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>10% BST</span>
            <span className="font-mono text-white">Nu. {bstTaxBtn.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-2 text-white">
            <span>Total (posted)</span>
            <OdometerTicker value={grandTotalBtn} prefix="Nu. " className="text-base text-emerald-400 font-bold" />
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-xs">
          <span className="text-[10px] text-indigo-400 uppercase font-semibold block mb-1">Charge target</span>
          {inHouseStays.length === 0 ? (
            <p className="text-slate-500">
              No in-house stays in snapshot — load desk after sign-in or post KOT-only (no folio line).
            </p>
          ) : (
            <select
              value={selectedStayId}
              onChange={(e) => setSelectedStayId(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-2 text-white font-bold"
            >
              {inHouseStays.map((s) => (
                <option key={s.id} value={s.id}>
                  Room {s.roomNumber ?? "—"} — {s.guestName}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <TactileButton
            variant="primary"
            size="md"
            disabled={cart.length === 0 || !signedIn || pending}
            onClick={() => void submitPosOrder(true)}
            icon={<Building2 className="w-4 h-4" />}
          >
            KOT + room folio line
          </TactileButton>
          <TactileButton
            variant="secondary"
            size="md"
            disabled={cart.length === 0 || !signedIn || pending}
            onClick={() => void submitPosOrder(false)}
            icon={<Flame className="w-4 h-4" />}
          >
            KOT only (walk-in)
          </TactileButton>
          <TactileButton
            variant="emerald"
            size="md"
            disabled={cart.length === 0 || !signedIn || pending}
            onClick={() => void postFolioChargeForCart()}
            icon={<CreditCard className="w-4 h-4" />}
          >
            Folio charge (API)
          </TactileButton>
          <TactileButton
            variant="amber"
            size="md"
            disabled={cart.length === 0 || !signedIn || pending}
            onClick={() => void postCashPayment()}
            icon={<CreditCard className="w-4 h-4" />}
          >
            Cash to folio
          </TactileButton>
          <TactileButton
            variant="secondary"
            size="md"
            disabled={cart.length === 0}
            onClick={() => void printKotThermal()}
            icon={<Printer className="w-4 h-4" />}
          >
            Thermal KOT
          </TactileButton>
          <TactileButton
            variant="secondary"
            size="sm"
            disabled={cart.length === 0}
            onClick={() => showToast("RMA / Bhutan QR checkout is not a desk API route yet — use Innora or marketplace.")}
            icon={<QrCode className="w-4 h-4" />}
          >
            Bhutan QR
          </TactileButton>
        </div>
      </div>

      <div className="w-full lg:w-[300px] shrink-0 p-4 flex flex-col gap-2 overflow-y-auto bg-slate-950/90">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-rose-400" /> KDS
          </h3>
          <button
            type="button"
            onClick={() => loadKds()}
            className="text-[10px] text-indigo-400"
          >
            Refresh
          </button>
        </div>
        {kdsError ? <p className="text-[10px] text-rose-400">{kdsError}</p> : null}
        <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
          {kdsTickets.length === 0 ? (
            <p className="text-xs text-slate-500">No open tickets</p>
          ) : (
            kdsTickets.map((t) => (
              <div key={t.id} className="p-2 rounded-xl border border-white/10 bg-slate-900/80 text-[10px]">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span className="font-mono">{t.orders.table_label || t.station}</span>
                  <span className="text-amber-400">{t.status}</span>
                </div>
                {t.orders.order_lines.map((l) => (
                  <div key={l.id} className="text-white py-0.5">
                    {l.qty}× {l.name}
                  </div>
                ))}
                <div className="flex flex-wrap gap-1 mt-2">
                  <button
                    type="button"
                    onClick={() => bumpKot(t.id, "preparing")}
                    className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300"
                  >
                    Cook
                  </button>
                  <button
                    type="button"
                    onClick={() => bumpKot(t.id, "ready")}
                    className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300"
                  >
                    Ready
                  </button>
                  <button
                    type="button"
                    onClick={() => bumpKot(t.id, "served")}
                    className="px-2 py-0.5 rounded bg-slate-700 text-slate-200"
                  >
                    Served
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {pending ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Working…
          </div>
        ) : null}
      </div>

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      ) : null}
    </div>
  );
}
