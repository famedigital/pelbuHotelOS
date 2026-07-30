"use server";

import { writeAuditEvent } from "@/lib/audit";
import type { CmsPageDraftContent } from "@/lib/cms-admin";
import { publicPathForSlug } from "@/lib/cms-routes";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type CmsEditorState = {
  ok: boolean;
  message?: string;
  error?: string;
  savedAt?: string;
};

const EMPTY_STATE: CmsEditorState = { ok: false };

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function limited(
  value: FormDataEntryValue | null,
  label: string,
  max: number,
  required = false,
): string | null {
  const parsed = required
    ? trimRequired(value, label)
    : (optionalTrim(value) ?? null);
  if (parsed && parsed.length > max) {
    throw new Error(`${label} must be ${max} characters or fewer.`);
  }
  return parsed;
}

function linkValue(
  value: FormDataEntryValue | null,
  label: string,
): string | null {
  const link = limited(value, label, 500);
  if (
    link &&
    !link.startsWith("/") &&
    !/^https?:\/\//i.test(link) &&
    !/^(mailto|tel):/i.test(link)
  ) {
    throw new Error(
      `${label} must start with /, https://, mailto:, or tel:.`,
    );
  }
  return link;
}

function parseFaq(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("FAQ must be valid JSON.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("FAQ JSON must be an array.");
  }
  if (parsed.length > 50) {
    throw new Error("FAQ is limited to 50 questions.");
  }
  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`FAQ item ${index + 1} must be an object.`);
    }
    const record = item as Record<string, unknown>;
    const question = String(record.question ?? "").trim();
    const answer = String(record.answer ?? "").trim();
    if (!question || !answer) {
      throw new Error(`FAQ item ${index + 1} needs a question and answer.`);
    }
    if (question.length > 240 || answer.length > 4_000) {
      throw new Error(`FAQ item ${index + 1} is too long.`);
    }
    return { question, answer };
  });
}

