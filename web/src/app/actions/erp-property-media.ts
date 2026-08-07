"use server";

import { writeAuditEvent } from "@/lib/audit";
import type { CloudinaryResourceType } from "@/lib/cloudinary";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  facetsForScope,
  PROPERTY_MEDIA_SCOPES,
  type PropertyMediaScope,
} from "@/lib/property-media";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type PropertyMediaState = {
  ok: boolean;
  message?: string;
  error?: string;
};

const EMPTY: PropertyMediaState = { ok: false };

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

async function context() {
  await requireDesk();
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  return { admin, propertyId };
}

function parseScope(value: FormDataEntryValue | null): PropertyMediaScope {
  const raw = String(value ?? "").trim();
  if (!PROPERTY_MEDIA_SCOPES.includes(raw as PropertyMediaScope)) {
    throw new Error("Invalid media scope.");
  }
  return raw as PropertyMediaScope;
}

function parseResourceType(
  value: FormDataEntryValue | null,
): CloudinaryResourceType {
  return String(value ?? "image").trim() === "video" ? "video" : "image";
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function revalidateTrustPaths() {
  revalidatePath("/erp/front-public/media");
  revalidatePath("/erp/front-public");
  revalidatePath("/erp/rooms/layout");
  revalidatePath("/erp/rooms");
  revalidatePath("/rooms");
  revalidatePath("/gallery");
  revalidatePath("/contact");
  revalidatePath("/menu");
  revalidatePath("/cafe");
  revalidatePath("/restaurant");
  revalidatePath("/bar");
}

function assertFacet(scope: PropertyMediaScope, facet: string) {
  const allowed = facetsForScope(scope);
  if (!allowed.includes(facet)) {
    throw new Error(`Facet “${facet}” is not valid for ${scope}.`);
  }
}

export async function addPropertyMedia(
  _previous: PropertyMediaState = EMPTY,
  formData: FormData,
): Promise<PropertyMediaState> {
  void _previous;
  try {
    const { admin, propertyId } = await context();
    const scope = parseScope(formData.get("scope"));
    const facet = trimRequired(formData.get("facet"), "Shot type");
    assertFacet(scope, facet);

    let scopeId: string | null = optionalTrim(formData.get("scope_id"));
    if (scope === "property_area") {
      scopeId = null;
    } else if (!scopeId) {
      throw new Error("Select a room, staff member, or menu item.");
    }

    const publicId = trimRequired(
      formData.get("public_id"),
      "Cloudinary public ID",
    );
    if (publicId.length > 300) {
      throw new Error("Cloudinary public ID is too long.");
    }

    const resourceType = parseResourceType(formData.get("resource_type"));
    const alt = optionalTrim(formData.get("alt"))?.slice(0, 200) ?? "";
    const caption = optionalTrim(formData.get("caption"))?.slice(0, 400) ?? null;
    const isPrimary = String(formData.get("is_primary") ?? "") === "on";
    const isPublished = String(formData.get("is_published") ?? "") === "on";

    let q = admin
      .from("property_media")
      .select("sort_order")
      .eq("property_id", propertyId)
      .eq("scope", scope)
      .eq("facet", facet)
      .order("sort_order", { ascending: false })
      .limit(1);
    q =
      scopeId === null
        ? q.is("scope_id", null)
        : q.eq("scope_id", scopeId);

    const { data: last } = await q.maybeSingle();

    if (isPrimary) {
      let clear = admin
        .from("property_media")
        .update({ is_primary: false })
        .eq("property_id", propertyId)
        .eq("scope", scope);
      clear =
        scopeId === null
          ? clear.is("scope_id", null)
          : clear.eq("scope_id", scopeId);
      await clear;
    }

    const { data: inserted, error } = await admin
      .from("property_media")
      .insert({
        property_id: propertyId,
        scope,
        scope_id: scopeId,
        facet,
        public_id: publicId,
        resource_type: resourceType,
        poster_public_id:
          optionalTrim(formData.get("poster_public_id"))?.slice(0, 300) ?? null,
        duration_sec: optionalNumber(formData.get("duration_sec")),
        bytes: optionalNumber(formData.get("bytes")),
        width: optionalNumber(formData.get("width")),
        height: optionalNumber(formData.get("height")),
        format: optionalTrim(formData.get("format"))?.slice(0, 40) ?? null,
        alt,
        caption,
        sort_order: Number(last?.sort_order ?? 0) + 10,
        is_primary: isPrimary,
        is_published: isPublished,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Sync primary image onto room_types for list cards.
    if (
      scope === "room_type" &&
      scopeId &&
      (isPrimary || facet === "overview")
    ) {
      await admin
        .from("room_types")
        .update({ image_public_id: publicId })
        .eq("id", scopeId)
        .eq("property_id", propertyId);
    }

    // Food: first/primary image can set menu_items.image_public_id
    if (scope === "menu_item" && scopeId && isPrimary) {
      await admin
        .from("menu_items")
        .update({ image_public_id: publicId })
        .eq("id", scopeId)
        .eq("property_id", propertyId);
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "property_media.add",
      entityType: "property_media",
      entityId: inserted?.id ?? null,
      summary: `Trust media: ${scope}/${facet}`,
      meta: { scope, scopeId, facet, publicId, resourceType },
    });

    revalidateTrustPaths();
    return { ok: true, message: "Photo saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save media.",
    };
  }
}

export async function updatePropertyMedia(
  _previous: PropertyMediaState = EMPTY,
  formData: FormData,
): Promise<PropertyMediaState> {
  void _previous;
  try {
    const { admin, propertyId } = await context();
    const id = trimRequired(formData.get("id"), "Media");
    const alt = optionalTrim(formData.get("alt"))?.slice(0, 200) ?? "";
    const caption = optionalTrim(formData.get("caption"))?.slice(0, 400) ?? null;
    const isPublished = String(formData.get("is_published") ?? "") === "on";
    const isPrimary = String(formData.get("is_primary") ?? "") === "on";

    const { data: existing } = await admin
      .from("property_media")
      .select("id, scope, scope_id, public_id, facet")
      .eq("id", id)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!existing) throw new Error("Media not found.");

    if (isPrimary) {
      let clear = admin
        .from("property_media")
        .update({ is_primary: false })
        .eq("property_id", propertyId)
        .eq("scope", existing.scope as string);
      const scopeId = existing.scope_id as string | null;
      clear =
        scopeId == null
          ? clear.is("scope_id", null)
          : clear.eq("scope_id", scopeId);
      await clear;
    }

    const { error } = await admin
      .from("property_media")
      .update({
        alt,
        caption,
        is_published: isPublished,
        is_primary: isPrimary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    if (
      isPrimary &&
      existing.scope === "room_type" &&
      existing.scope_id
    ) {
      await admin
        .from("room_types")
        .update({ image_public_id: existing.public_id as string })
        .eq("id", existing.scope_id as string)
        .eq("property_id", propertyId);
    }

    revalidateTrustPaths();
    return { ok: true, message: "Updated." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not update.",
    };
  }
}

export async function replacePropertyMediaAsset(
  _previous: PropertyMediaState = EMPTY,
  formData: FormData,
): Promise<PropertyMediaState> {
  void _previous;
  try {
    const { admin, propertyId } = await context();
    const id = trimRequired(formData.get("id"), "Media");
    const publicId = trimRequired(
      formData.get("public_id"),
      "Cloudinary public ID",
    );
    const resourceType = parseResourceType(formData.get("resource_type"));

    const { data: existing } = await admin
      .from("property_media")
      .select("id, scope, scope_id, is_primary, facet")
      .eq("id", id)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!existing) throw new Error("Media not found.");

    const { error } = await admin
      .from("property_media")
      .update({
        public_id: publicId,
        resource_type: resourceType,
        poster_public_id:
          optionalTrim(formData.get("poster_public_id"))?.slice(0, 300) ?? null,
        duration_sec: optionalNumber(formData.get("duration_sec")),
        bytes: optionalNumber(formData.get("bytes")),
        width: optionalNumber(formData.get("width")),
        height: optionalNumber(formData.get("height")),
        format: optionalTrim(formData.get("format"))?.slice(0, 40) ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    if (
      existing.is_primary &&
      existing.scope === "room_type" &&
      existing.scope_id
    ) {
      await admin
        .from("room_types")
        .update({ image_public_id: publicId })
        .eq("id", existing.scope_id as string)
        .eq("property_id", propertyId);
    }

    revalidateTrustPaths();
    return { ok: true, message: "Asset replaced." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not replace asset.",
    };
  }
}

export async function movePropertyMedia(
  _previous: PropertyMediaState = EMPTY,
  formData: FormData,
): Promise<PropertyMediaState> {
  void _previous;
  try {
    const { admin, propertyId } = await context();
    const id = trimRequired(formData.get("id"), "Media");
    const direction = String(formData.get("direction") ?? "up");

    const { data: row } = await admin
      .from("property_media")
      .select("id, scope, scope_id, facet, sort_order")
      .eq("id", id)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!row) throw new Error("Media not found.");

    let listQ = admin
      .from("property_media")
      .select("id, sort_order")
      .eq("property_id", propertyId)
      .eq("scope", row.scope as string)
      .eq("facet", row.facet as string)
      .order("sort_order", { ascending: true });
    const scopeId = row.scope_id as string | null;
    listQ =
      scopeId == null
        ? listQ.is("scope_id", null)
        : listQ.eq("scope_id", scopeId);

    const { data: siblings } = await listQ;
    const list = siblings ?? [];
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) throw new Error("Media not found in list.");
    const swapWith = direction === "down" ? idx + 1 : idx - 1;
    if (swapWith < 0 || swapWith >= list.length) {
      return { ok: true, message: "Already at edge." };
    }
    const a = list[idx];
    const b = list[swapWith];
    await admin
      .from("property_media")
      .update({ sort_order: b.sort_order })
      .eq("id", a.id);
    await admin
      .from("property_media")
      .update({ sort_order: a.sort_order })
      .eq("id", b.id);

    revalidateTrustPaths();
    return { ok: true, message: "Reordered." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not reorder.",
    };
  }
}

export async function deletePropertyMedia(
  _previous: PropertyMediaState = EMPTY,
  formData: FormData,
): Promise<PropertyMediaState> {
  void _previous;
  try {
    const { admin, propertyId } = await context();
    const id = trimRequired(formData.get("id"), "Media");
    const { error } = await admin
      .from("property_media")
      .delete()
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);
    await writeAuditEvent(admin, {
      propertyId,
      action: "property_media.delete",
      entityType: "property_media",
      entityId: id,
      summary: "Deleted trust media",
    });
    revalidateTrustPaths();
    return { ok: true, message: "Deleted." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not delete.",
    };
  }
}

export async function updateStaffTeamVisibility(
  _previous: PropertyMediaState = EMPTY,
  formData: FormData,
): Promise<PropertyMediaState> {
  void _previous;
  try {
    const { admin, propertyId } = await context();
    const id = trimRequired(formData.get("staff_id"), "Staff");
    const showOnTeam = String(formData.get("show_on_team") ?? "") === "on";
    const teamRoleLabel =
      optionalTrim(formData.get("team_role_label"))?.slice(0, 80) ?? null;
    const teamSortOrder = optionalNumber(formData.get("team_sort_order")) ?? 0;

    const { error } = await admin
      .from("staff_members")
      .update({
        show_on_team: showOnTeam,
        team_role_label: teamRoleLabel,
        team_sort_order: teamSortOrder,
      })
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    revalidatePath("/contact");
    revalidatePath("/erp/front-public/media");
    return { ok: true, message: "Team visibility saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not update staff.",
    };
  }
}
