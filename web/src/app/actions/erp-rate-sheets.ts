"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  mapRateSheetRow,
  normalizeRateSheetDocument,
  publicPeakRateSheetDocument,
  slugifyRateSheetTitle,
  type MarketingRateSheetRow,
  type RateSheetAudience,
  type RateSheetBrand,
  type RateSheetDocument,
  type RateSheetStatus,
} from "@/lib/marketing/rate-sheet";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type RateSheetActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  id?: string;
};

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "https://pelbusuites.bt"
  );
}

function hostToLabel(hostOrUrl: string | null): string | null {
  if (!hostOrUrl?.trim()) return null;
  try {
    const withProto = hostOrUrl.includes("://")
      ? hostOrUrl
      : `https://${hostOrUrl}`;
    return new URL(withProto).hostname.replace(/^www\./, "");
  } catch {
    return hostOrUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

/** Brand lockup + NAP from Settings → Identity for rate sheet chrome. */
export async function loadRateSheetBrand(
  propertyId: string,
): Promise<RateSheetBrand> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("properties")
    .select(
      "name, legal_name, logo_public_id, phone, whatsapp, email, address, public_host",
    )
    .eq("id", propertyId)
    .maybeSingle();

  const name = (data?.name as string | undefined)?.trim() || "Hotel";
  const phone = ((data?.phone as string | null) ?? null)?.trim() || null;
  const whatsappRaw =
    ((data?.whatsapp as string | null) ?? null)?.trim() || null;
  const publicHost =
    ((data?.public_host as string | null) ?? null)?.trim() || null;
  const logoPublicId =
    ((data?.logo_public_id as string | null) ?? null)?.trim() || null;

  let webUrl: string | null = null;
  let webLabel: string | null = null;
  if (publicHost) {
    webUrl = publicHost.includes("://")
      ? publicHost
      : `https://${publicHost}`;
    webLabel = hostToLabel(publicHost);
  } else {
    webUrl = siteOrigin();
    webLabel = hostToLabel(webUrl);
  }

  return {
    name,
    legalName: ((data?.legal_name as string | null) ?? null)?.trim() || null,
    logoPublicId,
    logoSrc: logoPublicId
      ? cloudinaryUrl(logoPublicId, { width: 160, height: 160, crop: "fit" })
      : null,
    phone,
    whatsapp: whatsappRaw || phone,
    email: ((data?.email as string | null) ?? null)?.trim() || null,
    address: ((data?.address as string | null) ?? null)?.trim() || null,
    webUrl,
    webLabel,
    settingsHref: "/erp/settings?tab=identity",
  };
}

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function revalidateSheets() {
  revalidatePath("/erp/marketing");
  revalidatePath("/erp/marketing/rate-sheets");
}

function parseAudience(raw: string | null): RateSheetAudience {
  if (
    raw === "agents" ||
    raw === "partners" ||
    raw === "custom" ||
    raw === "public"
  ) {
    return raw;
  }
  return "public";
}

function parseStatus(raw: string | null): RateSheetStatus {
  if (raw === "published" || raw === "archived" || raw === "draft") return raw;
  return "draft";
}

function parseDocument(raw: FormDataEntryValue | null): RateSheetDocument {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Document payload is missing.");
  }
  try {
    return normalizeRateSheetDocument(JSON.parse(raw));
  } catch {
    throw new Error("Document JSON is invalid.");
  }
}

export async function listRateSheetsForProperty(
  propertyId: string,
): Promise<MarketingRateSheetRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("marketing_rate_sheets")
    .select(
      "id, property_id, slug, title, audience, status, season_label, document, notes, created_at, updated_at, published_at",
    )
    .eq("property_id", propertyId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("listRateSheetsForProperty", error);
    return [];
  }
  return (data ?? []).map((r) => mapRateSheetRow(r as Record<string, unknown>));
}

export async function getRateSheet(
  id: string,
): Promise<MarketingRateSheetRow | null> {
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const { data, error } = await admin
    .from("marketing_rate_sheets")
    .select(
      "id, property_id, slug, title, audience, status, season_label, document, notes, created_at, updated_at, published_at",
    )
    .eq("id", id)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRateSheetRow(data as Record<string, unknown>);
}