function parseSections(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Additional sections must be valid JSON.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Additional sections JSON must be an array.");
  }
  if (parsed.length > 20) {
    throw new Error("A page is limited to 20 additional sections.");
  }
  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Section ${index + 1} must be an object.`);
    }
    const record = item as Record<string, unknown>;
    const heading = String(record.heading ?? "").trim();
    if (!heading || heading.length > 180) {
      throw new Error(`Section ${index + 1} needs a heading under 180 characters.`);
    }
    const paragraphs = Array.isArray(record.paragraphs)
      ? record.paragraphs.map((paragraph) => String(paragraph).trim()).filter(Boolean)
      : [];
    const items = Array.isArray(record.items)
      ? record.items.map((listItem) => String(listItem).trim()).filter(Boolean)
      : [];
    if (paragraphs.length > 20 || items.length > 40) {
      throw new Error(`Section ${index + 1} contains too many entries.`);
    }
    if (
      paragraphs.some((paragraph) => paragraph.length > 4_000) ||
      items.some((listItem) => listItem.length > 500)
    ) {
      throw new Error(`Section ${index + 1} contains an entry that is too long.`);
    }
    return { heading, paragraphs, items };
  });
}

function parsePageContent(formData: FormData): CmsPageDraftContent {
  const canonical = linkValue(formData.get("canonical_path"), "Canonical path");
  if (canonical && !canonical.startsWith("/")) {
    throw new Error("Canonical path must be an internal path beginning with /.");
  }

  return {
    eyebrow: limited(formData.get("eyebrow"), "Eyebrow", 120, true) ?? "",
    title: limited(formData.get("title"), "Title", 180, true) ?? "",
    body: limited(formData.get("body"), "Body", 12_000, true) ?? "",
    hours_note: limited(formData.get("hours_note"), "Hours note", 500),
    primary_cta_href: linkValue(
      formData.get("primary_cta_href"),
      "Primary CTA link",
    ),
    primary_cta_label: limited(
      formData.get("primary_cta_label"),
      "Primary CTA label",
      80,
    ),
    secondary_cta_href: linkValue(
      formData.get("secondary_cta_href"),
      "Secondary CTA link",
    ),
    secondary_cta_label: limited(
      formData.get("secondary_cta_label"),
      "Secondary CTA label",
      80,
    ),
    seo_title: limited(formData.get("seo_title"), "SEO title", 70),
    meta_description: limited(
      formData.get("meta_description"),
      "Meta description",
      180,
    ),
    canonical_path: canonical,
    og_public_id: limited(
      formData.get("og_public_id"),
      "Social image public ID",
      300,
    ),
    summary: limited(formData.get("summary"), "Summary", 500),
    faq_json: parseFaq(formData.get("faq_json")),
    sections_json: parseSections(formData.get("sections_json")),
    author_name: limited(formData.get("author_name"), "Author", 120),
    source_note: limited(formData.get("source_note"), "Source note", 500),
    last_verified_at:
      limited(formData.get("last_verified_at"), "Verified date", 40) ?? null,
    is_published: formData.get("is_published") === "1",
  };
}

async function pageContext(formData: FormData) {
  await requireDesk();
  const pageId = trimRequired(formData.get("page_id"), "Page ID");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const { data: page, error } = await admin
    .from("cms_pages")
    .select("id, slug, revision")
    .eq("id", pageId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error || !page) throw new Error("CMS page was not found.");
  return {
    admin,
    propertyId,
    pageId,
    slug: page.slug as string,
    revision: Number(page.revision),
  };
}

async function saveDraft(
  formData: FormData,
): Promise<{ slug: string; pageId: string; content: CmsPageDraftContent }> {
  const context = await pageContext(formData);
  const content = parsePageContent(formData);
  const { error } = await context.admin.from("cms_page_drafts").upsert(
    {
      page_id: context.pageId,
      property_id: context.propertyId,
      content,
      base_revision: context.revision,
      updated_at: new Date().toISOString(),
      updated_by: "desk",
    },
    { onConflict: "page_id" },
  );
  if (error) throw new Error(`Could not save draft: ${error.message}`);

  await writeAuditEvent(context.admin, {
    propertyId: context.propertyId,
    action: "cms.page.draft.save",
    entityType: "cms_pages",
    entityId: context.pageId,
    summary: `Saved draft for ${context.slug}`,
    meta: { slug: context.slug, baseRevision: context.revision },
  });
  revalidatePath(`/erp/front-public/pages/${context.slug}`);
  revalidatePath("/erp/front-public");
  return { slug: context.slug, pageId: context.pageId, content };
}

export async function saveCmsPageDraft(
  _previous: CmsEditorState = EMPTY_STATE,
  formData: FormData,
): Promise<CmsEditorState> {
  void _previous;
  try {
    const { slug } = await saveDraft(formData);
    return {
      ok: true,
      message: `Draft saved for ${slug}. The public page is unchanged.`,
      savedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save draft.",
    };
  }
}

export async function publishCmsPage(
  _previous: CmsEditorState = EMPTY_STATE,
  formData: FormData,
): Promise<CmsEditorState> {
  void _previous;
  try {
    // Publishing always saves the form first, so the operator cannot
    // accidentally publish an older draft than the one visible on screen.
    const { slug, pageId, content } = await saveDraft(formData);
    const context = await pageContext(formData);
    const nextRevision = context.revision + 1;
    const now = new Date().toISOString();

    const { data: updated, error } = await context.admin
      .from("cms_pages")
      .update({
        eyebrow: content.eyebrow,
        title: content.title,
        body: content.body,
        hours_note: content.hours_note,
        primary_cta_href: content.primary_cta_href,
        primary_cta_label: content.primary_cta_label,
        secondary_cta_href: content.secondary_cta_href,
        secondary_cta_label: content.secondary_cta_label,
        seo_title: content.seo_title,
        meta_description: content.meta_description,
        canonical_path: content.canonical_path,
        og_public_id: content.og_public_id,
        summary: content.summary,
        faq_json: content.faq_json,
        sections_json: content.sections_json,
        author_name: content.author_name,
        source_note: content.source_note,
        last_verified_at: content.last_verified_at,
        is_published: content.is_published,
        revision: nextRevision,
        published_at: now,
        updated_at: now,
      })
      .eq("id", pageId)
      .eq("property_id", context.propertyId)
      .eq("revision", context.revision)
      .select("id")
      .maybeSingle();
    if (error || !updated) {
      throw new Error(
        "This page changed in another session. Reload before publishing.",
      );
    }

    const { error: revisionError } = await context.admin
      .from("cms_page_revisions")
      .insert({
        page_id: pageId,
        property_id: context.propertyId,
        revision: nextRevision,
        content,
        created_at: now,
        created_by: "desk",
      });
    if (revisionError) {
      console.error("cms_page_revisions insert failed", revisionError);
    }

    await context.admin
      .from("cms_page_drafts")
      .update({ base_revision: nextRevision, updated_at: now })
      .eq("page_id", pageId);

    await writeAuditEvent(context.admin, {
      propertyId: context.propertyId,
      action: "cms.page.publish",
      entityType: "cms_pages",
      entityId: pageId,
      summary: `Published ${slug} revision ${nextRevision}`,
      meta: { slug, revision: nextRevision },
    });

    revalidatePath(publicPathForSlug(slug));
    revalidatePath("/", "layout");
    revalidatePath("/erp/front-public");
    revalidatePath(`/erp/front-public/pages/${slug}`);

    return {
      ok: true,
      message: `Published ${slug} · revision ${nextRevision}.`,
      savedAt: now,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not publish page.",
    };
  }
}
