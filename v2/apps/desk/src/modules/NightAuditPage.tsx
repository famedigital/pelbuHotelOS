import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import { useNavigate } from "react-router-dom";
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
  CheckCircle2,
  Circle,
  Lock,
  MoonStar,
  Sparkles,
} from "lucide-react";
import { nightAuditReadiness } from "../lib/action-dispatcher";
import {
  exportBst3Csv,
  exportPoliceManifestCsv,
} from "../lib/compliance-export";
import { verifyDeskManagerPin } from "../lib/desk-pin";
import { useFrontOfficeStore } from "../lib/front-office-store";
import { useFiscalStore } from "../lib/fiscal-store";
import { playSfx } from "../lib/sfx";

const PIPELINE = [
  "Clear POS / KDS / tables / till",
  "Post room + 10% SC + 10% BST",
  "Flag no-shows · apply fee policy",
  "Advance business date",
  "Seal immutable snapshot · manager pack",
] as const;

export function NightAuditPage() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const [pending, start] = useTransition();
  const [pin, setPin] = useState("");
  const [phase, setPhase] = useState<number | null>(null);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const runNightAuditRemote = useFrontOfficeStore((s) => s.runNightAuditRemote);
  const buildChecklist = useFiscalStore((s) => s.buildChecklist);
  const runAutonomousNightAudit = useFiscalStore(
    (s) => s.runAutonomousNightAudit,
  );
  const lastAuditDate = useFiscalStore((s) => s.lastAuditDate);
  const auditLog = useFiscalStore((s) => s.auditLog);
  const checklist = buildChecklist();
  /* Arrivals + unassigned are soft — night_audit.run marks no-shows / can proceed. */
  const hardBlockers = checklist.filter(
    (c) =>
      c.status === "blocked" && c.id !== "arrivals" && c.id !== "unassigned",
  );
  const readiness = useMemo(() => nightAuditReadiness(), [checklist, businessDate]);

  const nextDate = useMemo(() => {
    const d = new Date(`${businessDate}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, [businessDate]);

  const run = () => {
    const pinGate = verifyDeskManagerPin(pin);
    if (!pinGate.ok) {
      toast.error("GM PIN required", { description: pinGate.error });
      return;
    }
    if (hardBlockers.length > 0) {
      toast.error("Gates blocked", {
        description: hardBlockers.map((b) => b.label).join(" · "),
      });
      return;
    }
    start(() => {
      setPhase(0);
      const steps = PIPELINE.length;
      let i = 0;
      const tick = async () => {
        i += 1;
        setPhase(i);
        if (i < steps) {
          window.setTimeout(() => {
            void tick();
          }, reduce ? 0 : 180);
          return;
        }
        const remote = await runNightAuditRemote();
        if (!remote.ok) {
          setPhase(null);
          toast.error(remote.error, {
            description: "night_audit.run command failed — day not closed",
          });
          return;
        }
        const local = runAutonomousNightAudit();
        if (!local.ok) {
          toast.message(`API closed → ${remote.nextDate}`, {
            description: `Local fiscal pack: ${local.error}`,
          });
        } else {
          toast.success(`Night closed → ${remote.nextDate}`, {
            description: `API posted ${remote.postedNights} · no-shows ${remote.noShows} · tip ${local.tipPoolPoints} pts · ${pinGate.name}`,
          });
        }
        playSfx("audit");
        setPin("");
        window.setTimeout(() => setPhase(null), 600);
      };
      window.setTimeout(() => {
        void tick();
      }, reduce ? 0 : 120);
    });
  };

  return (
    <ModuleFrame
      title="Night Audit Cockpit"
      description="Autonomous 1-click rollover · pre-flight gates · fiscal seal · Bhutan DRC pack"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusLegend
            dense
            className="hidden md:flex"
            items={[
              { id: "ok", label: "Clear", swatch: "var(--hos-emerald)" },
              { id: "warn", label: "Soft gate", swatch: "var(--hos-brass)" },
              { id: "block", label: "Hard gate", swatch: "var(--hos-ruby)" },
            ]}
          />
          <Badge
            tone={readiness.blockers === 0 ? "success" : "danger"}
            className="border border-[var(--hos-line)]"
          >
            {readiness.score}% · {readiness.label}
          </Badge>
          <Badge tone="default" className="border border-[var(--hos-primary)]">
            Autonomous
          </Badge>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Business date" value={businessDate} delta="Open" />
          <KpiCard
            label="Hard gates"
            value={hardBlockers.length}
            delta={hardBlockers.length ? "Must clear" : "Clear"}
          />
          <KpiCard label="Last close" value={lastAuditDate ?? "—"} delta="Sealed" />
          <KpiCard label="Rollover to" value={nextDate.slice(5)} delta="Next" />
        </div>

        <GlassPanel className="relative overflow-hidden p-4">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgba(37,99,235,0.08)] via-transparent to-[rgba(245,158,11,0.06)]" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-2xl bg-[#111] text-white shadow-[0_8px_20px_-10px_#111]">
                  <MoonStar className="size-4" strokeWidth={2} />
                </span>
                <div>
                  <strong className="block text-sm font-bold tracking-tight text-[var(--hos-ink)]">
                    One-click autonomous close
                  </strong>
                  <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                    Soft arrivals → no-shows · hard POS/HK/balance gates enforced
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="hos-btn-tactile !rounded-full"
                onClick={() => {
                  const r = exportPoliceManifestCsv();
                  toast.success("Police manifest", {
                    description: `${r.rows} rows · ${r.filename}`,
                  });
                }}
              >
                Police CSV
              </Button>
              <Button
                size="sm"
                className="hos-btn-tactile !rounded-full"
                onClick={() => {
                  const r = exportBst3Csv();
                  toast.success("BST-3 draft", { description: r.filename });
                }}
              >
                BST-3 CSV
              </Button>
              <Button
                size="sm"
                className="hos-btn-ink !rounded-full"
                onClick={() => navigate("/desk")}
              >
                Back to Desk
              </Button>
            </div>
          </div>
        </GlassPanel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GlassPanel className="p-4">
            <strong className="text-sm text-[var(--hos-ink)]">
              Pre-flight gates
            </strong>
            <ul className="mt-3 m-0 list-none space-y-2 p-0">
              {checklist.map((c) => {
                const soft = c.id === "arrivals" && c.status === "blocked";
                const blocked = c.status === "blocked" && !soft;
                return (
                  <li
                    key={c.id}
                    className="hos-cell flex items-center justify-between gap-2 rounded-xl px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      {blocked ? (
                        <Lock className="mt-0.5 size-3.5 shrink-0 text-[var(--hos-ruby)]" />
                      ) : soft ? (
                        <Circle className="mt-0.5 size-3.5 shrink-0 text-[var(--hos-brass)]" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--hos-emerald)]" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[var(--hos-ink)]">
                          {c.label}
                        </div>
                        <div className="text-[10px] text-[var(--hos-ink-3)]">
                          {c.detail}
                          {soft ? " · soft (no-show at close)" : ""}
                        </div>
                      </div>
                    </div>
                    <Badge
                      tone={
                        blocked ? "danger" : soft ? "vip" : "success"
                      }
                    >
                      {blocked ? "block" : soft ? "soft" : "ok"}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </GlassPanel>

          <GlassPanel className="flex flex-col gap-3 p-4">
            <strong className="text-sm text-[var(--hos-ink)]">
              Run rollover
            </strong>
            <ol className="m-0 list-none space-y-2 p-0">
              {PIPELINE.map((step, i) => {
                const active = phase !== null && phase === i;
                const done = phase !== null && phase > i;
                return (
                  <li
                    key={step}
                    className={[
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition-colors",
                      done
                        ? "bg-[rgba(16,185,129,0.1)] text-[var(--hos-ink)]"
                        : active
                          ? "bg-[rgba(37,99,235,0.12)] text-[var(--hos-primary)]"
                          : "text-[var(--hos-ink-2)]",
                    ].join(" ")}
                  >
                    <span className="font-mono text-[10px] font-bold tabular-nums text-[var(--hos-ink-3)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-medium">{step}</span>
                  </li>
                );
              })}
            </ol>

            <label className="grid gap-1 text-xs font-medium text-[var(--hos-ink-2)]">
              GM PIN
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                data-testid="night-audit-pin"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="hos-input rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5 tracking-[0.35em]"
                placeholder="••••"
                autoComplete="off"
              />
            </label>

            <motion.div whileTap={reduce ? undefined : { scale: 0.97 }}>
              <Button
                className="hos-btn-ink hos-btn-spring w-full !min-h-11 !rounded-2xl"
                data-testid="night-audit-run"
                disabled={hardBlockers.length > 0 || pending}
                onClick={run}
              >
                <Sparkles className="size-4" strokeWidth={2} />
                {hardBlockers.length > 0
                  ? `Clear ${hardBlockers.length} hard gate(s)`
                  : pending
                    ? "Sealing night…"
                    : "Run autonomous night audit"}
              </Button>
            </motion.div>

            {hardBlockers.length > 0 ? (
              <p className="m-0 text-xs font-medium text-[var(--hos-ruby)]">
                Impossible until hard gates clear — Desk / POS / KDS / StayHub.
              </p>
            ) : null}

            {auditLog.length > 0 ? (
              <div className="hos-scrollbar-slim max-h-36 overflow-y-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3 font-mono text-[10px] leading-relaxed text-[var(--hos-ink-3)]">
                {auditLog.map((l, i) => (
                  <div key={`${i}-${l.slice(0, 12)}`}>{l}</div>
                ))}
              </div>
            ) : null}
          </GlassPanel>
        </div>
      </div>
    </ModuleFrame>
  );
}
