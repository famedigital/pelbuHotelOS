import { DayDesk, type DayStayRow } from "@/components/erp/day-desk/DayDesk";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadDayOpsBoard, type DayOpsRow } from "@/lib/erp/day-ops-board";
import { parseGuestRequests } from "@/lib/erp/guest-requests";
import { addIsoDays } from "@/lib/erp/occupancy-nights";
import { loadOccupancyNights } from "@/lib/erp/load-occupancy";
import { fmtDate, thimphuToday } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Day",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function iso(value: string | undefined, fallback: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function mapStay(
  row: DayOpsRow,
  notes: Map<string, string | null>,
  nationality: Map<string, string>,
  invoices: Set<string>,
): DayStayRow {
  return {
    id: row.id,
    room: row.room_labels ?? "",
    guest: row.contact_name ?? "Guest",
    agent: row.agent_name ?? "",
    heads: row.pax,
    nationality: nationality.get(row.id) || row.guest_origin || "",
    meal: row.meal_plan_code,
    guide: row.guide_name || row.guide_number || "",
    guidePhone: row.guide_phone || row.guide_number || "",
    laundry: row.open_laundry_count,
    requests: parseGuestRequests(notes.get(row.id)),
    balance: row.folio_balance_btn,
    folioId: row.folio_id,
    hasInvoice: row.folio_id ? invoices.has(row.folio_id) : false,
    phone: row.contact_phone,
    checkIn: row.check_in,
    checkOut: row.check_out,
    status: row.status,
    rooms: row.rooms,
    agentId: row.agent_id,
  };
}

export default async function FrontOfficeDayPage({
  searchParams,
}: {
  searchParams: Promise<{ occ_from?: string; occ_to?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();
  const tomorrow = addIsoDays(today, 1);
  const from = iso(sp.occ_from, today);
  const to = iso(sp.occ_to, addIsoDays(today, 6));

  const [todayBoard, tomorrowBoard, nights] = await Promise.all([
    loadDayOpsBoard(admin, propertyId, today),
    loadDayOpsBoard(admin, propertyId, tomorrow, { slices: ["departures"] }),
    loadOccupancyNights(admin, propertyId, from, to < from ? from : to),
  ]);

  const rows = [
    ...todayBoard.inHouse,
    ...todayBoard.arrivals,
    ...todayBoard.departures,
    ...tomorrowBoard.departures,
  ];
  const ids = [...new Set(rows.map((row) => row.id))];
  const folioIds = [...new Set(rows.map((row) => row.folio_id).filter(Boolean))] as string[];

  const [{ data: bookingNotes }, { data: guests }, { data: docs }, { data: payments }] =
    await Promise.all([
      ids.length
        ? admin.from("bookings").select("id, notes").in("id", ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? admin
            .from("booking_guests")
            .select("booking_id, nationality")
            .in("booking_id", ids)
        : Promise.resolve({ data: [] }),
      folioIds.length
        ? admin
            .from("fiscal_documents")
            .select("folio_id, status")
            .in("folio_id", folioIds)
            .in("status", ["issued", "sent"])
        : Promise.resolve({ data: [] }),
      admin
        .from("payments")
        .select("amount_btn, method, created_at")
        .eq("property_id", propertyId)
        .gte("created_at", `${today}T00:00:00+06:00`)
        .lt("created_at", `${tomorrow}T00:00:00+06:00`),
    ]);

  const notes = new Map(
    (bookingNotes ?? []).map((row) => [row.id as string, (row.notes as string | null) ?? null]),
  );
  const nationality = new Map<string, string>();
  for (const guest of guests ?? []) {
    const name = (guest.nationality as string | null)?.trim();
    if (!name || nationality.has(guest.booking_id as string)) continue;
    nationality.set(guest.booking_id as string, name);
  }
  const invoices = new Set(
    (docs ?? []).map((doc) => doc.folio_id as string).filter(Boolean),
  );

  const inHouse = todayBoard.inHouse.map((row) => mapStay(row, notes, nationality, invoices));
  const arrivalRows = todayBoard.arrivals.map((row) => mapStay(row, notes, nationality, invoices));
  const departureRows = todayBoard.departures.map((row) =>
    mapStay(row, notes, nationality, invoices),
  );
  const tomorrowRows = tomorrowBoard.departures.map((row) =>
    mapStay(row, notes, nationality, invoices),
  );

  const mealCount = new Map<string, number>();
  for (const row of inHouse) {
    mealCount.set(row.meal, (mealCount.get(row.meal) ?? 0) + row.heads);
  }
  const meals = [...mealCount.entries()].map(([code, heads]) => `${code} ${heads}`).join(" · ") || "No meals";
  const nationCount = new Map<string, number>();
  for (const row of inHouse) {
    const key = row.nationality || "Not written";
    nationCount.set(key, (nationCount.get(key) ?? 0) + row.heads);
  }
  const nationalities =
    [...nationCount.entries()].map(([name, heads]) => `${name} ${heads}`).join(" · ") ||
    "Nationality not written";

  const toCollect = departureRows.reduce((sum, row) => sum + Math.max(0, row.balance ?? 0), 0);
  const takings = (payments ?? []).reduce((sum, row) => sum + Number(row.amount_btn ?? 0), 0);
  const guides = new Map<string, { name: string; phone: string; rooms: number }>();
  for (const row of [...inHouse, ...arrivalRows]) {
    if (!row.guide && !row.guidePhone) continue;
    const key = row.guidePhone || row.guide;
    const current = guides.get(key) ?? { name: row.guide, phone: row.guidePhone, rooms: 0 };
    current.rooms += Math.max(1, row.rooms);
    guides.set(key, current);
  }

  return (
    <DayDesk
      dateLabel={fmtDate(today)}
      inHouseCount={inHouse.reduce((sum, row) => sum + (row.room.split(",").filter((label) => label.trim()).length || row.rooms || 1), 0)}
      inHouseHeads={inHouse.reduce((sum, row) => sum + row.heads, 0)}
      arrivals={arrivalRows.reduce((sum, row) => sum + (row.room.split(",").filter((label) => label.trim()).length || row.rooms || 1), 0)}
      departures={departureRows.reduce((sum, row) => sum + (row.room.split(",").filter((label) => label.trim()).length || row.rooms || 1), 0)}
      tomorrowDepartures={tomorrowRows.length}
      meals={meals}
      nationalities={nationalities}
      toCollect={toCollect}
      takings={takings}
      openBills={departureRows.filter((row) => (row.balance ?? 0) > 0.5).length}
      missingInvoices={departureRows.filter((row) => !row.hasInvoice).length}
      nights={nights}
      from={from}
      to={to < from ? from : to}
      inHouse={inHouse}
      arrivalRows={arrivalRows}
      departureRows={departureRows}
      tomorrowRows={tomorrowRows}
      guides={[...guides.values()]}
    />
  );
}
