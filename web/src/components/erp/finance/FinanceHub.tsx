"use client";

import { HubChrome } from "@/components/erp/HubChrome";
import { FINANCE_TABS } from "@/lib/erp/hubs";
import type { ReactNode } from "react";

export function FinanceHub({
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
      heading="Finance"
      description="Hotel books — night close, banking, expenses, GST, and cash position (not a guest bill)"
      tabs={FINANCE_TABS}
      filters={filters}
      headerAside={headerAside}
    >
      {children}
    </HubChrome>
  );
}
