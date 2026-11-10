import { useEffect, useState, useTransition } from "react";
import { isBrowserOnline } from "@hotel-os/engine";
import { NeoGlassCard, TactileButton } from "@hotel-os/ui";
import { api } from "../api";
import { assertOnlineMoney } from "../lib/online";

type StaySummary = {
  bookingId: string;
  confirmationCode: string;
  guestName: string;
  phone: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
  mealPlan: string | null;
  balanceBtn: number;
  chargesBtn: number;
  paidBtn: number;
  agreedNightlyRateBtn: number | null;
  notes: string | null;
  assignments: unknown[];
};

export function StayHubDrawer({
  bookingId,
  onClose,
  onChanged,
}: {
  bookingId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [stay, setStay] = useState<StaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payAmt, setPayAmt] = useState("");
  const [chargeAmt, setChargeAmt] = useState("");
  const [chargeDesc, setChargeDesc] = useState("Misc charge");
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
    if (!bookingId) {
      setStay(null);
      return;
    }
    start(async () => {
      try {
        setError(null);
        const s = await api<StaySummary>(`/v1/stays/${bookingId}`);
        setStay(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, [bookingId]);

  if (!bookingId) return null;

  const refresh = () => {
    start(async () => {
      const s = await api<StaySummary>(`/v1/stays/${bookingId}`);
      setStay(s);
      onChanged?.();
    });
  };

  return (
    <aside
      className="hos-glass"
      style={{
        position: "fixed",
        top: 56,
        right: 0,
        width: 420,
        maxWidth: "100vw",
        height: "calc(100vh - 56px)",
        zIndex: 40,
        padding: 16,
        overflow: "auto",
        borderLeft: "1px solid rgba(15,23,42,0.08)",
        background: "rgba(255,255,255,0.92)",
        color: "#0f172a",
        transform: "translateZ(0)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>StayHub</h2>
        <button
          type="button"
          onClick={onClose}
          style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer" }}
        >
          Close
        </button>
      </div>
      {error ? <p style={{ color: "#dc2626", fontSize: 12 }}>{error}</p> : null}
      {pending && !stay ? <p style={{ color: "#64748b" }}>Loading…</p> : null}
      {stay ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          <NeoGlassCard>
            <div style={{ fontWeight: 700 }}>{stay.guestName}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {stay.confirmationCode} · {stay.status}
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              {stay.checkIn} → {stay.checkOut} · {stay.mealPlan || "EP"}
            </div>
            {stay.phone ? (
              <div style={{ fontSize: 12, color: "#64748b" }}>{stay.phone}</div>
            ) : null}
          </NeoGlassCard>

          <NeoGlassCard>
            <div style={{ fontSize: 12, color: "#64748b" }}>Folio</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Charges</span>
              <strong>BTN {stay.chargesBtn.toLocaleString()}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Paid</span>
              <strong>BTN {stay.paidBtn.toLocaleString()}</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: stay.balanceBtn > 0 ? "#dc2626" : "#059669",
                marginTop: 6,
              }}
            >
              <span>Balance</span>
              <strong>BTN {stay.balanceBtn.toLocaleString()}</strong>
            </div>
          </NeoGlassCard>

          {!online ? (
            <p style={{ color: "#f59e0b", fontSize: 12 }}>
              Offline — charge, pay, check-in/out disabled until reconnect.
            </p>
          ) : null}

          <TactileButton
            disabled={
              pending ||
              !online ||
              stay.status === "checked_in" ||
              stay.status === "checked_out" ||
              stay.status === "cancelled"
            }
            onClick={() =>
              start(async () => {
                try {
                  setError(null);
                  assertOnlineMoney("check in");
                  await api("/v1/stays/check-in", {
                    method: "POST",
                    body: JSON.stringify({
                      bookingId: stay.bookingId,
                      idempotencyKey: crypto.randomUUID(),
                    }),
                  });
                  refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              })
            }
          >
            Check in
          </TactileButton>

          <TactileButton
            disabled={pending || !online || stay.status !== "checked_in"}
            onClick={() =>
              start(async () => {
                try {
                  setError(null);
                  assertOnlineMoney("check out");
                  await api("/v1/stays/checkout", {
                    method: "POST",
                    body: JSON.stringify({
                      bookingId: stay.bookingId,
                      idempotencyKey: crypto.randomUUID(),
                      allowBalance: stay.balanceBtn > 0.009,
                    }),
                  });
                  refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              })
            }
          >
            Check out
          </TactileButton>

          <NeoGlassCard>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Post charge</div>
            <input value={chargeDesc} onChange={(e) => setChargeDesc(e.target.value)} style={inputStyle} />
            <input
              value={chargeAmt}
              onChange={(e) => setChargeAmt(e.target.value)}
              placeholder="Amount BTN"
              style={{ ...inputStyle, marginTop: 6 }}
            />
            <TactileButton
              style={{ marginTop: 8 }}
              disabled={pending || !online}
              onClick={() =>
                start(async () => {
                  try {
                    assertOnlineMoney("post folio charge");
                    await api("/v1/folio/charge", {
                      method: "POST",
                      body: JSON.stringify({
                        bookingId: stay.bookingId,
                        description: chargeDesc,
                        amountBtn: Number(chargeAmt),
                        idempotencyKey: crypto.randomUUID(),
                      }),
                    });
                    setChargeAmt("");
                    refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                })
              }
            >
              Post charge
            </TactileButton>
          </NeoGlassCard>

          <NeoGlassCard>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Take payment</div>
            <input
              value={payAmt}
              onChange={(e) => setPayAmt(e.target.value)}
              placeholder="Amount BTN"
              style={inputStyle}
            />
            <TactileButton
              style={{ marginTop: 8 }}
              disabled={pending || !online}
              onClick={() =>
                start(async () => {
                  try {
                    assertOnlineMoney("record payment");
                    await api("/v1/folio/payment", {
                      method: "POST",
                      body: JSON.stringify({
                        bookingId: stay.bookingId,
                        amountBtn: Number(payAmt),
                        method: "cash",
                        idempotencyKey: crypto.randomUUID(),
                      }),
                    });
                    setPayAmt("");
                    refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                })
              }
            >
              Record cash payment
            </TactileButton>
          </NeoGlassCard>
        </div>
      ) : null}
    </aside>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "8px 10px",
};
