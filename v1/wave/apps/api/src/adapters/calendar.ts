import type { AdapterCtx } from "./types.js";

export async function getStayView(
  ctx: AdapterCtx,
  from: string,
  nights = 14,
) {
  const fromDate = from || new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Thimphu",
  });
  const toDate = new Date(
    Date.parse(`${fromDate}T00:00:00Z`) + nights * 86400000,
  )
    .toISOString()
    .slice(0, 10);

  const [{ data: units, error: uErr }, { data: bookings, error: bErr }] =
    await Promise.all([
      ctx.admin
        .from("room_units")
        .select(
          "id, label, room_type_id, hk_status, room_types(name, code)",
        )
        .eq("property_id", ctx.jwt.propertyId)
        .order("label"),
      ctx.admin
        .from("bookings")
        .select(
          `id, confirmation_code, contact_name, status, check_in, check_out,
           room_assignments(room_unit_id)`,
        )
        .eq("property_id", ctx.jwt.propertyId)
        .neq("status", "cancelled")
        .lt("check_in", toDate)
        .gt("check_out", fromDate),
    ]);
  if (uErr) throw uErr;
  if (bErr) throw bErr;

  return {
    from: fromDate,
    to: toDate,
    nights,
    rooms: (units ?? []).map((u) => {
      const rt = u.room_types as { name?: string; code?: string } | null;
      return {
        id: u.id as string,
        label: u.label as string,
        roomTypeId: u.room_type_id as string,
        roomTypeName: rt?.name ?? null,
        hkStatus: u.hk_status as string | null,
      };
    }),
    stays: (bookings ?? []).map((b) => {
      const assigns =
        (b.room_assignments as Array<{ room_unit_id?: string }>) ?? [];
      return {
        bookingId: b.id,
        confirmationCode: b.confirmation_code,
        guestName: b.contact_name,
        status: b.status,
        checkIn: b.check_in,
        checkOut: b.check_out,
        roomUnitIds: assigns
          .map((a) => a.room_unit_id)
          .filter(Boolean) as string[],
      };
    }),
  };
}

export async function getDayBoard(ctx: AdapterCtx, businessDate?: string) {
  const day =
    businessDate ||
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });

  const [
    { data: arrivals },
    { data: departures },
    { data: inHouse },
    { data: rooms },
  ] = await Promise.all([
    ctx.admin
      .from("bookings")
      .select(
        "id, confirmation_code, contact_name, status, adults, rooms, meal_plan_code, agent_id, agents(company_name)",
      )
      .eq("property_id", ctx.jwt.propertyId)
      .eq("check_in", day)
      .neq("status", "cancelled"),
    ctx.admin
      .from("bookings")
      .select(
        "id, confirmation_code, contact_name, status, adults, rooms, meal_plan_code",
      )
      .eq("property_id", ctx.jwt.propertyId)
      .eq("check_out", day)
      .neq("status", "cancelled"),
    ctx.admin
      .from("bookings")
      .select(
        "id, confirmation_code, contact_name, status, check_in, check_out, adults",
      )
      .eq("property_id", ctx.jwt.propertyId)
      .eq("status", "checked_in"),
    ctx.admin
      .from("room_units")
      .select("id, label, hk_status")
      .eq("property_id", ctx.jwt.propertyId),
  ]);

  const hk: Record<string, number> = {
    clean: 0,
    dirty: 0,
    occupied: 0,
    ooo: 0,
    inspected: 0,
    other: 0,
  };
  for (const r of rooms ?? []) {
    const s = String(r.hk_status || "other").toLowerCase();
    if (Object.prototype.hasOwnProperty.call(hk, s)) {
      hk[s] = (hk[s] ?? 0) + 1;
    } else {
      hk.other = (hk.other ?? 0) + 1;
    }
  }

  return {
    businessDate: day,
    arrivals: arrivals ?? [],
    departures: departures ?? [],
    inHouse: inHouse ?? [],
    housekeeping: hk,
    roomCount: (rooms ?? []).length,
  };
}
