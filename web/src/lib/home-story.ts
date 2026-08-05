import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";
import { OUTLET_SHOWCASE_PHOTOS } from "@/lib/brand";

export type StoryAccent = "sky" | "citrus" | "mint" | "spa" | "espresso";

export type StoryBlock = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  body: string;
  public_id: string | null;
  gallery_public_ids: string[];
  primary_href: string;
  primary_label: string;
  secondary_href: string | null;
  secondary_label: string | null;
  accent: StoryAccent;
  amount_btn: number | null;
  amount_note: string | null;
  focal_x: number;
  focal_y: number;
};

export type HomepageStory = {
  about: StoryBlock;
  rooms: StoryBlock;
  restaurant: StoryBlock;
  lunch: StoryBlock;
  cafe: StoryBlock;
  spa: StoryBlock;
};

const ACCENTS: StoryAccent[] = ["sky", "citrus", "mint", "spa", "espresso"];

function accentOf(value: unknown, fallback: StoryAccent): StoryAccent {
  return ACCENTS.includes(value as StoryAccent)
    ? (value as StoryAccent)
    : fallback;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback: number | null): number | null {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function focal(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
}

function block(
  raw: unknown,
  defaults: StoryBlock,
): StoryBlock {
  const r =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : defaults.enabled,
    eyebrow: str(r.eyebrow, defaults.eyebrow),
    title: str(r.title, defaults.title),
    body: str(r.body, defaults.body),
    public_id: str(r.public_id, defaults.public_id ?? "") || null,
    gallery_public_ids:
      strings(r.gallery_public_ids).length > 0
        ? strings(r.gallery_public_ids)
        : defaults.gallery_public_ids,
    primary_href: str(r.primary_href, defaults.primary_href),
    primary_label: str(r.primary_label, defaults.primary_label),
    secondary_href: str(r.secondary_href, defaults.secondary_href ?? "") || null,
    secondary_label:
      str(r.secondary_label, defaults.secondary_label ?? "") || null,
    accent: accentOf(r.accent, defaults.accent),
    amount_btn: num(r.amount_btn, defaults.amount_btn),
    amount_note: str(r.amount_note, defaults.amount_note ?? "") || null,
    focal_x: focal(r.focal_x, defaults.focal_x),
    focal_y: focal(r.focal_y, defaults.focal_y),
  };
}

export const DEFAULT_HOMEPAGE_STORY: HomepageStory = {
  about: {
    enabled: true,
    eyebrow: "The name",
    title: "Pelbu — one of the eight lucky signs",
    body: "Pelbu is one of Bhutan's eight auspicious symbols (lucky signs). We rebranded from Seven Suites to Pelbu Suites so the hotel carries that blessing into every stay in Olakha — new management, same welcome.",
    public_id: "pelbu/hotel/exterior",
    gallery_public_ids: [],
    primary_href: "/contact",
    primary_label: "About & contact",
    secondary_href: "/rooms",
    secondary_label: "Check rooms",
    accent: "citrus",
    amount_btn: null,
    amount_note: null,
    focal_x: 0.5,
    focal_y: 0.45,
  },
  rooms: {
    enabled: true,
    eyebrow: "Rooms",
    title: "Suites built for the Thimphu road",
    body: "Quiet rooms in Olakha with live availability and direct rack rates. Guide and driver beds are complimentary on agent groups.",
    public_id: "pelbu/rooms/deluxe",
    gallery_public_ids: [],
    primary_href: "/rooms",
    primary_label: "All rooms",
    secondary_href: "/book",
    secondary_label: "Book dates",
    accent: "sky",
    amount_btn: null,
    amount_note: null,
    focal_x: 0.5,
    focal_y: 0.5,
  },
  restaurant: {
    enabled: true,
    eyebrow: "In-house restaurant",
    title: "Kitchen led by two seasoned chefs",
    body: "Chief chef Jigme Chaeda — 15 years as a chef — alongside a seasoned Indian chef. Indian, Bhutanese and multicuisine for regional and international guests. The dining room seats up to 50.",
    public_id: "pelbu/restaurant/uuy1ycprinlbhm7lvkli",
    gallery_public_ids: OUTLET_SHOWCASE_PHOTOS.restaurant.map((p) => p.publicId),
    primary_href: "/restaurant",
    primary_label: "Restaurant",
    secondary_href: "/menu?outlet=restaurant",
    secondary_label: "Full menu",
    accent: "espresso",
    amount_btn: null,
    amount_note: null,
    focal_x: 0.5,
    focal_y: 0.4,
  },
  lunch: {
    enabled: true,
    eyebrow: "Day visitors welcome",
    title: "Lunch package for tourists",
    body: "Perfect for tour groups even if they are not staying with us. Capacity up to 50 guests — please schedule in advance.",
    public_id: "pelbu/restaurant/dining-room",
    gallery_public_ids: [],
    primary_href: "/contact",
    primary_label: "Schedule lunch",
    secondary_href: "/restaurant",
    secondary_label: "Restaurant details",
    accent: "citrus",
    amount_btn: 400,
    amount_note: "Inclusive of taxes · lunch package",
    focal_x: 0.5,
    focal_y: 0.5,
  },
  cafe: {
    enabled: true,
    eyebrow: "New on property",
    title: "PELBU ZONE",
    body: "Our all-day café — where Thimphu mornings meet Filipino-inspired flavours, craft coffee, and oven-fresh pastry. Perfect pit-stop for guests, guides, and friends of the house.",
    public_id: "pelbu/cafe/v7d8ba1cszstrkfosyax",
    gallery_public_ids: OUTLET_SHOWCASE_PHOTOS.cafe.map((p) => p.publicId),
    primary_href: "/cafe",
    primary_label: "Cafe",
    secondary_href: "/menu",
    secondary_label: "Order online",
    accent: "mint",
    amount_btn: null,
    amount_note: null,
    focal_x: 0.5,
    focal_y: 0.45,
  },
  spa: {
    enabled: true,
    eyebrow: "Wellness on site",
    title: "Spa & Steam",
    body: "Unwind after a day of sightseeing with a warming steam experience. The jacuzzi is exclusive to our one Suite room only — not available with Double or Twin.",
    public_id: "pelbu/marketing/agent-email-steam",
    gallery_public_ids: ["pelbu/spa/steam", "pelbu/spa/jacuzzi"],
    primary_href: "/spa",
    primary_label: "Spa & steam",
    secondary_href: "/rooms",
    secondary_label: "Suite room",
    accent: "spa",
    amount_btn: null,
    amount_note: null,
    focal_x: 0.5,
    focal_y: 0.4,
  },
};

