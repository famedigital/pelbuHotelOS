import { redirect } from "next/navigation";
import { getDistributorSession } from "@/lib/platform-auth";
import { PortalShell } from "@/components/platform/PortalShell";

const NAV = [
  { href: "/partner", label: "Dashboard" },
  { href: "/partner/hotels", label: "My hotels" },
  { href: "/partner/hotels/new", label: "Onboard" },
  { href: "/partner/leads", label: "My leads" },
  { href: "/partner/tickets", label: "Tickets" },
];

export default async function PartnerConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getDistributorSession();
  if (!session) redirect("/partner/login");
  return (
    <PortalShell
      brand="Innora · Partner"
      subtitle={session.distributorName}
      nav={NAV}
      userEmail={session.email}
    >
      {children}
    </PortalShell>
  );
}
