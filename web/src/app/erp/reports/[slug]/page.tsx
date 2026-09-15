import {
  DeskListShell,
  DeskTable,
} from "@/components/erp/DeskListShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { thimphuToday } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { formatBtn } from "@/lib/pricing";
import {
  isReportSlug,
  loadAgentArReport,
  loadCancellationsReport,
  loadDepositDueReport,
  loadFoOccupancyReport,
  loadGuestArAgingReport,
  loadGroupOutstandingReport,
  loadGroupArrivalsReport,
  loadGroupInHouseReport,
  loadInventoryMovementsSummary,
  loadMealCountReport,
  loadRoomMoveAuditReport,
  loadStaffAttendanceSummary,
  loadStaffSalesReport,
  REPORT_CATALOG,
} from "@/lib/reports/catalog";
import { PrintButton } from "@/components/erp/PrintButton";
import { loadAgentProductionReport } from "@/lib/reports/agent-dossier";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    agent_id?: string;
    staff_id?: string;
    category?: string;
  }>;
};

function monthStartIso(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const meta = REPORT_CATALOG.find((r) => r.slug === slug);
  return {
    title: meta ? `${meta.title} | Innora` : "Report",
    robots: { index: false, follow: false },
  };
}

export default async function ReportRunnerPage({ params, searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { slug } = await params;
  if (!isReportSlug(slug)) notFound();

  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();
  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)
      ? sp.from
      : monthStartIso(today);
  const to =
    sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today;
  const agentId = sp.agent_id?.trim() || undefined;
  const staffId = sp.staff_id?.trim() || undefined;
  const category = sp.category?.trim() || undefined;

  const meta = REPORT_CATALOG.find((r) => r.slug === slug)!;

  const [{ data: agents }, { data: staff }, { data: categories }] =
    await Promise.all([
      admin
        .from("agents")
        .select("id, company_name")
        .in("status", ["approved", "demo"])
        .order("company_name")
        .limit(120),
      admin
        .from("staff_members")
        .select("id, full_name")
        .eq("property_id", propertyId)
        .eq("status", "active")
        .order("full_name")
        .limit(200),
      admin
        .from("inventory_items")
        .select("category")
        .eq("property_id", propertyId)
        .limit(500),
    ]);

  const categoryOpts = [
    ...new Set(
      (categories ?? [])
        .map((c) => c.category as string)
        .filter(Boolean),
    ),
  ].sort();

  const exportHref = `/api/erp/export?kind=${slug}&since=${from}&until=${to}${
    agentId ? `&agent_id=${agentId}` : ""
  }${staffId ? `&staff_id=${staffId}` : ""}${
    category ? `&category=${encodeURIComponent(category)}` : ""
  }`;

  return (
    <DeskListShell
      title="Reports"
      eyebrow="Money · Reports"
      heading={meta.title}
      blurb={meta.blurb}
      filters={
        <form
          className="flex flex-wrap items-end gap-2"
          action={`/erp/reports/${slug}`}
          method="get"
        >
          <div className="space-y-1">
            <Label htmlFor="rep-from" className="text-xs">
              From
            </Label>
            <Input
              id="rep-from"
              type="date"
              name="from"
              defaultValue={from}
              className="h-9 w-[10.5rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rep-to" className="text-xs">
              To
            </Label>
            <Input
              id="rep-to"
              type="date"
              name="to"
              defaultValue={to}
              className="h-9 w-[10.5rem]"
            />
          </div>
          {slug === "agent-production" || slug === "agent-ar" ? (
            <label className="text-xs text-muted-foreground">
              Agent
              <select
                name="agent_id"
                defaultValue={agentId ?? ""}
                className="mt-1 flex h-9 min-w-[12rem] rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All agents</option>
                {(agents ?? []).map((a) => (
                  <option key={a.id as string} value={a.id as string}>
                    {a.company_name as string}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {slug === "staff-attendance" || slug === "staff-sales" ? (
            <label className="text-xs text-muted-foreground">
              Staff
              <select
                name="staff_id"
                defaultValue={staffId ?? ""}
                className="mt-1 flex h-9 min-w-[12rem] rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All staff</option>
                {(staff ?? []).map((s) => (
                  <option key={s.id as string} value={s.id as string}>
                    {s.full_name as string}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {slug === "inventory-movements" ? (
            <label className="text-xs text-muted-foreground">
              Category
              <select
                name="category"
                defaultValue={category ?? ""}
                className="mt-1 flex h-9 min-w-[10rem] rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All</option>
                {categoryOpts.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Button type="submit" size="sm" className="h-9">
            Run
          </Button>
          <Button asChild variant="outline" size="sm" className="h-9">
            <a href={exportHref}>CSV</a>
          </Button>
          <PrintButton label="Print" />
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link href="/erp/reports">← Catalog</Link>
          </Button>
        </form>
      }
    >
      {slug === "agent-production" ? (
        <AgentProductionTable
          propertyId={propertyId}
          from={from}
          to={to}
          agentId={agentId}
        />
      ) : null}
      {slug === "agent-ar" ? (
        <AgentArTable
          propertyId={propertyId}
          from={from}
          to={to}
          today={today}
          agentId={agentId}
        />
      ) : null}
      {slug === "staff-attendance" ? (
        <StaffAttendanceTable
          propertyId={propertyId}
          from={from}
          to={to}
          staffId={staffId}
        />
      ) : null}
      {slug === "staff-sales" ? (
        <StaffSalesTable
          propertyId={propertyId}
          from={from}
          to={to}
          staffId={staffId}
        />
      ) : null}
      {slug === "inventory-movements" ? (
        <InventoryMovementsTable
          propertyId={propertyId}
          from={from}
          to={to}
          category={category}
        />
      ) : null}
      {slug === "deposit-due" ? (
        <DepositDueTable propertyId={propertyId} from={from} to={to} />
      ) : null}
      {slug === "cancellations" ? (
        <CancellationsTable propertyId={propertyId} from={from} to={to} />
      ) : null}
      {slug === "meal-count" ? (
        <MealCountTable propertyId={propertyId} businessDate={to} />
      ) : null}
      {slug === "fo-occupancy" ? (
        <FoOccupancyTable propertyId={propertyId} from={from} to={to} />
      ) : null}
      {slug === "room-moves" ? (
        <RoomMovesTable propertyId={propertyId} from={from} to={to} />
      ) : null}
      {slug === "guest-ar-aging" ? (
        <GuestArAgingTable propertyId={propertyId} asOf={to} />
      ) : null}
      {slug === "group-outstanding" ? (
        <GroupOutstandingTable propertyId={propertyId} />
      ) : null}
      {slug === "group-arrivals" ? (
        <GroupPartyListTable
          propertyId={propertyId}
          from={from}
          to={to}
          mode="arrivals"
        />
      ) : null}
      {slug === "group-in-house" ? (
        <GroupPartyListTable
          propertyId={propertyId}
          from={from}
          to={to}
          mode="in_house"
        />
      ) : null}
    </DeskListShell>
  );
}

async function AgentProductionTable({
  propertyId,
  from,
  to,
  agentId,
}: {
  propertyId: string;
  from: string;
  to: string;
  agentId?: string;
}) {
  const admin = createSupabaseAdminClient();
  const rows = await loadAgentProductionReport(admin, {
    propertyId,
    from,
    to,
    agentId,
  });
  return (
    <DeskTable
      caption="Production"
      headers={[
        "Agent",
        "Bookings",
        "Rooms",
        "Room-nights",
        "Quoted",
        "Comm %",
        "Commission",
        "",
      ]}
    >
      {rows.length === 0 ? (
        <tr>
          <td colSpan={8} className="px-3 py-6 text-muted-foreground">
            No agent production in this range.
          </td>
        </tr>
      ) : (
        rows.map((r) => (
          <tr key={r.agent_id} className="border-t">
            <td className="px-3 py-2.5 font-medium">{r.company_name}</td>
            <td className="px-3 py-2.5 tabular-nums">{r.bookings}</td>
            <td className="px-3 py-2.5 tabular-nums">{r.rooms}</td>
            <td className="px-3 py-2.5 tabular-nums">{r.room_nights}</td>
            <td className="px-3 py-2.5 tabular-nums">
              {formatBtn(r.quoted_total)}
            </td>
            <td className="px-3 py-2.5 tabular-nums">
              {r.commission_pct != null ? `${r.commission_pct}%` : "—"}
            </td>
            <td className="px-3 py-2.5 tabular-nums">
              {formatBtn(r.commission_btn)}
            </td>
            <td className="px-3 py-2.5 text-right">
              <Link
                href={`/erp/agents/${r.agent_id}`}
                className="text-accent underline-offset-4 hover:underline"
              >
                Dossier →
              </Link>
            </td>
          </tr>
        ))
      )}
    </DeskTable>
  );
}

async function AgentArTable({
  propertyId,
  from,
  to,
  today,
  agentId,
}: {
  propertyId: string;
  from: string;
  to: string;
  today: string;
  agentId?: string;
}) {
  const admin = createSupabaseAdminClient();
  let rows = await loadAgentArReport(admin, {
    propertyId,
    from,
    to,
    today,
  });
  if (agentId) rows = rows.filter((r) => r.agent_id === agentId);
  return (
    <DeskTable
      caption="AR & habit"
      headers={[
        "Agent",
        "Bookings",
        "Outstanding",
        "Aged",
        "Credit",
        "Habit",
        "",
      ]}
    >
      {rows.length === 0 ? (
        <tr>
          <td colSpan={7} className="px-3 py-6 text-muted-foreground">
            No agent AR activity in this range.
          </td>
        </tr>
      ) : (
        rows.map((r) => (
          <tr key={r.agent_id} className="border-t">
            <td className="px-3 py-2.5 font-medium">{r.company_name}</td>
            <td className="px-3 py-2.5 tabular-nums">{r.bookings_in_range}</td>
            <td className="px-3 py-2.5 tabular-nums">
              {formatBtn(r.outstanding)}
            </td>
            <td className="px-3 py-2.5 tabular-nums">
              {formatBtn(r.aging_total)}
            </td>
            <td className="px-3 py-2.5 text-sm tabular-nums text-muted-foreground">
              {formatBtn(r.credit_used)} / {formatBtn(r.credit_limit)}
            </td>
            <td className="max-w-[14rem] px-3 py-2.5 text-xs text-muted-foreground">
              {r.habit}
            </td>
            <td className="px-3 py-2.5 text-right">
              <Link
                href={`/erp/agents/${r.agent_id}?tab=money`}
                className="text-accent underline-offset-4 hover:underline"
              >
                Money →
              </Link>
            </td>
          </tr>
        ))
      )}
    </DeskTable>
  );
}

async function StaffAttendanceTable({
  propertyId,
  from,
  to,
  staffId,
}: {
  propertyId: string;
  from: string;
  to: string;
  staffId?: string;
}) {
  const admin = createSupabaseAdminClient();
  const rows = await loadStaffAttendanceSummary(admin, {
    propertyId,
    from,
    to,
    staffId,
  });
  return (
    <DeskTable
      caption="Attendance"
      headers={["Staff", "Events", "In", "Out", "Est. hours"]}
    >
      {rows.length === 0 ? (
        <tr>
          <td colSpan={5} className="px-3 py-6 text-muted-foreground">
            No attendance punches in this range.
          </td>
        </tr>
      ) : (
        rows.map((r) => (
          <tr key={r.staff_id} className="border-t">
            <td className="px-3 py-2.5 font-medium">{r.full_name}</td>
            <td className="px-3 py-2.5 tabular-nums">{r.events}</td>
            <td className="px-3 py-2.5 tabular-nums">{r.clock_ins}</td>
            <td className="px-3 py-2.5 tabular-nums">{r.clock_outs}</td>
            <td className="px-3 py-2.5 tabular-nums">{r.estimated_hours}</td>
          </tr>
        ))
      )}
    </DeskTable>
  );
}

async function InventoryMovementsTable({
  propertyId,
  from,
  to,
  category,
}: {
  propertyId: string;
  from: string;
  to: string;
  category?: string;
}) {
  const admin = createSupabaseAdminClient();
  const { rows, missingCostCount } = await loadInventoryMovementsSummary(
    admin,
    { propertyId, from, to, category },
  );
  return (
    <div className="space-y-3">
      {missingCostCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {missingCostCount} movement(s) have no unit cost — value columns are
          partial until receive posts write cost history (Phase C).
        </p>
      ) : null}
      <DeskTable
        caption="Movements"
        headers={["Item", "Category", "Kind", "Qty", "Value"]}
      >
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-muted-foreground">
              No inventory movements in this range.
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={`${r.item_id}-${r.movement_kind}`} className="border-t">
              <td className="px-3 py-2.5 font-medium">{r.item_name}</td>
              <td className="px-3 py-2.5 text-sm capitalize text-muted-foreground">
                {r.category}
              </td>
              <td className="px-3 py-2.5 text-sm capitalize">
                {r.movement_kind}
              </td>
              <td className="px-3 py-2.5 tabular-nums">{r.qty}</td>
              <td className="px-3 py-2.5 tabular-nums">
                {r.value_btn == null ? "—" : formatBtn(r.value_btn)}
              </td>
            </tr>
          ))
        )}
      </DeskTable>
    </div>
  );
}

async function StaffSalesTable({
  propertyId,
  from,
  to,
  staffId,
}: {
  propertyId: string;
  from: string;
  to: string;
  staffId?: string;
}) {
  const admin = createSupabaseAdminClient();
  const rows = await loadStaffSalesReport(admin, {
    propertyId,
    from,
    to,
    staffId,
    status: "approved",
  });
  return (
    <DeskTable
      caption="Staff sales"
      headers={[
        "Staff",
        "Guest",
        "Stay",
        "Agent",
        "Quoted",
        "Comm %",
        "Commission",
      ]}
    >
      {rows.length === 0 ? (
        <tr>
          <td colSpan={7} className="px-3 py-6 text-muted-foreground">
            No approved staff sales claims in this range.
          </td>
        </tr>
      ) : (
        rows.map((r) => (
          <tr key={r.booking_id} className="border-t">
            <td className="px-3 py-2.5 font-medium">{r.staff_name}</td>
            <td className="px-3 py-2.5">{r.contact_name}</td>
            <td className="px-3 py-2.5 tabular-nums text-sm">
              {r.check_in} → {r.check_out}
            </td>
            <td className="px-3 py-2.5 text-sm">{r.agent_name ?? "—"}</td>
            <td className="px-3 py-2.5 tabular-nums">
              {formatBtn(r.quoted_total_btn)}
            </td>
            <td className="px-3 py-2.5 tabular-nums">
              {r.commission_pct != null ? `${r.commission_pct}%` : "—"}
            </td>
            <td className="px-3 py-2.5 tabular-nums">
              {formatBtn(r.commission_btn)}
            </td>
          </tr>
        ))
      )}
    </DeskTable>
  );
}

async function DepositDueTable({
  propertyId,
  from,
  to,
}: {
  propertyId: string;
  from: string;
  to: string;
}) {
  const admin = createSupabaseAdminClient();
  const rows = await loadDepositDueReport(admin, { propertyId, from, to });
  return (
    <DeskTable
      caption="Deposit due"
      headers={[
        "Conf #",
        "Guest",
        "Arrival",
        "Status",
        "Required",
        "Received",
        "Short",
        "Due on",
        "Agent",
        "",
      ]}
    >
      {rows.length === 0 ? (
        <tr>
          <td colSpan={10} className="px-3 py-6 text-muted-foreground">
            No deposit shortfalls in this arrival range.
          </td>
        </tr>
      ) : (
        rows.map((r) => (
          <tr key={r.booking_id} className="border-t">
            <td className="px-3 py-2.5 font-mono text-xs tabular-nums">
              {r.confirmation_code ?? "—"}
            </td>
            <td className="px-3 py-2.5 font-medium">{r.contact_name}</td>
            <td className="px-3 py-2.5 tabular-nums text-sm">{r.check_in}</td>
            <td className="px-3 py-2.5 text-sm capitalize">{r.status}</td>
            <td className="px-3 py-2.5 tabular-nums">
              {formatBtn(r.token_required_btn)}
            </td>
            <td className="px-3 py-2.5 tabular-nums">
              {formatBtn(r.token_received_btn)}
            </td>
            <td className="px-3 py-2.5 tabular-nums font-medium">
              {formatBtn(r.shortfall_btn)}
            </td>
            <td className="px-3 py-2.5 tabular-nums text-sm">
              {r.deposit_due_on ?? "—"}
            </td>
            <td className="px-3 py-2.5 text-sm">{r.agent_name ?? "—"}</td>
            <td className="px-3 py-2.5 text-right">
              <Link
                href={`/erp/reservations?q=${encodeURIComponent(r.confirmation_code || r.contact_name)}`}
                className="text-accent underline-offset-4 hover:underline"
              >
                List →
              </Link>
            </td>
          </tr>
        ))
      )}
    </DeskTable>
  );
}

async function CancellationsTable({
  propertyId,
  from,
  to,
}: {
  propertyId: string;
  from: string;
  to: string;
}) {
  const admin = createSupabaseAdminClient();
  const rows = await loadCancellationsReport(admin, { propertyId, from, to });
  return (
    <DeskTable
      caption="Cancellations"
      headers={[
        "Conf #",
        "Guest",
        "Arrival",
        "Depart",
        "Status",
        "Quoted",
        "Agent",
      ]}
    >
      {rows.length === 0 ? (
        <tr>
          <td colSpan={7} className="px-3 py-6 text-muted-foreground">
            No cancellations or no-shows in this arrival range.
          </td>
        </tr>
      ) : (
        rows.map((r) => (
          <tr key={r.booking_id} className="border-t">
            <td className="px-3 py-2.5 font-mono text-xs tabular-nums">
              {r.confirmation_code ?? "—"}
            </td>
            <td className="px-3 py-2.5 font-medium">{r.contact_name}</td>
            <td className="px-3 py-2.5 tabular-nums text-sm">{r.check_in}</td>
            <td className="px-3 py-2.5 tabular-nums text-sm">{r.check_out}</td>
            <td className="px-3 py-2.5 text-sm capitalize">
              {r.status.replace("_", " ")}
            </td>
            <td className="px-3 py-2.5 tabular-nums">
              {formatBtn(r.quoted_total_btn)}
            </td>
            <td className="px-3 py-2.5 text-sm">{r.agent_name ?? "—"}</td>
          </tr>
        ))
      )}
    </DeskTable>
  );
}

async function MealCountTable({
  propertyId,
  businessDate,
}: {
  propertyId: string;
  businessDate: string;
}) {
  const admin = createSupabaseAdminClient();
  const report = await loadMealCountReport(admin, {
    propertyId,
    businessDate,
  });
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Business date <span className="font-medium text-foreground">{report.businessDate}</span>
        {" · "}
        BF {report.totals.breakfast} · Lunch {report.totals.lunch} · Dinner{" "}
        {report.totals.dinner}
        {report.totals.eventCovers
          ? ` · Events ${report.totals.eventCovers}`
          : ""}
        {" · "}
        <span className="text-xs">Use “To” date as business day.</span>
      </p>
      <DeskTable
        caption="Meal count"
        headers={["Guest", "Room", "Plan", "Pax", "BF", "L", "D", "Status"]}
      >
        {report.rows.length === 0 ? (
          <tr>
            <td colSpan={8} className="px-3 py-6 text-muted-foreground">
              No meal covers for this night.
            </td>
          </tr>
        ) : (
          report.rows.map((r) => (
            <tr key={r.booking_id} className="border-t">
              <td className="px-3 py-2.5 font-medium">{r.guest_name}</td>
              <td className="px-3 py-2.5 tabular-nums text-sm">
                {r.rooms || "—"}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs">{r.meal_plan}</td>
              <td className="px-3 py-2.5 tabular-nums">{r.pax}</td>
              <td className="px-3 py-2.5">{r.breakfast ? "✓" : "—"}</td>
              <td className="px-3 py-2.5">{r.lunch ? "✓" : "—"}</td>
              <td className="px-3 py-2.5">{r.dinner ? "✓" : "—"}</td>
              <td className="px-3 py-2.5 text-sm capitalize">{r.status}</td>
            </tr>
          ))
        )}
      </DeskTable>
    </div>
  );
}

async function FoOccupancyTable({
  propertyId,
  from,
  to,
}: {
  propertyId: string;
  from: string;
  to: string;
}) {
  const admin = createSupabaseAdminClient();
  const rows = await loadFoOccupancyReport(admin, { propertyId, from, to });
  return (
    <DeskTable
      caption="FO occupancy"
      headers={[
        "Date",
        "Capacity",
        "Occupied",
        "Comp",
        "Occ %",
        "Arrivals",
        "Departs",
      ]}
    >
      {rows.length === 0 ? (
        <tr>
          <td colSpan={7} className="px-3 py-6 text-muted-foreground">
            No days in range.
          </td>
        </tr>
      ) : (
        rows.map((r) => (
          <tr key={r.date} className="border-t">
            <td className="px-3 py-2.5 font-mono text-sm tabular-nums">
              {r.date}
            </td>
            <td className="px-3 py-2.5 tabular-nums">{r.sellable_capacity}</td>
            <td className="px-3 py-2.5 tabular-nums">{r.rooms_occupied}</td>
            <td className="px-3 py-2.5 tabular-nums">{r.rooms_comp}</td>
            <td className="px-3 py-2.5 tabular-nums font-medium">
              {r.occupancy_pct}%
            </td>
            <td className="px-3 py-2.5 tabular-nums">{r.arrivals}</td>
            <td className="px-3 py-2.5 tabular-nums">{r.departures}</td>
          </tr>
        ))
      )}
    </DeskTable>
  );
}

async function RoomMovesTable({
  propertyId,
  from,
  to,
}: {
  propertyId: string;
  from: string;
  to: string;
}) {
  const admin = createSupabaseAdminClient();
  const rows = await loadRoomMoveAuditReport(admin, { propertyId, from, to });
  return (
    <DeskTable
      caption="Room moves"
      headers={["When", "Actor", "Move", "Booking", "Action"]}
    >
      {rows.length === 0 ? (
        <tr>
          <td colSpan={5} className="px-3 py-6 text-muted-foreground">
            No room moves in this range.
          </td>
        </tr>
      ) : (
        rows.map((r, i) => (
          <tr key={`${r.at}-${i}`} className="border-t">
            <td className="px-3 py-2.5 text-xs tabular-nums">
              {r.at.slice(0, 19).replace("T", " ")}
            </td>
            <td className="px-3 py-2.5 text-sm">{r.actor}</td>
            <td className="px-3 py-2.5 text-sm">{r.summary}</td>
            <td className="px-3 py-2.5 font-mono text-xs">
              {r.booking_id ? r.booking_id.slice(0, 8) : "—"}
            </td>
            <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">
              {r.action}
            </td>
          </tr>
        ))
      )}
    </DeskTable>
  );
}

async function GuestArAgingTable({
  propertyId,
  asOf,
}: {
  propertyId: string;
  asOf: string;
}) {
  const admin = createSupabaseAdminClient();
  const { rows, totals } = await loadGuestArAgingReport(admin, {
    propertyId,
    asOf,
  });
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        As of <span className="font-medium text-foreground">{asOf}</span>
        {" · "}
        Current {formatBtn(totals.current)} · 31–60 {formatBtn(totals.d30)} ·
        61–90 {formatBtn(totals.d60)} · 90+ {formatBtn(totals.d90)} · Total{" "}
        <span className="font-medium text-foreground">
          {formatBtn(totals.total)}
        </span>
      </p>
      <DeskTable
        caption="Guest AR aging"
        headers={[
          "Guest",
          "CO",
          "Status",
          "Balance",
          "Current",
          "31–60",
          "61–90",
          "90+",
          "Agent",
          "",
        ]}
      >
        {rows.length === 0 ? (
          <tr>
            <td colSpan={10} className="px-3 py-6 text-muted-foreground">
              No open folio balances.
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.folio_id} className="border-t">
              <td className="px-3 py-2.5 font-medium">{r.contact_name}</td>
              <td className="px-3 py-2.5 tabular-nums text-sm">{r.check_out}</td>
              <td className="px-3 py-2.5 text-sm capitalize">{r.status}</td>
              <td className="px-3 py-2.5 tabular-nums font-medium">
                {formatBtn(r.balance_btn)}
              </td>
              <td className="px-3 py-2.5 tabular-nums">
                {formatBtn(r.aging_current)}
              </td>
              <td className="px-3 py-2.5 tabular-nums">
                {formatBtn(r.aging_d30)}
              </td>
              <td className="px-3 py-2.5 tabular-nums">
                {formatBtn(r.aging_d60)}
              </td>
              <td className="px-3 py-2.5 tabular-nums">
                {formatBtn(r.aging_d90)}
              </td>
              <td className="px-3 py-2.5 text-sm">{r.agent_name ?? "—"}</td>
              <td className="px-3 py-2.5 text-right">
                <Link
                  href={`/erp/folios/${r.folio_id}`}
                  className="text-accent underline-offset-4 hover:underline"
                >
                  Folio →
                </Link>
              </td>
            </tr>
          ))
        )}
      </DeskTable>
    </div>
  );
}

async function GroupOutstandingTable({ propertyId }: { propertyId: string }) {
  const admin = createSupabaseAdminClient();
  const { rows, total_due_btn } = await loadGroupOutstandingReport(admin, {
    propertyId,
  });
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Formal parties with open folio balances · Total due{" "}
        <span className="font-medium text-foreground">
          {formatBtn(total_due_btn)}
        </span>
      </p>
      <DeskTable
        caption="Group outstanding"
        headers={["Party", "Room", "Guest", "Status", "Due", ""]}
      >
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-muted-foreground">
              No open party balances.
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={`${r.group_id}:${r.folio_id}`}>
              <td className="px-3 py-2.5 text-sm font-medium">{r.group_name}</td>
              <td className="px-3 py-2.5 font-mono text-sm">{r.room_label}</td>
              <td className="px-3 py-2.5 text-sm">{r.contact_name}</td>
              <td className="px-3 py-2.5 text-sm text-muted-foreground">
                {r.status.replace(/_/g, " ")}
              </td>
              <td className="px-3 py-2.5 tabular-nums font-medium">
                {formatBtn(r.balance_btn)}
              </td>
              <td className="px-3 py-2.5 text-right">
                <Link
                  href={`/erp/folios/${r.folio_id}`}
                  className="text-accent underline-offset-4 hover:underline"
                >
                  Folio →
                </Link>
              </td>
            </tr>
          ))
        )}
      </DeskTable>
    </div>
  );
}

