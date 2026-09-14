"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  EMPTY_MEGA_MENU_MEDIA,
  megaMenuMediaToJson,
  type MegaMenuMediaOverrides,
} from "@/lib/mega-menu";
import { MEGA_MENU_MEDIA_KEY } from "@/lib/nav-mega-menu";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type MegaMenuMediaState = {
  ok: boolean;
  message?: string;
  error?: string;
};

const EMPTY: MegaMenuMediaState = { ok: false };

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function mediaFromForm(formData: FormData): MegaMenuMediaOverrides {
  const features: Record<string, string> = {};
  const items: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const id = value.trim();
    if (!id) continue;
    if (key.startsWith("feature::")) {
      features[key.slice("feature::".length)] = id;
    } else if (key.startsWith("item::")) {
      items[key.slice("item::".length)] = id;
    }
  }
  return { features, items };
}

async function ensureSetting(propertyId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("cms_site_settings")
    .select("id, revision")
    .eq("property_id", propertyId)
    .eq("key", MEGA_MENU_MEDIA_KEY)
    .maybeSingle();
  if (data) return data;

  const empty = megaMenuMediaToJson(EMPTY_MEGA_MENU_MEDIA);
  const { data: inserted, error } = await admin
    .from("cms_site_settings")
    .insert({
      property_id: propertyId,
      key: MEGA_MENU_MEDIA_KEY,
      content: empty,
    })
    .select("id, revision")
    .single();
  if (error || !inserted) {
    throw new Error(error?.message ?? "Could not create mega menu setting.");
  }
  await admin.from("cms_site_setting_drafts").upsert({
    setting_id: inserted.id,
    property_id: propertyId,
    content: empty,
    base_revision: inserted.revision,
  });
  return inserted;
}

function revalidatePublicNav() {
  revalidatePath("/", "layout");
  revalidatePath("/erp/front-public/navigation");
  revalidatePath("/erp/front-public");
}

export async function saveMegaMenuMediaDraft(
  _prev: MegaMenuMediaState = EMPTY,
  formData: FormData,
): Promise<MegaMenuMediaState> {
  void _prev;
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const setting = await ensureSetting(propertyId);
    const media = mediaFromForm(formData);
    const content = megaMenuMediaToJson(media);

    const { error } = await admin.from("cms_site_setting_drafts").upsert({
      setting_id: setting.id,
      property_id: propertyId,
      content,
      base_revision: setting.revision,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "cms.mega_menu.draft",
      entityType: "cms_site_settings",
      entityId: setting.id as string,
      summary: "Saved mega menu media draft",
    });

    revalidatePath("/erp/front-public/navigation");
    return { ok: true, message: "Draft saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save draft.",
    };
  }
}

export async function publishMegaMenuMedia(
  _prev: MegaMenuMediaState = EMPTY,
  formData: FormData,
): Promise<MegaMenuMediaState> {
  void _prev;
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const setting = await ensureSetting(propertyId);

    // Prefer live form payload so Publish works without a separate Save click.
    const media = mediaFromForm(formData);
    const content = megaMenuMediaToJson(media);
    const nextRevision = Number(setting.revision) + 1;

    const { error } = await admin
      .from("cms_site_settings")
      .update({
        content,
        revision: nextRevision,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", setting.id);
    if (error) throw new Error(error.message);

    await admin.from("cms_site_setting_drafts").upsert({
      setting_id: setting.id,
      property_id: propertyId,
      content,
      base_revision: nextRevision,
      updated_at: new Date().toISOString(),
    });

    await writeAuditEvent(admin, {
      propertyId,
      action: "cms.mega_menu.publish",
      entityType: "cms_site_settings",
      entityId: setting.id as string,
      summary: "Published mega menu media",
    });

    revalidatePublicNav();
    return { ok: true, message: "Mega menu images are live." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not publish.",
    };
  }
}
