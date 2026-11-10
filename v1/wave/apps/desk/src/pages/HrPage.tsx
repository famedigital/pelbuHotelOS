import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard } from "@hotel-os/ui";
import { api } from "../api";

export function HrPage() {
  const [staff, setStaff] = useState<Array<Record<string, unknown>>>([]);
  const [board, setBoard] = useState<{
    rota: unknown[];
    leave: unknown[];
    attendance: unknown[];
    warning?: string | null;
  } | null>(null);
  const [payslips, setPayslips] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    start(async () => {
      try {
        const [s, b, p] = await Promise.all([
          api<{ staff: Array<Record<string, unknown>> }>("/v1/hr/staff"),
          api<{
            rota: unknown[];
            leave: unknown[];
            attendance: unknown[];
            warning?: string | null;
          }>("/v1/hr/board"),
          api<{ payslips: unknown[]; warning?: string }>("/v1/hr/payslips"),
        ]);
        setStaff(s.staff);
        setBoard(b);
        setPayslips(p.payslips);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, []);

  return (
    <div className="desk-grid">
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>Staff</h2>
        {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
        {pending ? <p style={{ color: "#94a3b8" }}>Loading…</p> : null}
        {staff.map((s) => (
          <div
            key={String(s.id)}
            style={{
              padding: 8,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "#0b1220",
              fontSize: 13,
            }}
          >
            <strong>{String(s.fullName)}</strong> · {String(s.role || "—")}
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {String(s.department || "")} {s.isActive ? "" : "· inactive"}
            </div>
          </div>
        ))}
      </NeoGlassCard>
      <NeoGlassCard>
        <h2 style={{ marginTop: 0 }}>Rota / leave / attendance</h2>
        {board?.warning ? (
          <p style={{ color: "#fbbf24", fontSize: 12 }}>{board.warning}</p>
        ) : null}
        <p style={{ fontSize: 12 }}>Rota rows: {board?.rota.length ?? 0}</p>
        <p style={{ fontSize: 12 }}>Leave: {board?.leave.length ?? 0}</p>
        <p style={{ fontSize: 12 }}>
          Attendance today: {board?.attendance.length ?? 0}
        </p>
        <h3>Payslips</h3>
        <p style={{ fontSize: 12, color: "#94a3b8" }}>
          {payslips.length} recent payslips
        </p>
      </NeoGlassCard>
    </div>
  );
}