async function GroupPartyListTable({
  propertyId,
  from,
  to,
  mode,
}: {
  propertyId: string;
  from: string;
  to: string;
  mode: "arrivals" | "in_house";
}) {
  const admin = createSupabaseAdminClient();
  const rows =
    mode === "arrivals"
      ? await loadGroupArrivalsReport(admin, { propertyId, from, to })
      : await loadGroupInHouseReport(admin, { propertyId, asOf: to });
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {mode === "arrivals"
          ? `Arrivals ${from} → ${to}`
          : `In-house parties as of ${to}`}
        {" · "}
        {rows.length} part{rows.length === 1 ? "y" : "ies"}
      </p>
      <DeskTable
        caption={mode === "arrivals" ? "Group arrivals" : "Group in-house"}
        headers={["Party", "Leader", "Dates", "Rooms", "Status", "Agent"]}
      >
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-muted-foreground">
              No parties in range.
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.group_id}>
              <td className="px-3 py-2.5 text-sm font-medium">{r.group_name}</td>
              <td className="px-3 py-2.5 text-sm">{r.leader_name ?? "—"}</td>
              <td className="px-3 py-2.5 text-sm tabular-nums">
                {r.check_in} → {r.check_out}
              </td>
              <td className="px-3 py-2.5 tabular-nums">{r.room_count}</td>
              <td className="px-3 py-2.5 text-sm text-muted-foreground">
                {r.status_mix}
              </td>
              <td className="px-3 py-2.5 text-sm">{r.agent_name ?? "—"}</td>
            </tr>
          ))
        )}
      </DeskTable>
    </div>
  );
}