export function parseHomepageStory(raw: unknown): HomepageStory {
  const r =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    about: block(r.about, DEFAULT_HOMEPAGE_STORY.about),
    rooms: block(r.rooms, DEFAULT_HOMEPAGE_STORY.rooms),
    restaurant: block(r.restaurant, DEFAULT_HOMEPAGE_STORY.restaurant),
    lunch: block(r.lunch, DEFAULT_HOMEPAGE_STORY.lunch),
    cafe: block(r.cafe, DEFAULT_HOMEPAGE_STORY.cafe),
    spa: block(r.spa, DEFAULT_HOMEPAGE_STORY.spa),
  };
}

export function storyBlockToRecord(block: StoryBlock): Record<string, unknown> {
  return {
    enabled: block.enabled,
    eyebrow: block.eyebrow,
    title: block.title,
    body: block.body,
    public_id: block.public_id,
    gallery_public_ids: block.gallery_public_ids,
    primary_href: block.primary_href,
    primary_label: block.primary_label,
    secondary_href: block.secondary_href,
    secondary_label: block.secondary_label,
    accent: block.accent,
    amount_btn: block.amount_btn,
    amount_note: block.amount_note,
    focal_x: block.focal_x,
    focal_y: block.focal_y,
  };
}

export function homepageStoryToJson(story: HomepageStory): Record<string, unknown> {
  return {
    about: storyBlockToRecord(story.about),
    rooms: storyBlockToRecord(story.rooms),
    restaurant: storyBlockToRecord(story.restaurant),
    lunch: storyBlockToRecord(story.lunch),
    cafe: storyBlockToRecord(story.cafe),
    spa: storyBlockToRecord(story.spa),
  };
}

/** Load published homepage.story for the public property. */
export async function loadHomepageStory(): Promise<HomepageStory> {
  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return DEFAULT_HOMEPAGE_STORY;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("cms_site_settings")
    .select("content")
    .eq("property_id", propertyId)
    .eq("key", "homepage.story")
    .maybeSingle();
  if (!data?.content) return DEFAULT_HOMEPAGE_STORY;
  return parseHomepageStory(data.content);
}

export type HomepageStoryAdmin = {
  id: string;
  revision: number;
  published: HomepageStory;
  draft: HomepageStory;
  has_unpublished_changes: boolean;
};

/** Desk load of homepage.story with draft. */
export async function loadHomepageStoryAdmin(
  propertyId: string,
): Promise<HomepageStoryAdmin | null> {
  const admin = createSupabaseAdminClient();
  const { data: setting } = await admin
    .from("cms_site_settings")
    .select("id, revision, content")
    .eq("property_id", propertyId)
    .eq("key", "homepage.story")
    .maybeSingle();

  if (!setting) {
    // Ensure row exists for first-time desk edit.
    const { data: inserted, error } = await admin
      .from("cms_site_settings")
      .insert({
        property_id: propertyId,
        key: "homepage.story",
        content: homepageStoryToJson(DEFAULT_HOMEPAGE_STORY),
      })
      .select("id, revision, content")
      .single();
    if (error || !inserted) return null;
    await admin.from("cms_site_setting_drafts").upsert({
      setting_id: inserted.id,
      property_id: propertyId,
      content: homepageStoryToJson(DEFAULT_HOMEPAGE_STORY),
      base_revision: inserted.revision,
    });
    const published = parseHomepageStory(inserted.content);
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
    .select("content, base_revision")
    .eq("setting_id", setting.id)
    .maybeSingle();

  const published = parseHomepageStory(setting.content);
  const draft = draftRow?.content
    ? parseHomepageStory(draftRow.content)
    : published;
  const hasDraft =
    Boolean(draftRow) &&
    JSON.stringify(homepageStoryToJson(draft)) !==
      JSON.stringify(homepageStoryToJson(published));

  return {
    id: setting.id as string,
    revision: Number(setting.revision),
    published,
    draft,
    has_unpublished_changes: hasDraft,
  };
}
