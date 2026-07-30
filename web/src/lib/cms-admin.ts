import type { SupabaseClient } from "@supabase/supabase-js";
import type { CmsContentSection } from "@/lib/cms";

export type CmsPageDraftContent = {
  eyebrow: string;
  title: string;
  body: string;
  hours_note: string | null;
  primary_cta_href: string | null;
  primary_cta_label: string | null;
  secondary_cta_href: string | null;
  secondary_cta_label: string | null;
  seo_title: string | null;
  meta_description: string | null;
  canonical_path: string | null;
  og_public_id: string | null;
  summary: string | null;
  faq_json: Array<{ question: string; answer: string }>;
  sections_json: CmsContentSection[];
  author_name: string | null;
  source_note: string | null;
  last_verified_at: string | null;
  is_published: boolean;
};

export type CmsAdminPage = {
  id: string;
  property_id: string;
  slug: string;
  revision: number;
  published_at: string | null;
  updated_at: string;
  published: CmsPageDraftContent;
  draft: CmsPageDraftContent;
  has_unpublished_changes: boolean;
};

type CmsPageRow = {
  id: string;
  property_id: string;
  slug: string;
  eyebrow: string;
  title: string;
  body: string;
  hours_note: string | null;
  primary_cta_href: string | null;
  primary_cta_label: string | null;
  secondary_cta_href: string | null;
  secondary_cta_label: string | null;
  seo_title: string | null;
  meta_description: string | null;
  canonical_path: string | null;
  og_public_id: string | null;
  summary: string | null;
  faq_json: unknown;
  sections_json: unknown;
  author_name: string | null;
  source_note: string | null;
  last_verified_at: string | null;
  is_published: boolean;
  revision: number;
  published_at: string | null;
  updated_at: string;
};

const PAGE_COLUMNS =
  "id, property_id, slug, eyebrow, title, body, hours_note, primary_cta_href, primary_cta_label, secondary_cta_href, secondary_cta_label, seo_title, meta_description, canonical_path, og_public_id, summary, faq_json, sections_json, author_name, source_note, last_verified_at, is_published, revision, published_at, updated_at";

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function faqItems(
  value: unknown,
): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const question = nullableText((item as Record<string, unknown>).question);
    const answer = nullableText((item as Record<string, unknown>).answer);
    return question && answer ? [{ question, answer }] : [];
  });
}

function sectionItems(value: unknown): CmsContentSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const heading = nullableText(record.heading);
    if (!heading) return [];
    const paragraphs = Array.isArray(record.paragraphs)
      ? record.paragraphs.flatMap((paragraph) => {
          const text = nullableText(paragraph);
          return text ? [text] : [];
        })
      : [];
    const items = Array.isArray(record.items)
      ? record.items.flatMap((listItem) => {
          const text = nullableText(listItem);
          return text ? [text] : [];
        })
      : [];
    return [{ heading, paragraphs, items }];
  });
}

