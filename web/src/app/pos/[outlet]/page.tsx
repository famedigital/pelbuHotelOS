import { DeskOfflineQueueStrip } from "@/components/erp/DeskOfflineQueueStrip";
import { PosLayout } from "@/components/erp/pos/PosLayout";
import { CREDIT_AGENT_STATUSES } from "@/lib/agents/status";
import {
  getDeskRole,
  isDeskAuthenticated,
  isPosFireRole,
} from "@/lib/desk-auth";
import { thimphuToday } from "@/lib/erp-lists";
import { loadMenuByOutlets } from "@/lib/menu-loader";
import { loadPropertyOutlets } from "@/lib/outlets";
import { posKioskSaleKind, resolvePosKioskOutlet } from "@/lib/pos-kiosk";
import {
  loadDiningTables,
  loadModifierGroupsForItems,
  loadOpenPosTickets,
  loadOpenPosShift,
  loadPosSetMeals,
  loadPosShiftCloseSummary,
  loadPosStaff,
  loadSettledPosTickets,
  POS_TENDER_METHODS,
  POS_VOID_REASON_CODES,
  voidManagerThresholdBtn,
} from "@/lib/pos";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ outlet: string }>;
}) {
  const { outlet } = await params;
  const resolved = resolvePosKioskOutlet(outlet);
  return {
    title: `${resolved?.label ?? "POS"} till | Pelbu OS`,
    robots: { index: false, follow: false },
  };
}

