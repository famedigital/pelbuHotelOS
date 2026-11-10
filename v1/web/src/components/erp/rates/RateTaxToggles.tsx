"use client";

import {
  formatBtn,
  guestNightFromTypedRate,
  nightBasisFromToggles,
  type NightRateBasis,
} from "@/lib/pricing";

export function RateTaxToggles({
  includesServiceCharge,
  includesGst,
  gstCharged,
  serviceChargeRate,
  gstRate,
  storeInclusive,
  sampleNu,
  onIncludesServiceCharge,
  onIncludesGst,
}: {
  includesServiceCharge: boolean;
  includesGst: boolean;
  gstCharged: boolean;
  serviceChargeRate: number;
  gstRate: number;
  storeInclusive: boolean;
  sampleNu: string;
  onIncludesServiceCharge: (value: boolean) => void;
  onIncludesGst: (value: boolean) => void;
}) {
  const typed = Number(sampleNu);
  const basis: NightRateBasis = nightBasisFromToggles({
    includesServiceCharge,
    includesGst,
    gstCharged,
  });
  const split =
    sampleNu.trim() !== "" && Number.isFinite(typed) && typed >= 0
      ? guestNightFromTypedRate(typed, basis, { serviceChargeRate, gstRate })
      : null;
  const saved = split ? (storeInclusive ? split.totalBtn : split.amountBtn) : null;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 px-3 py-3">
      <p className="text-sm font-medium">This number already includes</p>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--gold)]"
            checked={includesServiceCharge}
            onChange={(event) => onIncludesServiceCharge(event.target.checked)}
          />
          Service charge
          {serviceChargeRate > 0
            ? ` (${Math.round(serviceChargeRate * 1000) / 10}%)`
            : ""}
        </label>
        {gstCharged ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--gold)]"
              checked={includesGst}
              onChange={(event) => onIncludesGst(event.target.checked)}
            />
            GST ({Math.round(gstRate * 1000) / 10}%)
          </label>
        ) : (
          <p className="text-sm text-muted-foreground">GST is not charged.</p>
        )}
      </div>
      {split && saved != null ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm tabular-nums sm:grid-cols-4">
          <div>
            <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Base
            </dt>
            <dd>{formatBtn(split.amountBtn)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Service
            </dt>
            <dd>{formatBtn(split.serviceChargeBtn)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              GST
            </dt>
            <dd>{formatBtn(split.gstBtn)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Sheet saves
            </dt>
            <dd className="font-medium">{formatBtn(saved)}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-xs text-muted-foreground">
          Type the Nu from the card. The switches say whether service charge
          and GST are already inside that figure.
        </p>
      )}
    </div>
  );
}
