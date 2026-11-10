import { formatBtn } from "@/lib/pricing";
import { nightsBetween } from "@/lib/rates";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type ManagerFlashInput = {
  from: string;
  to: string;
};

export type ManagerFlashStats = {
  from: string;
  to: string;
  days: number;
  sellableCapacity: number;
  capacityNights: number;
  roomNightsSold: number;
  occupancyPct: number;
  roomRevenueBtn: number;
  adrBtn: number;
  revparBtn: number;
};

function daysInclusive(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

function overlapNights(
  stayIn: string,
  stayOut: string,
  rangeFrom: string,
  rangeToExclusive: string,
): number {
  const start = stayIn > rangeFrom ? stayIn : rangeFrom;
  const end = stayOut < rangeToExclusive ? stayOut : rangeToExclusive;
  if (end <= start) return 0;
  return nightsBetween(start, end);
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Manager flash: OCC / ADR / RevPAR for a closed date range (inclusive).
 * Sellable guest rooms only — comp beds excluded from capacity and sold nights.
 */
export async function computeManagerFlash(
  admin: Admin,
  propertyId: string,
  input: ManagerFlashInput,
): Promise<ManagerFlashStats> {
  const from = input.from;
  const to = input.to;
  const days = daysInclusive(from, to);
  const toExclusive = addDaysIso(to, 1);

  const [{ data: roomTypes }, { data: bookings }, { data: folioRows }] =
    await Promise.all([
      admin
        .from("room_types")
        .select("id, inventory_kind, unit_count")
        .eq("property_id", propertyId),
      admin
        .from("bookings")
        .select(
          "id, status, check_in, check_out, booking_rooms(qty, inventory_kind)",
        )
        .eq("property_id", propertyId)
        .lt("check_in", toExclusive)
        .gt("check_out", from)
        .in("status", [
          "confirmed",
          "checked_in",
          "checked_out",
          "pending",
        ])
        .limit(2000),
      admin
        .from("folios")
        .select(
          "id, folio_lines(source_type, total_btn, status, created_at, business_date, is_comp)",
        )
        .eq("property_id", propertyId)
        .limit(800),
    ]);

  const sellableCapacity = (roomTypes ?? [])
    .filter((r) => r.inventory_kind === "sellable_guest")
    .reduce((s, r) => s + Number(r.unit_count ?? 0), 0);

  const capacityNights = sellableCapacity * days;

  let roomNightsSold = 0;
  for (const b of bookings ?? []) {
    const status = b.status as string;
    if (status === "pending" || status === "cancelled" || status === "no_show") {
      continue;
    }
    const stayNights = overlapNights(
      b.check_in as string,
      b.check_out as string,
      from,
      toExclusive,
    );
    if (stayNights <= 0) continue;
    const lines =
      (b.booking_rooms as { qty?: number; inventory_kind?: string }[] | null) ??
      [];
    let sellableQty = 0;
    for (const line of lines) {
      if (line.inventory_kind === "sellable_guest") {
        sellableQty += Number(line.qty ?? 0);
      }
    }
    if (sellableQty === 0 && lines.length === 0) {
      sellableQty = 1;
    }
    roomNightsSold += stayNights * sellableQty;
  }

  let roomRevenueBtn = 0;
  for (const folio of folioRows ?? []) {
    const lines =
      (folio.folio_lines as
        | {
            source_type: string;
            total_btn: number;
            status: string;
            created_at: string;
            business_date?: string | null;
            is_comp?: boolean;
          }[]
        | null) ?? [];
    for (const line of lines) {
      if (line.status !== "posted") continue;
      if (line.source_type !== "room") continue;
      if (line.is_comp) continue;
      const biz =
        (line.business_date && String(line.business_date).slice(0, 10)) ||
        String(line.created_at).slice(0, 10);
      if (biz < from || biz > to) continue;
      roomRevenueBtn += Number(line.total_btn ?? 0);
    }
  }

  const occupancyPct =
    capacityNights > 0
      ? Math.round((roomNightsSold / capacityNights) * 1000) / 10
      : 0;
  const adrBtn =
    roomNightsSold > 0
      ? Math.round((roomRevenueBtn / roomNightsSold) * 100) / 100
      : 0;
  const revparBtn =
    capacityNights > 0
      ? Math.round((roomRevenueBtn / capacityNights) * 100) / 100
      : 0;

  return {
    from,
    to,
    days,
    sellableCapacity,
    capacityNights,
    roomNightsSold,
    occupancyPct,
    roomRevenueBtn,
    adrBtn,
    revparBtn,
  };
}

export function formatFlashMoney(n: number): string {
  return formatBtn(n);
}
