import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard, TactileButton } from "@hotel-os/ui";
import { api } from "../api";

type RatePlan = Record<string, unknown>;

type PendingApproval = {
  lineId: string;
  bookingId: string;
  confirmationCode: string;
  guestName: string;
  bookingStatus: string;
  checkIn: string;
  checkOut: string;
  agreedNightlyRateBtn: number | null;
  sheetNightlyRateBtn: number | null;
  reason: string | null;
};

export function RatesPage() {
  const [plans, setPlans] = useState<RatePlan[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>(
    [],
  );
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () => {
    start(async () => {
      try {
        setError(null);
        const [plansRes, approvalsRes] = await Promise.all([
          api<{
            ratePlans: RatePlan[];
            warning?: string;
          }>("/v1/rates/plans"),
          api<{ pending: PendingApproval[] }>("/v1/rates/approvals"),
        ]);
        setPlans(plansRes.ratePlans);
        setWarning(plansRes.warning || null);
        setPendingApprovals(approvalsRes.pending);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  useEffect(() => {
    load();
  }, []);

  const decide = (line: PendingApproval, action: "approve" | "reject") => {
    start(async () => {
      try {
        setError(null);
        setToast(null);
        const res = await api<{ message?: string }>(
          `/v1/rates/approvals/${line.lineId}/${action}`,
          {
            method: "POST",
            body: JSON.stringify({
              bookingId: line.bookingId,
              idempotencyKey: crypto.randomUUID(),
            }),
          },
        );
        setToast(res.message || `${action} ok`);
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Rates · approvals</h1>
      {warning ? (
        <p style={{ color: "#fbbf24", fontSize: 12 }}>{warning}</p>
      ) : null}
      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
      {toast ? <p style={{ color: "#34d399", fontSize: 13 }}>{toast}</p> : null}
      {pending ? <p style={{ color: "#94a3b8" }}>Loading…</p> : null}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Pending rate requests</h2>
      <NeoGlassCard>
        {pendingApprovals.map((p) => (
          <div
            key={p.lineId}
            style={{
              padding: 12,
              background: "#0b1220",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontSize: 13,
              display: "grid",
              gap: 8,
            }}
          >
            <div>
              <strong>{p.confirmationCode}</strong> · {p.guestName} ·{" "}
              {p.bookingStatus}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {p.checkIn} → {p.checkOut} · requested BTN{" "}
              {p.agreedNightlyRateBtn ?? "—"}
              {p.sheetNightlyRateBtn != null
                ? ` (sheet ${p.sheetNightlyRateBtn})`
                : ""}
              {p.reason ? ` · ${p.reason}` : ""}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <TactileButton
                disabled={pending}
                onClick={() => decide(p, "approve")}
              >
                Approve
              </TactileButton>
              <TactileButton
                variant="ghost"
                disabled={pending}
                onClick={() => decide(p, "reject")}
              >
                Reject
              </TactileButton>
            </div>
          </div>
        ))}
        {!pendingApprovals.length && !pending ? (
          <p style={{ color: "#94a3b8" }}>No pending rate approvals</p>
        ) : null}
      </NeoGlassCard>

      <h2 style={{ fontSize: 16, marginTop: 28 }}>Rate plans</h2>
      <NeoGlassCard>
        {plans.map((p) => (
          <div
            key={String(p.id)}
            style={{
              padding: 10,
              background: "#0b1220",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontSize: 13,
            }}
          >
            <strong>{String(p.name)}</strong> · {String(p.code)} ·{" "}
            {String(p.meal_plan_code || "")}
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {p.is_active ? "Active" : "Inactive"} · min{" "}
              {String(p.min_stay || 1)}
            </div>
          </div>
        ))}
        {!plans.length && !pending ? (
          <p style={{ color: "#94a3b8" }}>No rate plans</p>
        ) : null}
      </NeoGlassCard>
    </div>
  );
}
