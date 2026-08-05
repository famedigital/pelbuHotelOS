"use server";

import type { PropertyWizardState } from "@/app/actions/erp-properties";
import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated, requireDeskRole } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import {
  defaultDocumentDesign,
  mapDocumentDesign,
  percentToRate,
} from "@/lib/property-settings";
import { normalizeCloseTime } from "@/lib/night-audit/close-time";
import { resolveActivePropertyId } from "@/lib/property-context";
import { syncRoomUnits } from "@/lib/rooms/sync-room-units";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function requirePercent(value: FormDataEntryValue | null, label: string): number {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error(`${label} is required.`);
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    throw new Error(`${label} must be between 0 and 100.`);
  }
  return percentToRate(raw);
}

async function syncRoomTypeCount(admin: Admin, roomTypeId: string) {
  const { count, error } = await admin
    .from("room_units")
    .select("*", { count: "exact", head: true })
    .eq("room_type_id", roomTypeId);
  if (error) throw new Error(error.message);
  const { error: patchError } = await admin
    .from("room_types")
    .update({ unit_count: count ?? 0 })
    .eq("id", roomTypeId);
  if (patchError) throw new Error(patchError.message);
}

export async function updatePropertyIdentity(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const name = trimRequired(formData.get("name"), "Property name");
    const legalName = optionalTrim(formData.get("legal_name")) ?? name;

    const patch = {
      name,
      legal_name: legalName,
      address: optionalTrim(formData.get("address")),
      phone: optionalTrim(formData.get("phone")),
      whatsapp: optionalTrim(formData.get("whatsapp")),
      email: optionalTrim(formData.get("email")),
      tax_id: optionalTrim(formData.get("tax_id")),
      logo_public_id: optionalTrim(formData.get("logo_public_id")),
    };

    const { error } = await admin.from("properties").update(patch).eq("id", propertyId);
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.settings.identity",
      entityType: "properties",
      entityId: propertyId,
      summary: `Updated identity for ${name}`,
    });

    revalidatePath("/erp");
    revalidatePath("/erp/settings");
    revalidatePath("/");
    revalidatePath("/contact");
    revalidatePath("/rates");
    return { ok: true, propertyId, message: "Identity saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save identity.",
    };
  }
}

export async function updatePropertyHosts(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    await requireDeskRole(["gm", "owner"]);
    const admin = createSupabaseAdminClient();
    const activePropertyId = await resolveActivePropertyId(admin);
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    assertDeskProperty(activePropertyId, propertyId, "Property");
    const publicHost = optionalTrim(formData.get("public_host"));
    const deskHost = optionalTrim(formData.get("desk_host"));

    const normalize = (h: string | null) =>
      h
        ? h
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .split("/")[0]
            ?.trim() || null
        : null;

    const { error } = await admin
      .from("properties")
      .update({
        public_host: normalize(publicHost),
        desk_host: normalize(deskHost),
      })
      .eq("id", propertyId);
    if (error) {
      if (
        error.message.includes("properties_public_host") ||
        error.message.includes("unique")
      ) {
        throw new Error("That hostname is already used by another property.");
      }
      throw new Error(error.message);
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.settings.hosts",
      entityType: "properties",
      entityId: propertyId,
      summary: `Hosts public=${normalize(publicHost) ?? "—"} desk=${normalize(deskHost) ?? "—"}`,
    });

    revalidatePath("/erp/settings");
    return { ok: true, propertyId, message: "Hostnames saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save hosts.",
    };
  }
}

/** Platform stub: rename the SaaS tenant org attached to this property. */
export async function updateTenantName(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    await requireDeskRole(["gm", "owner"]);
    const admin = createSupabaseAdminClient();
    const activePropertyId = await resolveActivePropertyId(admin);
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    assertDeskProperty(activePropertyId, propertyId, "Property");
    const tenantId = trimRequired(formData.get("tenant_id"), "Tenant");
    const name = trimRequired(formData.get("tenant_name"), "Tenant name");

    const { data: property } = await admin
      .from("properties")
      .select("tenant_id")
      .eq("id", propertyId)
      .maybeSingle();
    if (!property?.tenant_id || property.tenant_id !== tenantId) {
      throw new Error("Tenant is not attached to the active property.");
    }

    const { error } = await admin
      .from("tenants")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", tenantId);
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "tenant.settings.name",
      entityType: "tenants",
      entityId: tenantId,
      summary: `Tenant renamed to ${name}`,
    });

    revalidatePath("/erp/settings");
    revalidatePath("/erp/group");
    return { ok: true, propertyId, message: "Tenant name saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save tenant name.",
    };
  }
}

