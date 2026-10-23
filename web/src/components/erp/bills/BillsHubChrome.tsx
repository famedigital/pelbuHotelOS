"use client";

import { HubShell } from "@/components/erp/HubShell";
import { BILLS_TABS, parseHubTab } from "@/lib/erp/hubs";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

function BillsHubChromeInner({
  children,
  stickyCta,
}: {
  children: ReactNode;
  stickyCta?: ReactNode;
}) {
  const searchParams = useSearchParams();
  const activeTab = parseHubTab(searchParams.get("tab"), BILLS_TABS, "owes");
  const tab = BILLS_TABS.find((t) => t.id === activeTab);
  return (
    <HubShell
      heading="Bills"
      description={tab?.description ?? "Collect balances, folios, invoices"}
      tabs={BILLS_TABS}
      activeTab={activeTab}
      stickyCta={stickyCta}
      hideHeading
    >
      {children}
    </HubShell>
  );
}

export function BillsHubChrome({
  children,
  stickyCta,
}: {
  children: ReactNode;
  stickyCta?: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">Loading bills…</div>
      }
    >
      <BillsHubChromeInner stickyCta={stickyCta}>{children}</BillsHubChromeInner>
    </Suspense>
  );
}
