"use server";

import type { PropertyWizardState } from "@/app/actions/erp-properties";
import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  defaultDocumentDesign,
  mapDocumentDesign,
  percentToRate,
} from "@/lib/property-settings";
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

function formatUnitLabel(code: string, n: number): string {
  return `${code.toUpperCase()}-${String(n).padStart(2, "0")}`;
}

async function syncRoomUnits(
  admin: Admin,
  propertyId: string,
  roomTypeId: string,
  code: string,
  unitCount: number,
) {
  const safeCount = Math.max(0, unitCount);
  const { data: units, error } = await admin
    .from("room_units")
    .select("id, label, created_at")
    .eq("property_id", propertyId)
    .eq("room_type_id", roomTypeId)
    .order("created_at", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw new Error(error.message);

  const existing = (units ?? []) as {
    id: string;
    label: string;
    created_at: string;
  }[];
  const existingLabels = new Set(existing.map((unit) => unit.label));

  if (existing.length < safeCount) {
    const inserts: Array<{
      property_id: string;
      room_type_id: string;
      label: string;
      hk_status: string;
      sort_order: number;
    }> = [];
    let next = 1;
    let sortBase = existing.length;
    while (existing.length + inserts.length < safeCount) {
      const label = formatUnitLabel(code, next);
      next += 1;
      if (existingLabels.has(label) || inserts.some((row) => row.label === label)) {
        continue;
      }
      sortBase += 1;
      inserts.push({
        property_id: propertyId,
        room_type_id: roomTypeId,
        label,
        hk_status: "clean",
        sort_order: sortBase,
      });
    }
    if (inserts.length) {
      const { error: insertError } = await admin.from("room_units").insert(inserts);
      if (insertError) throw new Error(insertError.message);
    }
  }

  if (existing.length > safeCount) {
    const surplus = existing.slice(safeCount).map((unit) => unit.id);
    if (surplus.length) {
      const { error: deleteError } = await admin
        .from("room_units")
        .delete()
        .in("id", surplus);
      if (deleteError) throw new Error(deleteError.message);
    }
  }
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
    return { ok: true, propertyId, message: "Identity saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save identity.",
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

export async function updatePropertyTaxSettings(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const gstRate = requirePercent(formData.get("gst_rate"), "GST rate");
    const serviceChargeRate = requirePercent(
      formData.get("service_charge_rate"),
      "Service charge",
    );
    const serviceChargeDefaultOn =
      formData.get("service_charge_default_on") === "1";

    const { error } = await admin
      .from("properties")
      .update({
        gst_rate: gstRate,
        service_charge_rate: serviceChargeRate,
        service_charge_default_on: serviceChargeDefaultOn,
      })
      .eq("id", propertyId);
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.settings.tax",
      entityType: "properties",
      entityId: propertyId,
      summary: "Updated GST and service charge defaults",
      meta: {
        gst_rate: gstRate,
        service_charge_rate: serviceChargeRate,
        service_charge_default_on: serviceChargeDefaultOn,
      },
    });

    revalidatePath("/erp/settings");
    revalidatePath("/erp/pos");
    return { ok: true, propertyId, message: "Tax defaults saved." };
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
    if (roomTypeId) {
      const { error } = await admin
        .from("room_types")
        .update({
          code,
          name,
          inventory_kind: inventoryKind,
          unit_count: unitCountRaw,
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
      meta: { code, inventory_kind: inventoryKind, unit_count: unitCountRaw },
    });

    revalidatePath("/erp/settings");
    revalidatePath("/erp/rooms");
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
    const notes = optionalTrim(formData.get("notes"));
    const sortRaw = optionalTrim(formData.get("sort_order"));
    const sortOrder = sortRaw ? Number(sortRaw) : NaN;
    const resolvedSort = Number.isFinite(sortOrder) ? Math.max(0, Math.floor(sortOrder)) : null;

    let previousRoomTypeId: string | null = null;

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
