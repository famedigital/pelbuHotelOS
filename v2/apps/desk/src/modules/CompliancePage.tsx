import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  GlassPanel,
  KpiCard,
  ModuleFrame,
  StatusLegend,
} from "@hos-v2/ui";
import {
  exportBst3Csv,
  exportPoliceManifestCsv,
  exportRrcoBinderCsv,
} from "../lib/compliance-export";
import { useFiscalStore } from "../lib/fiscal-store";
import { useFrontOfficeStore } from "../lib/front-office-store";

const DOT_CHECKS = [
  { id: "fire", label: "Fire extinguishers inspected", weight: 10 },
  { id: "food", label: "Kitchen hygiene grade ≥ B", weight: 15 },
  { id: "sdf", label: "SDF / immigration log complete", weight: 15 },
  { id: "guide", label: "TCB guide licenses on file", weight: 10 },
  { id: "rate", label: "Displayed rates match MoU / BAR", weight: 10 },
  { id: "waste", label: "Waste segregation & septic ok", weight: 10 },
  { id: "staff", label: "Staff ID badges & PIN roster", weight: 10 },
  { id: "guest", label: "Guest complaint log current", weight: 10 },
  { id: "room", label: "Room inventory vs Occupancy board", weight: 10 },
];

export function CompliancePage() {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<"bst3" | "police" | "dot" | "rrco">("bst3");
  const [tpn, setTpn] = useState("BTN-TPN-104829");
  const [license, setLicense] = useState("DOT-HTL-PARO-221");
  const [checks, setChecks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DOT_CHECKS.map((c) => [c.id, c.id !== "waste"])),
  );
  const reportPayload = useFiscalStore((s) => s.reportPayload);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const stays = useFrontOfficeStore((s) => s.stays);
  const bst = reportPayload("bst3");
  const score = DOT_CHECKS.reduce(
    (s, c) => s + (checks[c.id] ? c.weight : 0),
    0,
  );
  const foreignCount = useMemo(
    () =>
      stays.filter(
        (s) =>
          s.status === "checked_in" &&
          s.nationality.trim().toLowerCase() !== "bhutanese",
      ).length,
    [stays],
  );

  return (
    <ModuleFrame
      title="Compliance"
      description="BST-3 returns · Tourist police manifest · DOT grading · RRCO audit binder"
      actions={
        <StatusLegend
          dense
          items={[
            { id: "bst", label: "BST-3", swatch: "var(--hos-primary)" },
            { id: "police", label: "Police", swatch: "var(--hos-brass)" },
            { id: "dot", label: "DOT", swatch: "var(--hos-emerald)" },
            { id: "rrco", label: "RRCO", swatch: "var(--hos-ink-3)" },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="TPN" value={tpn.slice(-6)} delta="Taxpayer" />
          <KpiCard
            label="DOT license"
            value={license.slice(-3)}
            delta="Hotel"
          />
          <KpiCard
            label="DOT score"
            value={`${score}/100`}
            delta={score >= 80 ? "Pass" : "At risk"}
          />
          <KpiCard
            label="Foreign in-house"
            value={foreignCount}
            delta={businessDate}
          />
        </div>

        <div className="relative flex w-fit flex-wrap rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-1">
          {(["bst3", "police", "dot", "rrco"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="relative px-3 py-1.5 text-xs font-semibold uppercase"
            >
              {tab === t ? (
                <motion.span
                  layoutId="compTab"
                  className="absolute inset-0 rounded-lg border border-[var(--hos-primary)]/30 bg-[var(--hos-primary)]/15"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              ) : null}
              <span
                className={`relative z-10 ${tab === t ? "text-[var(--hos-primary)]" : "text-[var(--hos-ink-2)]"}`}
              >
                {t}
              </span>
            </button>
          ))}
        </div>

        {tab === "bst3" ? (
          <GlassPanel className="flex flex-col gap-3 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium">
                TPN
                <input
                  value={tpn}
                  onChange={(e) => setTpn(e.target.value)}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Hotel license
                <input
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2"
                />
              </label>
            </div>
            <p className="m-0 text-xs text-[var(--hos-ink-3)]">{bst.headline}</p>
            <div className="overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
              <table className="w-full text-left text-xs">
                <tbody>
                  {bst.rows.map((row, i) => (
                    <tr key={i} className="border-b border-[var(--hos-line)]">
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className={`px-3 py-2 ${i === 0 ? "text-[10px] font-semibold uppercase text-[var(--hos-ink-3)]" : "font-medium"}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <motion.div whileTap={reduce ? undefined : { scale: 0.97 }}>
              <Button
                className="hos-btn-ink"
                onClick={() => {
                  const r = exportBst3Csv({ tpn, license });
                  toast.success("BST-3 CSV downloaded", {
                    description: `${r.filename} · tip-pool SC attached`,
                  });
                }}
              >
                Download BST-3 return
              </Button>
            </motion.div>
          </GlassPanel>
        ) : null}

        {tab === "police" ? (
          <GlassPanel className="flex flex-col gap-3 p-4">
            <strong className="text-sm text-[var(--hos-ink)]">
              Tourist Police / Immigration manifest
            </strong>
            <p className="m-0 text-xs text-[var(--hos-ink-3)]">
              Daily in-house foreign nationals for RBP / immigration — live from
              desk stays ({foreignCount} tonight).
            </p>
            <Badge tone="default">{businessDate}</Badge>
            <motion.div whileTap={reduce ? undefined : { scale: 0.97 }}>
              <Button
                className="hos-btn-ink"
                onClick={() => {
                  const r = exportPoliceManifestCsv({ asOfDate: businessDate });
                  toast.success("Police manifest downloaded", {
                    description: `${r.rows} guest(s) · ${r.filename}`,
                  });
                }}
              >
                Download police CSV
              </Button>
            </motion.div>
          </GlassPanel>
        ) : null}

        {tab === "dot" ? (
          <GlassPanel className="p-4">
            <strong className="text-sm">DOT hotel inspection checklist</strong>
            <ul className="mt-3 m-0 list-none space-y-2 p-0">
              {DOT_CHECKS.map((c) => (
                <li key={c.id}>
                  <label className="hos-cell flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-xs">
                    <span className="font-medium text-[var(--hos-ink)]">
                      {c.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[var(--hos-ink-3)]">
                        {c.weight} pts
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(checks[c.id])}
                        onChange={(e) =>
                          setChecks((x) => ({
                            ...x,
                            [c.id]: e.target.checked,
                          }))
                        }
                      />
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-semibold text-[var(--hos-ink)]">
              Grade:{" "}
              {score >= 90
                ? "A"
                : score >= 80
                  ? "B"
                  : score >= 70
                    ? "C"
                    : "Fail"}
            </p>
          </GlassPanel>
        ) : null}

        {tab === "rrco" ? (
          <GlassPanel className="p-4">
            <strong className="text-sm">RRCO compliance audit binder</strong>
            <p className="mt-1 text-xs text-[var(--hos-ink-3)]">
              Packs BST-3 snapshot, void/discount folio lines, and night audit
              closes for Regional Revenue & Customs.
            </p>
            <Button
              className="hos-btn-ink mt-3"
              onClick={() => {
                const r = exportRrcoBinderCsv({ tpn });
                toast.success("RRCO binder exported", {
                  description: r.filename,
                });
              }}
            >
              Export audit binder CSV
            </Button>
          </GlassPanel>
        ) : null}
      </div>
    </ModuleFrame>
  );
}
