"use client";

import { StayHubProvider } from "@/components/erp/StayHubProvider";
import { Suspense, type ReactNode } from "react";

/** Client island: StayHub context + dialog for all ERP pages under DeskShell. */
export function StayHubShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <StayHubProvider>{children}</StayHubProvider>
    </Suspense>
  );
}
