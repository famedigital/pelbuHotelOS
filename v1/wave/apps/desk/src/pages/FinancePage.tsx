import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard, TactileButton, OdometerTicker } from "@hotel-os/ui";
import { api } from "../api";

export function FinancePage() {
  const [hub, setHub] = useState<{
    expenseTotalBtn: number;
    paymentsInBtn: number;
    monthStart: string;
    vendors: Array<Record<string, unknown>>;
  } | null>(null);
  const [rrco, setRrco] = useState<Array<Record<string, unknown>>>([]);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () => {
    start(async () => {
      try {
        setError(null);
        const [h, r] = await Promise.all([
          api<{
            expenseTotalBtn: number;
            paymentsInBtn: number;
            monthStart: string;
            vendors: Array<Record<string, unknown>>;
          }>("/v1/finance/hub"),
          api<{ entries: Array<Record<string, unknown>>; warning?: string }>(
            "/v1/finance/rrco",
          ),
        ]);
        setHub(h);
        setRrco(r.entries);
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
        <h2 style={{ marginTop: 0 }}>Finance hub</h2>
        {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
        {hub ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                Month from {hub.monthStart} · expenses
              </div>
              <OdometerTicker value={hub.expenseTotalBtn} prefix="BTN " />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Payments in</div>
              <OdometerTicker value={hub.paymentsInBtn} prefix="BTN " />
            </div>
          </div>
        ) : null}
        <h3>Quick expense</h3>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Description"
          style={inputStyle}
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount BTN"
          style={{ ...inputStyle, marginTop: 8 }}
        />
        <TactileButton
          style={{ marginTop: 8 }}
          disabled={pending || !desc || !amount}
          onClick={() =>
            start(async () => {
              await api("/v1/finance/expenses", {
                method: "POST",
                body: JSON.stringify({
                  description: desc,
                  amountBtn: Number(amount),
                  spentAt: new Date().toISOString().slice(0, 10),
                  idempotencyKey: crypto.randomUUID(),
                }),
              });
              setDesc("");
              setAmount("");
              load();
            })
          }
        >
          Post expense
        </TactileButton>
      </NeoGlassCard>
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>RRCO books</h2>
        <div style={{ maxHeight: 420, overflow: "auto" }}>
          {rrco.map((e) => (
            <div
              key={String(e.id)}
              style={{
                padding: 8,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                fontSize: 12,
                background: "#0b1220",
              }}
            >
              {String(e.entry_date)} · {String(e.book_kind)} ·{" "}
              {String(e.description)} · BTN {Number(e.amount_btn || 0)}
            </div>
          ))}
          {!rrco.length ? (
            <p style={{ color: "#94a3b8" }}>No RRCO entries (or table not seeded)</p>
          ) : null}
        </div>
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
