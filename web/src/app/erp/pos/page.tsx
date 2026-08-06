import { GuestServiceForm } from "@/components/erp/GuestServiceForm";
import { DeskOfflineQueueStrip } from "@/components/erp/DeskOfflineQueueStrip";
import { MealServiceBoard } from "@/components/erp/MealServiceBoard";
import { PosLayout } from "@/components/erp/pos/PosLayout";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { thimphuToday } from "@/lib/erp-lists";
import { loadMealServicesForDate } from "@/lib/kitchen/meal-service";
import { loadMenuByOutlets } from "@/lib/menu-loader";
import {
  loadActiveOutletCodes,
  loadPropertyOutlets,
} from "@/lib/outlets";
import {
  loadDiningTables,
  loadModifierGroupsForItems,
  loadOpenPosTickets,
  loadOpenPosShift,
  loadPosShiftCloseSummary,
  loadPosStaff,
  loadSettledPosTickets,
  POS_TENDER_METHODS,
  POS_VOID_REASON_CODES,
  voidManagerThresholdBtn,
} from "@/lib/pos";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "POS | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpPosPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const property = await loadProperty(admin, propertyId);
  const today = thimphuToday();
  const activeOutletCodes = await loadActiveOutletCodes(admin, propertyId);
  const outlets = await loadPropertyOutlets(admin, propertyId, {
    activeOnly: true,
  });

  const [
    items,
    { data: bookings },
    tables,
    openTickets,
    settledTickets,
    staff,
    shift,
    mealServices,
    { data: todayEvents },
  ] = await Promise.all([
      loadMenuByOutlets(
        activeOutletCodes.length > 0
          ? activeOutletCodes
          : ["cafe", "pastry", "restaurant", "bar"],
      ),
      property
        ? admin
            .from("bookings")
            .select(
              "id, contact_name, contact_phone, check_in, check_out, status, source, agents(company_name), booking_guests(id, full_name, sort_order), room_assignments(room_unit_id, room_units(id, label))",
            )
            .eq("property_id", property.id)
            /**
             * Room charge must list guests still under roof, not only “nights generating
             * a room night.” After midnight of departure day check_out === today while
             * status is still checked_in — `.gt(check_out, today)` greyed Room to zero.
             * Desk truth: all checked_in always; confirmed still covering today inclusive.
             */
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
      loadMealServicesForDate(admin, propertyId, today),
      admin
        .from("kitchen_events")
        .select(
          "id, title, covers, meal_period, service_time, service_end, menu_note, venue, package_total_btn, rate_per_pax_btn, billing_status, status",
        )
        .eq("property_id", propertyId)
        .eq("event_date", today)
        .neq("status", "cancelled")
        .order("service_time", { ascending: true }),
    ]);

  const shiftCloseSummary = shift
    ? await loadPosShiftCloseSummary(shift, admin)
    : null;

  const dayEvents = [...(todayEvents ?? [])].sort((a, b) => {
    const ta = (a.service_time as string | null) ?? "99:99";
    const tb = (b.service_time as string | null) ?? "99:99";
    return ta.localeCompare(tb);
  });

  const modifierGroups = await loadModifierGroupsForItems(
    items.map((i) => i.id),
    admin,
  );

  const { data: ncReasonRows } = await admin
    .from("nc_reason_codes")
    .select("code, label, domains")
    .eq("property_id", propertyId)
    .eq("active", true)
    .order("sort_order")
    .limit(40);
  const ncReasons = (ncReasonRows ?? [])
    .filter((r) => {
      const domains = r.domains as string[] | null;
      return !domains || domains.includes("pos") || domains.includes("all");
    })
    .map((r) => ({ code: r.code as string, label: r.label as string }));

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

  return (
    <div className="erp mx-auto w-full max-w-[1280px] space-y-4 p-4 md:p-6">
      <DeskOfflineQueueStrip defaultKind="pos_park" />

      <MealServiceBoard
        compact
        services={mealServices}
        events={dayEvents.map((ev) => {
          const covers = Number(ev.covers ?? 0);
          const rate =
            ev.rate_per_pax_btn == null ? null : Number(ev.rate_per_pax_btn);
          let packageTotal =
            ev.package_total_btn == null
              ? null
              : Number(ev.package_total_btn);
          if (
            (packageTotal == null || !(packageTotal > 0)) &&
            rate != null &&
            rate > 0 &&
            covers > 0
          ) {
            packageTotal = rate * covers;
          }
          return {
            id: ev.id as string,
            title: ev.title as string,
            serviceTime: (ev.service_time as string | null) ?? null,
            serviceEnd: (ev.service_end as string | null) ?? null,
            covers,
            mealPeriod: (ev.meal_period as string) ?? "all",
            menuNote: (ev.menu_note as string | null) ?? null,
            venue: (ev.venue as string | null) ?? null,
            packageTotalBtn: packageTotal,
            billingStatus: (ev.billing_status as string | null) ?? null,
          };
        })}
        businessDate={today}
        title="Kitchen today"
        emptyHint="No published meal service or group events for today."
      />

      <PosLayout
        items={items}
        outlets={outlets.map((o) => ({ code: o.code, name: o.name }))}
        modifierGroups={modifierGroups}
        tables={tables}
        staff={staff}
        openTickets={openTickets}
        settledTickets={settledTickets}
        bookings={bookingOptions}
        shift={shift}
        shiftCloseSummary={shiftCloseSummary}
        gstRate={property?.gst_rate ?? 0.07}
        serviceChargeRate={property?.service_charge_rate ?? 0}
        serviceChargeDefaultOn={property?.service_charge_default_on ?? false}
        runtimeConfig={{
          voidReasonCodes: POS_VOID_REASON_CODES,
          tenderMethods: POS_TENDER_METHODS,
          voidManagerThresholdBtn: voidManagerThresholdBtn(),
        }}
        ncReasons={ncReasons}
        guestServiceSlot={
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-4 space-y-0.5">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                Guest service
              </p>
              <p className="text-sm text-muted-foreground">
                Post taxi, shop, laundry, and other non-menu charges straight to
                a guest folio.
              </p>
            </div>
            <GuestServiceForm
              bookings={bookingOptions}
              gstRate={property?.gst_rate ?? 0.07}
              serviceChargeRate={property?.service_charge_rate ?? 0}
              serviceChargeDefaultOn={
                property?.service_charge_default_on ?? false
              }
            />
          </div>
        }
      />
    </div>
  );
}