/** Normalize untrusted JSON from cms_page_drafts onto a stable editor shape. */
export function normalizeCmsPageContent(
  value: unknown,
  fallback: CmsPageDraftContent,
): CmsPageDraftContent {
  const data =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    eyebrow: nullableText(data.eyebrow) ?? fallback.eyebrow,
    title: nullableText(data.title) ?? fallback.title,
    body:
      typeof data.body === "string" ? data.body : fallback.body,
    hours_note:
      data.hours_note === null
        ? null
        : nullableText(data.hours_note) ?? fallback.hours_note,
    primary_cta_href:
      data.primary_cta_href === null
        ? null
        : nullableText(data.primary_cta_href) ?? fallback.primary_cta_href,
    primary_cta_label:
      data.primary_cta_label === null
        ? null
        : nullableText(data.primary_cta_label) ?? fallback.primary_cta_label,
    secondary_cta_href:
      data.secondary_cta_href === null
        ? null
        : nullableText(data.secondary_cta_href) ?? fallback.secondary_cta_href,
    secondary_cta_label:
      data.secondary_cta_label === null
        ? null
        : nullableText(data.secondary_cta_label) ?? fallback.secondary_cta_label,
    seo_title:
      data.seo_title === null
        ? null
        : nullableText(data.seo_title) ?? fallback.seo_title,
    meta_description:
      data.meta_description === null
        ? null
        : nullableText(data.meta_description) ?? fallback.meta_description,
    canonical_path:
      data.canonical_path === null
        ? null
        : nullableText(data.canonical_path) ?? fallback.canonical_path,
    og_public_id:
      data.og_public_id === null
        ? null
        : nullableText(data.og_public_id) ?? fallback.og_public_id,
    summary:
      data.summary === null
        ? null
        : nullableText(data.summary) ?? fallback.summary,
    faq_json: Array.isArray(data.faq_json)
      ? faqItems(data.faq_json)
      : fallback.faq_json,
    sections_json: Array.isArray(data.sections_json)
      ? sectionItems(data.sections_json)
      : fallback.sections_json,
    author_name:
      data.author_name === null
        ? null
        : nullableText(data.author_name) ?? fallback.author_name,
    source_note:
      data.source_note === null
        ? null
        : nullableText(data.source_note) ?? fallback.source_note,
    last_verified_at:
      data.last_verified_at === null
        ? null
        : nullableText(data.last_verified_at) ?? fallback.last_verified_at,
    is_published:
      typeof data.is_published === "boolean"
        ? data.is_published
        : fallback.is_published,
  };
}

function rowContent(row: CmsPageRow): CmsPageDraftContent {
  return {
    eyebrow: row.eyebrow,
    title: row.title,
    body: row.body,
    hours_note: row.hours_note,
    primary_cta_href: row.primary_cta_href,
    primary_cta_label: row.primary_cta_label,
    secondary_cta_href: row.secondary_cta_href,
    secondary_cta_label: row.secondary_cta_label,
    seo_title: row.seo_title,
    meta_description: row.meta_description,
    canonical_path: row.canonical_path,
    og_public_id: row.og_public_id,
    summary: row.summary,
    faq_json: faqItems(row.faq_json),
    sections_json: sectionItems(row.sections_json),
    author_name: row.author_name,
    source_note: row.source_note,
    last_verified_at: row.last_verified_at,
    is_published: row.is_published,
  };
}

function sameContent(
  left: CmsPageDraftContent,
  right: CmsPageDraftContent,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function loadCmsAdminPages(
  admin: SupabaseClient,
  propertyId: string,
): Promise<CmsAdminPage[]> {
  const { data: pages, error } = await admin
    .from("cms_pages")
    .select(PAGE_COLUMNS)
    .eq("property_id", propertyId)
    .order("slug");
  if (error) throw new Error(error.message);

  const rows = (pages ?? []) as unknown as CmsPageRow[];
  if (!rows.length) return [];

  const { data: drafts, error: draftError } = await admin
    .from("cms_page_drafts")
    .select("page_id, content")
    .eq("property_id", propertyId)
    .in(
      "page_id",
      rows.map((page) => page.id),
    );
  if (draftError) throw new Error(draftError.message);

  const draftByPage = new Map(
    (drafts ?? []).map((draft) => [
      draft.page_id as string,
      draft.content as unknown,
    ]),
  );

  return rows.map((row) => {
    const published = rowContent(row);
    const draft = normalizeCmsPageContent(
      draftByPage.get(row.id),
      published,
    );
    return {
      id: row.id,
      property_id: row.property_id,
      slug: row.slug,
      revision: Number(row.revision),
      published_at: row.published_at,
      updated_at: row.updated_at,
      published,
      draft,
      has_unpublished_changes: !sameContent(published, draft),
    };
  });
}

export async function loadCmsAdminPage(
  admin: SupabaseClient,
  propertyId: string,
  slug: string,
): Promise<CmsAdminPage | null> {
  const pages = await loadCmsAdminPages(admin, propertyId);
  return pages.find((page) => page.slug === slug) ?? null;
}
