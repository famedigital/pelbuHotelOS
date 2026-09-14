import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/platform-auth";
import { PortalShell } from "@/components/platform/PortalShell";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/distributors", label: "Distributors" },
  { href: "/admin/hotels", label: "Hotels" },
  { href: "/admin/packages", label: "Packages" },
  { href: "/admin/royalty", label: "Royalty" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/audit", label: "Audit" },
];

export default async function AdminConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPlatformAdminSession();
  if (!session) redirect("/admin/login");
  return (
    <PortalShell
      brand="Hotel OS · Platform"
      subtitle="Fame Digital superadmin"
      nav={NAV}
      userEmail={session.email}
    >
      {children}
    </PortalShell>
  );
}
