import type { BookingRow } from "@/components/erp/BookingsTable";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { NewReservationLauncher } from "@/components/erp/NewReservationLauncher";
import { ReservationsAccordionTable } from "@/components/erp/ReservationsAccordionTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BOOKABLE_AGENT_STATUSES,
} from "@/lib/agents/status";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { matchesQuery } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { loadProperty } from "@/lib/property-context";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata = {
  title: "Reservations | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const STATUSES = [
  "held",
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    source?: string;
    new?: string;
    check_in?: string;
    check_out?: string;
    room_unit_id?: string;
  }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const sp = await searchParams;
  const { q, status, source } = sp;
  const query = (q ?? "").trim();
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const property = await loadProperty(admin, propertyId);

  const [
    { data: rows },
    { data: roomTypes },
    { data: agents },
    preferredUnit,
    { data: mealPlans },
    { data: propertyDefaults },
    { data: staffRows },
  ] = await Promise.all([
    (() => {
      let req = admin
        .from("bookings")
        .select(
          "id, contact_name, contact_phone, check_in, check_out, status, source, guest_origin, agent_id, adults, rooms, hold_expires_at, agents(company_name)",
        )
        .eq("property_id", propertyId)
        .order("check_in", { ascending: false })
        .limit(250);
      if (status) req = req.eq("status", status);
      if (source) req = req.eq("source", source);
      return req;
    })(),
    property
      ? admin
          .from("room_types")
          .select("id, code, name, inventory_kind, unit_count")
          .eq("property_id", property.id)
          .order("code")
      : Promise.resolve({ data: [] }),
    admin
      .from("agents")
      .select("id, company_name, market, status")
      .in("status", [...BOOKABLE_AGENT_STATUSES])
      .order("company_name"),
    sp.room_unit_id && property
      ? admin
          .from("room_units")
          .select("id, room_type_id, room_types(code)")
          .eq("id", sp.room_unit_id)
          .eq("property_id", property.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    property
      ? admin
          .from("meal_plans")
          .select("code, name, blurb, amount_btn_per_adult_night, is_active")
          .eq("property_id", property.id)
          .eq("is_active", true)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    property
      ? admin
          .from("properties")
          .select("default_meal_plan_code")
          .eq("id", property.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    property
      ? admin
          .from("staff_members")
          .select("id, full_name, employee_code, role_label")
          .eq("property_id", property.id)
          .in("status", ["active", "on_leave"])
          .order("full_name")
          .limit(300)
      : Promise.resolve({ data: [] }),
  ]);

  const qtyByCode: Record<string, number> = {};
  const unit = preferredUnit.data;
  if (unit) {
    const rt = unit.room_types as
      | { code?: string }
      | { code?: string }[]
      | null;
    const code = Array.isArray(rt) ? rt[0]?.code : rt?.code;
    if (code) qtyByCode[code] = 1;
  }

  const data: BookingRow[] = (rows ?? []).map((r) => {
    const agent = r.agents as
      | { company_name?: string }
      | { company_name?: string }[]
      | null;
    const agentName = Array.isArray(agent)
      ? (agent[0]?.company_name ?? null)
      : (agent?.company_name ?? null);
    return {
      id: r.id as string,
      contact_name: (r.contact_name as string) ?? null,
      contact_phone: (r.contact_phone as string) ?? null,
      check_in: (r.check_in as string) ?? null,
      check_out: (r.check_out as string) ?? null,
      source: (r.source as string) ?? null,
      agent_name: agentName,
      adults: (r.adults as number) ?? null,
      rooms: (r.rooms as number) ?? null,
      status: (r.status as string) ?? null,
    };
  });

  const filtered = data.filter((r) =>
    matchesQuery(
      [r.contact_name, r.contact_phone, r.id, r.source, r.agent_name],
      query,
    ),
  );

  const staffSession = await getStaffSession();
  const fastBookForm = {
    roomTypes: (roomTypes ?? []).map((r) => ({
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      inventory_kind: r.inventory_kind as string,
      unit_count: Number(r.unit_count ?? 0),
    })),
    agents: (agents ?? []).map((a) => ({
      id: a.id as string,
      company_name: a.company_name as string,
      market: a.market as string,
      status: a.status as string,
    })),
    staff: (staffRows ?? []).map((s) => ({
      id: s.id as string,
      full_name: (s.full_name as string) || "Staff",
      employee_code: (s.employee_code as string | null) ?? null,
      role_label: (s.role_label as string | null) ?? null,
    })),
    defaultSoldByStaffId:
      staffSession && staffSession.propertyId === propertyId
        ? staffSession.staffId
        : "",
    property: property
      ? {
          name: property.name,
          legal_name: property.legal_name,
          address: property.address,
          phone: property.phone,
          email: property.email,
          tax_id: property.tax_id,
          logo_public_id: property.logo_public_id,
        }
      : undefined,
    invoiceDesign: property?.doc_invoice,
    voucherDesign: property?.doc_voucher,
    defaults: {
      checkIn: sp.check_in,
      checkOut: sp.check_out,
      roomUnitId: unit?.id as string | undefined,
      qtyByCode,
      mealPlanCode:
        (propertyDefaults?.default_meal_plan_code as string | undefined) ??
        "EP",
      guestOrigin: "regional",
    },
    mealPlans: (mealPlans ?? []).map((m) => ({
      code: m.code as string,
      name: m.name as string,
      blurb: (m.blurb as string | null) ?? null,
      amountPerAdultNight:
        m.amount_btn_per_adult_night == null
          ? null
          : Number(m.amount_btn_per_adult_night),
    })),
  };

  return (
    <DeskListShell
      eyebrow="Bookings"
      heading="All reservations"
      blurb="Every booking at this property. Use New reservation for walk-ins or phone books (Fast Book modal → StayHub). Open a row for stay, folio, and lifecycle. Today’s arrivals / in-house / departures have dedicated boards."
      headerAside={
        <Suspense
          fallback={
            <Button variant="citrus" className="h-11" disabled>
              New reservation
            </Button>
          }
        >
          <NewReservationLauncher form={fastBookForm} />
        </Suspense>
      }
      filters={
        <form
          className="flex flex-wrap items-end gap-2"
          action="/erp/reservations"
          method="get"
        >
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <label htmlFor="q" className="sr-only">
              Search
            </label>
            <Input
              id="q"
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Guest, phone, agent, booking id…"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="sr-only">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ""}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="w-32 space-y-1.5">
            <label htmlFor="source" className="sr-only">
              Source
            </label>
            <Input
              id="source"
              name="source"
              defaultValue={source ?? ""}
              placeholder="Source"
              className="h-10"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10">
            Search
          </Button>
        </form>
      }
    >
      <p className="text-xs text-muted-foreground">{filtered.length} shown</p>
      <Suspense
        fallback={
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            Loading reservations…
          </p>
        }
      >
        <ReservationsAccordionTable
          data={filtered}
          emptyMessage="No reservations match."
        />
      </Suspense>
    </DeskListShell>
  );
}
