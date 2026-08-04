"use server";

import {
  setAgentRateViewCookie,
} from "@/lib/agent-rate-view";
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

export type AgentRateGateState = {
  ok: boolean;
  error?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Soft gate: email + WhatsApp required, audit logged, short-lived httpOnly cookie.
 * Agent rate amounts are never returned from this action — page reloads with cookie.
 */
export async function requestAgentRateView(
  _prev: AgentRateGateState,
  formData: FormData,
): Promise<AgentRateGateState> {
  try {
    const h = await headers();
    const rl = await rateLimit(`rate-card-gate:${clientIp(h)}`, {
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.ok) {
      return {
        ok: false,
        error: "Too many requests. Please wait a few minutes and try again.",
      };
    }

    const fullName = optionalTrim(formData.get("full_name"));
    const email = trimRequired(formData.get("email"), "Email").toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    if (email.length > 200) {
      return { ok: false, error: "Email is too long." };
    }

    const whatsapp = trimRequired(formData.get("whatsapp"), "WhatsApp number");
    assertPhone(whatsapp);
    if (whatsapp.length > 40) {
      return { ok: false, error: "WhatsApp number is too long." };
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

    const { error: logError } = await admin.from("rate_card_access_log").insert({
      property_id: propertyId,
      full_name: fullName,
      email,
      whatsapp,
      user_agent: userAgent,
    });

    if (logError) {
      console.error("rate_card_access_log insert failed", logError);
      return {
        ok: false,
        error: "Could not verify access right now. Please try again.",
      };
    }

    await setAgentRateViewCookie(propertyId, email);
    revalidatePath("/rates");

    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}
