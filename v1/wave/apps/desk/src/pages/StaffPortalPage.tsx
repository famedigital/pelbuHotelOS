import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard } from "@hotel-os/ui";
import { useRamEngine } from "@hotel-os/engine";
import { api } from "../api";

export function StaffPortalPage() {
  const engine = useRamEngine();
  const [payslips, setPayslips] = useState<unknown[]>([]);
  const [leave, setLeave] = useState<unknown[]>([]);
  const [laundry, setLaundry] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    start(async () => {
      try {
        const [p, board, l] = await Promise.all([
          api<{ payslips: unknown[] }>(
            `/v1/hr/payslips${engine.staffId ? `?staffId=${engine.staffId}` : ""}`,
          ),
          api<{ leave: unknown[] }>("/v1/hr/board"),
          api<{ tickets: unknown[] }>("/v1/laundry"),
        ]);
        setPayslips(p.payslips);
        setLeave(board.leave);
        setLaundry(l.tickets);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, [engine.staffId]);

  return (
    <div className="desk-grid">
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>Staff PWA</h2>
        <p style={{ fontSize: 13, color: "#94a3b8" }}>
          {engine.staffName || "Staff"} · payslips, leave, laundry notices
        </p>
        {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
        {pending ? <p style={{ color: "#94a3b8" }}>Loading…</p> : null}
        <h3>Payslips</h3>
        <p style={{ fontSize: 12 }}>{payslips.length} records</p>
        <h3>Leave</h3>
        <p style={{ fontSize: 12 }}>{leave.length} open requests</p>
      </NeoGlassCard>
      <NeoGlassCard>
        <h3 style={{ marginTop: 0 }}>Laundry / notices</h3>
        <p style={{ fontSize: 12, color: "#94a3b8" }}>
          {laundry.length} laundry tickets visible to property
        </p>
      </NeoGlassCard>
    </div>
  );
}
