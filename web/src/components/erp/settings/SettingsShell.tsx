"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SettingsTabKey } from "@/lib/erp/settings-readiness";

type NavItem = {
  tab: SettingsTabKey;
  label: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function buildGroups(isOwner: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "Home",
      items: [{ tab: "overview", label: "Overview" }],
    },
    {
      label: "Your hotel",
      items: [{ tab: "identity", label: "Hotel profile" }],
    },
    {
      label: "Rooms",
      items: [{ tab: "rooms", label: "Inventory" }],
    },
    {
      label: "Money",
      items: [
        { tab: "tax", label: "Tax & service" },
        { tab: "commercial", label: "Meals & defaults" },
      ],
    },
    {
      label: "Guest stay",
      items: [{ tab: "policies", label: "Policies & Wi‑Fi" }],
    },
    {
      label: "Printouts",
      items: [{ tab: "documents", label: "Documents" }],
    },
    {
      label: "Licenses",
      items: [{ tab: "compliance", label: "Compliance" }],
    },
    {
      label: "Advanced",
      items: [{ tab: "finance-imports", label: "Finance imports" }],
    },
  ];

  if (isOwner) {
    groups.push({
      label: "Owner",
      items: [{ tab: "danger", label: "Danger zone" }],
    });
  }

  return groups;
}

function tabHref(tab: SettingsTabKey): string {
  if (tab === "overview") return "/erp/settings";
  return `/erp/settings?tab=${tab}`;
}

export function SettingsShell({
  activeTab,
  isOwner,
  setupComplete,
  description,
  actions,
  children,
}: {
  activeTab: SettingsTabKey;
  isOwner: boolean;
  setupComplete: boolean;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const groups = buildGroups(isOwner);
  const defaultDescription = setupComplete
    ? "Hotel defaults — change carefully during service."
    : "Finish setup for guests and money.";

  const flatItems = groups.flatMap((g) =>
    g.items.map((item) => ({ ...item, group: g.label })),
  );

  return (
    <div className="erp space-y-3 p-3 md:space-y-4 md:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">Hotel</p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            Settings
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description ?? defaultDescription}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      {/* Mobile: horizontal chip jump */}
      <nav
        aria-label="Settings sections"
        className="flex gap-1 overflow-x-auto pb-1 md:hidden"
      >
        {flatItems.map((item) => {
          const active = activeTab === item.tab;
          const danger = item.tab === "danger";
          return (
            <Link
              key={item.tab}
              href={tabHref(item.tab)}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap",
                active
                  ? danger
                    ? "bg-destructive font-medium text-destructive-foreground"
                    : "bg-primary font-medium text-primary-foreground"
                  : danger
                    ? "border border-destructive/30 text-destructive"
                    : "border bg-card text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="md:grid md:grid-cols-[11rem_minmax(0,1fr)] md:gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Desktop: sticky side toc */}
        <nav
          aria-label="Settings sections"
          className="hidden md:block"
        >
          <div className="sticky top-14 space-y-3 rounded-lg border bg-card p-2">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = activeTab === item.tab;
                    const danger = item.tab === "danger";
                    return (
                      <Link
                        key={item.tab}
                        href={tabHref(item.tab)}
                        className={cn(
                          "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                          active
                            ? danger
                              ? "bg-destructive font-medium text-destructive-foreground"
                              : "bg-primary font-medium text-primary-foreground"
                            : danger
                              ? "text-destructive hover:bg-destructive/10"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
