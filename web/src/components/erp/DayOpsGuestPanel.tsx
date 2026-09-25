"use client";

import type { DayOpsRow } from "@/lib/erp/day-ops-board";
import { useState } from "react";

export type DayOpsGuestListProps = {
  title: string;
  blurb?: string;
  rows: DayOpsRow[];
  emptyMessage?: string;
  /** Show laundry column (departures). */
  showLaundry?: boolean;
  /** Show folio balance. */
  showFolio?: boolean;
};

/**
 * Department day list with a slim detail drawer (not StayHub).
 * FO boards keep StayHub; F&B / Kitchen / HK / Laundry use this.
 */
export function DayOpsGuestPanel({
  title,
  blurb,
  rows,
  emptyMessage = "None for this list.",
  showLaundry = false,
  showFolio = false,
}: DayOpsGuestListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="relative space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {blurb ? (
          <p className="text-xs text-muted-foreground">{blurb}</p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Guest</th>
                <th className="px-3 py-2 font-medium">Rooms</th>
                <th className="px-3 py-2 font-medium">Pax</th>
                <th className="px-3 py-2 font-medium">Meal</th>
                <th className="px-3 py-2 font-medium">Agent</th>
                {showFolio ? (
                  <th className="px-3 py-2 font-medium">Folio</th>
                ) : null}
                {showLaundry ? (
                  <th className="px-3 py-2 font-medium">Laundry</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                  onClick={() => setSelectedId(row.id)}
                >
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">
                      {row.contact_name ?? "Guest"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.contact_phone ?? "—"}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.room_labels ?? `${row.rooms} rm`}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.pax}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">
                    {row.meal_plan_code}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.agent_name ?? "—"}
                    {row.agent_phone ? (
                      <span className="block text-muted-foreground">
                        {row.agent_phone}
                      </span>
                    ) : null}
                  </td>
                  {showFolio ? (
                    <td className="px-3 py-2 tabular-nums text-xs">
                      {row.folio_balance_btn != null
                        ? `Nu ${Math.round(row.folio_balance_btn).toLocaleString()}`
                        : "—"}
                    </td>
                  ) : null}
                  {showLaundry ? (
                    <td className="px-3 py-2 text-xs">
                      {row.open_laundry_count > 0 ? (
                        <span className="font-medium text-destructive">
                          {row.open_laundry_count} open
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <DayOpsDetailDrawer
          row={selected}
          showLaundry={showLaundry}
          showFolio={showFolio}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

function DayOpsDetailDrawer({
  row,
  showLaundry,
  showFolio,
  onClose,
}: {
  row: DayOpsRow;
  showLaundry: boolean;
  showFolio: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close detail"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l bg-background shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Stay detail
            </p>
            <h3 className="text-lg font-semibold text-foreground">
              {row.contact_name ?? "Guest"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {row.check_in} → {row.check_out}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-2 py-1 text-sm hover:bg-muted"
          >
            Close
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
          <Field label="Phone" value={row.contact_phone} />
          <Field label="Rooms" value={row.room_labels ?? `${row.rooms} booked`} />
          <Field
            label="Pax"
            value={`${row.pax} (${row.adults}A${row.children ? ` + ${row.children}C` : ""})`}
          />
          <Field label="Meal plan" value={row.meal_plan_code} />
          <Field
            label="Agent"
            value={
              row.agent_name
                ? `${row.agent_name}${row.agent_phone ? ` · ${row.agent_phone}` : ""}`
                : null
            }
          />
          <Field
            label="Guide"
            value={
              row.guide_name || row.guide_number
                ? `${row.guide_name ?? row.guide_number ?? ""}${
                    row.guide_phone ? ` · ${row.guide_phone}` : ""
                  }`
                : null
            }
          />
          <Field
            label="Driver"
            value={
              row.driver_name
                ? `${row.driver_name}${
                    row.driver_phone ? ` · ${row.driver_phone}` : ""
                  }`
                : null
            }
          />
          {showFolio ? (
            <Field
              label="Folio balance"
              value={
                row.folio_balance_btn != null
                  ? `Nu ${Math.round(row.folio_balance_btn).toLocaleString()}`
                  : null
              }
            />
          ) : null}
          {showLaundry ? (
            <Field
              label="Open laundry"
              value={
                row.open_laundry_count > 0
                  ? `${row.open_laundry_count} · ${row.open_laundry_statuses.join(", ")}`
                  : "None"
              }
            />
          ) : null}
          {row.folio_id ? (
            <a
              href={`/erp/folios/${row.folio_id}`}
              className="inline-flex text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              Open folio →
            </a>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-foreground">{value?.trim() || "—"}</p>
    </div>
  );
}
