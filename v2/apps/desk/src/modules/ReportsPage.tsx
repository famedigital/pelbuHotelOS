import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  GlassPanel,
  KpiCard,
  ModuleFrame,
  StatusLegend,
} from "@hos-v2/ui";
import { DRC_REPORTS, useFiscalStore } from "../lib/fiscal-store";

export function ReportsPage() {
  const reduce = useReducedMotion();
  const selectedReport = useFiscalStore((s) => s.selectedReport);
  const setSelectedReport = useFiscalStore((s) => s.setSelectedReport);
  const reportPayload = useFiscalStore((s) => s.reportPayload);
  const payload = reportPayload(selectedReport);
  const meta = DRC_REPORTS.find((r) => r.id === selectedReport)!;

  return (
    <ModuleFrame
      title="Reports Studio"
      description="16 DRC reports · BST-3 pack — live from desk RAM engine"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusLegend
            dense
            className="hidden md:flex"
            items={[
              { id: "drc", label: "DRC", swatch: "var(--hos-primary)" },
              { id: "live", label: "Live RAM", swatch: "var(--hos-emerald)" },
              { id: "pack", label: "BST-3", swatch: "var(--hos-brass)" },
            ]}
          />
          <Button
            size="sm"
            onClick={() =>
              toast.success(`Exported ${meta.title}`, {
                description: "PDF + XLSX queued for owner inbox",
              })
            }
          >
            Export PDF / XLSX
          </Button>
        </div>
      }
    >
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Reports" value={16} delta="DRC standard" />
        <KpiCard label="Selected" value={`#${meta.no}`} delta={meta.title} />
        <KpiCard label="Live source" value="RAM" delta="FO + POS + Till" />
        <KpiCard label="Format" value="A4 / 80mm" delta="Thermal ready" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <GlassPanel className="max-h-[640px] overflow-auto p-2.5">
          {DRC_REPORTS.map((r) => (
            <motion.button
              key={r.id}
              type="button"
              whileTap={reduce ? undefined : { scale: 0.98 }}
              onClick={() => setSelectedReport(r.id)}
              className={`mb-1.5 w-full rounded-xl border px-3 py-2.5 text-left ${
                selectedReport === r.id
                  ? "border-[var(--hos-primary)] bg-[rgba(37,99,235,0.1)]"
                  : "border-[var(--hos-line)] bg-[var(--hos-cell)]"
              }`}
            >
              <div className="text-[10px] font-bold text-[var(--hos-primary)]">
                #{r.no}
              </div>
              <div className="text-xs font-semibold text-[var(--hos-ink)]">{r.title}</div>
              <div className="text-[10px] text-[var(--hos-ink-3)]">{r.description}</div>
            </motion.button>
          ))}
        </GlassPanel>

        <GlassPanel className="p-4">
          <h2 className="m-0 text-lg font-bold text-[var(--hos-ink)]">{meta.title}</h2>
          <p className="mt-1 text-xs text-[var(--hos-ink-3)]">{payload.headline}</p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
            <table className="w-full text-left text-xs">
              <tbody>
                {payload.rows.map((row, i) => (
                  <tr
                    key={i}
                    className={
                      i === 0
                        ? "border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]"
                        : "border-b border-[var(--hos-line)]"
                    }
                  >
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className={`px-3 py-2 ${i === 0 ? "font-semibold" : "font-medium text-[var(--hos-ink)]"}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      </div>
    </div>
    </ModuleFrame>
  );
}
