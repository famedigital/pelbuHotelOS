import "server-only";

import { thimphuDateOffset, thimphuToday } from "@/lib/erp-lists";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type BusinessDateGateResult =
  | { ok: true }
  | { ok: false; message: string; priorDate: string };

/**
 * Light FO gate: prior calendar day must be night-audited before check-in on
 * the open business date. Not Opera-perfect — honest close-day discipline.
 */
export async function assertBusinessDateOpenForCheckIn(
  admin: Admin,
  propertyId: string,
  checkInDate: string,
): Promise<BusinessDateGateResult> {
  const today = thimphuToday();
  const checkIn = checkInDate.slice(0, 10);
  if (checkIn < today) {
    return {
      ok: false,
      priorDate: thimphuDateOffset(today, -1),
      message:
        "Check-in date is before today. Adjust stay dates on Details, or complete the GM / manager override on check-in.",
    };
  }

  const { data: property, error: propErr } = await admin
    .from("properties")
    .select("current_business_date, timezone")
    .eq("id", propertyId)
    .maybeSingle();
  if (propErr) {
    return {
      ok: false,
      priorDate: thimphuDateOffset(today, -1),
      message: "Could not verify business date. Try again.",
    };
  }

  const openBusinessDate =
    (property?.current_business_date as string | null)?.slice(0, 10) ?? today;

  if (checkIn > openBusinessDate) {
    return {
      ok: false,
      priorDate: thimphuDateOffset(openBusinessDate, -1),
      message: `Business date is still ${openBusinessDate}. Run night audit for the prior day before checking in guests for ${checkIn}.`,
    };
  }

  const priorDate = thimphuDateOffset(openBusinessDate, -1);

  const { count: completedAudits } = await admin
    .from("night_audits")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .eq("status", "completed");
  if ((completedAudits ?? 0) === 0) {
    return { ok: true };
  }

  const { data: priorAudit } = await admin
    .from("night_audits")
    .select("id")
    .eq("property_id", propertyId)
    .eq("business_date", priorDate)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();

  if (!priorAudit && priorDate < openBusinessDate) {
    return {
      ok: false,
      priorDate,
      message: `Night audit for ${priorDate} is not closed. Run Night audit or ask a manager to override.`,
    };
  }

  return { ok: true };
}

/** After a successful night audit for `closedDate`, roll business date forward. */
export async function advancePropertyBusinessDate(
  admin: Admin,
  propertyId: string,
  closedDate: string,
): Promise<void> {
  const next = thimphuDateOffset(closedDate.slice(0, 10), 1);
  await admin
    .from("properties")
    .update({ current_business_date: next })
    .eq("id", propertyId);
}
