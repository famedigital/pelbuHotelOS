import { DeskShell } from "@/components/erp/DeskShell";
import { WorkPwaRegistrar } from "@/components/pwa/WorkPwaRegistrar";
import { cloudinaryUrl } from "@/lib/cloudinary";
import {
  getDeskModuleKeys,
  getDeskRole,
  isDeskAuthenticated,
} from "@/lib/desk-auth";
import { pathnameAllowedForModules } from "@/lib/erp/desk-modules";
import {
  canPreviewDashboards,
  deskRoleToDashboardView,
} from "@/lib/erp/role-dashboard";
import {
  listProperties,
  loadProperty,
  resolveActivePropertyId,
} from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pelbu Work",
  description: "Front desk and hotel operations for Pelbu Suites.",
  robots: { index: false, follow: false },
  manifest: "/work.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pelbu Work",
  },
};

export default async function ErpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isDeskAuthenticated();

  // When unauthenticated we render children raw. The login page is the only
  // public ERP route; every other ERP page performs its own redirect to
  // /erp/login at the top of the page handler. This keeps the login UI free
  // of the sidebar shell, and avoids a layout redirect-loop. Middleware gates
  // /erp on credential presence as a backstop for a page missing that guard.
  if (!authed) {
    return (
      <>
        {children}
        <WorkPwaRegistrar />
      </>
    );
  }

  // Authenticated: render the sidebar shell. Detect the login route via the
  // forwarded pathname so the login page can still render its own (already
  // self-redirects to /erp) without the shell around it.
  const headerList = await headers();
  const pathname =
    headerList.get("x-invoke-path") ??
    headerList.get("x-pathname") ??
    "";
  if (pathname === "/erp/login" || pathname.startsWith("/erp/login/")) {
    return (
      <>
        {children}
        <WorkPwaRegistrar />
      </>
    );
  }

  // Kitchen + Pass/Expo TV boards run fullscreen on wall displays.
  // Desk-auth-gated in the page handlers; no sidebar chrome.
  // Invoice / receipt / statement print sheets also skip the shell for a clean page.
  const isPrintSurface =
    pathname === "/erp/kds" ||
    pathname.startsWith("/erp/kds/") ||
    /\/print\/?$/.test(pathname) ||
    /\/receipt\/?$/.test(pathname) ||
    /\/statement\/?$/.test(pathname);

  if (isPrintSurface) {
    return (
      <>
        {children}
        <WorkPwaRegistrar />
      </>
    );
  }

  const allowedModuleKeys = await getDeskModuleKeys();
  const deskRole = await getDeskRole();
  const canPreview = canPreviewDashboards(deskRole);
  const homeDashboardView = deskRole
    ? deskRoleToDashboardView(deskRole)
    : "front_desk";

  if (
    pathname &&
    pathname !== "/erp" &&
    !pathnameAllowedForModules(pathname, allowedModuleKeys)
  ) {
    redirect("/erp");
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const [activeProperty, properties] = await Promise.all([
    loadProperty(admin, propertyId),
    listProperties(admin),
  ]);

  const title = activeProperty?.name ?? "Pelbu desk";
  const logoSrc = activeProperty?.logo_public_id
    ? cloudinaryUrl(activeProperty.logo_public_id, {
        width: 64,
        height: 64,
        crop: "fit",
      })
    : null;

  return (
    <DeskShell
      title={title}
      properties={properties}
      activePropertyId={propertyId}
      logoSrc={logoSrc}
      allowedModuleKeys={allowedModuleKeys}
      canPreviewDashboards={canPreview}
      homeDashboardView={homeDashboardView}
    >
      {children}
      <WorkPwaRegistrar />
    </DeskShell>
  );
}