export async function upsertRateSheet(
  _prev: RateSheetActionState,
  formData: FormData,
): Promise<RateSheetActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();

    const id = optionalTrim(formData.get("sheet_id"));
    const title = trimRequired(formData.get("title"), "Title");
    let slug = optionalTrim(formData.get("slug")) || slugifyRateSheetTitle(title);
    slug = slugifyRateSheetTitle(slug);
    if (!slug) throw new Error("Slug is required.");

    const audience = parseAudience(optionalTrim(formData.get("audience")));
    const status = parseStatus(optionalTrim(formData.get("status")));
    const seasonLabel = optionalTrim(formData.get("season_label"));
    const notes = optionalTrim(formData.get("notes"));
    const document = parseDocument(formData.get("document_json"));
    const now = new Date().toISOString();

    const payload = {
      property_id: propertyId,
      title,
      slug,
      audience,
      status,
      season_label: seasonLabel,
      notes,
      document,
      updated_at: now,
      published_at: status === "published" ? now : null,
    };

    if (id) {
      const { data, error } = await admin
        .from("marketing_rate_sheets")
        .update(payload)
        .eq("id", id)
        .eq("property_id", propertyId)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await writeAuditEvent(admin, {
        propertyId,
        action: "marketing.rate_sheet.update",
        entityType: "marketing_rate_sheets",
        entityId: data.id,
        summary: `Updated rate sheet “${title}”`,
        meta: { title, status, audience },
      });
      revalidateSheets();
      return { ok: true, message: "Rate sheet saved", id: data.id };
    }

    const { data, error } = await admin
      .from("marketing_rate_sheets")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "marketing.rate_sheet.create",
      entityType: "marketing_rate_sheets",
      entityId: data.id,
      summary: `Created rate sheet “${title}”`,
      meta: { title, status, audience },
    });
    revalidateSheets();
    return { ok: true, message: "Rate sheet created", id: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save rate sheet.",
    };
  }
}

/** Seed public peak card from marketing/rate-public (one click). */
export async function seedPublicRateSheet(
  _prev: RateSheetActionState,
  _formData: FormData,
): Promise<RateSheetActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const slug = "public-peak-2026";
    const document = publicPeakRateSheetDocument();
    const now = new Date().toISOString();

    const { data: existing } = await admin
      .from("marketing_rate_sheets")
      .select("id")
      .eq("property_id", propertyId)
      .eq("slug", slug)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await admin
        .from("marketing_rate_sheets")
        .update({
          title: "Public room rates — Peak 2026",
          audience: "public",
          status: "draft",
          season_label: "Season 2 · Peak Sep–Nov 2026",
          document,
          updated_at: now,
          notes:
            "Seeded from marketing/rate-public.html peak table. Edit freely.",
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      revalidateSheets();
      return {
        ok: true,
        message: "Public rate sheet refreshed from seed",
        id: existing.id,
      };
    }

    const { data, error } = await admin
      .from("marketing_rate_sheets")
      .insert({
        property_id: propertyId,
        slug,
        title: "Public room rates — Peak 2026",
        audience: "public",
        status: "draft",
        season_label: "Season 2 · Peak Sep–Nov 2026",
        document,
        notes:
          "Seeded from marketing/rate-public.html peak table. Edit freely.",
        updated_at: now,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    revalidateSheets();
    return {
      ok: true,
      message: "Public rate sheet created from seed",
      id: data.id,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not seed rate sheet.",
    };
  }
}

export async function archiveRateSheet(
  _prev: RateSheetActionState,
  formData: FormData,
): Promise<RateSheetActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const id = trimRequired(formData.get("sheet_id"), "Sheet");

    const { error } = await admin
      .from("marketing_rate_sheets")
      .update({
        status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("property_id", propertyId);

    if (error) throw new Error(error.message);
    revalidateSheets();
    return { ok: true, message: "Rate sheet archived" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not archive.",
    };
  }
}

export async function createBlankRateSheet(
  _prev: RateSheetActionState,
  formData: FormData,
): Promise<RateSheetActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const title =
      optionalTrim(formData.get("title")) || "New rate design";
    const slugBase = slugifyRateSheetTitle(title) || "rate-sheet";
    const slug = `${slugBase}-${Date.now().toString(36).slice(-4)}`;
    const now = new Date().toISOString();

    const { data, error } = await admin
      .from("marketing_rate_sheets")
      .insert({
        property_id: propertyId,
        slug,
        title,
        audience: "custom",
        status: "draft",
        season_label: optionalTrim(formData.get("season_label")),
        document: {
          version: 1,
          intro: "Start typing. Use the toolbar to add tables, banners, and free design blocks.",
          blocks: [
            {
              id: crypto.randomUUID(),
              type: "heading",
              level: 1,
              text: title,
            },
            {
              id: crypto.randomUUID(),
              type: "paragraph",
              text: "Add a table for rates, a banner for peak months, or free HTML for custom layouts.",
            },
            {
              id: crypto.randomUUID(),
              type: "table",
              caption: "Your table",
              headers: ["Item", "Details", "Amount"],
              rows: [
                ["", "", ""],
                ["", "", ""],
              ],
            },
          ],
        },
        updated_at: now,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    revalidateSheets();
    return { ok: true, message: "Blank design created", id: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create sheet.",
    };
  }
}
