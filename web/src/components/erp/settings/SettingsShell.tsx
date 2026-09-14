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

  return (
    <div className="erp space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Hotel
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Settings
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-[15px]">
            {description ?? defaultDescription}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      <nav
        aria-label="Settings sections"
        className="overflow-x-auto rounded-xl border bg-card"
      >
        <div className="flex min-w-max items-stretch divide-x">
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col px-2 py-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-0.5">
                {group.items.map((item) => {
                  const active = activeTab === item.tab;
                  const danger = item.tab === "danger";
                  return (
                    <Link
                      key={item.tab}
                      href={tabHref(item.tab)}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                        active
                          ? danger
                            ? "bg-destructive font-medium text-destructive-foreground"
                            : "bg-accent font-medium text-accent-foreground"
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

      {children}
    </div>
  );
}
