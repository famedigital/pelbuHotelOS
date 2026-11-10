import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard, TactileButton } from "@hotel-os/ui";
import { api } from "../api";

export function PurchasesPage() {
  const [inv, setInv] = useState<{
    locations: unknown[];
    items: Array<Record<string, unknown>>;
    purchaseOrders: Array<Record<string, unknown>>;
    warning?: string | null;
  } | null>(null);
  const [vendor, setVendor] = useState("");
  const [lineName, setLineName] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () => {
    start(async () => {
      try {
        setInv(await api("/v1/inventory"));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="desk-grid">
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>Inventory</h2>
        {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
        {inv?.warning ? (
          <p style={{ color: "#fbbf24", fontSize: 12 }}>{inv.warning}</p>
        ) : null}
        <p style={{ fontSize: 12, color: "#94a3b8" }}>
          Locations: {inv?.locations.length ?? 0} · Items: {inv?.items.length ?? 0}
        </p>
        <div style={{ maxHeight: 280, overflow: "auto" }}>
          {(inv?.items || []).slice(0, 40).map((it) => (
            <div
              key={String(it.id)}
              style={{
                padding: 6,
                fontSize: 12,
                background: "#0b1220",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {String(it.name)} · {String(it.sku || "")} · reorder{" "}
              {String(it.reorder_level ?? "—")}
            </div>
          ))}
        </div>
      </NeoGlassCard>
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>Purchase orders</h2>
        {(inv?.purchaseOrders || []).map((po) => (
          <div
            key={String(po.id)}
            style={{
              padding: 8,
              background: "#0b1220",
              marginBottom: 6,
              fontSize: 12,
              borderRadius: 8,
            }}
          >
            {String(po.vendor_name)} · {String(po.status)} · BTN{" "}
            {Number(po.total_btn || 0)}
          </div>
        ))}
        <h3>New PO</h3>
        <input
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="Vendor"
          style={inputStyle}
        />
        <input
          value={lineName}
          onChange={(e) => setLineName(e.target.value)}
          placeholder="Line item"
          style={{ ...inputStyle, marginTop: 6 }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Qty"
            style={inputStyle}
          />
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Unit cost"
            style={inputStyle}
          />
        </div>
        <TactileButton
          style={{ marginTop: 8 }}
          disabled={pending || !vendor || !lineName}
          onClick={() =>
            start(async () => {
              await api("/v1/inventory/purchase-orders", {
                method: "POST",
                body: JSON.stringify({
                  vendorName: vendor,
                  lines: [
                    {
                      name: lineName,
                      qty: Number(qty) || 1,
                      unitCostBtn: Number(cost) || 0,
                    },
                  ],
                  idempotencyKey: crypto.randomUUID(),
                }),
              });
              setVendor("");
              setLineName("");
              setCost("");
              load();
            })
          }
        >
          Create PO
        </TactileButton>
      </NeoGlassCard>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0b1220",
  color: "#f8fafc",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "8px 10px",
};
