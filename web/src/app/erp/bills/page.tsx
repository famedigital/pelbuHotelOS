import { BillsAgentsPanel } from "@/components/erp/bills/BillsAgentsPanel";
import { BillsCollectPanel } from "@/components/erp/bills/BillsCollectPanel";
import { BillsHubChrome } from "@/components/erp/bills/BillsHubChrome";
import { CashierMoneyStrip } from "@/components/erp/bills/CashierMoneyStrip";
import { BillsInvoicesPanel } from "@/components/erp/bills/BillsInvoicesPanel";
import { BillsOwesPanel } from "@/components/erp/bills/BillsOwesPanel";
import { BillsPaymentsPanel } from "@/components/erp/bills/BillsPaymentsPanel";
import { BillsStaySearch } from "@/components/erp/bills/BillsStaySearch";
import { Button } from "@/components/ui/button";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { BILLS_TABS, parseHubTab } from "@/lib/erp/hubs";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Bills",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function BillsHubPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    filter?: string;
    from?: string;
    to?: string;
  }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const tab = parseHubTab(sp.tab, BILLS_TABS, "stay");

  const stickyCta =
    tab === "owes" || tab === "agents" ? (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Collect from Who owes · open a folio for the room bill
        </p>
        <Button asChild size="sm" className="h-9">
          <Link href="/erp/bills?tab=stay">Open folios</Link>
        </Button>
      </div>
    ) : undefined;

  return (
    <BillsHubChrome stickyCta={stickyCta}>
      <CashierMoneyStrip />
      {tab === "collect" ? (
        <BillsCollectPanel />
      ) : tab === "owes" ? (
        <BillsOwesPanel filterRaw={sp.filter} />
      ) : tab === "agents" ? (
        <BillsAgentsPanel />
      ) : tab === "stay" ? (
        <BillsStaySearch />
      ) : tab === "invoices" ? (
        <BillsInvoicesPanel fromRaw={sp.from} toRaw={sp.to} />
      ) : tab === "payments" ? (
        <BillsPaymentsPanel fromRaw={sp.from} toRaw={sp.to} />
      ) : (
        <BillsOwesPanel filterRaw={sp.filter} />
      )}
    </BillsHubChrome>
  );
}
