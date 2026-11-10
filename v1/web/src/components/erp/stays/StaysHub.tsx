"use client";

import { HubChrome } from "@/components/erp/HubChrome";
import { STAYS_TABS } from "@/lib/erp/hubs";
import type { ReactNode } from "react";

export function StaysHub({
  children,
  filters,
  headerAside,
}: {
  children: ReactNode;
  filters?: ReactNode;
  headerAside?: ReactNode;
}) {
  return (
    <HubChrome
      heading="Stays"
      description="Arrivals, in-house guests, departures, reservations, and guest profiles"
      tabs={STAYS_TABS}
      filters={filters}
      headerAside={headerAside}
    >
      {children}
    </HubChrome>
  );
}
