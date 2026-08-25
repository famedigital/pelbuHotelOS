"use client";

import {
  DASHBOARD_VIEWS,
  parseDashboardView,
  type DashboardView,
} from "@/lib/erp/dashboard-views";
import { resolveModule } from "@/lib/erp-nav";
import { isFoDailyTab } from "@/lib/erp/desk-workspace";
import { useDeskWorkspace } from "@/components/erp/DeskWorkspaceProvider";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

function tabClass(active: boolean) {
  return cn(
    "inline-flex h-7 shrink-0 items-center rounded-[5px] px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
    active
      ? "bg-accent text-accent-foreground shadow-sm"
      : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
  );
}

/**
 * Active module sections **inline in the sticky header** (one row).
 * On `/erp`, when the session can preview boards, Owner / Manager / Front desk…
 * lives here too — not a second strip under the header.
 */
function DashboardBoardTabs({
  homeDashboardView,
}: {
  homeDashboardView: DashboardView;
}) {
  const searchParams = useSearchParams();
  const requested = parseDashboardView(searchParams.get("view"));
  const active: DashboardView = requested ?? homeDashboardView;
  const forecastMonth = searchParams.get("forecastMonth");

  return (
    <nav
      aria-label="Desk dashboard boards"
      className="ml-1 flex min-w-0 max-w-[min(100%,52rem)] items-center gap-0.5 overflow-x-auto rounded-md border bg-muted/40 p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {DASHBOARD_VIEWS.map((v) => {
        const isActive = v.id === active;
        const params = new URLSearchParams();
        if (v.id !== homeDashboardView) {
          params.set("view", v.id);
        }
        if (forecastMonth && /^\d{4}-\d{2}$/.test(forecastMonth)) {
          params.set("forecastMonth", forecastMonth);
        }
        const q = params.toString();
        const href = q ? `/erp?${q}` : "/erp";
        return (
          <Link
            key={v.id}
            href={href}
            aria-current={isActive ? "page" : undefined}
            title={v.blurb}
            className={tabClass(isActive)}
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ModuleHeaderTabs({
  canPreviewDashboards = false,
  homeDashboardView = "front_desk",
  allowedModuleKeys,
}: {
  /** Owner/GM: show department boards in the first-row header. */
  canPreviewDashboards?: boolean;
  homeDashboardView?: DashboardView;
  /** Filter visible tabs when partial screen grants are set. */
  allowedModuleKeys?: readonly string[];
} = {}) {
  const pathname = usePathname();
  const match = resolveModule(pathname);
  const { workspace } = useDeskWorkspace();

  if (!match) return null;

  // Register owns its own first-row chrome (Sell | Floor + Tickets) via portal.
  // Keep full POS destination tabs on Menu / Kitchen / recipe-cost / food-cost.
  if (pathname === "/erp/pos" || pathname === "/erp/pos/") return null;

  const onDashboard =
    match.module.key === "dashboard" &&
    (pathname === "/erp" || pathname === "/erp/");

  if (onDashboard && canPreviewDashboards) {
    return <DashboardBoardTabs homeDashboardView={homeDashboardView} />;
  }

  const tabs = (() => {
    const granted =
      allowedModuleKeys && allowedModuleKeys.length > 0
        ? match.module.tabs.filter(
            (tab) =>
              allowedModuleKeys.includes(match.module.key) ||
              allowedModuleKeys.includes(tab.href),
          )
        : match.module.tabs;
    if (match.module.key === "pos") {
      return granted.filter(isFoDailyTab);
    }
    if (workspace === "front_desk") {
      return granted.filter(isFoDailyTab);
    }
    return granted.filter((tab) => tab.rail !== "hidden");
  })();

  if (tabs.length < 2) return null;

  return (
    <nav
      aria-label={`${match.module.title} sections`}
      className="ml-1 flex min-w-0 max-w-[min(100%,52rem)] items-center gap-0.5 overflow-x-auto rounded-md border bg-muted/40 p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const active = tab.href === match.tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={tabClass(active)}
          >
            {tab.title}
          </Link>
        );
      })}
    </nav>
  );
}

/** @deprecated Prefer ModuleHeaderTabs — same UI for all modules. */
export function CalendarHeaderTabs() {
  return <ModuleHeaderTabs />;
}