/** Invoice-first billing fields + seat usage soft cap. */
export async function updateTenantBilling(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    await requireDeskRole(["gm", "owner"]);
    const admin = createSupabaseAdminClient();
    const activePropertyId = await resolveActivePropertyId(admin);
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    assertDeskProperty(activePropertyId, propertyId, "Property");
    const tenantId = trimRequired(formData.get("tenant_id"), "Tenant");
    const billingEmail = optionalTrim(formData.get("billing_email"));
    const seatsUsedRaw = optionalTrim(formData.get("seats_used"));
    const seatsUsed = seatsUsedRaw ? Number(seatsUsedRaw) : 0;
    if (!Number.isFinite(seatsUsed) || seatsUsed < 0 || seatsUsed > 10000) {
      throw new Error("Seats used must be between 0 and 10000.");
    }

    const { data: property } = await admin
      .from("properties")
      .select("tenant_id")
      .eq("id", propertyId)
      .maybeSingle();
    if (!property?.tenant_id || property.tenant_id !== tenantId) {
      throw new Error("Tenant is not attached to the active property.");
    }

    const { data: tenant } = await admin
      .from("tenants")
      .select("seat_limit")
      .eq("id", tenantId)
      .maybeSingle();
    if (!tenant) throw new Error("Tenant not found.");
    if (seatsUsed > Number(tenant.seat_limit)) {
      throw new Error(
        `Seats used (${seatsUsed}) exceeds seat limit (${tenant.seat_limit}).`,
      );
    }

    const { error } = await admin
      .from("tenants")
      .update({
        billing_email: billingEmail,
        seats_used: Math.floor(seatsUsed),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "tenant.settings.billing",
      entityType: "tenants",
      entityId: tenantId,
      summary: `Billing email / seats_used=${Math.floor(seatsUsed)}`,
    });

    revalidatePath("/erp/settings");
    return { ok: true, propertyId, message: "Tenant billing saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save tenant billing.",
    };
  }
}

/** Issue / refresh TXT verify token and mark host cert status pending. */
export async function issueHostDomainVerify(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    await requireDeskRole(["gm", "owner"]);
    const admin = createSupabaseAdminClient();
    const activePropertyId = await resolveActivePropertyId(admin);
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    assertDeskProperty(activePropertyId, propertyId, "Property");
    const target = optionalTrim(formData.get("host_target")) ?? "public";
    if (target !== "public" && target !== "desk") {
      throw new Error("Host target must be public or desk.");
    }

    const token = `pelbu-verify=${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const patch =
      target === "public"
        ? {
            host_verify_token: token,
            public_host_cert_status: "pending",
          }
        : {
            host_verify_token: token,
            desk_host_cert_status: "pending",
          };

    const { error } = await admin
      .from("properties")
      .update(patch)
      .eq("id", propertyId);
    if (error) throw new Error(error.message);

    const { data: property } = await admin
      .from("properties")
      .select("tenant_id")
      .eq("id", propertyId)
      .maybeSingle();
    if (property?.tenant_id) {
      await admin
        .from("tenants")
        .update({
          domain_verify_token: token,
          updated_at: new Date().toISOString(),
        })
        .eq("id", property.tenant_id as string);
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.settings.host_verify",
      entityType: "properties",
      entityId: propertyId,
      summary: `Issued ${target} domain verify token (cert pending)`,
    });

    revalidatePath("/erp/settings");
    return {
      ok: true,
      propertyId,
      message: `TXT token ready. Add it at DNS, then mark verified after Vercel cert attaches.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not issue verify token.",
    };
  }
}

/** Mark host cert verified after ops confirms Vercel domain + DNS. */
export async function markHostDomainVerified(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    await requireDeskRole(["gm", "owner"]);
    const admin = createSupabaseAdminClient();
    const activePropertyId = await resolveActivePropertyId(admin);
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    assertDeskProperty(activePropertyId, propertyId, "Property");
    const target = optionalTrim(formData.get("host_target")) ?? "public";
    if (target !== "public" && target !== "desk") {
      throw new Error("Host target must be public or desk.");
    }

    const patch =
      target === "public"
        ? { public_host_cert_status: "verified" }
        : { desk_host_cert_status: "verified" };

    const { error } = await admin
      .from("properties")
      .update(patch)
      .eq("id", propertyId);
    if (error) throw new Error(error.message);

    const { data: property } = await admin
      .from("properties")
      .select("tenant_id")
      .eq("id", propertyId)
      .maybeSingle();
    if (property?.tenant_id) {
      await admin
        .from("tenants")
        .update({
          domain_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", property.tenant_id as string);
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.settings.host_verified",
      entityType: "properties",
      entityId: propertyId,
      summary: `Marked ${target} host cert verified`,
    });

    revalidatePath("/erp/settings");
    return { ok: true, propertyId, message: `${target} host marked verified.` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not mark verified.",
    };
  }
}

