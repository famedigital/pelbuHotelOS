"use client";

import { HubChrome } from "@/components/erp/HubChrome";
import { HR_TABS } from "@/lib/erp/hubs";
import type { ReactNode } from "react";

export function HrHub({
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
      heading="HR"
      description="Team, attendance, leave, rota, payroll, and recruitment"
      tabs={HR_TABS}
      filters={filters}
      headerAside={headerAside}
    >
      {children}
    </HubChrome>
  );
}
