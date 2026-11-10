/**
 * Guide field portal — Innora marketplace first (availability, jobs, room sales).
 * FO companion ops kept as secondary “My assignment”.
 */
import { useState } from "react";
import { FieldPortalGate } from "../field/FieldPortalGate";
import {
  MarketplaceFieldHome,
  defaultMarketplaceActor,
} from "../field/MarketplaceFieldHome";
import { GuideAssignmentOps } from "../field/GuideAssignmentOps";

export function GuideCompanionPage() {
  const actor = defaultMarketplaceActor("guide");
  const [showOps, setShowOps] = useState(false);

  return (
    <FieldPortalGate
      role="guide"
      title="Guide Marketplace"
      blurb="Set free / at hotel · accept Innora-wide jobs · sell rooms (guest pays tariff; your commission stays off their bill)."
    >
      <MarketplaceFieldHome
        role="guide"
        actorId={actor.id}
        actorName={actor.name}
      />
      <div className="mx-auto w-full max-w-lg px-3 pb-10">
        <button
          type="button"
          className="w-full rounded-xl border border-[var(--hos-line)] py-3 text-[13px] font-bold text-[var(--hos-ink-2)]"
          onClick={() => setShowOps((v) => !v)}
        >
          {showOps ? "Hide" : "Show"} my assignment ops (roster / breakfast)
        </button>
        {showOps ? <GuideAssignmentOps /> : null}
      </div>
    </FieldPortalGate>
  );
}
