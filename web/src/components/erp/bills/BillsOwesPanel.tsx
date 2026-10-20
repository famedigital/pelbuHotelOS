import { DeskMetricRow } from "@/components/erp/DeskMetricRow";
import { DeskViewSwitcher } from "@/components/erp/DeskViewSwitcher";
import { UnpaidBillsTable } from "@/components/erp/UnpaidBillsTable";
import { Button } from "@/components/ui/button";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  loadUnpaidBills,
  type UnpaidBillsFilter,
} from "@/lib/erp/unpaid-bills";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

function parseFilter(raw: string | undefined): UnpaidBillsFilter {
  if (raw === "agents" || raw === "guests") return raw;
  return "all";
}

export async function BillsOwesPanel({
  filterRaw,
  forceAgents,
}: {
  filterRaw?: string;
  /** Agents tab — only travel-agent balances */
  forceAgents?: boolean;
}) {
  const filter = forceAgents ? "agents" : parseFilter(filterRaw);
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
  const base = forceAgents ? "/erp/bills?tab=agents" : "/erp/bills?tab=owes";
  const csvHref = `/api/erp/export?kind=unpaid-bills${
    filter !== "all" ? `&filter=${encodeURIComponent(filter)}` : ""
  }`;

  return (
    <div className="flex flex-col gap-3">
      {!forceAgents ? (
        <DeskViewSwitcher
          label="Collect from"
          items={[
            {
              href: "/erp/bills?tab=owes",
              label: "All",
              count: pack.totals.billCount,
              active: filter === "all",
            },
            {
              href: "/erp/bills?tab=owes&filter=agents",
              label: "Travel agents",
              count: pack.totals.agentCount,
              active: filter === "agents",
            },
            {
              href: "/erp/bills?tab=owes&filter=guests",
              label: "Guests",
              count: pack.totals.guestCount,
              active: filter === "guests",
            },
          ]}
        />
      ) : null}
      <DeskMetricRow
        metrics={[
          {
            label: "Total to collect",
            value: formatBtn(viewDue),
            tone: viewDue > 0.5 ? "destructive" : "default",
          },
          { label: "Bills", value: String(viewCount) },
        ]}
      />
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link href={`/erp/unpaid-bills/print${filter === "all" ? "" : `?filter=${filter}`}`}>
            Print / PDF
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-9">
          <a href={csvHref}>CSV</a>
        </Button>
        <span className="sr-only">{base}</span>
      </div>
      <UnpaidBillsTable
        rows={rows}
        orphanAgents={orphanAgents}
        propertyName={property?.name ?? "Hotel"}
      />
    </div>
  );
}
