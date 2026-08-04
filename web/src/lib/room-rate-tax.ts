import "server-only";
import { DEFAULT_GST_RATE } from "@/lib/property-settings";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type RoomRateTaxSettings = {
  gstRate: number;
  serviceChargeRate: number;
  applyServiceCharge: boolean;
  inclusiveOfGstSc: boolean;
};

/**
 * GST / SC / inclusive flag used when quoting and posting room nights.
 * SC applies only when property `service_charge_default_on` is set (same as folio).
 */
export async function loadRoomRateTaxSettings(
  admin: Admin,
  propertyId: string,
): Promise<RoomRateTaxSettings> {
  const [{ data: prop }, { data: policy }] = await Promise.all([
    admin
      .from("properties")
      .select("gst_rate, service_charge_rate, service_charge_default_on")
      .eq("id", propertyId)
      .maybeSingle(),
    admin
      .from("property_policies")
      .select("rates_inclusive_of_gst_sc")
      .eq("property_id", propertyId)
      .maybeSingle(),
  ]);

  return {
    gstRate: Number(prop?.gst_rate ?? DEFAULT_GST_RATE),
    serviceChargeRate: Number(prop?.service_charge_rate ?? 0),
    applyServiceCharge: Boolean(prop?.service_charge_default_on),
    inclusiveOfGstSc: Boolean(policy?.rates_inclusive_of_gst_sc),
  };
}