/**
 * Saves a Cloudinary public ID chosen in the media picker. The file itself
 * goes browser → Cloudinary, so nothing large travels through this action.
 */
export async function setPropertyLogo(
  propertyId: string,
  publicId: string | null,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const id = trimRequired(propertyId, "Property");
    const logoPublicId = publicId?.trim() ? publicId.trim() : null;

    const { error } = await admin
      .from("properties")
      .update({ logo_public_id: logoPublicId })
      .eq("id", id);
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId: id,
      action: "property.settings.logo",
      entityType: "properties",
      entityId: id,
      summary: logoPublicId
        ? `Set property logo to ${logoPublicId}`
        : "Removed property logo",
      meta: { logo_public_id: logoPublicId },
    });

    // Layout scope: the sidebar brand mark lives in the /erp layout, so every
    // desk route needs the new logo, not just the settings page.
    revalidatePath("/erp", "layout");
    // Public chrome (header, footer, book shell) reads logo_public_id per request.
    revalidatePath("/", "layout");
    revalidatePath("/book");
    revalidatePath("/contact");
    revalidatePath("/menu");
    revalidatePath("/rooms");
    revalidatePath("/rates");
    return {
      ok: true,
      propertyId: id,
      message: logoPublicId ? "Logo updated." : "Logo removed.",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not update logo.",
    };
  }
}

/** Public header mark size, hang under the nav rail, and gap to hotel name. */
export async function setPropertyLogoNavLayout(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const sizeRaw = Number(String(formData.get("logo_nav_size_rem") ?? "").trim());
    const offsetRaw = Number(
      String(formData.get("logo_nav_offset_pct") ?? "").trim(),
    );
    const gapRaw = Number(String(formData.get("logo_nav_gap_rem") ?? "").trim());
    const shiftRaw = Number(
      String(formData.get("logo_nav_shift_x_rem") ?? "0").trim(),
    );
    if (!Number.isFinite(sizeRaw) || sizeRaw < 4 || sizeRaw > 12) {
      throw new Error("Logo size must be between 4 and 12 rem.");
    }
    if (!Number.isFinite(offsetRaw) || offsetRaw < 20 || offsetRaw > 70) {
      throw new Error("Logo vertical hang must be between 20% and 70%.");
    }
    if (!Number.isFinite(gapRaw) || gapRaw < 0 || gapRaw > 3) {
      throw new Error("Logo–title gap must be between 0 and 3 rem.");
    }
    if (!Number.isFinite(shiftRaw) || shiftRaw < -1.5 || shiftRaw > 3) {
      throw new Error("Logo horizontal shift must be between −1.5 and 3 rem.");
    }
    const logo_nav_size_rem = Math.round(sizeRaw * 100) / 100;
    const logo_nav_offset_pct = Math.round(offsetRaw * 10) / 10;
    const logo_nav_gap_rem = Math.round(gapRaw * 100) / 100;
    const logo_nav_shift_x_rem = Math.round(shiftRaw * 100) / 100;

    const { error } = await admin
      .from("properties")
      .update({
        logo_nav_size_rem,
        logo_nav_offset_pct,
        logo_nav_gap_rem,
        logo_nav_shift_x_rem,
      })
      .eq("id", propertyId);
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.settings.logo_layout",
      entityType: "properties",
      entityId: propertyId,
      summary: `Logo layout size ${logo_nav_size_rem}rem, hang ${logo_nav_offset_pct}%, shift ${logo_nav_shift_x_rem}rem, gap ${logo_nav_gap_rem}rem`,
      meta: {
        logo_nav_size_rem,
        logo_nav_offset_pct,
        logo_nav_gap_rem,
        logo_nav_shift_x_rem,
      },
    });

    revalidatePath("/erp/settings");
    revalidatePath("/", "layout");
    return {
      ok: true,
      propertyId,
      message: "Header logo size, hang, shift, and gap saved.",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save logo layout.",
    };
  }
}

