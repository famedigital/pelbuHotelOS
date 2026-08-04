/** Named catalogue templates — layout only; content comes from CMS / ops data. */

export const CATALOGUE_TEMPLATE_CODES = [
  "flagship_stay",
  "fnb_taste",
  "agent_trade",
] as const;

export type CatalogueTemplateCode = (typeof CATALOGUE_TEMPLATE_CODES)[number];

export type CatalogueSectionType =
  | "cover"
  | "gallery"
  | "rooms"
  | "fnb"
  | "spa"
  | "meeting"
  | "rates"
  | "contact"
  | "custom";

export type CatalogueSectionDraft = {
  type: CatalogueSectionType;
  enabled: boolean;
  sort_order: number;
  title?: string | null;
  caption?: string | null;
  item_ids?: string[];
  image_public_id?: string | null;
};

export type CatalogueTemplateMeta = {
  code: CatalogueTemplateCode;
  name: string;
  blurb: string;
  defaultSections: CatalogueSectionDraft[];
  defaultAudience: "public" | "agents" | "media_press";
  socialEmphasis: "stay" | "fnb" | "trade";
};

const flagshipSections: CatalogueSectionDraft[] = [
  { type: "cover", enabled: true, sort_order: 10 },
  { type: "gallery", enabled: true, sort_order: 20 },
  { type: "rooms", enabled: true, sort_order: 30 },
  { type: "fnb", enabled: true, sort_order: 40 },
  { type: "spa", enabled: true, sort_order: 50 },
  { type: "rates", enabled: false, sort_order: 60 },
  { type: "contact", enabled: true, sort_order: 70 },
];

const fnbSections: CatalogueSectionDraft[] = [
  { type: "cover", enabled: true, sort_order: 10 },
  { type: "fnb", enabled: true, sort_order: 20 },
  { type: "gallery", enabled: true, sort_order: 30 },
  { type: "rooms", enabled: false, sort_order: 40 },
  { type: "contact", enabled: true, sort_order: 50 },
];

const agentSections: CatalogueSectionDraft[] = [
  { type: "cover", enabled: true, sort_order: 10 },
  { type: "rooms", enabled: true, sort_order: 20 },
  { type: "fnb", enabled: true, sort_order: 30 },
  { type: "meeting", enabled: true, sort_order: 40 },
  { type: "rates", enabled: true, sort_order: 50 },
  { type: "contact", enabled: true, sort_order: 60 },
];

export const CATALOGUE_TEMPLATES: Record<
  CatalogueTemplateCode,
  CatalogueTemplateMeta
> = {
  flagship_stay: {
    code: "flagship_stay",
    name: "Flagship stay",
    blurb:
      "Full hotel brochure — rooms, dine, spa, contact. Best for IG/FB intro packs.",
    defaultSections: flagshipSections,
    defaultAudience: "public",
    socialEmphasis: "stay",
  },
  fnb_taste: {
    code: "fnb_taste",
    name: "F&B taste",
    blurb: "Food-forward catalogue for cafe / restaurant campaigns.",
    defaultSections: fnbSections,
    defaultAudience: "public",
    socialEmphasis: "fnb",
  },
  agent_trade: {
    code: "agent_trade",
    name: "Agent trade",
    blurb:
      "Trade-facing pack — room pitch + contact; no public agent rates dump.",
    defaultSections: agentSections,
    defaultAudience: "agents",
    socialEmphasis: "trade",
  },
};

export function isCatalogueTemplateCode(
  value: string,
): value is CatalogueTemplateCode {
  return (CATALOGUE_TEMPLATE_CODES as readonly string[]).includes(value);
}

export function getCatalogueTemplate(code: string): CatalogueTemplateMeta {
  if (isCatalogueTemplateCode(code)) return CATALOGUE_TEMPLATES[code];
  return CATALOGUE_TEMPLATES.flagship_stay;
}

export function listCatalogueTemplates(): CatalogueTemplateMeta[] {
  return CATALOGUE_TEMPLATE_CODES.map((c) => CATALOGUE_TEMPLATES[c]);
}

export const SOCIAL_CROP_PRESETS = [
  { key: "feed_square", label: "IG feed square", width: 1080, height: 1080 },
  {
    key: "feed_portrait",
    label: "IG feed portrait",
    width: 1080,
    height: 1350,
  },
  { key: "story", label: "Story / Reels cover", width: 1080, height: 1920 },
  { key: "fb_link", label: "Facebook link cover", width: 1200, height: 630 },
] as const;

export type SocialCropKey = (typeof SOCIAL_CROP_PRESETS)[number]["key"];
