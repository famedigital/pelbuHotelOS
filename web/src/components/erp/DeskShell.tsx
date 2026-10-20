import { DeskHelpHint } from "@/components/erp/DeskHelpHint";
import { DeskMobileNav } from "@/components/erp/DeskMobileNav";
import { DeskSheetTabs } from "@/components/erp/DeskSheetTabs";
import { DeskTopChrome } from "@/components/erp/DeskTopChrome";
import { DeskWorkspaceProvider } from "@/components/erp/DeskWorkspaceProvider";
import { ErpCommandPalette } from "@/components/erp/ErpCommandPalette";
import { NavigationProgress } from "@/components/erp/NavigationProgress";
import { DeskMainSkeleton } from "@/components/erp/DeskMainSkeleton";
import { DeskChromeGuard } from "@/components/erp/DeskChromeGuard";
import { DeskSurfaceMetrics } from "@/components/erp/DeskSurfaceMetrics";
import { FoAskShortcut } from "@/components/erp/FoAskShortcut";
import { SoftNavRecovery } from "@/components/erp/SoftNavRecovery";
import { StayHubShell } from "@/components/erp/StayHubShell";
import { Badge } from "@/components/ui/badge";
import type { DeskRole } from "@/lib/desk-auth";
import type { PropertySwitcherOption } from "@/lib/property-types";
import { Suspense, type ReactNode } from "react";

/**
 * ERP shell — Sheets-style chrome: top menubar + toolbar, bottom sheet tabs (md+).
 * Phone: compact top Menu + thumb bottom nav. No left sidebar.
 * Page body scrolls in the middle; StayHub mounts once for the desk.
 */
export function DeskShell({
  title,
  properties,
  activePropertyId,
  logoSrc,
  businessDate,
  allowedModuleKeys,
  deskRole,
  canPreviewDashboards: _canPreviewDashboards,
  homeDashboardView: _homeDashboardView,
  productPack: _productPack = "hotel",
  children,
}: {
  title?: string;
  properties?: PropertySwitcherOption[];
  activePropertyId?: string;
  logoSrc?: string | null;
  businessDate?: string | null;
  allowedModuleKeys?: readonly string[];
  deskRole?: DeskRole | null;
  canPreviewDashboards?: boolean;
  homeDashboardView?: import("@/lib/erp/role-dashboard").DashboardView;
  productPack?: "hotel" | "restaurant";
  children: ReactNode;
}) {
  return (
    <div className="erp flex h-svh max-h-svh flex-col overflow-hidden">
      <DeskChromeGuard />
      <SoftNavRecovery />
      <NavigationProgress />
      <DeskWorkspaceProvider
        deskRole={deskRole}
        allowedModuleKeys={allowedModuleKeys}
      >
        <ErpCommandPalette allowedModuleKeys={allowedModuleKeys} />
        <FoAskShortcut />
        <StayHubShell>
          <Suspense fallback={null}>
            <DeskSurfaceMetrics />
          </Suspense>
          <DeskTopChrome
            brandName={title}
            logoSrc={logoSrc}
            businessDate={businessDate}
            properties={properties}
            activePropertyId={activePropertyId}
            allowedModuleKeys={allowedModuleKeys}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0 print:overflow-visible print:pb-0">
            <Suspense fallback={<DeskMainSkeleton />}>{children}</Suspense>
          </div>
          <DeskSheetTabs allowedModuleKeys={allowedModuleKeys} />
          <div className="shrink-0 print:hidden md:hidden">
            <DeskMobileNav allowedModuleKeys={allowedModuleKeys} />
          </div>
        </StayHubShell>
      </DeskWorkspaceProvider>
    </div>
  );
}

/** Compact top-of-page title strip — same grammar as DeskListShell (non-list pages). */
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
  const short =
    description && description.length <= 96 ? description : undefined;
  const long =
    description && description.length > 96 ? description : undefined;

  return (
    <div className="erp border-b border-border bg-background px-4 md:sticky md:top-0 md:z-20 md:-mx-6 md:px-6 -mx-4">
      <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between md:py-3.5">
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
            <p className="max-w-2xl text-sm leading-snug text-muted-foreground line-clamp-2 sm:line-clamp-1">
              {short}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DeskTitleBadge({ children }: { children: ReactNode }) {
  return <Badge variant="secondary">{children}</Badge>;
}
