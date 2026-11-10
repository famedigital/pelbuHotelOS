import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "B2B / Partner ops",
  robots: { index: false, follow: false },
};

const LINKS = [
  {
    title: "Agency Dashboard (desk)",
    href: "/v2",
    note: "Open Vite/desk Partner → Dashboard for multi-hotel MoU KPIs, rates, FO pulse, money. Path on desk: /partner",
  },
  {
    title: "Hotel Agents directory (desk)",
    href: "/v2",
    note: "Partnered agents · MoU · rates · AR · Paid · FO. Path on desk: /agents",
  },
  {
    title: "MoU Registry (platform)",
    href: "/admin/mou",
    note: "Cross-tenant pending/active/suspended links from agent_property_links + v2.agent_mou_links",
  },
  {
    title: "Vault · Agents",
    href: "/admin/vault/agents",
    note: "National verify queue + MoU/AR commercial columns",
  },
  {
    title: "Hermes Fleet",
    href: "/admin/hermes",
    note: "Agent MoU-gated Telegram chats and topic bindings",
  },
  {
    title: "OTA Commissions",
    href: "/admin/commissions",
    note: "Marketplace take-rate ledger (not B2B folio AR)",
  },
];

export default function AdminPartnerOpsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">B2B / Partner ops</h1>
        <p className="text-sm text-muted-foreground">
          Platform oversight only — do not fork a third dashboard. Agency and hotel Agents panes stay
          on desk; use these deep-links and the MoU registry.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {LINKS.map((item) => (
          <li key={item.title} className="rounded-xl border bg-card p-4">
            <Link href={item.href} className="font-medium underline-offset-2 hover:underline">
              {item.title}
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">{item.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
