import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type ClosedDay = {
  date: string;
  room: number;
  fnb: number;
  laundry: number;
  cash: number;
  bank: number;
  card: number;
  other: number;
};

function bucket(source: string | null | undefined): "room" | "fnb" | "laundry" | "skip" {
  const kind = source ?? "";
  if (kind === "payment" || kind === "deposit") return "skip";
  if (kind === "order") return "fnb";
  if (kind === "guest_service" || kind === "service" || kind === "laundry") return "laundry";
  return "room";
}

export async function loadClosedDay(
  admin: Admin,
  propertyId: string,
  date: string,
): Promise<ClosedDay> {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextIso = next.toISOString().slice(0, 10);
  const [{ data: lines }, { data: payments }] = await Promise.all([
    admin
      .from("folio_lines")
      .select("total_btn, source_type, status, business_date, folios!inner(property_id)")
      .eq("business_date", date)
      .eq("folios.property_id", propertyId)
      .limit(2000),
    admin
      .from("payments")
      .select("amount_btn, method")
      .eq("property_id", propertyId)
      .gte("created_at", `${date}T00:00:00+06:00`)
      .lt("created_at", `${nextIso}T00:00:00+06:00`),
  ]);

  const day: ClosedDay = {
    date,
    room: 0,
    fnb: 0,
    laundry: 0,
    cash: 0,
    bank: 0,
    card: 0,
    other: 0,
  };
  for (const line of lines ?? []) {
    if (line.status === "void") continue;
    const total = Number(line.total_btn ?? 0);
    if (total <= 0) continue;
    const where = bucket(line.source_type as string | null);
    if (where === "skip") continue;
    day[where] = Math.round((day[where] + total) * 100) / 100;
  }
  for (const payment of payments ?? []) {
    const amount = Number(payment.amount_btn ?? 0);
    const method = String(payment.method ?? "");
    if (method === "cash") day.cash += amount;
    else if (method === "bank") day.bank += amount;
    else if (method === "card") day.card += amount;
    else day.other += amount;
  }
  day.cash = Math.round(day.cash * 100) / 100;
  day.bank = Math.round(day.bank * 100) / 100;
  day.card = Math.round(day.card * 100) / 100;
  day.other = Math.round(day.other * 100) / 100;
  return day;
}
