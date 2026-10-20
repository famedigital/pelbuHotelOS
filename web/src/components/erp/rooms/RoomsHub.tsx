"use client";

import { HubChrome } from "@/components/erp/HubChrome";
import { ROOMS_TABS } from "@/lib/erp/hubs";
import type { ReactNode } from "react";

export function RoomsHub({
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
      heading="Rooms"
      description="Room status, floor map, housekeeping, lost & found, maintenance, laundry"
      tabs={ROOMS_TABS}
      filters={filters}
      headerAside={headerAside}
    >
      {children}
    </HubChrome>
  );
}