export async function updatePropertyTaxSettings(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDeskRole(["gm", "owner"]);
    const admin = createSupabaseAdminClient();
    const activePropertyId = await resolveActivePropertyId(admin);
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    assertDeskProperty(activePropertyId, propertyId, "Property");
    const gstRate = requirePercent(formData.get("gst_rate"), "GST rate");
    const serviceChargeRate = requirePercent(
      formData.get("service_charge_rate"),
      "Service charge",
    );
    const serviceChargeDefaultOn =
      formData.get("service_charge_default_on") === "1";
    const postDay1RoomAtCheckin =
      formData.get("post_day1_room_at_checkin") === "1";
    const closeTime = normalizeCloseTime(
      optionalTrim(formData.get("night_audit_close_time")) ?? "00:00",
    );

    const { error } = await admin
      .from("properties")
      .update({
        gst_rate: gstRate,
        service_charge_rate: serviceChargeRate,
        service_charge_default_on: serviceChargeDefaultOn,
        post_day1_room_at_checkin: postDay1RoomAtCheckin,
        night_audit_close_time: closeTime,
      })
      .eq("id", propertyId);
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.settings.tax",
      entityType: "properties",
      entityId: propertyId,
      summary: "Updated GST, service charge, day-1 post, and night-audit close time",
      meta: {
        gst_rate: gstRate,
        service_charge_rate: serviceChargeRate,
        service_charge_default_on: serviceChargeDefaultOn,
        post_day1_room_at_checkin: postDay1RoomAtCheckin,
        night_audit_close_time: closeTime,
      },
    });

    revalidatePath("/erp/settings");
    revalidatePath("/erp/pos");
    revalidatePath("/erp/night-audit");
    return { ok: true, propertyId, message: "Tax & night-audit defaults saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save tax settings.",
    };
  }
}

