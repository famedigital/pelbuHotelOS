"use client";

import type { FastBookRoomType } from "./FastBookForm";
import { cn } from "@/lib/utils";

type Props = {
  roomTypes: FastBookRoomType[];
  qtyValues: Record<string, number>;
  onQtyChange: (code: string, value: number) => void;
};

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
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-input bg-background text-base text-foreground transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-40 md:size-8"
    >
      {children}
    </button>
  );
}

function QtyControls({
  rt,
  value,
  onQtyChange,
}: {
  rt: FastBookRoomType;
  value: number;
  onQtyChange: (code: string, value: number) => void;
}) {
  const over = value > rt.unit_count;
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <StepperButton
        label={`Decrease ${rt.name}`}
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
          onQtyChange(
            rt.code,
            Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0,
          );
        }}
        className={cn(
          "h-10 w-12 rounded-md border bg-background px-1 text-center text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:h-8 md:w-14 md:px-2",
          over ? "border-destructive text-destructive" : "border-input",
        )}
      />
      <StepperButton
        label={`Increase ${rt.name}`}
        onClick={() =>
          onQtyChange(rt.code, Math.min(rt.unit_count, value + 1))
        }
        disabled={value >= rt.unit_count}
      >
        +
      </StepperButton>
    </div>
  );
}

function TypeMeta({ rt }: { rt: FastBookRoomType }) {
  return (
    <div className="min-w-0">
      <span className="block truncate text-sm font-medium text-foreground">
        {rt.name}
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
        <span>{rt.code}</span>
        <span className="text-muted-foreground/80 normal-case tracking-normal">
          {rt.unit_count} avail
          {rt.unit_count === 0 ? (
            <span className="text-destructive"> · full</span>
          ) : null}
        </span>
      </span>
    </div>
  );
}

function MobileTypeRow({
  rt,
  value,
  onQtyChange,
}: {
  rt: FastBookRoomType;
  value: number;
  onQtyChange: (code: string, value: number) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-border/80 px-3 py-3 first:border-t-0">
      <TypeMeta rt={rt} />
      <QtyControls rt={rt} value={value} onQtyChange={onQtyChange} />
    </li>
  );
}

function MobileGroup({
  label,
  types,
  qtyValues,
  onQtyChange,
}: {
  label: string;
  types: FastBookRoomType[];
  qtyValues: Record<string, number>;
  onQtyChange: (code: string, value: number) => void;
}) {
  if (types.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <p className="border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </p>
      <ul>
        {types.map((rt) => (
          <MobileTypeRow
            key={rt.id}
            rt={rt}
            value={qtyValues[rt.code] ?? 0}
            onQtyChange={onQtyChange}
          />
        ))}
      </ul>
    </div>
  );
}

function DesktopTypeRow({
  rt,
  value,
  onQtyChange,
}: {
  rt: FastBookRoomType;
  value: number;
  onQtyChange: (code: string, value: number) => void;
}) {
  return (
    <tr className="border-t transition-colors hover:bg-muted/40">
      <th
        scope="row"
        className="px-3 py-2.5 text-left align-middle text-foreground"
      >
        <span className="block text-sm font-medium">{rt.name}</span>
        <span className="block font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          {rt.code}
        </span>
      </th>
      <td className="px-3 py-2.5 text-right align-middle font-mono text-xs text-muted-foreground">
        {rt.unit_count}
        {rt.unit_count === 0 ? (
          <span className="ml-1 text-destructive">· full</span>
        ) : null}
      </td>
      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center justify-end">
          <QtyControls rt={rt} value={value} onQtyChange={onQtyChange} />
        </div>
      </td>
    </tr>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <tr className="bg-muted/40">
      <th
        colSpan={3}
        scope="colgroup"
        className="px-3 py-1.5 text-left text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
      >
        {label}
      </th>
    </tr>
  );
}

/**
 * Quantity picker for Fast Book room types.
 * Mobile: stacked rows (no horizontal table clip). Desktop: compact table.
 */
export function FastBookGrid({ roomTypes, qtyValues, onQtyChange }: Props) {
  const guestTypes = roomTypes.filter(
    (r) => r.inventory_kind === "sellable_guest",
  );
  const compTypes = roomTypes.filter(
    (r) =>
      r.inventory_kind === "guide_comp" || r.inventory_kind === "driver_comp",
  );

  if (guestTypes.length === 0 && compTypes.length === 0) {
    return (
      <p className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        No room types configured for this property.
      </p>
    );
  }

  return (
    <fieldset className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <legend className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Rooms &amp; beds
        </legend>
        <p className="text-xs text-muted-foreground">Tap + / − per type</p>
      </div>

      {/* Phone — card stacks, full width, no table overflow */}
      <div className="space-y-3 md:hidden">
        <MobileGroup
          label="Guest rooms"
          types={guestTypes}
          qtyValues={qtyValues}
          onQtyChange={onQtyChange}
        />
        <MobileGroup
          label="Guide / driver (comp)"
          types={compTypes}
          qtyValues={qtyValues}
          onQtyChange={onQtyChange}
        />
      </div>

      {/* Desktop — table */}
      <div className="hidden min-w-0 overflow-x-auto rounded-lg border bg-card md:block">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <caption className="sr-only">
            Quantity per room type. Available units shown as a maximum hint.
          </caption>
          <thead>
            <tr className="border-b bg-muted/40 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Type
              </th>
              <th
                scope="col"
                className="w-20 px-3 py-2 text-right font-semibold"
              >
                Avail
              </th>
              <th
                scope="col"
                className="w-36 px-3 py-2 text-right font-semibold"
              >
                Qty
              </th>
            </tr>
          </thead>
          <tbody>
            {guestTypes.length > 0 ? (
              <>
                <GroupHeader label="Guest rooms" />
                {guestTypes.map((rt) => (
                  <DesktopTypeRow
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
                  <DesktopTypeRow
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
