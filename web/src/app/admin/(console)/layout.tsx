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
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/distributors", label: "Distributors" },
    { href: "/admin/hotels", label: "Hotels" },
    {
      href: "/admin/vault/agents",
      label: pending > 0 ? `Vault (${pending})` : "Vault",
    },
    { href: "/admin/packages", label: "Packages" },
    { href: "/admin/royalty", label: "Royalty" },
    { href: "/admin/leads", label: "Leads" },
    { href: "/admin/tickets", label: "Tickets" },
    { href: "/admin/audit", label: "Audit" },
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