export default async function PosKioskOutletPage({
  params,
}: {
  params: Promise<{ outlet: string }>;
}) {
  const { outlet: rawOutlet } = await params;
  const resolved = resolvePosKioskOutlet(rawOutlet);
  if (!resolved) notFound();

  if (!(await isDeskAuthenticated())) {
    redirect(`/pos/login?next=/pos/${rawOutlet}`);
  }
  const deskRole = await getDeskRole();
  if (!isPosFireRole(deskRole)) {
    redirect("/erp");
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const property = await loadProperty(admin, propertyId);
  const today = thimphuToday();
  const outlets = await loadPropertyOutlets(admin, propertyId, {
    activeOnly: true,
  });
  const tillOutlets = outlets.filter((o) => o.code === resolved.outlet);

  const [
    items,
    { data: bookings },
    tables,
    openTickets,
    settledTickets,
    staff,
    shift,
    { data: ncReasonRows },
    { data: creditAgentRows },
    setMeals,
  ] = await Promise.all([
    loadMenuByOutlets([resolved.outlet]),
    property
      ? admin
          .from("bookings")
          .select(
            "id, contact_name, contact_phone, check_in, check_out, status, source, agents(company_name), booking_guests(id, full_name, sort_order), room_assignments(room_unit_id, room_units(id, label))",
          )
          .eq("property_id", property.id)
          .or(
            `status.eq.checked_in,and(status.eq.confirmed,check_in.lte.${today},check_out.gte.${today})`,
          )
          .order("check_out")
          .limit(80)
      : Promise.resolve({ data: [] }),
    loadDiningTables(admin),
    loadOpenPosTickets(admin),
    loadSettledPosTickets(admin),
    loadPosStaff(admin),
    loadOpenPosShift(admin),
    admin
      .from("nc_reason_codes")
      .select("code, label, domains")
      .eq("property_id", propertyId)
      .eq("active", true)
      .order("sort_order")
      .limit(40),
    admin
      .from("agents")
      .select("id, company_name, market, status, credit_used, credit_limit")
      .in("status", [...CREDIT_AGENT_STATUSES])
      .order("company_name")
      .limit(200),
    loadPosSetMeals(admin, resolved.outlet),
  ]);

  const [shiftCloseSummary, modifierGroups] = await Promise.all([
    shift ? loadPosShiftCloseSummary(shift, admin) : Promise.resolve(null),
    loadModifierGroupsForItems(
      items.map((i) => i.id),
      admin,
    ),
  ]);

  const ncReasons = (ncReasonRows ?? [])
    .filter((r) => {
      const domains = r.domains as string[] | null;
      return !domains || domains.includes("pos") || domains.includes("all");
    })
    .map((r) => ({ code: r.code as string, label: r.label as string }));

  const creditAgents = (creditAgentRows ?? []).map((a) => ({
    id: a.id as string,
    company_name: (a.company_name as string) ?? "Agent",
    market: (a.market as string) ?? "",
    status: (a.status as string) ?? "",
    credit_used: Number(a.credit_used ?? 0),
    credit_limit: Number(a.credit_limit ?? 0),
  }));

  const bookingOptions = (bookings ?? []).map((b) => ({
    id: b.id as string,
    contact_name: (b.contact_name as string | null) ?? null,
    contact_phone: (b.contact_phone as string | null) ?? null,
    check_in: b.check_in as string,
    check_out: b.check_out as string,
    status: b.status as string,
    source: (b.source as string | null) ?? null,
    agent_name:
      (
        (Array.isArray(b.agents) ? b.agents[0] : b.agents) as
          | { company_name?: string | null }
          | null
      )?.company_name ?? null,
    rooms: (
      (b.room_assignments as
        | {
            room_unit_id: string;
            room_units:
              | { id: string; label: string }
              | { id: string; label: string }[]
              | null;
          }[]
        | null) ?? []
    ).flatMap((assignment) => {
      const unit = Array.isArray(assignment.room_units)
        ? assignment.room_units[0]
        : assignment.room_units;
      return unit
        ? [{ id: unit.id ?? assignment.room_unit_id, label: unit.label }]
        : [];
    }),
    guests: [
      {
        id: null,
        full_name: (b.contact_name as string | null) ?? "Booking guest",
        phone: (b.contact_phone as string | null) ?? null,
      },
      ...(
        (b.booking_guests as
          | { id: string; full_name: string; sort_order: number }[]
          | null) ?? []
      )
        .filter(
          (guest) =>
            guest.full_name &&
            guest.full_name !== (b.contact_name as string | null),
        )
        .sort((a, c) => Number(a.sort_order) - Number(c.sort_order))
        .map((guest) => ({
          id: guest.id,
          full_name: guest.full_name,
          phone: (b.contact_phone as string | null) ?? null,
        })),
    ],
  }));

  const kioskOutlets =
    tillOutlets.length > 0
      ? tillOutlets.map((o) => ({ code: o.code, name: o.name }))
      : [{ code: resolved.outlet, name: resolved.label }];

  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <DeskOfflineQueueStrip defaultKind="pos_park" />
        <PosLayout
          propertyId={propertyId}
          items={items}
          outlets={kioskOutlets}
          modifierGroups={modifierGroups}
          tables={tables}
          staff={staff}
          openTickets={openTickets}
          settledTickets={settledTickets}
          bookings={bookingOptions}
          creditAgents={creditAgents}
          shift={shift}
          shiftCloseSummary={shiftCloseSummary}
          gstRate={property?.gst_rate ?? 0.07}
          serviceChargeRate={property?.service_charge_rate ?? 0}
          serviceChargeDefaultOn={property?.service_charge_default_on ?? false}
          gstDefaultOn={property?.gst_default_on !== false}
          setMeals={setMeals}
          lockedOutlet={resolved.outlet}
          kioskMode
          kioskOutletLabel={resolved.label}
          propertyName={property?.name ?? "Pelbu Suites"}
          initialSaleKind={posKioskSaleKind(resolved.outlet)}
          runtimeConfig={{
            voidReasonCodes: POS_VOID_REASON_CODES,
            tenderMethods: POS_TENDER_METHODS,
            voidManagerThresholdBtn: voidManagerThresholdBtn(),
          }}
          ncReasons={ncReasons}
          canFireKot
        />
      </div>
    </>
  );
}
