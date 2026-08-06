"use client";

import { StayHubProvider } from "@/components/erp/StayHubProvider";
import { Suspense, type ReactNode } from "react";

/** Client island: StayHub context + dialog for all ERP pages under DeskShell. */
export function StayHubShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      }
    >
      <StayHubProvider>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </StayHubProvider>
    </Suspense>
  );
}