export async function updatePropertyDocumentDesign(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const kind = trimRequired(formData.get("doc_kind"), "Document kind");
    if (!["invoice", "receipt", "voucher"].includes(kind)) {
      throw new Error("Choose invoice, receipt, or voucher.");
    }

    const defaultDesign = defaultDocumentDesign(
      kind as "invoice" | "receipt" | "voucher",
    );
    const next = mapDocumentDesign(
      {
        preset: optionalTrim(formData.get("preset")) ?? defaultDesign.preset,
        brand_color:
          optionalTrim(formData.get("brand_color")) ?? defaultDesign.brand_color,
        accent_color:
          optionalTrim(formData.get("accent_color")) ?? defaultDesign.accent_color,
        header_text:
          optionalTrim(formData.get("header_text")) ?? defaultDesign.header_text,
        footer_text:
          optionalTrim(formData.get("footer_text")) ?? defaultDesign.footer_text,
        show_phone: formData.get("show_phone") === "1",
        show_email: formData.get("show_email") === "1",
        show_tax_id: formData.get("show_tax_id") === "1",
        show_address: formData.get("show_address") === "1",
        paper_size:
          optionalTrim(formData.get("paper_size")) ?? defaultDesign.paper_size,
      },
      kind as "invoice" | "receipt" | "voucher",
    );

    const column =
      kind === "invoice"
        ? "doc_invoice"
        : kind === "receipt"
          ? "doc_receipt"
          : "doc_voucher";
    const { error } = await admin
      .from("properties")
      .update({ [column]: next })
      .eq("id", propertyId);
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: `property.settings.${kind}_design`,
      entityType: "properties",
      entityId: propertyId,
      summary: `Updated ${kind} design`,
      meta: { kind, preset: next.preset, paper_size: next.paper_size },
    });

    revalidatePath("/erp/settings");
    return {
      ok: true,
      propertyId,
      message: `${kind[0].toUpperCase()}${kind.slice(1)} design saved.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save document design.",
    };
  }
}

export async function saveRoomTypeSettings(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const roomTypeId = optionalTrim(formData.get("room_type_id"));
    const code = trimRequired(formData.get("code"), "Room code").toLowerCase();
    const name = trimRequired(formData.get("name"), "Room category");
    const inventoryKind =
      optionalTrim(formData.get("inventory_kind")) ?? "sellable_guest";
    const unitCountRaw = Number(formData.get("unit_count") ?? 0);
    if (!Number.isInteger(unitCountRaw) || unitCountRaw < 0 || unitCountRaw > 500) {
      throw new Error("Room count must be a whole number between 0 and 500.");
    }

    let nextRoomTypeId = roomTypeId;
    const imagePublicId = optionalTrim(formData.get("image_public_id"));
    const blurb = optionalTrim(formData.get("blurb"));

    if (roomTypeId) {
      const { error } = await admin
        .from("room_types")
        .update({
          code,
          name,
          inventory_kind: inventoryKind,
          unit_count: unitCountRaw,
          image_public_id: imagePublicId,
          blurb,
        })
        .eq("id", roomTypeId)
        .eq("property_id", propertyId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await admin
        .from("room_types")
        .insert({
          property_id: propertyId,
          code,
          name,
          inventory_kind: inventoryKind,
          unit_count: unitCountRaw,
          image_public_id: imagePublicId,
          blurb,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not add room type.");
      nextRoomTypeId = data.id as string;
    }

    await syncRoomUnits(admin, propertyId, nextRoomTypeId as string, code, unitCountRaw);

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.settings.room_type",
      entityType: "room_types",
      entityId: nextRoomTypeId,
      summary: `Saved room category ${name}`,
      meta: {
        code,
        inventory_kind: inventoryKind,
        unit_count: unitCountRaw,
        image_public_id: imagePublicId,
      },
    });

    revalidatePath("/erp/settings");
    revalidatePath("/erp/rooms");
    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath(`/rooms/${code}`);
    return { ok: true, propertyId, message: "Room category saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save room category.",
    };
  }
}

export async function saveRoomUnitSettings(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const roomTypeId = trimRequired(formData.get("room_type_id"), "Room category");
    const roomUnitId = optionalTrim(formData.get("room_unit_id"));
    const label = trimRequired(formData.get("label"), "Room name or number");
    const floorLabel = optionalTrim(formData.get("floor_label"));
    const viewLabel = optionalTrim(formData.get("view_label"));
    const hasBalcony = formData.get("has_balcony") === "on";
    const notes = optionalTrim(formData.get("notes"));
    const connectingRaw = optionalTrim(formData.get("connecting_room_unit_id"));
    const connectingRoomUnitId =
      connectingRaw && connectingRaw !== roomUnitId ? connectingRaw : null;
    const sortRaw = optionalTrim(formData.get("sort_order"));
    const sortOrder = sortRaw ? Number(sortRaw) : NaN;
    const resolvedSort = Number.isFinite(sortOrder) ? Math.max(0, Math.floor(sortOrder)) : null;

    let previousRoomTypeId: string | null = null;

    if (connectingRoomUnitId) {
      const { data: peer } = await admin
        .from("room_units")
        .select("id")
        .eq("id", connectingRoomUnitId)
        .eq("property_id", propertyId)
        .maybeSingle();
      if (!peer) throw new Error("Connecting room not found on this property.");
    }

    if (roomUnitId) {
      const { data: current } = await admin
        .from("room_units")
        .select("room_type_id")
        .eq("id", roomUnitId)
        .eq("property_id", propertyId)
        .maybeSingle();
      previousRoomTypeId = (current?.room_type_id as string | undefined) ?? null;

      const patch: Record<string, unknown> = {
        label,
        floor_label: floorLabel,
        view_label: viewLabel,
        has_balcony: hasBalcony,
        connecting_room_unit_id: connectingRoomUnitId,
        notes,
        room_type_id: roomTypeId,
        updated_at: new Date().toISOString(),
      };
      if (resolvedSort != null) patch.sort_order = resolvedSort;
      const { error } = await admin
        .from("room_units")
        .update(patch)
        .eq("id", roomUnitId)
        .eq("property_id", propertyId);
      if (error) throw new Error(error.message);

      // Keep peer link mutual when set.
      if (connectingRoomUnitId) {
        await admin
          .from("room_units")
          .update({
            connecting_room_unit_id: roomUnitId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connectingRoomUnitId)
          .eq("property_id", propertyId);
      }
    } else {
      let sort_order = resolvedSort;
      if (sort_order == null) {
        const { data: maxRow } = await admin
          .from("room_units")
          .select("sort_order")
          .eq("property_id", propertyId)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        sort_order = Number(maxRow?.sort_order ?? 0) + 1;
      }
      const { error } = await admin.from("room_units").insert({
        property_id: propertyId,
        room_type_id: roomTypeId,
        label,
        floor_label: floorLabel,
        view_label: viewLabel,
        has_balcony: hasBalcony,
        connecting_room_unit_id: connectingRoomUnitId,
        notes,
        hk_status: "clean",
        sort_order,
      });
      if (error) throw new Error(error.message);
    }

    await syncRoomTypeCount(admin, roomTypeId);
    if (previousRoomTypeId && previousRoomTypeId !== roomTypeId) {
      await syncRoomTypeCount(admin, previousRoomTypeId);
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.settings.room_unit",
      entityType: "room_units",
      entityId: roomUnitId,
      summary: `${roomUnitId ? "Updated" : "Added"} room ${label}`,
    });

    revalidatePath("/erp/settings");
    revalidatePath("/erp/rooms");
    revalidatePath("/erp/calendar");
    return { ok: true, propertyId, message: "Room saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save room.",
    };
  }
}

export async function deleteRoomUnit(formData: FormData): Promise<void> {
  await requireDesk();
  const admin = createSupabaseAdminClient();
  const propertyId = trimRequired(formData.get("property_id"), "Property");
  const roomTypeId = trimRequired(formData.get("room_type_id"), "Room category");
  const roomUnitId = trimRequired(formData.get("room_unit_id"), "Room");

  const { data: unit } = await admin
    .from("room_units")
    .select("label")
    .eq("id", roomUnitId)
    .eq("property_id", propertyId)
    .maybeSingle();

  const { error } = await admin
    .from("room_units")
    .delete()
    .eq("id", roomUnitId)
    .eq("property_id", propertyId);
  if (error) throw new Error(error.message);

  await syncRoomTypeCount(admin, roomTypeId);

  await writeAuditEvent(admin, {
    propertyId,
    action: "property.settings.room_unit_delete",
    entityType: "room_units",
    entityId: roomUnitId,
    summary: `Deleted room ${(unit?.label as string | undefined) ?? roomUnitId}`,
  });

  revalidatePath("/erp/settings");
  revalidatePath("/erp/rooms");
}

export type CommercialSettingsState = {
  ok: boolean;
  error?: string;
  message?: string;
};

function parseMealAmount(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").trim();
  if (!text || text.toLowerCase() === "label") return null;
  const num = Number(text);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error("Meal amount must be blank (label-only) or a non-negative number.");
  }
  return num;
}

export async function updateCommercialSettings(
  _prev: CommercialSettingsState,
  formData: FormData,
): Promise<CommercialSettingsState> {
  try {
    await requireDesk();
    await requireDeskRole(["owner", "gm"]);
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    await assertDeskProperty(await resolveActivePropertyId(admin), propertyId, "Property");

    const defaultMealPlan = trimRequired(
      formData.get("default_meal_plan_code"),
      "Default meal plan",
    );
    const codes = formData.getAll("meal_code") as string[];

    for (const code of codes) {
      const isActive = formData.get(`meal_active_${code}`) === "on";
      const amount = parseMealAmount(formData.get(`meal_amount_${code}`));
      const childAmount = parseMealAmount(
        formData.get(`meal_child_amount_${code}`),
      );
      const { error } = await admin
        .from("meal_plans")
        .update({
          is_active: isActive,
          amount_btn_per_adult_night: amount,
          amount_btn_per_child_night: childAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("property_id", propertyId)
        .eq("code", code);
      if (error) throw new Error(`Could not save meal plan ${code}.`);
    }

    const extraBedActive = formData.get("extra_bed_active") === "on";
    const extraBedRateRaw = String(formData.get("extra_bed_rate_btn") ?? "").trim();
    let extraBedRate: number | null = null;
    if (extraBedRateRaw) {
      const n = Number(extraBedRateRaw);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error("Extra bed rate must be blank or a non-negative number.");
      }
      extraBedRate = n;
    }
    if (extraBedActive && (extraBedRate == null || extraBedRate <= 0)) {
      throw new Error("Set a positive extra bed Nu / night to sell on booking.");
    }

    const staffCommRaw = String(
      formData.get("staff_sales_commission_pct") ?? "",
    ).trim();
    let staffSalesCommissionPct: number | null = null;
    if (staffCommRaw) {
      const n = Number(staffCommRaw);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new Error("Staff sales commission must be blank or 0–100%.");
      }
      staffSalesCommissionPct = n;
    }

    const ratesInclusiveOfGstSc =
      formData.get("rates_inclusive_of_gst_sc") === "on";

    const { error: propError } = await admin
      .from("properties")
      .update({ default_meal_plan_code: defaultMealPlan })
      .eq("id", propertyId);
    if (propError) throw new Error("Could not save default meal plan.");

    const { data: existingPolicy } = await admin
      .from("property_policies")
      .select("property_id")
      .eq("property_id", propertyId)
      .maybeSingle();
    if (existingPolicy) {
      const { error: policyError } = await admin
        .from("property_policies")
        .update({
          extra_bed_active: extraBedActive,
          extra_bed_rate_btn: extraBedRate,
          staff_sales_commission_pct: staffSalesCommissionPct,
          rates_inclusive_of_gst_sc: ratesInclusiveOfGstSc,
          updated_at: new Date().toISOString(),
        })
        .eq("property_id", propertyId);
      if (policyError) throw new Error("Could not save commercial policy settings.");
    } else {
      const { error: policyError } = await admin.from("property_policies").insert({
        property_id: propertyId,
        extra_bed_active: extraBedActive,
        extra_bed_rate_btn: extraBedRate,
        staff_sales_commission_pct: staffSalesCommissionPct,
        rates_inclusive_of_gst_sc: ratesInclusiveOfGstSc,
      });
      if (policyError) throw new Error("Could not save commercial policy settings.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.settings.commercial",
      entityType: "properties",
      entityId: propertyId,
      summary: "Updated rates & meals settings",
      meta: { rates_inclusive_of_gst_sc: ratesInclusiveOfGstSc },
    });

    revalidatePath("/erp/settings");
    revalidatePath("/erp/rates");
    revalidatePath("/erp/fast-book");
    revalidatePath("/book");
    return { ok: true, message: "Rates & meals saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save commercial settings.",
    };
  }
}

/** Owner/GM: optional desk access limited to published staff_shifts. Default OFF. */
export async function updateDeskShiftRestrictionSettings(
  _prev: CommercialSettingsState,
  formData: FormData,
): Promise<CommercialSettingsState> {
  try {
    await requireDesk();
    await requireDeskRole(["owner", "gm"]);
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    await assertDeskProperty(await resolveActivePropertyId(admin), propertyId, "Property");

    const restrict = formData.get("desk_restrict_to_scheduled_shifts") === "on";

    const { data: existingPolicy } = await admin
      .from("property_policies")
      .select("property_id")
      .eq("property_id", propertyId)
      .maybeSingle();

    if (existingPolicy) {
      const { error } = await admin
        .from("property_policies")
        .update({
          desk_restrict_to_scheduled_shifts: restrict,
          updated_at: new Date().toISOString(),
        })
        .eq("property_id", propertyId);
      if (error) throw new Error("Could not save desk shift restriction.");
    } else {
      const { error } = await admin.from("property_policies").insert({
        property_id: propertyId,
        desk_restrict_to_scheduled_shifts: restrict,
      });
      if (error) throw new Error("Could not save desk shift restriction.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.settings.desk_shift_restriction",
      entityType: "property_policies",
      entityId: propertyId,
      summary: restrict
        ? "Enabled desk restriction to scheduled shifts"
        : "Disabled desk restriction to scheduled shifts (staff free access)",
      meta: { desk_restrict_to_scheduled_shifts: restrict },
    });

    revalidatePath("/erp/settings");
    revalidatePath("/erp/login");
    return {
      ok: true,
      message: restrict
        ? "Desk is now limited to scheduled shifts for non-management staff."
        : "Desk open any time for staff with hotel desk access (default).",
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Could not save desk shift restriction.",
    };
  }
}

export async function updatePropertyPoliciesSettings(
  _prev: CommercialSettingsState,
  formData: FormData,
): Promise<CommercialSettingsState> {
  try {
    await requireDesk();
    await requireDeskRole(["owner", "gm"]);
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    await assertDeskProperty(await resolveActivePropertyId(admin), propertyId, "Property");

    const freeCancelDays = Number(String(formData.get("free_cancel_days") ?? "3"));
    if (!Number.isInteger(freeCancelDays) || freeCancelDays < 0) {
      throw new Error("Free cancel days must be zero or a positive whole number.");
    }

    const noShowNights = Number(String(formData.get("no_show_nights") ?? "1"));
    if (!Number.isInteger(noShowNights) || noShowNights < 0) {
      throw new Error("No-show nights must be zero or a positive whole number.");
    }

    const patch = {
      free_cancel_days: freeCancelDays,
      late_cancel_forfeit_deposit:
        formData.get("late_cancel_forfeit_deposit") === "on",
      no_show_nights: noShowNights,
      mou_free_cancel: formData.get("mou_free_cancel") === "on",
      mou_waive_no_show: formData.get("mou_waive_no_show") === "on",
      guest_summary: optionalTrim(formData.get("guest_summary")),
      house_rules: optionalTrim(formData.get("house_rules")),
      dos: optionalTrim(formData.get("dos")),
      donts: optionalTrim(formData.get("donts")),
      wifi_name: optionalTrim(formData.get("wifi_name")),
      wifi_password: optionalTrim(formData.get("wifi_password")),
      check_in_time: optionalTrim(formData.get("check_in_time")),
      check_out_time: optionalTrim(formData.get("check_out_time")),
      quiet_hours: optionalTrim(formData.get("quiet_hours")),
      early_checkout_fee_btn: (() => {
        const raw = optionalTrim(formData.get("early_checkout_fee_btn"));
        if (!raw) return null;
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error("Early checkout fee must be non-negative.");
        }
        return n;
      })(),
      late_checkout_fee_btn: (() => {
        const raw = optionalTrim(formData.get("late_checkout_fee_btn"));
        if (!raw) return null;
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error("Late checkout fee must be non-negative.");
        }
        return n;
      })(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await admin
      .from("property_policies")
      .upsert({ property_id: propertyId, ...patch });
    if (error) throw new Error("Could not save policies.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.settings.policies",
      entityType: "property_policies",
      entityId: propertyId,
      summary: "Updated booking & house policies",
    });

    revalidatePath("/erp/settings");
    revalidatePath("/erp/bookings");
    return { ok: true, message: "Policies saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save policies.",
    };
  }
}

export async function updateDamageCatalogItem(
  _prev: CommercialSettingsState,
  formData: FormData,
): Promise<CommercialSettingsState> {
  try {
    await requireDesk();
    await requireDeskRole(["owner", "gm"]);
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const itemId = trimRequired(formData.get("item_id"), "Item");
    await assertDeskProperty(await resolveActivePropertyId(admin), propertyId, "Property");

    const amountRaw = String(formData.get("amount_btn") ?? "").trim();
    const amountBtn =
      !amountRaw || amountRaw.toLowerCase() === "manager"
        ? null
        : Number(amountRaw);
    if (amountBtn != null && (!Number.isFinite(amountBtn) || amountBtn < 0)) {
      throw new Error("Damage amount must be blank (manager price) or non-negative.");
    }

    const { error } = await admin
      .from("property_damage_items")
      .update({
        amount_btn: amountBtn,
        is_active: formData.get("is_active") === "on",
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not save damage item.");

    revalidatePath("/erp/settings");
    revalidatePath("/erp/folios");
    return { ok: true, message: "Damage item updated." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save damage item.",
    };
  }
}

export type SettingsActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const WIPE_CONFIRM_PHRASE = "WIPE";

function formFlag(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "1" || v === "on" || v === "true";
}

/** Owner-only danger zone — type WIPE to confirm. Optional master-data flags. Audit-logged. */
export async function wipeOperationalData(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    await requireDeskRole(["owner"]);
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const activeId = await resolveActivePropertyId(admin);
    await assertDeskProperty(activeId, propertyId, "Property");

    const phrase = String(formData.get("confirm_phrase") ?? "").trim();
    if (phrase !== WIPE_CONFIRM_PHRASE) {
      throw new Error(`Type ${WIPE_CONFIRM_PHRASE} exactly to confirm.`);
    }

    const flags = {
      p_wipe_rooms: formFlag(formData, "wipe_rooms"),
      p_wipe_staff: formFlag(formData, "wipe_staff"),
      p_wipe_menu: formFlag(formData, "wipe_menu"),
      p_wipe_agents: formFlag(formData, "wipe_agents"),
      p_wipe_rates: formFlag(formData, "wipe_rates"),
      p_wipe_rota: formFlag(formData, "wipe_rota"),
      p_wipe_attendance: formFlag(formData, "wipe_attendance"),
      p_wipe_leave: formFlag(formData, "wipe_leave"),
    };

    const { data, error } = await admin.rpc("wipe_property_operational_data", {
      p_property_id: propertyId,
      ...flags,
    });
    if (error) throw new Error(error.message);

    const selected = Object.entries(flags)
      .filter(([, on]) => on)
      .map(([k]) => k.replace("p_wipe_", ""));

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.operational_wipe",
      entityType: "properties",
      entityId: propertyId,
      summary:
        selected.length > 0
          ? `Owner wiped operational data + master: ${selected.join(", ")}`
          : "Owner wiped operational data (bookings, folios, orders, laundry, inventory ops)",
      meta: { counts: data ?? {}, flags },
      actor: "owner",
    });

    revalidatePath("/erp");
    revalidatePath("/erp/settings");
    revalidatePath("/erp/calendar");
    revalidatePath("/erp/arrivals");
    revalidatePath("/erp/reservations");
    revalidatePath("/erp/folios");
    revalidatePath("/erp/inventory");
    revalidatePath("/erp/rooms");
    revalidatePath("/erp/staff");
    revalidatePath("/erp/menu");
    revalidatePath("/erp/agents");
    revalidatePath("/erp/rates");
    revalidatePath("/erp/hr");
    revalidatePath("/erp/rota");
    revalidatePath("/erp/attendance");
    revalidatePath("/erp/leave");

    const bookings =
      typeof data === "object" && data && "bookings" in data
        ? Number((data as Record<string, unknown>).bookings)
        : null;

    const masterNote =
      selected.length > 0
        ? ` Also wiped: ${selected.join(", ")}.`
        : " Master data (rooms, rates, staff, menu…) kept unless checked.";

    return {
      ok: true,
      message:
        bookings != null
          ? `Wipe complete — ${bookings} booking(s) removed.${masterNote}`
          : `Wipe complete.${masterNote}`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Wipe failed.",
    };
  }
}
