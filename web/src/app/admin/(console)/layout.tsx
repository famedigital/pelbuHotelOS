import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/platform-auth";
import { countOpenVerifications } from "@/lib/platform-verification";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PortalShell } from "@/components/platform/PortalShell";

export default async function AdminConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPlatformAdminSession();
  if (!session) redirect("/admin/login");

  let pending = 0;
  try {
    pending = await countOpenVerifications(createSupabaseAdminClient());
  } catch {
    pending = 0;
  }

  const NAV = [
    {
      href: "/admin",
      label: "Dashboard",
      description: "Platform overview",
    },
    {
      href: "/admin/distributors",
      label: "Distributors",
      description: "Partner companies that sell Innora",
    },
    {
      href: "/admin/hotels",
      label: "Hotels",
      description: "Tenant hotels on the platform",
    },
    {
      href: "/admin/vault/agents",
      label: pending > 0 ? `Vault (${pending})` : "Vault",
      description: "Verify agents and guides",
    },
    {
      href: "/admin/packages",
      label: "Packages",
      description: "Commercial packages",
    },
    {
      href: "/admin/royalty",
      label: "Royalty",
      description: "Royalty and billing",
    },
    {
      href: "/admin/leads",
      label: "Leads",
      description: "Sales pipeline leads",
    },
    {
      href: "/admin/tickets",
      label: "Tickets",
      description: "Support tickets",
    },
    {
      href: "/admin/audit",
      label: "Audit",
      description: "Platform audit log",
    },
  ];

  return (
    <PortalShell
      brand="Hotel OS · Platform"
      subtitle="Innora / Fame Digital superadmin"
      nav={NAV}
      userEmail={session.email}
    >
      {children}
    </PortalShell>
  );
}
