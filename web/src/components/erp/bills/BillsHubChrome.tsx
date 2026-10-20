"use client";

import { ErpBreadcrumb } from "@/components/erp/ErpBreadcrumb";
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
      description="Guest and agent money — collect balances, open folios, invoices, payments"
      tabs={BILLS_TABS}
      activeTab={activeTab}
      stickyCta={stickyCta}
      breadcrumb={
        <ErpBreadcrumb
          items={[
            { label: "Desk", href: "/erp/stayview" },
            { label: "Bills", href: "/erp/bills" },
            { label: tab?.label ?? "Bills" },
          ]}
        />
      }
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
