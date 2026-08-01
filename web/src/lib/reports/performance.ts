import { computeFoodCostPeriod } from "@/lib/kitchen/food-cost";
import { formatBtn, roundBtn } from "@/lib/pricing";
import { computeManagerFlash } from "@/lib/reports/manager-flash";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type PerformanceMetricRow = {
  metric: string;
  label: string;
  target: number;
  achieved: number;
  unit: "btn" | "pct" | "count";
  pctOfTarget: number;
};

export type IncomeStreamRow = {
  stream: string;
  amountBtn: number;
  sharePct: number;
};

export type OpexBucketRow = {
  bucket: string;
  amountBtn: number;
  sharePct: number;
};

export type AgentProductionRow = {
  id: string;
  name: string;
  bookings: number;
  roomNights: number;
};

export type CountryRow = {
  country: string;
  guests: number;
};

export type OwnerPerformancePack = {
  from: string;
  to: string;
  yearKey: string;
  metrics: PerformanceMetricRow[];
  incomeStreams: IncomeStreamRow[];
  opexBuckets: OpexBucketRow[];
  topAgents: AgentProductionRow[];
  topCountries: CountryRow[];
  flash: Awaited<ReturnType<typeof computeManagerFlash>>;
  foodCostPct: number;
};

const METRIC_LABELS: Record<string, string> = {
  revenue: "Total revenue",
  occupancy: "Occupancy %",
  adr: "ADR",
  revpar: "RevPAR",
  fnb_sales: "F&B sales",
  food_cost_pct: "Food cost %",
};

function pctOf(target: number, achieved: number): number {
  if (target <= 0) return achieved > 0 ? 100 : 0;
  return Math.round((achieved / target) * 1000) / 10;
}

