"use client";

import { switchActiveProperty } from "@/app/actions/erp-holds";
import type { PropertyRow } from "@/lib/property-context";

export function PropertySwitcher({
  properties,
  activePropertyId,
}: {
  properties: PropertyRow[];
  activePropertyId: string;
}) {
  return (
    <form action={switchActiveProperty} className="ml-1">
      <label className="sr-only" htmlFor="property_id">
        Active hotel
      </label>
      <select
        id="property_id"
        name="property_id"
        defaultValue={activePropertyId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="min-h-9 rounded-sm border border-white/20 bg-espresso px-2 text-xs text-white outline-none"
      >
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {!p.setup_completed_at ? " · setup" : ""}
          </option>
        ))}
      </select>
    </form>
  );
}
