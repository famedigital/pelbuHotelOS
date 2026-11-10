import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard } from "@hotel-os/ui";
import { api } from "../api";

type Preview = {
  businessDate: string;
  closeTime: string | null;
  inHouseCount: number;
  arrivalCount: number;
  departureCount: number;
  openFolioCount: number;
  blockers: string[];
  openStays: Array<Record<string, unknown>>;
  lastRun: Record<string, unknown> | null;
  runAvailable: boolean;
  runWhere: string;
};

/**
 * Read-only close-of-day preview. Running night audit stays in Innora until
 * the shared core (room-night posting + GL + business-date roll) is wired
 * into v2 — see docs/v2/V1-VS-V2-GAP.md.
 */
export function NightAuditPage() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () => {
    start(async () => {
      try {
        setError(null);
        setPreview(await api<Preview>("/v1/night-audit/preview"));
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
        <h2 style={{ marginTop: 0 }}>Night audit</h2>
        {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
        {pending && !preview ? <p style={{ color: "#94a3b8" }}>Loading…</p> : null}
        {preview ? (
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <div>
              Business date <strong>{preview.businessDate}</strong>
              {preview.closeTime ? ` · closes ${preview.closeTime}` : ""}
            </div>
            <div>In-house: {preview.inHouseCount}</div>
            <div>Arrivals still due: {preview.arrivalCount}</div>
            <div>Departures: {preview.departureCount}</div>
            <div>Open folios: {preview.openFolioCount}</div>
            {preview.blockers.length ? (
              <div style={{ color: "#fbbf24" }}>
                Blockers: {preview.blockers.join(" · ")}
              </div>
            ) : (
              <div style={{ color: "#4ade80" }}>No blockers</div>
            )}
            {preview.lastRun ? (
              <div style={{ color: "#94a3b8", fontSize: 12 }}>
                Last closed {String(preview.lastRun.business_date)} ·{" "}
                {String(preview.lastRun.rooms_occupied)} occ ·{" "}
                {String(preview.lastRun.run_by)}
              </div>
            ) : (
              <div style={{ color: "#94a3b8", fontSize: 12 }}>No audits yet</div>
            )}
          </div>
        ) : null}
        <p
          style={{
            marginTop: 16,
            fontSize: 12,
            color: "#fbbf24",
            background: "#0b1220",
            padding: 10,
            borderRadius: 8,
          }}
        >
          Run the close in Innora: <strong>{preview?.runWhere ?? "/erp/night-audit"}</strong>.
          It posts room nights to folios and the ledger and rolls the business date.
          This screen refreshes from the same database.
        </p>
        <button type="button" onClick={load} disabled={pending} style={{ color: "#94a3b8" }}>
          Refresh
        </button>
      </NeoGlassCard>
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>In-house stays</h2>
        {(preview?.openStays || []).map((s) => (
          <div
            key={String(s.id)}
            style={{
              padding: 8,
              background: "#0b1220",
              marginBottom: 4,
              fontSize: 12,
            }}
          >
            {String(s.confirmation_code)} · {String(s.contact_name)} · out{" "}
            {String(s.check_out)}
          </div>
        ))}
      </NeoGlassCard>
    </div>
  );
}
