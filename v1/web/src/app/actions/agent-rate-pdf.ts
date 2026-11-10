"use server";

import {
  normalizeAgentEmail,
  normalizeAgentPhone,
  setAgentRatePdfCookie,
} from "@/lib/agent-rate-pdf";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertPhone,
  optionalTrim,
  trimRequired,
} from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export type AgentRatePdfGateState = {
  ok: boolean;
  error?: string;
  /** Total property downloads after this request (for live counter). */
  totalDownloads?: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Gate for agent rate-card download: email + phone required.
 * Upserts lead, increments download_count, sets short-lived download cookie.
 * File is served only from GET /api/agents/rate-card-download after cookie is set.
 */
export async function requestAgentRatePdfDownload(
  _prev: AgentRatePdfGateState,
  formData: FormData,
): Promise<AgentRatePdfGateState> {
  try {
    const h = await headers();
    const rl = await rateLimit(`agent-rate-pdf:${clientIp(h)}`, {
      limit: 12,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.ok) {
      return {
        ok: false,
        error: "Too many requests. Please wait a few minutes and try again.",
      };
    }

    const fullName = optionalTrim(formData.get("full_name"));
    const email = normalizeAgentEmail(
      trimRequired(formData.get("email"), "Email"),
    );
    if (!EMAIL_RE.test(email)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    if (email.length > 200) {
      return { ok: false, error: "Email is too long." };
    }

    const phone = normalizeAgentPhone(
      trimRequired(formData.get("phone"), "Phone number"),
    );
    assertPhone(phone);
    if (phone.length > 40) {
      return { ok: false, error: "Phone number is too long." };
    }

    if (fullName && fullName.length > 120) {
      return { ok: false, error: "Name is too long." };
    }

    const propertyId = await resolvePublicPropertyId();
    if (!propertyId) {
      return {
        ok: false,
        error: "Hotel property is not configured. Please call the desk.",
      };
    }

    const admin = createSupabaseAdminClient();
    const userAgent = (h.get("user-agent") ?? "").slice(0, 500) || null;
    const now = new Date().toISOString();

    const { data: existing, error: findErr } = await admin
      .from("agent_rate_pdf_leads")
      .select("id, download_count")
      .eq("property_id", propertyId)
      .eq("email", email)
      .eq("phone", phone)
      .maybeSingle();

    if (findErr) {
      console.error("agent_rate_pdf_leads lookup failed", findErr);
      return {
        ok: false,
        error:
          "Could not register your download. Please try again or call the desk.",
      };
    }

    let leadId: string;

    if (existing?.id) {
      const nextCount = (existing.download_count ?? 0) + 1;
      const patch: Record<string, unknown> = {
        download_count: nextCount,
        last_download_at: now,
        last_user_agent: userAgent,
        updated_at: now,
      };
      if (fullName) patch.full_name = fullName;
      const { error: updErr } = await admin
        .from("agent_rate_pdf_leads")
        .update(patch)
        .eq("id", existing.id);

      if (updErr) {
        console.error("agent_rate_pdf_leads update failed", updErr);
        return {
          ok: false,
          error:
            "Could not register your download. Please try again or call the desk.",
        };
      }
      leadId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("agent_rate_pdf_leads")
        .insert({
          property_id: propertyId,
          email,
          phone,
          full_name: fullName,
          download_count: 1,
          first_download_at: now,
          last_download_at: now,
          last_user_agent: userAgent,
        })
        .select("id")
        .single();

      if (insErr || !inserted?.id) {
        console.error("agent_rate_pdf_leads insert failed", insErr);
        return {
          ok: false,
          error:
            "Could not register your download. Please try again or call the desk.",
        };
      }
      leadId = inserted.id;
    }

    const { error: eventErr } = await admin.from("agent_rate_pdf_events").insert({
      property_id: propertyId,
      lead_id: leadId,
      email,
      phone,
      full_name: fullName,
      user_agent: userAgent,
    });

    if (eventErr) {
      console.error("agent_rate_pdf_events insert failed", eventErr);
      // Lead already counted; still allow download.
    }

    await setAgentRatePdfCookie(propertyId, email, phone);

    const { data: tallyRows } = await admin
      .from("agent_rate_pdf_leads")
      .select("download_count")
      .eq("property_id", propertyId);

    const totalDownloads = (tallyRows ?? []).reduce(
      (sum, row) => sum + (Number(row.download_count) || 0),
      0,
    );

    revalidatePath("/agents");
    revalidatePath("/erp/agents/rate-downloads");

    return { ok: true, totalDownloads };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}

/** Public counter: sum of all lead download_counts for the property. */
export async function getAgentRatePdfDownloadTotal(
  propertyId: string,
): Promise<number> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("agent_rate_pdf_leads")
      .select("download_count")
      .eq("property_id", propertyId);

    if (error || !data) {
      if (error) console.error("agent rate pdf total failed", error);
      return 0;
    }
    return data.reduce((sum, row) => sum + (Number(row.download_count) || 0), 0);
  } catch {
    return 0;
  }
}
