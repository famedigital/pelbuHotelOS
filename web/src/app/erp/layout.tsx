import { DeskShell } from "@/components/erp/DeskShell";
import { WorkPwaRegistrar } from "@/components/pwa/WorkPwaRegistrar";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  listProperties,
  loadProperty,
  resolveActivePropertyId,
} from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { headers } from "next/headers";

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
  // of the sidebar shell, and avoids a layout redirect-loop.
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
  if (pathname === "/erp/login") {
    return (
      <>
        {children}
        <WorkPwaRegistrar />
      </>
    );
  }

  // The kitchen display (KDS) route runs fullscreen on a wall TV / tablet.
  // It's still desk-auth-gated (the page handler checks isDeskAuthenticated)
  // but it bypasses the sidebar shell entirely so the TV gets a clean,
  // chrome-free surface.
  if (pathname === "/erp/kds") {
    return (
      <>
        {children}
        <WorkPwaRegistrar />
      </>
    );
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
    >
      {children}
      <WorkPwaRegistrar />
    </DeskShell>
  );
}
