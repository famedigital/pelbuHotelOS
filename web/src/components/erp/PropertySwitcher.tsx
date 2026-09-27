"use client";

import { switchActiveProperty } from "@/app/actions/erp-holds";
import { deleteDeskReadCacheByProperty } from "@/lib/desk/desk-read-cache";
import type { PropertySwitcherOption } from "@/lib/property-types";

export function PropertySwitcher({
  properties,
  activePropertyId,
}: {
  properties: PropertySwitcherOption[];
  activePropertyId: string;
}) {
  return (
    <form action={switchActiveProperty} className="ml-0.5">
      <label className="sr-only" htmlFor="property_id">
        Active hotel
      </label>
      <select
        id="property_id"
        name="property_id"
        defaultValue={activePropertyId}
        onChange={(e) => {
          const next = e.currentTarget.value;
          void deleteDeskReadCacheByProperty(activePropertyId);
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem("pelbu-desk-property-id", next);
          }
          e.currentTarget.form?.requestSubmit();
        }}
        className="h-8 max-w-[7.5rem] truncate rounded-md border border-input bg-transparent px-2 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] xl:max-w-[200px]"
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
