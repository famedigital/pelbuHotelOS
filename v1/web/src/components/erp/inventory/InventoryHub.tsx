"use client";

import { HubChrome } from "@/components/erp/HubChrome";
import { INVENTORY_TABS } from "@/lib/erp/hubs";
import type { ReactNode } from "react";

export function InventoryHub({
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
      heading="Inventory"
      description="Stock, locations, moves, purchase orders, audits, and assets"
      tabs={INVENTORY_TABS}
      filters={filters}
      headerAside={headerAside}
    >
      {children}
    </HubChrome>
  );
}
