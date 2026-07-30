"use server";

import { writeAuditEvent } from "@/lib/audit";
import { CMS_MEDIA_KINDS, type CmsMediaKind } from "@/lib/cms-media-admin";
import { publicPathForSlug } from "@/lib/cms-routes";
import type { CloudinaryResourceType } from "@/lib/cloudinary";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type CmsMediaState = {
  ok: boolean;
  message?: string;
  error?: string;
};

const EMPTY_STATE: CmsMediaState = { ok: false };

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function parseKind(value: FormDataEntryValue | null): CmsMediaKind {
  const raw = String(value ?? "gallery").trim();
  if (!CMS_MEDIA_KINDS.includes(raw as CmsMediaKind)) {
    throw new Error("Media role must be hero, gallery, or thumb.");
  }
  return raw as CmsMediaKind;
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

function revalidateForSlug(slug: string) {
  revalidatePath(publicPathForSlug(slug));
  revalidatePath("/erp/front-public/media");
  revalidatePath("/erp/front-public/media/upload");
  revalidatePath("/erp/front-public");
}

async function context() {
  await requireDesk();
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  return { admin, propertyId };
}

export async function addCmsMedia(
  _previous: CmsMediaState = EMPTY_STATE,
  formData: FormData,
): Promise<CmsMediaState> {
  void _previous;
  try {
    const { admin, propertyId } = await context();
    const pageSlug = trimRequired(formData.get("page_slug"), "Page");
    const publicId = trimRequired(
      formData.get("public_id"),
      "Cloudinary public ID",
    );
    if (publicId.length > 300) {
      throw new Error("Cloudinary public ID is too long.");
    }
    const alt = optionalTrim(formData.get("alt"))?.slice(0, 200) ?? "";
    const kind = parseKind(formData.get("kind"));
    const resourceType = parseResourceType(formData.get("resource_type"));
    const posterPublicId =
      optionalTrim(formData.get("poster_public_id"))?.slice(0, 300) ?? null;
    const durationSec = optionalNumber(formData.get("duration_sec"));
    const bytes = optionalNumber(formData.get("bytes"));
    const width = optionalNumber(formData.get("width"));
    const height = optionalNumber(formData.get("height"));
    const format = optionalTrim(formData.get("format"))?.slice(0, 40) ?? null;

    const { data: last } = await admin
      .from("cms_media")
      .select("sort_order")
      .eq("property_id", propertyId)
      .eq("page_slug", pageSlug)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await admin.from("cms_media").insert({
      property_id: propertyId,
      page_slug: pageSlug,
      public_id: publicId,
      alt,
      kind,
      resource_type: resourceType,
      poster_public_id: posterPublicId,
      duration_sec: durationSec,
      bytes,
      width,
      height,
      format,
      sort_order: Number(last?.sort_order ?? 0) + 10,
      is_published: true,
    });
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "cms.media.add",
      entityType: "cms_media",
      summary: `Added ${kind} ${resourceType} to ${pageSlug}`,
      meta: { pageSlug, publicId, kind, resourceType },
    });
    revalidateForSlug(pageSlug);
    return {
      ok: true,
      message: `${resourceType === "video" ? "Video" : "Image"} added to ${pageSlug}.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not add media.",
    };
  }
}

export async function updateCmsMedia(
  _previous: CmsMediaState = EMPTY_STATE,
  formData: FormData,
): Promise<CmsMediaState> {
  void _previous;
  try {
    const { admin, propertyId } = await context();
    const id = trimRequired(formData.get("media_id"), "Media");
    const alt = optionalTrim(formData.get("alt"))?.slice(0, 200) ?? "";
    const kind = parseKind(formData.get("kind"));
    const isPublished = formData.get("is_published") === "1";
    const posterPublicId =
      optionalTrim(formData.get("poster_public_id"))?.slice(0, 300) ?? null;

    const { data: updated, error } = await admin
      .from("cms_media")
      .update({
        alt,
        kind,
        is_published: isPublished,
        poster_public_id: posterPublicId,
      })
      .eq("id", id)
      .eq("property_id", propertyId)
      .select("page_slug")
      .maybeSingle();
    if (error || !updated) throw new Error("Media item was not found.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "cms.media.update",
      entityType: "cms_media",
      entityId: id,
      summary: `Updated media on ${updated.page_slug}`,
      meta: { alt, kind, isPublished },
    });
    revalidateForSlug(updated.page_slug as string);
    return { ok: true, message: "Media updated." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update media.",
    };
  }
}

export async function deleteCmsMedia(formData: FormData): Promise<void> {
  const { admin, propertyId } = await context();
  const id = trimRequired(formData.get("media_id"), "Media");
  const { data: removed, error } = await admin
    .from("cms_media")
    .delete()
    .eq("id", id)
    .eq("property_id", propertyId)
    .select("page_slug, public_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!removed) return;

  await writeAuditEvent(admin, {
    propertyId,
    action: "cms.media.delete",
    entityType: "cms_media",
    entityId: id,
    summary: `Removed media from ${removed.page_slug}`,
    meta: { publicId: removed.public_id },
  });
  revalidateForSlug(removed.page_slug as string);
}

/**
 * Swap sort_order with the neighbouring row. Ordering is per page slug, so the
 * swap partner is the closest row above or below within the same page.
 */
export async function moveCmsMedia(formData: FormData): Promise<void> {
  const { admin, propertyId } = await context();
  const id = trimRequired(formData.get("media_id"), "Media");
  const direction = String(formData.get("direction") ?? "up");
  if (direction !== "up" && direction !== "down") {
    throw new Error("Direction must be up or down.");
  }

  const { data: current, error } = await admin
    .from("cms_media")
    .select("id, page_slug, sort_order")
    .eq("id", id)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error || !current) throw new Error("Media item was not found.");

  const siblings = admin
    .from("cms_media")
    .select("id, sort_order")
    .eq("property_id", propertyId)
    .eq("page_slug", current.page_slug)
    .neq("id", id);

  const { data: neighbour } =
    direction === "up"
      ? await siblings
          .lt("sort_order", current.sort_order)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle()
      : await siblings
          .gt("sort_order", current.sort_order)
          .order("sort_order", { ascending: true })
          .limit(1)
          .maybeSingle();
  if (!neighbour) return;

  await admin
    .from("cms_media")
    .update({ sort_order: Number(neighbour.sort_order) })
    .eq("id", current.id);
  await admin
    .from("cms_media")
    .update({ sort_order: Number(current.sort_order) })
    .eq("id", neighbour.id);

  revalidateForSlug(current.page_slug as string);
}
