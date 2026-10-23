"use client";

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
  tabsClassName,
}: {
  heading: string;
  description: string;
  tabs: readonly HubTab[];
  children: ReactNode;
  filters?: ReactNode;
  headerAside?: ReactNode;
  stickyCta?: ReactNode;
  tabsClassName?: string;
}) {
  const pathname = usePathname() ?? "";
  const activeTab = hubTabIdFromPath(pathname, tabs);
  return (
    <HubShell
      heading={heading}
      description={description}
      tabs={tabs}
      activeTab={activeTab}
      filters={filters}
      headerAside={headerAside}
      stickyCta={stickyCta}
      tabsClassName={tabsClassName}
      hideHeading
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
  tabsClassName?: string;
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
