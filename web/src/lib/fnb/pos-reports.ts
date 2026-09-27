import { thimphuToday } from "@/lib/erp-lists";
import { tenderMethodLabel } from "@/lib/pos-tenders";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type PosReportView = "day" | "cashier" | "tenders" | "hour" | "items";

export type PosCashierRow = {
  name: string;
  bills: number;
  salesBtn: number;
  cashBtn: number;
  roomBtn: number;
  otherBtn: number;
};

export type PosTenderRow = {
  method: string;
  label: string;
  amountBtn: number;
};

export type PosHourRow = {
  hour: string;
  bills: number;
  salesBtn: number;
};

export type PosItemRow = {
  name: string;
  outlet: string;
  qty: number;
  salesBtn: number;
};

export type PosReportPack = {
  from: string;
  to: string;
  bills: number;
  salesBtn: number;
  voidCount: number;
  voidBtn: number;
  avgBtn: number;
  byCashier: PosCashierRow[];
  byTender: PosTenderRow[];
  byHour: PosHourRow[];
  byItem: PosItemRow[];
};

export function parsePosReportView(raw: string | undefined): PosReportView {
  if (
    raw === "cashier" ||
    raw === "tenders" ||
    raw === "hour" ||
    raw === "items"
  ) {
    return raw;
  }
  return "day";
}

export function parsePosReportRange(
  fromRaw: string | undefined,
  toRaw: string | undefined,
): { from: string; to: string } {
  const today = thimphuToday();
  let from = DAY.test(fromRaw ?? "") ? (fromRaw as string) : today;
  let to = DAY.test(toRaw ?? "") ? (toRaw as string) : from;
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  return { from, to };
}

function hourInThimphu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Thimphu",
    hour: "2-digit",
    hour12: false,
  }).format(d);
}

type Tender = { method?: string | null; amount_btn?: number | null };
type Item = {
  name_snapshot?: string | null;
  qty?: number | null;
  unit_price_btn?: number | null;
  voided_at?: string | null;
};
type Staff = { full_name?: string | null } | { full_name?: string | null }[] | null;

function asList<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function staffName(staff: Staff): string {
  const row = Array.isArray(staff) ? staff[0] : staff;
  const name = row?.full_name?.trim();
  return name || "No server";
}

export async function buildPosReports(
  from: string,
  to: string,
  admin?: Admin,
): Promise<PosReportPack> {
  const client = admin ?? createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(client);
  const start = `${from}T00:00:00+06:00`;
  const end = `${to}T23:59:59.999+06:00`;

  const { data } = await client
    .from("orders")
    .select(
      `id, outlet, total_btn, voided_at, settled_at, created_at, server_staff_id,
       staff_members!server_staff_id(full_name),
       order_tenders(method, amount_btn),
       order_items(name_snapshot, qty, unit_price_btn, voided_at)`,
    )
    .eq("property_id", propertyId)
    .gte("created_at", start)
    .lte("created_at", end)
    .limit(2000);

  const orders = data ?? [];
  const voided = orders.filter((o) => o.voided_at);
  const settled = orders.filter((o) => !o.voided_at && o.settled_at);
  const salesBtn = roundBtn(
    settled.reduce((s, o) => s + Number(o.total_btn ?? 0), 0),
  );
  const bills = settled.length;

  const cashierMap = new Map<string, PosCashierRow>();
  const tenderMap = new Map<string, number>();
  const hourMap = new Map<string, PosHourRow>();
  const itemMap = new Map<string, PosItemRow>();

  for (const order of settled) {
    const name = staffName(order.staff_members as Staff);
    const cashier =
      cashierMap.get(name) ??
      {
        name,
        bills: 0,
        salesBtn: 0,
        cashBtn: 0,
        roomBtn: 0,
        otherBtn: 0,
      };
    cashier.bills += 1;
    cashier.salesBtn = roundBtn(cashier.salesBtn + Number(order.total_btn ?? 0));

    for (const tender of asList(order.order_tenders as Tender | Tender[] | null)) {
      const method = tender.method || "other";
      const amount = Number(tender.amount_btn ?? 0);
      tenderMap.set(method, roundBtn((tenderMap.get(method) ?? 0) + amount));
      if (method === "cash") cashier.cashBtn = roundBtn(cashier.cashBtn + amount);
      else if (method === "room_charge") {
        cashier.roomBtn = roundBtn(cashier.roomBtn + amount);
      } else cashier.otherBtn = roundBtn(cashier.otherBtn + amount);
    }
    cashierMap.set(name, cashier);

    const hour = hourInThimphu(String(order.created_at ?? ""));
    const hourRow = hourMap.get(hour) ?? { hour, bills: 0, salesBtn: 0 };
    hourRow.bills += 1;
    hourRow.salesBtn = roundBtn(hourRow.salesBtn + Number(order.total_btn ?? 0));
    hourMap.set(hour, hourRow);

    const outlet = String(order.outlet ?? "other");
    for (const item of asList(order.order_items as Item | Item[] | null)) {
      if (item.voided_at) continue;
      const itemName = item.name_snapshot?.trim() || "Item";
      const key = `${outlet}::${itemName}`;
      const qty = Number(item.qty ?? 0);
      const lineBtn = roundBtn(qty * Number(item.unit_price_btn ?? 0));
      const row = itemMap.get(key) ?? {
        name: itemName,
        outlet,
        qty: 0,
        salesBtn: 0,
      };
      row.qty += qty;
      row.salesBtn = roundBtn(row.salesBtn + lineBtn);
      itemMap.set(key, row);
    }
  }

  return {
    from,
    to,
    bills,
    salesBtn,
    voidCount: voided.length,
    voidBtn: roundBtn(
      voided.reduce((s, o) => s + Number(o.total_btn ?? 0), 0),
    ),
    avgBtn: bills > 0 ? roundBtn(salesBtn / bills) : 0,
    byCashier: [...cashierMap.values()].sort((a, b) => b.salesBtn - a.salesBtn),
    byTender: [...tenderMap.entries()]
      .map(([method, amountBtn]) => ({
        method,
        label: tenderMethodLabel(method),
        amountBtn,
      }))
      .sort((a, b) => b.amountBtn - a.amountBtn),
    byHour: [...hourMap.values()].sort((a, b) => a.hour.localeCompare(b.hour)),
    byItem: [...itemMap.values()]
      .sort((a, b) => b.salesBtn - a.salesBtn)
      .slice(0, 80),
  };
}
