"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireDistributor,
  requirePlatformAdmin,
  setSupportPropertyCookie,
} from "@/lib/platform-auth";
import { CONDITIONS_VERSION } from "@/lib/conditions";
import { ONE_TIME_FEES } from "@/lib/pricing-catalog";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function audit(
  action: string,
  meta: Record<string, unknown>,
  ids: {
    actor_email?: string;
    actor_role?: string;
    tenant_id?: string;
    property_id?: string;
    distributor_id?: string;
  },
) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("platform_audit_events").insert({
      action,
      meta,
      actor_email: ids.actor_email ?? null,
      actor_role: ids.actor_role ?? null,
      tenant_id: ids.tenant_id ?? null,
      property_id: ids.property_id ?? null,
      distributor_id: ids.distributor_id ?? null,
    });
  } catch {
    // ignore if table missing
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function isRedirectError(e: unknown): boolean {
  return (
    !!e &&
    typeof e === "object" &&
    "digest" in e &&
    String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function createDistributor(formData: FormData): Promise<void> {
  const session = await requirePlatformAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? name));
  if (!name || !slug) throw new Error("Name required.");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("distributors")
    .insert({
      name,
      slug,
      contact_email: String(formData.get("contact_email") ?? "").trim() || null,
      contact_name: String(formData.get("contact_name") ?? "").trim() || null,
      contact_phone: String(formData.get("contact_phone") ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await audit(
    "distributor.create",
    { name, slug },
    {
      actor_email: session.email,
      actor_role: "platform",
      distributor_id: data.id,
    },
  );
  revalidatePath("/admin/distributors");
}

export async function assignLeadDistributor(formData: FormData): Promise<void> {
  const session = await requirePlatformAdmin();
  const leadId = String(formData.get("lead_id") ?? "");
  const distributorId = String(formData.get("distributor_id") ?? "");
  if (!leadId) throw new Error("Missing lead.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("sales_leads")
    .update({
      distributor_id: distributorId || null,
      status: "contacted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  await audit(
    "lead.assign",
    { leadId, distributorId },
    {
      actor_email: session.email,
      actor_role: "platform",
      distributor_id: distributorId || undefined,
    },
  );
  revalidatePath("/admin/leads");
  revalidatePath("/partner/leads");
}

export async function onboardHotel(formData: FormData): Promise<void> {
  let actorEmail = "";
  let actorRole = "platform";
  let distributorId: string | null = null;

  try {
    try {
      const p = await requirePlatformAdmin();
      actorEmail = p.email;
      distributorId = String(formData.get("distributor_id") ?? "").trim() || null;
    } catch {
      const d = await requireDistributor();
      actorEmail = d.email;
      actorRole = "distributor";
      distributorId = d.distributorId;
    }

    const hotelName = String(formData.get("hotel_name") ?? "").trim();
    const ownerName = String(formData.get("owner_name") ?? "").trim() || hotelName;
    const ownerKind = String(formData.get("owner_kind") ?? "independent");
    const packageCode = String(formData.get("package_code") ?? "classic");
    const amcAmount = Number(formData.get("amc_amount_btn") ?? 0);
    const deskHost = String(formData.get("desk_host") ?? "").trim() || null;
    const existingTenantId = String(formData.get("existing_tenant_id") ?? "").trim();
    const acceptConditions = String(formData.get("accept_conditions") ?? "") === "1";
    const onboardingPaid = String(formData.get("onboarding_paid") ?? "") === "1";
    const trainingPaid = String(formData.get("training_paid") ?? "") === "1";
    const contact1 = String(formData.get("contact_1") ?? "").trim();
    const contact2 = String(formData.get("contact_2") ?? "").trim();
    const dzongkhagCode = String(formData.get("dzongkhag_code") ?? "THI")
      .trim()
      .toUpperCase();
    const areaCode = String(formData.get("area_code") ?? "01")
      .trim()
      .padStart(2, "0");

    if (!hotelName) throw new Error("Hotel name required.");
    if (!acceptConditions) throw new Error("Client must accept conditions.");
    if (!onboardingPaid || !trainingPaid) {
      throw new Error("Mark onboarding and training fees as paid.");
    }
    if (!contact1) throw new Error("At least one authorised contact required.");
    if (!/^[A-Z]{3}$/.test(dzongkhagCode)) {
      throw new Error("Invalid dzongkhag code.");
    }
    if (!/^[0-9]{2}$/.test(areaCode)) {
      throw new Error("Invalid area code.");
    }

    const admin = createSupabaseAdminClient();

    const { data: areaOk } = await admin
      .from("bhutan_hotel_areas")
      .select("code")
      .eq("dzongkhag_code", dzongkhagCode)
      .eq("code", areaCode)
      .maybeSingle();
    if (!areaOk) throw new Error("Unknown dzongkhag / area combination.");

    const { buildHotelCode, nextHotelCodeSequence } = await import(
      "@/lib/hotel-codes"
    );
    const seq = await nextHotelCodeSequence(admin, dzongkhagCode, areaCode);
    const hotelCode = buildHotelCode(dzongkhagCode, areaCode, seq);

    let tenantId = existingTenantId || null;

    if (!tenantId) {
      const slug = slugify(ownerName) + "-" + Date.now().toString(36).slice(-4);
      const { data: tenant, error: tErr } = await admin
        .from("tenants")
        .insert({
          name: ownerName,
          slug,
          plan: packageCode === "chain" ? "chain" : "hotel",
          distributor_id: distributorId,
          package_code: packageCode,
          amc_amount_btn: amcAmount || null,
          owner_kind: ownerKind,
          conditions_version: CONDITIONS_VERSION,
          conditions_accepted_at: new Date().toISOString(),
          authorized_contacts: [
            { phone: contact1 },
            ...(contact2 ? [{ phone: contact2 }] : []),
          ],
          onboarding_fee_btn: ONE_TIME_FEES.onboardingBtn,
          training_fee_btn: ONE_TIME_FEES.trainingBtn,
          onboarding_paid_at: new Date().toISOString(),
          training_paid_at: new Date().toISOString(),
          billing_status: "active",
        })
        .select("id")
        .single();
      if (tErr) throw new Error(tErr.message);
      tenantId = tenant.id;
    }

    const propSlug = slugify(hotelName) + "-" + Date.now().toString(36).slice(-4);
    const checklist = {
      rooms_rates: false,
      staff_trained: false,
      night_audit_dry_run: false,
      fees_paid: true,
      conditions_accepted: true,
      contacts_set: true,
    };

    const { data: property, error: pErr } = await admin
      .from("properties")
      .insert({
        name: hotelName,
        slug: propSlug,
        hotel_code: hotelCode,
        dzongkhag_code: dzongkhagCode,
        area_code: areaCode,
        tenant_id: tenantId,
        distributor_id: distributorId,
        package_code: packageCode,
        desk_host: deskHost,
        amc_amount_btn: amcAmount || null,
        go_live_checklist: checklist,
        is_demo: false,
        setup_step: 1,
        setup_completed_at: null,
      })
      .select("id, slug, hotel_code")
      .single();

    if (pErr) throw new Error(pErr.message);

    // First owner credentials (eZee-style hotel code + user ID + password).
    const { provisionStaffAuthUser } = await import("@/lib/staff-auth");
    const ownerUserId = "OWNER";
    const ownerPassword = String(
      10000000 + Math.floor(Math.random() * 90000000),
    ); // 8-digit initial password
    const { data: ownerStaff, error: ownerErr } = await admin
      .from("staff_members")
      .insert({
        property_id: property.id,
        full_name: ownerName,
        role_label: "manager",
        employee_code: ownerUserId,
        access_level: "owner",
        desk_role: "owner",
        can_login: false,
        can_access_desk: true,
        status: "active",
        employment_type: "full_time",
      })
      .select("id, property_id, employee_code, full_name, access_level, auth_user_id")
      .single();
    if (ownerErr || !ownerStaff) {
      throw new Error(ownerErr?.message || "Could not create owner staff.");
    }

    const authUserId = await provisionStaffAuthUser(
      admin,
      {
        id: ownerStaff.id as string,
        property_id: ownerStaff.property_id as string,
        employee_code: ownerStaff.employee_code as string,
        full_name: ownerStaff.full_name as string,
        access_level: ownerStaff.access_level as string,
        auth_user_id: null,
      },
      ownerPassword,
    );
    await admin
      .from("staff_members")
      .update({
        auth_user_id: authUserId,
        can_login: true,
        pin_set_at: new Date().toISOString(),
      })
      .eq("id", ownerStaff.id);

    await audit(
      "hotel.onboard",
      {
        hotelName,
        packageCode,
        amcAmount,
        hotelCode: property.hotel_code ?? property.slug,
        ownerUserId,
      },
      {
        actor_email: actorEmail,
        actor_role: actorRole,
        tenant_id: tenantId ?? undefined,
        property_id: property.id,
        distributor_id: distributorId ?? undefined,
      },
    );

    revalidatePath("/admin/hotels");
    revalidatePath("/partner/hotels");
    const credQs = new URLSearchParams({
      hotel_code: String(property.hotel_code ?? property.slug),
      user_id: ownerUserId,
      password: ownerPassword,
    });
    if (actorRole === "distributor") {
      redirect(`/partner/hotels/${property.id}?${credQs.toString()}`);
    }
    redirect(`/admin/hotels/${property.id}?${credQs.toString()}`);
  } catch (e) {
    if (isRedirectError(e)) throw e;
    throw e instanceof Error ? e : new Error("Failed");
  }
}

export async function updateGoLiveChecklist(formData: FormData): Promise<void> {
  let actorEmail = "";
  try {
    actorEmail = (await requirePlatformAdmin()).email;
  } catch {
    actorEmail = (await requireDistributor()).email;
  }

  const propertyId = String(formData.get("property_id") ?? "");
  if (!propertyId) throw new Error("Missing property.");

  const admin = createSupabaseAdminClient();
  const { data: prop } = await admin
    .from("properties")
    .select("go_live_checklist")
    .eq("id", propertyId)
    .maybeSingle();

  const current = (prop?.go_live_checklist as Record<string, boolean>) ?? {};
  const next = {
    ...current,
    rooms_rates: formData.get("rooms_rates") === "1",
    staff_trained: formData.get("staff_trained") === "1",
    night_audit_dry_run: formData.get("night_audit_dry_run") === "1",
    fees_paid: current.fees_paid ?? formData.get("fees_paid") === "1",
    conditions_accepted:
      current.conditions_accepted ?? formData.get("conditions_accepted") === "1",
    contacts_set: current.contacts_set ?? formData.get("contacts_set") === "1",
  };

  const ready =
    next.rooms_rates &&
    next.staff_trained &&
    next.night_audit_dry_run &&
    next.fees_paid &&
    next.conditions_accepted &&
    next.contacts_set;

  const { error } = await admin
    .from("properties")
    .update({
      go_live_checklist: next,
      go_live_at: ready ? new Date().toISOString() : null,
    })
    .eq("id", propertyId);
  if (error) throw new Error(error.message);

  await audit(
    "hotel.golive_checklist",
    { next, ready },
    { actor_email: actorEmail, property_id: propertyId },
  );
  revalidatePath(`/admin/hotels/${propertyId}`);
  revalidatePath(`/partner/hotels/${propertyId}`);
}

export async function supportEnterProperty(formData: FormData): Promise<void> {
  const propertyId = String(formData.get("property_id") ?? "");
  if (!propertyId) throw new Error("Missing property");

  let email = "";
  let role = "platform";
  let distributorId: string | undefined;
  try {
    email = (await requirePlatformAdmin()).email;
  } catch {
    const d = await requireDistributor();
    email = d.email;
    role = "distributor";
    distributorId = d.distributorId;
    const admin = createSupabaseAdminClient();
    const { data: prop } = await admin
      .from("properties")
      .select("distributor_id")
      .eq("id", propertyId)
      .maybeSingle();
    if (prop?.distributor_id !== d.distributorId) {
      throw new Error("Property not in your portfolio.");
    }
  }

  await setSupportPropertyCookie(propertyId);
  await audit(
    "support.enter",
    {},
    {
      actor_email: email,
      actor_role: role,
      property_id: propertyId,
      distributor_id: distributorId,
    },
  );
  redirect("/erp");
}

export async function markRoyaltyPaid(formData: FormData): Promise<void> {
  const session = await requirePlatformAdmin();
  const id = String(formData.get("invoice_id") ?? "");
  const bankRef = String(formData.get("bank_ref") ?? "").trim();
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("royalty_invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      bank_ref: bankRef || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await audit(
    "royalty.paid",
    { id, bankRef },
    { actor_email: session.email, actor_role: "platform" },
  );
  revalidatePath("/admin/royalty");
}

export async function createSupportTicket(formData: FormData): Promise<void> {
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const propertyId = String(formData.get("property_id") ?? "").trim() || null;
  const billableAck = formData.get("billable_ack") === "1";
  if (!subject || !body) throw new Error("Subject and body required.");

  let distributorId: string | null = null;
  let email = "unknown";
  try {
    email = (await requirePlatformAdmin()).email;
  } catch {
    const d = await requireDistributor();
    email = d.email;
    distributorId = d.distributorId;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("support_tickets").insert({
    subject,
    body,
    property_id: propertyId,
    distributor_id: distributorId,
    billable_acknowledged: billableAck,
    created_by_email: email,
    status: "open",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/tickets");
  revalidatePath("/partner/tickets");
}
