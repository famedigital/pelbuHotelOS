import { useEffect, useMemo, useState, useTransition } from "react";
import { stackExclusiveBtn } from "@hotel-os/rates";
import { isBrowserOnline, useRamEngine } from "@hotel-os/engine";
import { NeoGlassCard, TactileButton, OdometerTicker } from "@hotel-os/ui";
import {
  encodeSimpleReceipt,
  printSilentReceipt,
  requestThermalPort,
} from "@hotel-os/hardware";
import { api } from "../api";
import { assertOnlineMoney } from "../lib/online";

type MenuItem = {
  id: string;
  name: string;
  priceBtn: number;
  category: string;
  outletId?: string | null;
};

export function PosPage() {
  const engine = useRamEngine();
  const inHouse = engine.stays.filter((s) => s.status === "in_house");
  const [stayId, setStayId] = useState(inHouse[0]?.id || "");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [outlets, setOutlets] = useState<Array<Record<string, unknown>>>([]);
  const [cart, setCart] = useState<
    { id: string; name: string; price: number; qty: number }[]
  >([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [online, setOnline] = useState(isBrowserOnline());

  useEffect(() => {
    const sync = () => setOnline(isBrowserOnline());
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    start(async () => {
      try {
        const res = await api<{
          outlets: Array<Record<string, unknown>>;
          items: MenuItem[];
        }>("/v1/pos/menu");
        setMenu(res.items);
        setOutlets(res.outlets);
        if (!res.items.length) {
          setError("No DB menu items — seed menu_items for this property");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, []);

  const totals = useMemo(() => {
    const net = cart.reduce((a, c) => a + c.price * c.qty, 0);
    return stackExclusiveBtn(net);
  }, [cart]);

  const post = () => {
    if (!cart.length) return;
    start(async () => {
      try {
        setMsg(null);
        assertOnlineMoney("fire POS / KOT");
        const res = await api<{
          orderId: string;
          totalBtn: number;
          kotId: string | null;
        }>("/v1/pos/orders", {
          method: "POST",
          body: JSON.stringify({
            idempotencyKey: crypto.randomUUID(),
            bookingId: stayId || null,
            outletId: outlets[0]?.id,
            fireKot: true,
            lines: cart.map((c) => ({
              menuItemId: c.id.match(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
              )
                ? c.id
                : undefined,
              name: c.name,
              qty: c.qty,
              unitPriceBtn: c.price,
            })),
          }),
        });
        setCart([]);
        setMsg(
          `Order ${res.orderId.slice(0, 8)} · BTN ${res.totalBtn}${
            res.kotId ? ` · KOT fired` : ""
          }`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const printReceipt = async () => {
    try {
      const port = await requestThermalPort();
      const bytes = encodeSimpleReceipt([
        "Hotel OS POS",
        ...cart.map((c) => `${c.qty}x ${c.name}  ${c.price * c.qty}`),
        `TOTAL BTN ${totals.grossBtn}`,
      ]);
      await printSilentReceipt(port, bytes);
      setMsg("Sent to thermal printer");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="desk-grid">
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>POS · DB menu</h2>
        <label style={{ fontSize: 12 }}>
          Room charge stay{" "}
          <select
            value={stayId}
            onChange={(e) => setStayId(e.target.value)}
            style={{ background: "#0b1220", color: "white", marginLeft: 8 }}
          >
            <option value="">Walk-in / no folio</option>
            {inHouse.map((s) => (
              <option key={s.id} value={s.id}>
                {s.roomNumber} · {s.guestName}
              </option>
            ))}
          </select>
        </label>
        {error ? <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p> : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2,1fr)",
            gap: 8,
            marginTop: 12,
          }}
        >
          {menu.map((m) => (
            <TactileButton
              key={m.id}
              variant="ghost"
              onClick={() => {
                setCart((prev) => {
                  const hit = prev.find((x) => x.id === m.id);
                  if (hit) {
                    return prev.map((x) =>
                      x.id === m.id ? { ...x, qty: x.qty + 1 } : x,
                    );
                  }
                  return [
                    ...prev,
                    { id: m.id, name: m.name, price: m.priceBtn, qty: 1 },
                  ];
                });
              }}
            >
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  {m.category} · BTN {m.priceBtn}
                </div>
              </div>
            </TactileButton>
          ))}
        </div>
      </NeoGlassCard>
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>Ticket</h2>
        {cart.map((c) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              padding: "4px 0",
              background: "#0b1220",
            }}
          >
            <span>
              {c.qty}× {c.name}
            </span>
            <span>{c.price * c.qty}</span>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <OdometerTicker value={totals.grossBtn} prefix="BTN " />
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            Net {totals.netBtn} · SC {totals.serviceChargeBtn} · BST {totals.bstBtn}
          </div>
        </div>
        {msg ? <p style={{ color: "#34d399", fontSize: 12 }}>{msg}</p> : null}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {!online ? (
            <p style={{ color: "#f59e0b", fontSize: 12 }}>
              Offline — KOT / folio fire disabled.
            </p>
          ) : null}
          <TactileButton
            disabled={pending || !online || !cart.length}
            onClick={post}
          >
            Fire KOT + post
          </TactileButton>
          <TactileButton variant="ghost" disabled={!cart.length} onClick={printReceipt}>
            Thermal print
          </TactileButton>
        </div>
      </NeoGlassCard>
    </div>
  );
}
