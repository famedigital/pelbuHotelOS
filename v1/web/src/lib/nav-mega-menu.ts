import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";
import {
  EMPTY_MEGA_MENU_MEDIA,
  megaMenuMediaToJson,
  parseMegaMenuMedia,
  type MegaMenuMediaOverrides,
} from "@/lib/mega-menu";

export const MEGA_MENU_MEDIA_KEY = "nav.mega_menu";

/** Published mega-menu image overrides for the public property. */
export async function loadMegaMenuMedia(): Promise<MegaMenuMediaOverrides> {
  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return EMPTY_MEGA_MENU_MEDIA;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("cms_site_settings")
    .select("content")
    .eq("property_id", propertyId)
    .eq("key", MEGA_MENU_MEDIA_KEY)
    .maybeSingle();
  if (!data?.content) return EMPTY_MEGA_MENU_MEDIA;
  return parseMegaMenuMedia(data.content);
}

export type MegaMenuMediaAdmin = {
  id: string;
  revision: number;
  published: MegaMenuMediaOverrides;
  draft: MegaMenuMediaOverrides;
  has_unpublished_changes: boolean;
};

/** Desk: published + draft for mega menu media. Creates row if missing. */
export async function loadMegaMenuMediaAdmin(
  propertyId: string,
): Promise<MegaMenuMediaAdmin | null> {
  const admin = createSupabaseAdminClient();
  const emptyJson = megaMenuMediaToJson(EMPTY_MEGA_MENU_MEDIA);

  const { data: setting } = await admin
    .from("cms_site_settings")
    .select("id, revision, content")
    .eq("property_id", propertyId)
    .eq("key", MEGA_MENU_MEDIA_KEY)
    .maybeSingle();

  if (!setting) {
    const { data: inserted, error } = await admin
      .from("cms_site_settings")
      .insert({
        property_id: propertyId,
        key: MEGA_MENU_MEDIA_KEY,
        content: emptyJson,
      })
      .select("id, revision, content")
      .single();
    if (error || !inserted) return null;
    await admin.from("cms_site_setting_drafts").upsert({
      setting_id: inserted.id,
      property_id: propertyId,
      content: emptyJson,
      base_revision: inserted.revision,
    });
    const published = parseMegaMenuMedia(inserted.content);
    return {
      id: inserted.id as string,
      revision: Number(inserted.revision),
      published,
      draft: published,
      has_unpublished_changes: false,
    };
  }

  const { data: draftRow } = await admin
    .from("cms_site_setting_drafts")
    .select("content")
    .eq("setting_id", setting.id)
    .maybeSingle();

  const published = parseMegaMenuMedia(setting.content);
  const draft = draftRow?.content
    ? parseMegaMenuMedia(draftRow.content)
    : published;
  const hasDraft =
    Boolean(draftRow) &&
    JSON.stringify(megaMenuMediaToJson(draft)) !==
      JSON.stringify(megaMenuMediaToJson(published));

  return {
    id: setting.id as string,
    revision: Number(setting.revision),
    published,
    draft,
    has_unpublished_changes: hasDraft,
  };
}
