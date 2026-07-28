"use client";

import type { FastBookRoomType } from "./FastBookForm";

type Props = {
  roomTypes: FastBookRoomType[];
  qtyValues: Record<string, number>;
  onQtyChange: (code: string, value: number) => void;
};

function QtyRow({
  rt,
  value,
  onQtyChange,
}: {
  rt: FastBookRoomType;
  value: number;
  onQtyChange: (code: string, value: number) => void;
}) {
  const remaining = Math.max(rt.unit_count - 0, 0);
  const over = value > rt.unit_count;

  return (
    <tr className="border-t border-espresso/10">
      <th scope="row" className="px-3 py-2.5 text-left align-middle text-espresso">
        <span className="block text-sm font-medium">{rt.name}</span>
        <span className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          {rt.code}
        </span>
      </th>
      <td className="px-3 py-2.5 text-right align-middle font-mono text-xs text-muted">
        {rt.unit_count}
        {remaining === 0 ? <span className="ml-1 text-maroon">·full</span> : null}
      </td>
      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center justify-end gap-1.5">
          <StepperButton
            label="Decrease"
            onClick={() => onQtyChange(rt.code, Math.max(0, value - 1))}
            disabled={value <= 0}
          >
            −
          </StepperButton>
          <input
            type="number"
            name={`qty_${rt.code}`}
            min={0}
            max={rt.unit_count}
            value={value}
            inputMode="numeric"
            aria-label={`Quantity for ${rt.name}`}
            onChange={(e) => {
              const n = Number(e.target.value || 0);
              onQtyChange(rt.code, Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
            }}
            className={`w-14 rounded-sm border bg-white px-2 py-1.5 text-center text-sm text-espresso outline-none transition-colors focus:ring-2 focus:ring-gold/20 ${
              over
                ? "border-maroon/60 text-maroon focus:border-maroon"
                : "border-espresso/15 focus:border-gold"
            }`}
          />
          <StepperButton
            label="Increase"
            onClick={() => onQtyChange(rt.code, Math.min(rt.unit_count, value + 1))}
            disabled={value >= rt.unit_count}
          >
            +
          </StepperButton>
        </div>
      </td>
    </tr>
  );
}

function StepperButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-espresso/15 bg-white text-base text-espresso transition-colors hover:border-espresso/40 hover:bg-espresso/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <tr className="bg-espresso/[0.04]">
      <th
        colSpan={3}
        scope="colgroup"
        className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-muted"
      >
        {label}
      </th>
    </tr>
  );
}

export function FastBookGrid({ roomTypes, qtyValues, onQtyChange }: Props) {
  const guestTypes = roomTypes.filter((r) => r.inventory_kind === "sellable_guest");
  const compTypes = roomTypes.filter(
    (r) => r.inventory_kind === "guide_comp" || r.inventory_kind === "driver_comp",
  );

  if (guestTypes.length === 0 && compTypes.length === 0) {
    return (
      <p className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon">
        No room types configured for this property.
      </p>
    );
  }

  return (
    <fieldset className="space-y-3">
      <div className="flex items-baseline justify-between">
        <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Rooms &amp; beds
        </legend>
        <p className="text-xs text-muted">Enter quantity per row</p>
      </div>

      <div className="overflow-hidden rounded-sm border border-espresso/10 bg-white">
        <table className="w-full border-collapse">
          <caption className="sr-only">
            Quantity per room type. Available units shown as a maximum hint.
          </caption>
          <thead className="text-[11px] uppercase tracking-[0.18em] text-muted">
            <tr className="border-b border-espresso/10">
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Type
              </th>
              <th scope="col" className="w-20 px-3 py-2 text-right font-semibold">
                Avail
              </th>
              <th scope="col" className="w-32 px-3 py-2 text-right font-semibold">
                Qty
              </th>
            </tr>
          </thead>
          <tbody>
            {guestTypes.length > 0 ? (
              <>
                <GroupHeader label="Guest rooms" />
                {guestTypes.map((rt) => (
                  <QtyRow
                    key={rt.id}
                    rt={rt}
                    value={qtyValues[rt.code] ?? 0}
                    onQtyChange={onQtyChange}
                  />
                ))}
              </>
            ) : null}
            {compTypes.length > 0 ? (
              <>
                <GroupHeader label="Guide / driver (comp)" />
                {compTypes.map((rt) => (
                  <QtyRow
                    key={rt.id}
                    rt={rt}
                    value={qtyValues[rt.code] ?? 0}
                    onQtyChange={onQtyChange}
                  />
                ))}
              </>
            ) : null}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}
