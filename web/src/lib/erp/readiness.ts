import { thimphuToday } from "@/lib/erp-lists";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type ReadinessTone = "green" | "amber" | "red";

export type ReadinessTile = {
  role: string;
  label: string;
  tone: ReadinessTone;
  summary: string;
  href: string;
  items: Array<{ label: string; ok: boolean; href?: string }>;
};

function toneFromCounts(ok: number, warn: number, bad: number): ReadinessTone {
  if (bad > 0) return "red";
  if (warn > 0) return "amber";
  return "green";
}

/** Department readiness widgets for desk (Owner / FO / HK strip). Prefer role dashboards on `/erp`. */
export async function computeRoleReadiness(
  admin: Admin,
  propertyId: string,
): Promise<ReadinessTile[]> {
  const today = thimphuToday();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [
    { data: property },
    { data: arrivals },
    { data: holds },
    { data: units },
    { data: gstPack },
    { data: pendingBank },
    { data: lowStock },
    { data: nightAudit },
  ] = await Promise.all([
    admin
      .from("properties")
      .select("setup_completed_at, tax_id, bank_accounts")
      .eq("id", propertyId)
      .maybeSingle(),
    admin
      .from("bookings")
      .select("id, room_assignments(id)")
      .eq("property_id", propertyId)
      .eq("check_in", today)
      .in("status", ["pending", "confirmed"]),
    admin
      .from("bookings")
      .select("id")
      .eq("property_id", propertyId)
      .eq("status", "held"),
    admin
      .from("room_units")
      .select("hk_status")
      .eq("property_id", propertyId),
    admin
      .from("gst_return_packs")
      .select("id, status")
      .eq("property_id", propertyId)
      .eq("period_month", monthStart)
      .maybeSingle(),
    admin
      .from("payments")
      .select("id")
      .eq("property_id", propertyId)
      .eq("confirmation_status", "pending_bank")
      .limit(5),
    admin
      .from("inventory_items")
      .select("id, sku, qty_on_hand, reorder_level")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .limit(200),
    admin
      .from("night_audits")
      .select("id, business_date")
      .eq("property_id", propertyId)
      .order("business_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const setupOk = Boolean(property?.setup_completed_at);
  const tpnOk = Boolean((property?.tax_id as string | null)?.trim());
  const bankAccounts = property?.bank_accounts as unknown[] | null;
  const bankOk = Array.isArray(bankAccounts) && bankAccounts.length > 0;
  const gstFiled = gstPack?.status === "filed";
  const naRecent =
    nightAudit?.business_date &&
    String(nightAudit.business_date) >= today;

  const ownerItems = [
    {
      label: "Property setup complete",
      ok: setupOk,
      href: `/erp/properties/${propertyId}/setup`,
    },
    { label: "TPN on file", ok: tpnOk, href: `/erp/properties/${propertyId}/setup?step=1` },
    {
      label: "Bank account on file",
      ok: bankOk,
      href: `/erp/properties/${propertyId}/setup?step=5`,
    },
    {
      label: "GST pack filed this month",
      ok: gstFiled,
      href: "/erp/finance/gst",
    },
    {
      label: "Night audit current",
      ok: Boolean(naRecent),
      href: "/erp/night-audit",
    },
  ];
  const ownerBad = ownerItems.filter((i) => !i.ok).length;

  const arrivalsList = arrivals ?? [];
  const unassigned = arrivalsList.filter(
    (b) =>
      !(
        (b.room_assignments as { id?: string }[] | null)?.length
      ),
  ).length;

  const foItems = [
    {
      label: `${arrivalsList.length} arrival(s) today`,
      ok: arrivalsList.length === 0 || unassigned === 0,
      href: "/erp/arrivals",
    },
    {
      label: "All arrivals have rooms",
      ok: unassigned === 0,
      href: "/erp/arrivals",
    },
    {
      label: `${(holds ?? []).length} hold(s) awaiting token`,
      ok: (holds ?? []).length === 0,
      href: "/erp/reservations",
    },
    {
      label: `${(pendingBank ?? []).length} pending bank proof(s)`,
      ok: (pendingBank ?? []).length === 0,
      href: "/erp/finance/bank-proofs",
    },
  ];
  const foBad = foItems.filter((i) => !i.ok).length;
  const foWarn = (holds ?? []).length > 0 ? 1 : 0;

  const hkCounts: Record<string, number> = {};
  for (const u of units ?? []) {
    const st = (u.hk_status as string) ?? "unknown";
    hkCounts[st] = (hkCounts[st] ?? 0) + 1;
  }
  const dirty = hkCounts.dirty ?? 0;
  const inspect = hkCounts.inspect ?? 0;
  const low = (lowStock ?? []).filter(
    (i) => Number(i.qty_on_hand) <= Number(i.reorder_level),
  ).length;

  const hkItems = [
    {
      label: `${dirty} dirty room(s)`,
      ok: dirty <= 3,
      href: "/erp/housekeeping",
    },
    {
      label: `${inspect} inspect room(s)`,
      ok: inspect === 0,
      href: "/erp/housekeeping",
    },
    {
      label: `${low} SKU(s) at/below reorder`,
      ok: low === 0,
      href: "/erp/inventory",
    },
  ];
  const hkBad = hkItems.filter((i) => !i.ok).length;

  return [
    {
      role: "owner",
      label: "Owner readiness",
      tone: toneFromCounts(
        ownerItems.filter((i) => i.ok).length,
        0,
        ownerBad,
      ),
      summary:
        ownerBad === 0
          ? "Compliance and setup look good."
          : `${ownerBad} item(s) need attention.`,
      href: "/erp/reports/performance",
      items: ownerItems,
    },
    {
      role: "fo",
      label: "Front office",
      tone: toneFromCounts(
        foItems.filter((i) => i.ok).length,
        foWarn,
        foBad > 2 ? foBad - 2 : 0,
      ),
      summary:
        unassigned > 0
          ? `${unassigned} arrival(s) need room assignment.`
          : `${arrivalsList.length} arrival(s) today.`,
      href: "/erp/arrivals",
      items: foItems,
    },
    {
      role: "hk",
      label: "Housekeeping",
      tone: toneFromCounts(
        hkItems.filter((i) => i.ok).length,
        dirty > 3 ? 1 : 0,
        dirty > 8 ? 1 : 0,
      ),
      summary: `${dirty} dirty · ${inspect} inspect · ${low} low stock`,
      href: "/erp/housekeeping",
      items: hkItems,
    },
  ];
}
