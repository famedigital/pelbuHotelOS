/**
 * Optional driver FO ops (run sheet / fuel) after assignment.
 */
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, Button, EmptyState } from "@hos-v2/ui";
import { useEcosystemStore } from "../../lib/ecosystem-store";
import { formatNu, useFrontOfficeStore, ymd } from "../../lib/front-office-store";

const FUEL = [500, 1000, 2000, 3500] as const;

export function DriverAssignmentOps() {
  const [, start] = useTransition();
  const [amount, setAmount] = useState(1000);
  const [busy, setBusy] = useState(false);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const requestFuelAdvance = useEcosystemStore((s) => s.requestFuelAdvance);
  const fuelAdvances = useEcosystemStore((s) => s.fuelAdvances);
  const runLegs = useEcosystemStore((s) => s.runLegs);
  const ensureRunLegs = useEcosystemStore((s) => s.ensureRunLegs);
  const setLegStatus = useEcosystemStore((s) => s.setLegStatus);
  const healGuideRoster = useEcosystemStore((s) => s.healGuideRoster);
  const activeDriver = useEcosystemStore((s) => s.activeDriver);

  const today = businessDate || ymd(new Date());
  const driver = activeDriver();

  useEffect(() => {
    healGuideRoster();
    ensureRunLegs(today);
  }, [today, healGuideRoster, ensureRunLegs]);

  return (
    <div
      className="mt-3 flex flex-col gap-3 rounded-2xl border border-white/15 p-3"
      style={{ background: "#0B1220", color: "#F8FAFC" }}
    >
      <p className="m-0 text-[11px] text-slate-400">
        Assignment ops for {driver.name} · {driver.vehicleNo}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {FUEL.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setAmount(n)}
            className={[
              "min-h-11 rounded-xl text-[12px] font-bold",
              amount === n ? "bg-amber-400 text-black" : "border border-white/20",
            ].join(" ")}
          >
            {n}
          </button>
        ))}
      </div>
      <Button
        className="!min-h-11 !bg-amber-400 !text-black"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          start(() => {
            void requestFuelAdvance(amount).then((res) => {
              setBusy(false);
              if (!res.ok) toast.error(res.error);
              else toast.success(`Advance ${formatNu(amount)}`);
            });
          });
        }}
      >
        Request fuel advance
      </Button>
      {fuelAdvances[0] ? (
        <p className="m-0 text-[11px] text-slate-400">
          Last: {formatNu(fuelAdvances[0].amountBtn)} · {fuelAdvances[0].driverName}
        </p>
      ) : null}
      <strong className="text-[13px]">Run sheet · {today}</strong>
      {runLegs.length === 0 ? (
        <EmptyState
          title="No legs"
          description="Accept a vehicle job with arrivals/departures first."
        />
      ) : (
        runLegs.slice(0, 8).map((leg) => (
          <div
            key={leg.id}
            className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-2.5 py-2 text-[12px]"
          >
            <span>
              <Badge tone={leg.kind === "pickup" ? "success" : "danger"}>
                {leg.kind}
              </Badge>{" "}
              {leg.guestName}
            </span>
            <Button
              size="sm"
              className="!bg-white/10 !text-white"
              onClick={() =>
                setLegStatus(
                  leg.id,
                  leg.status === "pending"
                    ? "en_route"
                    : leg.status === "en_route"
                      ? "arrived"
                      : "done",
                )
              }
            >
              {leg.status}
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