export async function computeOwnerPerformance(
  admin: Admin,
  propertyId: string,
  from: string,
  to: string,
): Promise<OwnerPerformancePack> {
  const yearKey = from.slice(0, 4);
  const yearStart = `${yearKey}-01-01`;
  const yearEnd = `${yearKey}-12-31`;

  const [flash, foodCost, targetsRes, ordersRes, folioRes, expensesRes, bookingsRes] =
    await Promise.all([
      computeManagerFlash(admin, propertyId, { from: yearStart, to: yearEnd }),
      computeFoodCostPeriod(admin, propertyId, from, to),
      admin
        .from("property_performance_targets")
        .select("metric, target_value, period_kind, period_key")
        .eq("property_id", propertyId)
        .eq("period_kind", "year")
        .eq("period_key", yearKey),
      admin
        .from("orders")
        .select("total_btn, status, created_at")
        .eq("property_id", propertyId)
        .gte("created_at", `${yearStart}T00:00:00`)
        .lte("created_at", `${yearEnd}T23:59:59`)
        .limit(3000),
      admin
        .from("folios")
        .select("folio_lines(source_type, total_btn, status, business_date, created_at)")
        .eq("property_id", propertyId)
        .limit(800),
      admin
        .from("expenses")
        .select("category, amount_btn, expense_date, status")
        .eq("property_id", propertyId)
        .gte("expense_date", yearStart)
        .lte("expense_date", yearEnd)
        .limit(1000),
      admin
        .from("bookings")
        .select(
          "id, agent_id, check_in, check_out, adults, status, agents(company_name), booking_guests(nationality)",
        )
        .eq("property_id", propertyId)
        .gte("check_in", yearStart)
        .lte("check_in", yearEnd)
        .limit(1000),
    ]);

  let fnbSales = 0;
  for (const o of ordersRes.data ?? []) {
    if ((o.status as string) === "cancelled") continue;
    fnbSales += Number(o.total_btn ?? 0);
  }
  fnbSales = roundBtn(fnbSales);

  let roomRevenue = 0;
  let serviceRevenue = 0;
  for (const folio of folioRes.data ?? []) {
    const lines =
      (folio.folio_lines as
        | {
            source_type: string;
            total_btn: number;
            status: string;
            business_date?: string | null;
            created_at: string;
          }[]
        | null) ?? [];
    for (const line of lines) {
      if (line.status !== "posted") continue;
      const biz =
        (line.business_date && String(line.business_date).slice(0, 10)) ||
        String(line.created_at).slice(0, 10);
      if (biz < yearStart || biz > yearEnd) continue;
      const amt = Number(line.total_btn ?? 0);
      if (line.source_type === "room") roomRevenue += amt;
      else if (line.source_type === "service") serviceRevenue += amt;
    }
  }
  roomRevenue = roundBtn(roomRevenue);
  serviceRevenue = roundBtn(serviceRevenue);
  const totalRevenue = roundBtn(roomRevenue + fnbSales + serviceRevenue);

  const achievedByMetric: Record<string, number> = {
    revenue: totalRevenue,
    occupancy: flash.occupancyPct,
    adr: flash.adrBtn,
    revpar: flash.revparBtn,
    fnb_sales: fnbSales,
    food_cost_pct: foodCost.foodCostPct,
  };

  const targets = targetsRes.data ?? [];
  const metrics: PerformanceMetricRow[] = targets.map((t) => {
    const metric = t.metric as string;
    const target = Number(t.target_value);
    const achieved = achievedByMetric[metric] ?? 0;
    const unit =
      metric === "occupancy" || metric === "food_cost_pct"
        ? "pct"
        : metric === "revenue" ||
            metric === "adr" ||
            metric === "revpar" ||
            metric === "fnb_sales"
          ? "btn"
          : "count";
    return {
      metric,
      label: METRIC_LABELS[metric] ?? metric,
      target,
      achieved,
      unit,
      pctOfTarget: pctOf(target, achieved),
    };
  });

  const incomeTotal = totalRevenue || 1;
  const incomeStreams: IncomeStreamRow[] = [
    { stream: "Rooms", amountBtn: roomRevenue, sharePct: 0 },
    { stream: "F&B", amountBtn: fnbSales, sharePct: 0 },
    { stream: "Guest services", amountBtn: serviceRevenue, sharePct: 0 },
  ].map((r) => ({
    ...r,
    sharePct: Math.round((r.amountBtn / incomeTotal) * 1000) / 10,
  }));

  const opexMap = new Map<string, number>();
  for (const e of expensesRes.data ?? []) {
    if ((e.status as string) === "void") continue;
    const cat = (e.category as string) || "other";
    opexMap.set(cat, (opexMap.get(cat) ?? 0) + Number(e.amount_btn ?? 0));
  }
  const opexTotal = [...opexMap.values()].reduce((s, v) => s + v, 0) || 1;
  const opexLabels: Record<string, string> = {
    payroll: "Salaries",
    supplies: "Shopping / supplies",
    utilities: "Bills / utilities",
    tax: "Tax",
    rent: "Rent",
    marketing: "Marketing",
    maintenance: "Maintenance",
    bank_fee: "Bank fees",
    other: "Other",
  };
  const opexBuckets: OpexBucketRow[] = [...opexMap.entries()]
    .map(([bucket, amountBtn]) => ({
      bucket: opexLabels[bucket] ?? bucket,
      amountBtn: roundBtn(amountBtn),
      sharePct: Math.round((amountBtn / opexTotal) * 1000) / 10,
    }))
    .sort((a, b) => b.amountBtn - a.amountBtn);

  const agentMap = new Map<string, AgentProductionRow>();
  for (const b of bookingsRes.data ?? []) {
    const aid = b.agent_id as string | null;
    if (!aid) continue;
    const agent = b.agents as { company_name?: string } | null;
    const name = agent?.company_name ?? aid.slice(0, 8);
    const cur = agentMap.get(aid) ?? { id: aid, name, bookings: 0, roomNights: 0 };
    cur.bookings += 1;
    const nights = Math.max(
      1,
      Math.round(
        (new Date(String(b.check_out)).getTime() -
          new Date(String(b.check_in)).getTime()) /
          86_400_000,
      ),
    );
    cur.roomNights += nights;
    agentMap.set(aid, cur);
  }
  const topAgents = [...agentMap.values()]
    .sort((a, b) => b.roomNights - a.roomNights)
    .slice(0, 8);

  const countryMap = new Map<string, number>();
  for (const b of bookingsRes.data ?? []) {
    const guests =
      (b.booking_guests as { nationality?: string | null }[] | null) ?? [];
    for (const g of guests) {
      const c = ((g.nationality as string) ?? "Unknown").trim() || "Unknown";
      countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
    }
  }
  const topCountries = [...countryMap.entries()]
    .map(([country, guests]) => ({ country, guests }))
    .sort((a, b) => b.guests - a.guests)
    .slice(0, 8);

  return {
    from,
    to,
    yearKey,
    metrics,
    incomeStreams,
    opexBuckets,
    topAgents,
    topCountries,
    flash,
    foodCostPct: foodCost.foodCostPct,
  };
}

export function formatMetricValue(
  unit: PerformanceMetricRow["unit"],
  value: number,
): string {
  if (unit === "btn") return formatBtn(value);
  if (unit === "pct") return `${value}%`;
  return String(value);
}
