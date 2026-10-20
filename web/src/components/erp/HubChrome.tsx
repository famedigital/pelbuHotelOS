"use client";

import { ErpBreadcrumb } from "@/components/erp/ErpBreadcrumb";
import { HubShell, type HubTab } from "@/components/erp/HubShell";
import { hubTabIdFromPath } from "@/lib/erp/hubs";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

function HubChromeInner({
  heading,
  description,
  tabs,
  children,
  filters,
  headerAside,
  stickyCta,
}: {
  heading: string;
  description: string;
  tabs: readonly HubTab[];
  children: ReactNode;
  filters?: ReactNode;
  headerAside?: ReactNode;
  stickyCta?: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const activeTab = hubTabIdFromPath(pathname, tabs);
  const tab = tabs.find((t) => t.id === activeTab);
  return (
    <HubShell
      heading={heading}
      description={description}
      tabs={tabs}
      activeTab={activeTab}
      filters={filters}
      headerAside={headerAside}
      stickyCta={stickyCta}
      breadcrumb={
        <ErpBreadcrumb
          items={[
            { label: "Desk", href: "/erp/stayview" },
            { label: heading, href: tabs[0]?.href },
            { label: tab?.label ?? heading },
          ]}
        />
      }
    >
      {children}
    </HubShell>
  );
}

/** Link-mode hub chrome for sibling routes (Stays, Rooms, Finance, …). */
export function HubChrome(props: {
  heading: string;
  description: string;
  tabs: readonly HubTab[];
  children: ReactNode;
  filters?: ReactNode;
  headerAside?: ReactNode;
  stickyCta?: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <HubChromeInner {...props} />
    </Suspense>
  );
}
