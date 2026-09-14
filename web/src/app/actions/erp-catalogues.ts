"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { slugifyCatalogueTitle } from "@/lib/marketing/catalogue";
import {
  getCatalogueTemplate,
  isCatalogueTemplateCode,
  type CatalogueSectionDraft,
} from "@/lib/marketing/catalogue-templates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type CatalogueActionState = {
  ok: boolean;
  error?: string;
  id?: string;
  message?: string;
  slug?: string;
};

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function revalidateCatalogue(slug?: string) {
  revalidatePath("/erp/marketing");
  if (slug) revalidatePath(`/c/${slug}`);
}

function parseSections(raw: FormDataEntryValue | null): CatalogueSectionDraft[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as CatalogueSectionDraft[];
  } catch {
    return [];
  }
}

export async function upsertCatalogue(
  _prev: CatalogueActionState,
  formData: FormData,
): Promise<CatalogueActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();

    const id = optionalTrim(formData.get("catalogue_id"));
    const title = trimRequired(formData.get("title"), "Title");
    const templateRaw = trimRequired(formData.get("template_code"), "Template");
    if (!isCatalogueTemplateCode(templateRaw)) {
      throw new Error("Invalid template.");
    }
    const template = getCatalogueTemplate(templateRaw);

    let slug =
      optionalTrim(formData.get("slug")) || slugifyCatalogueTitle(title);
    slug = slugifyCatalogueTitle(slug);
    if (!slug) throw new Error("Slug is required.");

    const audienceRaw =
      optionalTrim(formData.get("audience")) ?? template.defaultAudience;
    const audience =
      audienceRaw === "agents" || audienceRaw === "media_press"
        ? audienceRaw
        : "public";
    const seasonLabel = optionalTrim(formData.get("season_label"));
    const coverPublicId = optionalTrim(formData.get("cover_public_id"));
    const introBlurb = optionalTrim(formData.get("intro_blurb"));
    const captionFeed = optionalTrim(formData.get("caption_feed"));
    const captionStory = optionalTrim(formData.get("caption_story"));
    const captionAgent = optionalTrim(formData.get("caption_agent"));
    const hashtags = optionalTrim(formData.get("hashtags"));
    const ctaKind = (optionalTrim(formData.get("cta_kind")) ?? "book") as
      | "book"
      | "order"
      | "contact"
      | "custom";
    const ctaHref = optionalTrim(formData.get("cta_href"));
    const ctaLabel = optionalTrim(formData.get("cta_label"));
    const promoCodeId = optionalTrim(formData.get("promo_code_id"));
    const showPublicRates = formData.get("show_public_rates") === "1";
    const statusRaw = optionalTrim(formData.get("status")) ?? "draft";
    const status =
      statusRaw === "published" || statusRaw === "archived"
        ? statusRaw
        : "draft";

    let sections = parseSections(formData.get("sections"));
    if (!sections.length) {
      sections = template.defaultSections.map((s) => ({ ...s }));
    }

    // Unchecked HTML checkboxes omit the field — treat missing as disabled when
    // at least one section_* field is present (create / edit form).
    const anySectionField = (
      [
        "cover",
        "gallery",
        "rooms",
        "fnb",
        "spa",
        "meeting",
        "rates",
        "contact",
      ] as const
    ).some((type) => formData.get(`section_${type}`) != null);

    if (anySectionField) {
      const types = [
        "cover",
        "gallery",
        "rooms",
        "fnb",
        "spa",
        "meeting",
        "rates",
        "contact",
      ] as const;
      const byType = new Map(sections.map((s) => [s.type, { ...s }]));
      for (const type of types) {
        const enabled = formData.get(`section_${type}`) === "1";
        const existing = byType.get(type);
        if (existing) {
          byType.set(type, { ...existing, enabled });
        } else if (enabled) {
          byType.set(type, {
            type,
            enabled: true,
            sort_order: 50 + byType.size * 10,
          });
        }
      }
      sections = Array.from(byType.values()).sort(
        (a, b) => a.sort_order - b.sort_order,
      );
    }

    // Rates list: keep off for public packs unless staff explicitly enable.
    const ratesEnabled = sections.some((s) => s.type === "rates" && s.enabled);
    const publicRates =
      ratesEnabled || (audience === "agents" && showPublicRates);

    const payload: Record<string, unknown> = {
      property_id: propertyId,
      template_code: templateRaw,
      title,
      slug,
      season_label: seasonLabel,
      audience,
      cover_public_id: coverPublicId,
      intro_blurb: introBlurb,
      caption_feed: captionFeed,
      caption_story: captionStory,
      caption_agent: captionAgent,
      hashtags,
      cta_kind: ctaKind,
      cta_href: ctaHref,
      cta_label: ctaLabel,
      promo_code_id: promoCodeId || null,
      show_public_rates: publicRates,
      sections,
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "published") {
      payload.published_at = new Date().toISOString();
      payload.published_by = "desk";
    }

    let catalogueId = id;
    if (id) {
      const { error } = await admin
        .from("marketing_catalogues")
        .update(payload)
        .eq("id", id)
        .eq("property_id", propertyId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await admin
        .from("marketing_catalogues")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Insert failed.");
      catalogueId = data.id as string;
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: id ? "marketing.catalogue.update" : "marketing.catalogue.create",
      entityType: "marketing_catalogues",
      entityId: catalogueId!,
      summary: `${id ? "Updated" : "Created"} catalogue ${title}`,
    });

    revalidateCatalogue(slug);
    return {
      ok: true,
      id: catalogueId ?? undefined,
      slug,
      message:
        status === "published"
          ? "Catalogue published."
          : "Catalogue saved as draft.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function archiveCatalogue(
  _prev: CatalogueActionState,
  formData: FormData,
): Promise<CatalogueActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const id = trimRequired(formData.get("catalogue_id"), "Catalogue");
    const { data, error } = await admin
      .from("marketing_catalogues")
      .update({
        status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("property_id", propertyId)
      .select("slug")
      .maybeSingle();
    if (error) throw new Error(error.message);
    revalidateCatalogue((data?.slug as string) ?? undefined);
    return { ok: true, message: "Catalogue archived." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

/** Increment social crop download counter (public or desk). */
export async function recordCatalogueSocialDlAction(
  catalogueId: string,
): Promise<{ ok: boolean }> {
  try {
    if (!catalogueId?.trim()) return { ok: false };
    const admin = createSupabaseAdminClient();
    const { recordCatalogueSocialDl } = await import(
      "@/lib/marketing/catalogue"
    );
    await recordCatalogueSocialDl(admin, catalogueId.trim());
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
