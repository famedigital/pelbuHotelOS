/**
 * Labor cost vs covers for F&B period.
 */

import { thimphuToday } from "@/lib/erp-lists";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type LaborCoversReport = {
  from: string;
  to: string;
  covers: number;
  laborCostBtn: number;
  laborPerCoverBtn: number;
  attendanceEvents: number;
  scShareBtn: number;
};

export async function buildLaborCoversReport(
  from?: string,
  to?: string,
  admin?: Admin,
): Promise<LaborCoversReport> {
  const client = admin ?? createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(client);
  const toDay = to || thimphuToday();
  const fromDay =
    from ||
    (() => {
      const d = new Date(`${toDay}T12:00:00+06:00`);
      d.setDate(d.getDate() - 6);
      return d.toISOString().slice(0, 10);
    })();

  const fromIso = `${fromDay}T00:00:00+06:00`;
  const toIso = `${toDay}T23:59:59.999+06:00`;
  const daySpan = Math.max(
    1,
    Math.round(
      (new Date(`${toDay}T12:00:00+06:00`).getTime() -
        new Date(`${fromDay}T12:00:00+06:00`).getTime()) /
        86_400_000,
    ) + 1,
  );

  const [{ data: orders }, { data: attendance }, { data: scOrders }] =
    await Promise.all([
      client
        .from("orders")
        .select("covers, settled_at, voided_at")
        .eq("property_id", propertyId)
        .gte("settled_at", fromIso)
        .lte("settled_at", toIso)
        .is("voided_at", null),
      client
        .from("staff_attendance_events")
        .select("id")
        .eq("property_id", propertyId)
        .gte("occurred_at", fromIso)
        .lte("occurred_at", toIso),
      client
        .from("orders")
        .select("service_charge_btn")
        .eq("property_id", propertyId)
        .gte("settled_at", fromIso)
        .lte("settled_at", toIso)
        .is("voided_at", null),
    ]);

  const { data: staff } = await client
    .from("staff_members")
    .select("base_wage_btn, base_salary_btn, department, desk_role, status")
    .eq("property_id", propertyId)
    .eq("status", "active");

  const fnb = (staff ?? []).filter((s) => {
    const d = String(s.department ?? "").toLowerCase();
    const r = String(s.desk_role ?? "").toLowerCase();
    return (
      d.includes("fnb") ||
      d.includes("kitchen") ||
      d.includes("food") ||
      ["fnb", "kitchen", "cashier"].includes(r)
    );
  });

  const monthShare = daySpan / 30;
  const laborCostBtn = roundBtn(
    fnb.reduce((sum, row) => {
      const monthly = Number(
        row.base_wage_btn ?? row.base_salary_btn ?? 0,
      );
      return sum + monthly * monthShare;
    }, 0),
  );

  const covers = (orders ?? []).reduce(
    (s, o) => s + Number(o.covers ?? 0),
    0,
  );

  const scShareBtn = roundBtn(
    (scOrders ?? []).reduce(
      (s, o) => s + Number(o.service_charge_btn ?? 0),
      0,
    ),
  );

  return {
    from: fromDay,
    to: toDay,
    covers,
    laborCostBtn,
    laborPerCoverBtn: covers > 0 ? roundBtn(laborCostBtn / covers) : 0,
    attendanceEvents: attendance?.length ?? 0,
    scShareBtn,
  };
}
