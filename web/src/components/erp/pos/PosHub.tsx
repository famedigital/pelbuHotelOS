"use client";

import { HubChrome } from "@/components/erp/HubChrome";
import { POS_TABS } from "@/lib/erp/hubs";
import type { ReactNode } from "react";

export function PosHub({
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
      heading="POS"
      description="Sell food and drink, open tickets, kitchen, and day reports"
      tabs={POS_TABS}
      filters={filters}
      headerAside={headerAside}
    >
      {children}
    </HubChrome>
  );
}
