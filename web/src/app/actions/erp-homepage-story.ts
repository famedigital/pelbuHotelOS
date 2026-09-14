"use server";

import { writeAuditEvent } from "@/lib/audit";
import {
  DEFAULT_FUNNEL,
  DEFAULT_HOMEPAGE_STORY,
  homepageStoryToJson,
  type FunnelModules,
  type HomepageStory,
  type StoryAccent,
  type StoryBlock,
} from "@/lib/home-story";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type HomepageStoryState = {
  ok: boolean;
  message?: string;
  error?: string;
};

const EMPTY: HomepageStoryState = { ok: false };

const ACCENTS: StoryAccent[] = ["sky", "citrus", "mint", "spa", "espresso"];

const STORY_KEYS = [
  "about",
  "rooms",
  "restaurant",
  "lunch",
  "cafe",
  "spa",
] as const satisfies ReadonlyArray<keyof HomepageStory>;

const FUNNEL_KEYS = [
  "trust",
  "proof",
  "why",
  "inHouse",
  "faq",
  "agents",
] as const satisfies ReadonlyArray<keyof FunnelModules>;

type StoryKey = (typeof STORY_KEYS)[number];

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function field(formData: FormData, key: string, section: string): string {
  return String(formData.get(`${section}.${key}`) ?? "").trim();
}

function parseBlock(
  formData: FormData,
  section: StoryKey,
  fallback: StoryBlock,
): StoryBlock {
  const accentRaw = field(formData, "accent", section);
  const accent = ACCENTS.includes(accentRaw as StoryAccent)
    ? (accentRaw as StoryAccent)
    : fallback.accent;

  const amountRaw = field(formData, "amount_btn", section);
  const amount =
    amountRaw === ""
      ? null
      : Number.isFinite(Number(amountRaw))
        ? Number(amountRaw)
        : fallback.amount_btn;

  // Empty string means “no extras” (user cleared the list), not fall back to defaults.
  const galleryRaw = field(formData, "gallery_public_ids", section);
  const gallery = galleryRaw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const fx = Number(field(formData, "focal_x", section) || fallback.focal_x);
  const fy = Number(field(formData, "focal_y", section) || fallback.focal_y);

  return {
    enabled: formData.get(`${section}.enabled`) === "1",
    eyebrow: field(formData, "eyebrow", section) || fallback.eyebrow,
    title: field(formData, "title", section) || fallback.title,
    body: field(formData, "body", section) || fallback.body,
    public_id: field(formData, "public_id", section) || null,
    gallery_public_ids: gallery,
    primary_href: field(formData, "primary_href", section) || fallback.primary_href,
    primary_label:
      field(formData, "primary_label", section) || fallback.primary_label,
    secondary_href: field(formData, "secondary_href", section) || null,
    secondary_label: field(formData, "secondary_label", section) || null,
    accent,
    amount_btn: amount,
    amount_note: field(formData, "amount_note", section) || null,
    focal_x: Number.isFinite(fx) ? Math.min(1, Math.max(0, fx)) : 0.5,
    focal_y: Number.isFinite(fy) ? Math.min(1, Math.max(0, fy)) : 0.5,
  };
}

function parseFunnelFromForm(formData: FormData): FunnelModules {
  const out = { ...DEFAULT_FUNNEL };
  for (const key of FUNNEL_KEYS) {
    out[key] = formData.get(`funnel.${key}`) === "1";
  }
  return out;
}

function storyFromForm(formData: FormData): HomepageStory {
  const base = DEFAULT_HOMEPAGE_STORY;
  const out = {
    funnel: parseFunnelFromForm(formData),
  } as HomepageStory;
  for (const key of STORY_KEYS) {
    out[key] = parseBlock(formData, key, base[key]);
  }
  return out;
}

async function ensureSetting(propertyId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("cms_site_settings")
    .select("id, revision")
    .eq("property_id", propertyId)
    .eq("key", "homepage.story")
    .maybeSingle();
  if (data) return data;

  const { data: inserted, error } = await admin
    .from("cms_site_settings")
    .insert({
      property_id: propertyId,
      key: "homepage.story",
      content: homepageStoryToJson(DEFAULT_HOMEPAGE_STORY),
    })
    .select("id, revision")
    .single();
  if (error || !inserted) throw new Error(error?.message ?? "Could not create story.");
  await admin.from("cms_site_setting_drafts").upsert({
    setting_id: inserted.id,
    property_id: propertyId,
    content: homepageStoryToJson(DEFAULT_HOMEPAGE_STORY),
    base_revision: inserted.revision,
  });
  return inserted;
}

export async function saveHomepageStoryDraft(
  _prev: HomepageStoryState = EMPTY,
  formData: FormData,
): Promise<HomepageStoryState> {
  void _prev;
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const setting = await ensureSetting(propertyId);
    const story = storyFromForm(formData);
    const content = homepageStoryToJson(story);

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
      action: "cms.homepage_story.draft",
      entityType: "cms_site_settings",
      entityId: setting.id as string,
      summary: "Saved homepage story draft",
    });

    revalidatePath("/erp/front-public/homepage");
    return { ok: true, message: "Draft saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save draft.",
    };
  }
}

export async function publishHomepageStory(
  _prev: HomepageStoryState = EMPTY,
  formData: FormData,
): Promise<HomepageStoryState> {
  void _prev;
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const setting = await ensureSetting(propertyId);

    // Prefer form so funnel checkboxes + story blocks publish together.
    const story = storyFromForm(formData);
    const content = homepageStoryToJson(story);
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
      action: "cms.homepage_story.publish",
      entityType: "cms_site_settings",
      entityId: setting.id as string,
      summary: "Published homepage story",
    });

    revalidatePath("/");
    revalidatePath("/erp/front-public/homepage");
    revalidatePath("/erp/front-public");
    return { ok: true, message: "Homepage story is live." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not publish.",
    };
  }
}
