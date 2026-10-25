import "server-only";

import { enqueuePlatformVerification } from "@/lib/platform-verification";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Guides are a national list. A hotel stay still keeps a local `guides` row
 * so visit counts and booking.guide_id stay property-scoped.
 */
export async function ensureCentralGuide(
  admin: Admin,
  args: {
    propertyId: string;
    licenseNo: string;
    fullName?: string | null;
  },
): Promise<{ nationalId: string | null; localId: string | null }> {
  const licenseNo = args.licenseNo.trim();
  if (!licenseNo || licenseNo === "DEFERRED") {
    return { nationalId: null, localId: null };
  }

  const { data: existing } = await admin
    .from("national_guides")
    .select("id, full_name")
    .ilike("license_no", licenseNo)
    .maybeSingle();

  let nationalId = (existing?.id as string | undefined) ?? null;
  const fullName =
    args.fullName?.trim() ||
    (existing?.full_name as string | undefined) ||
    licenseNo;

  if (!nationalId) {
    const { data, error } = await admin
      .from("national_guides")
      .insert({
        license_no: licenseNo,
        full_name: fullName,
        status: "pending_verification",
        source: "hotel_desk",
        submitted_by_property_id: args.propertyId,
        languages: ["English"],
      })
      .select("id")
      .maybeSingle();
    if (error?.code === "23505") {
      const { data: again } = await admin
        .from("national_guides")
        .select("id")
        .ilike("license_no", licenseNo)
        .maybeSingle();
      nationalId = (again?.id as string | undefined) ?? null;
    } else if (error) {
      throw new Error(error.message);
    } else {
      nationalId = (data?.id as string | undefined) ?? null;
    }
    if (nationalId) {
      try {
        await enqueuePlatformVerification(admin, {
          entityType: "guide",
          entityId: nationalId,
          propertyId: args.propertyId,
          submittedBy: "desk",
          payload: { licenseNo, fullName },
        });
      } catch (err) {
        console.error("national guide verification queue", err);
      }
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: local, error: localErr } = await admin
    .from("guides")
    .upsert(
      {
        property_id: args.propertyId,
        guide_number: licenseNo,
        full_name: fullName,
        national_guide_id: nationalId,
        last_seen_at: todayIso,
      },
      { onConflict: "property_id,guide_number" },
    )
    .select("id")
    .maybeSingle();
  if (localErr) {
    console.error("local guide link failed", localErr);
  }

  return {
    nationalId,
    localId: (local?.id as string | undefined) ?? null,
  };
}
