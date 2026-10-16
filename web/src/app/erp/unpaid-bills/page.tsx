import { DeskListShell } from "@/components/erp/DeskListShell";
import { DeskMetricRow } from "@/components/erp/DeskMetricRow";
import { DeskViewSwitcher } from "@/components/erp/DeskViewSwitcher";
import { PrintButton } from "@/components/erp/PrintButton";
import { UnpaidBillsTable } from "@/components/erp/UnpaidBillsTable";
import { Button } from "@/components/ui/button";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  loadUnpaidBills,
  type UnpaidBillsFilter,
} from "@/lib/erp/unpaid-bills";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Unpaid bills",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function parseFilter(raw: string | undefined): UnpaidBillsFilter {
  if (raw === "agents" || raw === "guests") return raw;
  return "all";
}

export default async function UnpaidBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const sp = await searchParams;
  const filter = parseFilter(sp.filter);
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [{ data: property }, pack] = await Promise.all([
    admin.from("properties").select("name").eq("id", propertyId).maybeSingle(),
    loadUnpaidBills(admin, { propertyId, filter: "all" }),
  ]);

  const rows =
    filter === "agents"
      ? pack.rows.filter((r) => r.collectParty === "agent")
      : filter === "guests"
        ? pack.rows.filter((r) => r.collectParty === "guest")
        : pack.rows;
  const orphanAgents = filter === "guests" ? [] : pack.orphanAgents;

  const viewDue =
    filter === "all"
      ? pack.totals.totalDue
      : [...rows, ...orphanAgents].reduce((s, r) => s + r.amountDue, 0);
  const viewCount = rows.length + orphanAgents.length;

  const printQs =
    filter === "all" ? "" : `?filter=${encodeURIComponent(filter)}`;
  const csvHref = `/api/erp/export?kind=unpaid-bills${
    filter !== "all" ? `&filter=${encodeURIComponent(filter)}` : ""
  }`;

  return (
    <DeskListShell
      eyebrow="Front desk"
      heading="Unpaid bills"
      subtitle="Money the hotel still needs to collect"
      help="Stay-level list of open balances — who to collect from, contact details, and chase actions. For history and habits see Reports."
      dense
      wide
      filters={
        <DeskViewSwitcher
          label="Collect from"
          items={[
            {
              href: "/erp/unpaid-bills",
              label: "All",
              count: pack.totals.billCount,
              active: filter === "all",
            },
            {
              href: "/erp/unpaid-bills?filter=agents",
              label: "Travel agents",
              count: pack.totals.agentCount,
              active: filter === "agents",
            },
            {
              href: "/erp/unpaid-bills?filter=guests",
              label: "Guests",
              count: pack.totals.guestCount,
              active: filter === "guests",
            },
          ]}
        />
      }
      metrics={
        <DeskMetricRow
          metrics={[
            {
              label: "Total to collect",
              value: formatBtn(viewDue),
              tone: viewDue > 0.5 ? "destructive" : "default",
            },
            {
              label: "Bills",
              value: String(viewCount),
            },
            {
              label: "Travel agents",
              value: formatBtn(pack.totals.agentDue),
              href: "/erp/unpaid-bills?filter=agents",
              hint: `${pack.totals.agentCount} bill(s)`,
            },
            {
              label: "Guests",
              value: formatBtn(pack.totals.guestDue),
              href: "/erp/unpaid-bills?filter=guests",
              hint: `${pack.totals.guestCount} bill(s)`,
            },
          ]}
        />
      }
      headerAside={
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <PrintButton label="Print list" />
          <Button asChild variant="outline" size="sm" className="h-10">
            <Link href={`/erp/unpaid-bills/print${printQs}`}>
              Print / PDF page
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-10">
            <a href={csvHref}>Download CSV</a>
          </Button>
        </div>
      }
    >
      <UnpaidBillsTable
        rows={rows}
        orphanAgents={orphanAgents}
        propertyName={property?.name ?? "Hotel"}
      />
      <p className="mt-4 text-xs text-muted-foreground print:hidden">
        For aging history and payment habits see{" "}
        <Link
          href="/erp/reports"
          className="text-accent underline-offset-4 hover:underline"
        >
          Reports
        </Link>
        . Open master / walk-in bills also live under{" "}
        <Link
          href="/erp/folios"
          className="text-accent underline-offset-4 hover:underline"
        >
          Open bills
        </Link>
        .
      </p>
    </DeskListShell>
  );
}
