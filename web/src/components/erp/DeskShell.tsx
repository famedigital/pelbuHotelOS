import { deskLogout } from "@/app/actions/desk";
import { AppSidebar } from "@/components/erp/app-sidebar";
import { ModuleHeaderTabs } from "@/components/erp/ModuleHeaderTabs";
import { DeskHelpHint } from "@/components/erp/DeskHelpHint";
import { DeskMobileNav } from "@/components/erp/DeskMobileNav";
import { ErpCommandPalette } from "@/components/erp/ErpCommandPalette";
import { NavigationProgress } from "@/components/erp/NavigationProgress";
import { DeskSearchHint } from "@/components/erp/DeskSearchHint";
import { PropertySwitcher } from "@/components/erp/PropertySwitcher";
import { StayHubShell } from "@/components/erp/StayHubShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import type { PropertyRow } from "@/lib/property-types";
import { Suspense, type ReactNode } from "react";

/**
 * ERP shell: icon sidebar + single sticky header row.
 * Module sub-destinations sit **in that header** (compact segment control), not
 * a second menu row under it — keeps desk workspace tall. POS register portals
 * Sell | Floor + ticket actions into the same row.
 */
export function DeskShell({
  title,
  properties,
  activePropertyId,
  logoSrc,
  allowedModuleKeys,
  canPreviewDashboards,
  homeDashboardView,
  children,
}: {
  title?: string;
  properties?: PropertyRow[];
  activePropertyId?: string;
  logoSrc?: string | null;
  /** ERP_MODULES keys the session may open. */
  allowedModuleKeys?: readonly string[];
  /** Owner/GM: department boards as first-row tabs on `/erp`. */
  canPreviewDashboards?: boolean;
  homeDashboardView?: import("@/lib/erp/role-dashboard").DashboardView;
  children: ReactNode;
}) {
  return (
    <div className="erp">
      <NavigationProgress />
      <SidebarProvider defaultOpen={false} defaultState="collapsed">
        <AppSidebar
          brandName={title}
          logoSrc={logoSrc}
          allowedModuleKeys={allowedModuleKeys}
        />
        <ErpCommandPalette allowedModuleKeys={allowedModuleKeys} />
        <SidebarInset>
          <StayHubShell>
            <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
              <Separator
                orientation="vertical"
                className="mr-1 hidden h-4! md:block"
              />
              {title ? (
                <h1 className="hidden max-w-[8rem] truncate text-sm font-medium text-muted-foreground lg:max-w-[12rem] xl:block">
                  {title}
                </h1>
              ) : null}
              <Suspense fallback={null}>
                <ModuleHeaderTabs
                  canPreviewDashboards={canPreviewDashboards}
                  homeDashboardView={homeDashboardView}
                />
              </Suspense>
              {/* POS register portals Sell | Floor here (see PosRegisterHeaderChrome). */}
              <div
                data-slot="erp-header-pos-modes"
                className="flex min-w-0 items-center empty:hidden"
              />

              <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
                {/* POS register portals Tickets / More / help / FS here. */}
                <div
                  data-slot="erp-header-pos-actions"
                  className="flex shrink-0 items-center gap-1.5 empty:hidden"
                />
                <DeskSearchHint />
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
            <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
              {children}
            </div>
            <DeskMobileNav allowedModuleKeys={allowedModuleKeys} />
          </StayHubShell>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}


/** Compact top-of-page title strip — same grammar as DeskListShell (non-list pages).
 *  Horizontal inset cancels parent page padding so title lines up with body content. */
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
  // Re-export pattern via lazy import would cycle; keep layout in sync with DeskListShell.
  const short =
    description && description.length <= 96 ? description : undefined;
  const long =
    description && description.length > 96 ? description : undefined;

  return (
    <div className="erp sticky top-14 z-20 -mx-4 border-b border-border/80 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:-mx-6 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3 py-3 md:py-3.5">
        <div className="min-w-0 flex-1 space-y-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {title}
            </h1>
            {long ? (
              <DeskHelpHint>
                <p>{long}</p>
              </DeskHelpHint>
            ) : null}
          </div>
          {short ? (
            <p className="max-w-2xl text-sm leading-snug text-muted-foreground line-clamp-1">
              {short}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Small badge to drop into the page title row. */
export function DeskTitleBadge({ children }: { children: ReactNode }) {
  return <Badge variant="secondary">{children}</Badge>;
}
