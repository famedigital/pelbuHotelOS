"use client";

import { AgentAppSidebar } from "@/components/erp/agent-portal/AgentAppSidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AGENTS_TABS, hubTabIdFromPath } from "@/lib/erp/hubs";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AgentAppShell({
  companyName,
  links = [],
  activePropertyId = null,
  activePropertyName = null,
  children,
}: {
  companyName: string;
  links?: { propertyId: string; propertyName: string }[];
  activePropertyId?: string | null;
  activePropertyName?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const printBare =
    pathname.includes("/voucher") ||
    /^\/agents\/app\/invoices\/[^/]+$/.test(pathname);

  if (printBare) {
    return <>{children}</>;
  }

  const activeId = hubTabIdFromPath(pathname, AGENTS_TABS);
  const activeTab =
    AGENTS_TABS.find((t) => t.id === activeId) ?? AGENTS_TABS[0];

  return (
    <div className="erp min-h-dvh bg-background text-foreground">
      <SidebarProvider defaultOpen defaultState="expanded">
        <AgentAppSidebar
          companyName={companyName}
          links={links}
          activePropertyId={activePropertyId}
          activePropertyName={activePropertyName}
        />

        <SidebarInset className="min-h-dvh">
          <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-md">
            <div className="flex h-12 items-center gap-2 px-3 sm:px-4">
              <SidebarTrigger className="-ml-0.5" />
              <Separator orientation="vertical" className="mr-1 h-4!" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold tracking-tight">
                  {activeTab?.label ?? companyName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {activeTab?.description ??
                    activePropertyName ??
                    companyName}
                </p>
              </div>
            </div>
            <nav
              aria-label="Agent sections"
              className="flex max-w-full items-center gap-0.5 overflow-x-auto border-t border-border/50 bg-muted/30 px-2 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-3"
            >
              {AGENTS_TABS.map((tab) => {
                const active = tab.id === activeTab?.id;
                return (
                  <Link
                    key={tab.id}
                    href={tab.href!}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center rounded-[5px] px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                      active
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <div className="relative flex-1">
            <main className="relative mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
              {children}
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
