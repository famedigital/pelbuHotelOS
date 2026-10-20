import { redirect } from "next/navigation";
import { getDistributorSession } from "@/lib/platform-auth";
import { PortalShell } from "@/components/platform/PortalShell";

const NAV = [
  {
    href: "/partner",
    label: "Dashboard",
    description: "Your partner home",
  },
  {
    href: "/partner/hotels",
    label: "My hotels",
    description: "Hotels you manage or sell",
  },
  {
    href: "/partner/hotels/new",
    label: "Onboard",
    description: "Add a new hotel",
  },
  {
    href: "/partner/leads",
    label: "My leads",
    description: "Leads you are working",
  },
  {
    href: "/partner/tickets",
    label: "Tickets",
    description: "Support tickets",
  },
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
