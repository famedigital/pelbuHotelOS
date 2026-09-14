/**
 * Multi-outlet chain rollup for the same tenant (same property today;
 * multi-property extend via tenant_id later).
 */

import { buildRestaurantDayPack } from "@/lib/fnb/restaurant-day-pack";
import { thimphuToday } from "@/lib/erp-lists";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ChainOutletFlash = {
  businessDate: string;
  propertyName: string;
  outlets: { outlet: string; salesBtn: number; tickets: number }[];
  salesTotalBtn: number;
  covers: number;
};

export async function buildChainOutletFlash(
  businessDate?: string,
): Promise<ChainOutletFlash> {
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const { data: prop } = await admin
    .from("properties")
    .select("name")
    .eq("id", propertyId)
    .maybeSingle();
  const pack = await buildRestaurantDayPack(businessDate, admin);
  return {
    businessDate: pack.businessDate || thimphuToday(),
    propertyName: (prop?.name as string) ?? "Property",
    outlets: pack.byOutlet,
    salesTotalBtn: pack.salesTotalBtn,
    covers: pack.covers,
  };
}
