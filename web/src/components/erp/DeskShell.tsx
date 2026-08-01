import { deskLogout } from "@/app/actions/desk";
import { AppSidebar } from "@/components/erp/app-sidebar";
import { CalendarHeaderTabs } from "@/components/erp/CalendarHeaderTabs";
import { DeskMobileNav } from "@/components/erp/DeskMobileNav";
import { ErpCommandPalette } from "@/components/erp/ErpCommandPalette";
import { ModuleTabs } from "@/components/erp/ModuleTabs";
import { NavigationProgress } from "@/components/erp/NavigationProgress";
import { DeskSearchHint } from "@/components/erp/DeskSearchHint";
import { PropertySwitcher } from "@/components/erp/PropertySwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import type { PropertyRow } from "@/lib/property-context";
import type { ReactNode } from "react";

/**
 * ERP dashboard shell — shadcn Sidebar (icon-collapsible) + SidebarInset with a
 * top header carrying the collapse trigger, page title, property switcher,
 * and sign out. Wraps every /erp route via the layout.
 */
export function DeskShell({
  title,
  properties,
  activePropertyId,
  logoSrc,
  children,
}: {
  title?: string;
  properties?: PropertyRow[];
  activePropertyId?: string;
  logoSrc?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="erp">
      <NavigationProgress />
      <SidebarProvider defaultOpen={false} defaultState="collapsed">
        <AppSidebar brandName={title} logoSrc={logoSrc} />
        <ErpCommandPalette />
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
            <Separator
              orientation="vertical"
              className="mr-1 hidden h-4! md:block"
            />
            {title ? (
              <h1 className="truncate text-sm font-medium text-muted-foreground">
                {title}
              </h1>
            ) : null}
            <CalendarHeaderTabs />

            <DeskSearchHint />

            <div className="ml-auto flex items-center gap-2">
              {properties && properties.length > 0 && activePropertyId ? (
                <PropertySwitcher
                  properties={properties}
                  activePropertyId={activePropertyId}
                />
              ) : null}
              <form action={deskLogout}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="hidden h-9 md:inline-flex"
                >
                  Sign out
                </Button>
              </form>
            </div>
          </header>
          <ModuleTabs />
          <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </div>
          <DeskMobileNav />
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

/** Compact top-of-page title strip for non-dashboard ERP pages. */
export function DeskPageTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-4 pt-6 md:px-6">
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Small badge to drop into the page title row. */
export function DeskTitleBadge({ children }: { children: ReactNode }) {
  return <Badge variant="secondary">{children}</Badge>;
}
