import Link from "next/link";
import { formatBtn } from "@/lib/pricing-catalog";
import { loadPlatformDashboardKpis } from "@/lib/platform/admin-data";

export const metadata = {
  title: "Platform dashboard",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const k = await loadPlatformDashboardKpis();

  const cards = [
    { label: "Hotels", value: String(k.hotels), href: "/admin/hotels" },
    {
      label: "OTA commission MTD",
      value: formatBtn(k.commissionMtdBtn),
      href: "/admin/commissions",
    },
    {
      label: "MoU active",
      value: String(k.mouActive),
      href: "/admin/mou",
    },
    {
      label: "MoU pending",
      value: String(k.mouPending),
      href: "/admin/mou",
    },
    {
      label: "Hermes chats",
      value: k.hermesAvailable ? String(k.hermesActiveChats) : "n/a",
      href: "/admin/hermes",
    },
    { label: "Distributors", value: String(k.distributors), href: "/admin/distributors" },
    { label: "New leads", value: String(k.newLeads), href: "/admin/leads" },
    { label: "Open tickets", value: String(k.openTickets), href: "/admin/tickets" },
    { label: "AMC overdue", value: String(k.overdueAmc), href: "/admin/hotels" },
    {
      label: "Royalty open",
      value: formatBtn(k.royaltyDueBtn),
      href: "/admin/royalty",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          National control plane — hotels, OTA commissions, MoU registry, Hermes fleet.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border bg-card p-4 transition hover:border-primary/40"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-2 text-2xl font-semibold">{c.value}</p>
          </Link>
        ))}
      </div>
      <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
        Desk Partner Portal and Hermes bots stay on hotel FO / Vite desk. This console federates
        oversight only —{" "}
        <Link href="/admin/partner" className="underline">
          B2B deep-links
        </Link>
        .
      </div>
    </div>
  );
}
