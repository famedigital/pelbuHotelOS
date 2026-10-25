import { DayDesk, type DayStayRow, type GuideRow } from "@/components/erp/day-desk/DayDesk";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { guidePhoneFromPlaceholder, isPlaceholderGuideNumber } from "@/lib/guide-number";
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

type GuideMaster = {
  full_name: string | null;
  phone: string | null;
  guide_number: string | null;
  visit_count: number | null;
  last_seen_at: string | null;
};

function phoneKey(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("975")) return digits.slice(3);
  return digits;
}

function writtenName(value: string | null | undefined): string {
  const name = (value ?? "").trim();
  if (!name || isPlaceholderGuideNumber(name)) return "";
  return name;
}

function shortDate(value: string | null | undefined): string {
  const day = (value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const date = new Date(`${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function guideCalls(
  groups: Array<{ movement: GuideRow["movement"]; when: GuideRow["when"]; rows: DayOpsRow[] }>,
  masters: GuideMaster[],
): GuideRow[] {
  const byPhone = new Map<string, GuideMaster>();
  const byNumber = new Map<string, GuideMaster>();
  for (const master of masters) {
    const phone = phoneKey(master.phone) || phoneKey(guidePhoneFromPlaceholder(master.guide_number));
    if (phone) byPhone.set(phone, master);
    const number = (master.guide_number ?? "").trim().toLowerCase();
    if (number && !isPlaceholderGuideNumber(number)) byNumber.set(number, master);
  }

  const calls = new Map<string, GuideRow & { guestSet: string[]; roomSet: string[]; agentSet: string[]; mealSet: string[] }>();
  for (const group of groups) {
    for (const row of group.rows) {
      const phone =
        row.guide_phone?.trim() || guidePhoneFromPlaceholder(row.guide_number) || "";
      const number = isPlaceholderGuideNumber(row.guide_number) ? "" : (row.guide_number ?? "").trim();
      const master =
        (phone ? byPhone.get(phoneKey(phone)) : undefined) ||
        (number ? byNumber.get(number.toLowerCase()) : undefined);
      const name = writtenName(master?.full_name) || writtenName(row.guide_name);
      if (!name && !phone && !number) continue;
      const key = `${group.movement}|${group.when}|${phoneKey(phone) || number.toLowerCase() || name.toLowerCase()}`;
      const current = calls.get(key) ?? {
        movement: group.movement,
        when: group.when,
        name,
        phone,
        number: number || (isPlaceholderGuideNumber(master?.guide_number) ? "" : (master?.guide_number ?? "").trim()),
        agent: "",
        visits: master?.visit_count == null ? null : Number(master.visit_count),
        rooms: "",
        guests: "",
        heads: 0,
        meal: "",
        lastSeen: shortDate(master?.last_seen_at),
        guestSet: [],
        roomSet: [],
        agentSet: [],
        mealSet: [],
      };
      if (!current.name && name) current.name = name;
      if (!current.phone && phone) current.phone = phone;
      const guest = (row.contact_name ?? "").trim();
      if (guest && !current.guestSet.includes(guest)) current.guestSet.push(guest);
      for (const room of (row.room_labels ?? "").split(",")) {
        const label = room.trim();
        if (label && !current.roomSet.includes(label)) current.roomSet.push(label);
      }
      const agent = (row.agent_name ?? "").trim();
      if (agent && !current.agentSet.includes(agent)) current.agentSet.push(agent);
      if (row.meal_plan_code && !current.mealSet.includes(row.meal_plan_code)) {
        current.mealSet.push(row.meal_plan_code);
      }
      current.heads += row.pax;
      calls.set(key, current);
    }
  }

  return [...calls.values()]
    .map((row) => ({
      movement: row.movement,
      when: row.when,
      name: row.name,
      phone: row.phone,
      number: row.number,
      agent: row.agentSet.join(", "),
      visits: row.visits,
      rooms: row.roomSet.join(", "),
      guests: row.guestSet.join(", "),
      heads: row.heads,
      meal: row.mealSet.join(", "),
      lastSeen: row.lastSeen,
    }))
    .sort((a, b) => a.when.localeCompare(b.when) || a.name.localeCompare(b.name) || a.phone.localeCompare(b.phone));
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
    loadDayOpsBoard(admin, propertyId, tomorrow, { slices: ["arrivals", "departures"] }),
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

  const [{ data: bookingNotes }, { data: guests }, { data: docs }, { data: payments }, { data: guideMasters }] =
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
      admin
        .from("guides")
        .select("full_name, phone, guide_number, visit_count, last_seen_at")
        .eq("property_id", propertyId),
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
  const meals = [...mealCount.entries()]
    .map(([code, heads]) => ({ code: code || "—", heads }))
    .sort((a, b) => b.heads - a.heads);
  const nationCount = new Map<string, number>();
  for (const row of inHouse) {
    const key = row.nationality || "Not written";
    nationCount.set(key, (nationCount.get(key) ?? 0) + row.heads);
  }
  const nationalities = [...nationCount.entries()]
    .map(([name, heads]) => ({ name, heads }))
    .sort((a, b) => b.heads - a.heads);

  const toCollect = departureRows.reduce((sum, row) => sum + Math.max(0, row.balance ?? 0), 0);
  const takings = (payments ?? []).reduce((sum, row) => sum + Number(row.amount_btn ?? 0), 0);
  const guides = guideCalls(
    [
      { movement: "arrival", when: "Today", rows: todayBoard.arrivals },
      { movement: "arrival", when: "Tomorrow", rows: tomorrowBoard.arrivals },
      { movement: "departure", when: "Today", rows: todayBoard.departures },
      { movement: "departure", when: "Tomorrow", rows: tomorrowBoard.departures },
    ],
    (guideMasters ?? []) as GuideMaster[],
  );

  const todayNight = nights.find((night) => night.date === today);
  const roomsToday = todayNight?.occupied ?? 0;
  const roomsTotal = todayNight
    ? todayNight.occupied + todayNight.empty + todayNight.outOfOrder
    : 0;

  return (
    <DayDesk
      dateLabel={fmtDate(today)}
      inHouseCount={roomsToday}
      roomsTotal={roomsTotal}
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
      guides={guides}
    />
  );
}
