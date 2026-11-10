/**
 * Driver field portal — Innora marketplace first.
 */
import { useState } from "react";
import { FieldPortalGate } from "../field/FieldPortalGate";
import {
  MarketplaceFieldHome,
  defaultMarketplaceActor,
} from "../field/MarketplaceFieldHome";
import { DriverAssignmentOps } from "../field/DriverAssignmentOps";

export function DriverCompanionPage() {
  const actor = defaultMarketplaceActor("driver");
  const [showOps, setShowOps] = useState(false);

  return (
    <FieldPortalGate
      role="driver"
      title="Fleet Marketplace"
      blurb="Show free / at hotel · accept vehicle jobs Innora-wide · optional room sales with opaque commission."
    >
      <MarketplaceFieldHome
        role="driver"
        actorId={actor.id}
        actorName={actor.name}
      />
      <div className="mx-auto w-full max-w-lg px-3 pb-10">
        <button
          type="button"
          className="w-full rounded-xl border border-[var(--hos-line)] py-3 text-[13px] font-bold text-[var(--hos-ink-2)]"
          onClick={() => setShowOps((v) => !v)}
        >
          {showOps ? "Hide" : "Show"} run sheet / fuel ops
        </button>
        {showOps ? <DriverAssignmentOps /> : null}
      </div>
    </FieldPortalGate>
  );
}
