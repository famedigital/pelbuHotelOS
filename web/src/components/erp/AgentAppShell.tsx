"use client";

import { AgentAppSidebar } from "@/components/erp/agent-portal/AgentAppSidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
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
  const pathname = usePathname();
  const printBare =
    pathname.includes("/voucher") ||
    /^\/agents\/app\/invoices\/[^/]+$/.test(pathname);

  if (printBare) {
    return <>{children}</>;
  }

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
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/90 px-3 backdrop-blur-md sm:px-4">
            <SidebarTrigger className="-ml-0.5" />
            <Separator orientation="vertical" className="mr-1 h-4!" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">
                {companyName}
              </p>
              {activePropertyName ? (
                <p className="truncate text-xs text-muted-foreground">
                  {activePropertyName}
                </p>
              ) : null}
            </div>
          </header>

          <div className="relative flex-1">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-sky-100/50 via-transparent to-transparent"
            />
            <main className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
              {children}
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
