import {
  DeskListShell,
  DeskTable,
} from "@/components/erp/DeskListShell";
import {
  SalesClaimApproveForm,
  SalesClaimRejectForm,
} from "@/components/erp/SalesClaimActions";
import { Button } from "@/components/ui/button";
import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { formatBtn } from "@/lib/pricing";
import {
  commissionBtnFromQuote,
  loadStaffSalesCommissionPct,
} from "@/lib/sales-claims";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sales claims | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type StatusFilter = "claimed" | "approved" | "rejected" | "all";

export default async function SalesClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const role = await getDeskRole();
  if (role !== "owner" && role !== "gm") {
    redirect("/erp");
  }

  const sp = await searchParams;
  const raw = (sp.status ?? "claimed").toLowerCase();
  const statusFilter: StatusFilter =
    raw === "approved" || raw === "rejected" || raw === "all"
      ? raw
      : "claimed";

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const commissionPct = await loadStaffSalesCommissionPct(admin, propertyId);

  // Separate chains avoid Supabase generic "Type instantiation is excessively deep".
  const selectCols =
    "id, contact_name, check_in, check_out, quoted_total_btn, sales_claim_status, sales_claim_note, sales_verified_at, sold_by_staff_id, agent_id, agents(company_name), sold_by:staff_members!sold_by_staff_id(full_name)";

  let rows: Array<Record<string, unknown>> | null = null;
  if (statusFilter === "all") {
    const { data } = await admin
      .from("bookings")
      .select(selectCols)
      .eq("property_id", propertyId)
      .not("sold_by_staff_id", "is", null)
      .not("sales_claim_status", "is", null)
      .order("check_in", { ascending: false })
      .limit(200);
    rows = (data as Array<Record<string, unknown>> | null) ?? null;
  } else {
    const { data } = await admin
      .from("bookings")
      .select(selectCols)
      .eq("property_id", propertyId)
      .not("sold_by_staff_id", "is", null)
      .eq("sales_claim_status", statusFilter)
      .order("check_in", { ascending: false })
      .limit(200);
    rows = (data as Array<Record<string, unknown>> | null) ?? null;
  }

  const tabs: { id: StatusFilter; label: string }[] = [
    { id: "claimed", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
    { id: "all", label: "All" },
  ];

  return (
    <DeskListShell
      eyebrow="Reservations"
      heading="Staff sales claims"
      blurb={
        commissionPct != null
          ? `Verify who brought the guest or agent. Suggested commission ${commissionPct}% of quoted total (reporting only).`
          : "Verify who brought the guest or agent. Set commission % under Settings → Rates & meals for suggested amounts."
      }
      headerAside={
        <Button asChild variant="outline" size="sm">
          <Link href="/erp/reports/staff-sales">Staff sales report</Link>
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={
              t.id === "claimed"
                ? "/erp/sales-claims"
                : `/erp/sales-claims?status=${t.id}`
            }
            className={
              statusFilter === t.id
                ? "inline-flex h-9 items-center rounded-md bg-foreground px-3 text-sm text-background"
                : "inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      <DeskTable
        caption="Sales claims"
        headers={[
          "Guest",
          "Stay",
          "Agent",
          "Sold by",
          "Quoted",
          "Comm.",
          "Status",
          "Actions",
        ]}
      >
          {(rows ?? []).length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-3 py-8 text-center text-sm text-muted-foreground"
              >
                No sales claims in this filter.
              </td>
            </tr>
          ) : (
            (rows ?? []).map((r) => {
              const agent = r.agents as
                | { company_name?: string }
                | { company_name?: string }[]
                | null;
              const agentName = Array.isArray(agent)
                ? agent[0]?.company_name
                : agent?.company_name;
              const sold = r.sold_by as
                | { full_name?: string }
                | { full_name?: string }[]
                | null;
              const soldName = Array.isArray(sold)
                ? sold[0]?.full_name
                : sold?.full_name;
              const quoted = Number(r.quoted_total_btn ?? 0);
              const comm = commissionBtnFromQuote(quoted, commissionPct);
              const claimStatus = (r.sales_claim_status as string) ?? "—";
              return (
                <tr key={r.id as string} className="border-t">
                  <td className="px-3 py-2.5 text-sm">
                    <Link
                      href={`/erp/calendar?booking=${r.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {(r.contact_name as string) || "Guest"}
                    </Link>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {(r.id as string).slice(0, 8)}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-sm tabular-nums">
                    {String(r.check_in).slice(0, 10)} →{" "}
                    {String(r.check_out).slice(0, 10)}
                  </td>
                  <td className="px-3 py-2.5 text-sm">
                    {agentName ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-sm">{soldName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                    {formatBtn(quoted)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                    {comm > 0 ? formatBtn(comm) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-sm capitalize">
                    {claimStatus}
                    {r.sales_claim_note ? (
                      <p className="text-[11px] text-muted-foreground normal-case">
                        {r.sales_claim_note as string}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    {claimStatus === "claimed" ? (
                      <div className="flex flex-col gap-2">
                        <SalesClaimApproveForm bookingId={r.id as string} />
                        <SalesClaimRejectForm bookingId={r.id as string} />
                      </div>
                    ) : claimStatus === "approved" ? (
                      <SalesClaimRejectForm bookingId={r.id as string} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
      </DeskTable>
    </DeskListShell>
  );
}
