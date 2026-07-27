"use server";

import { notifyNewAgentApplication } from "@/lib/notify";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertOptionalEmail,
  assertPhone,
  optionalTrim,
  trimRequired,
} from "@/lib/validation";

export type AgentApplyState = {
  ok: boolean;
  agentId?: string;
  error?: string;
};

const MARKETS = new Set(["bhutan", "jaigaon", "india"]);

function assertOptionalHttpUrl(value: string | null, label: string): void {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("bad protocol");
    }
  } catch {
    throw new Error(`${label} must be a valid http(s) link.`);
  }
}

export async function createAgentApplication(
  _prev: AgentApplyState,
  formData: FormData,
): Promise<AgentApplyState> {
  try {
    const companyName = trimRequired(formData.get("company_name"), "Company name");
    const market = trimRequired(formData.get("market"), "Market").toLowerCase();
    if (!MARKETS.has(market)) {
      throw new Error("Choose Bhutan, Jaigaon, or India as your market.");
    }

    const contactName = trimRequired(formData.get("contact_name"), "Contact name");
    const contactPhone = trimRequired(formData.get("contact_phone"), "Phone");
    assertPhone(contactPhone);

    const contactEmail = optionalTrim(formData.get("contact_email"));
    assertOptionalEmail(contactEmail);

    const licenseUrl = optionalTrim(formData.get("license_url"));
    assertOptionalHttpUrl(licenseUrl, "License link");

    const notes = optionalTrim(formData.get("notes"));
    const wantsMou = formData.get("wants_mou") === "on";

    const admin = createSupabaseAdminClient();

    const { data: agent, error } = await admin
      .from("agents")
      .insert({
        company_name: companyName,
        market,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        license_url: licenseUrl,
        notes,
        wants_mou: wantsMou,
        status: "pending",
        rate_tier: "agents",
        credit_limit: 0,
        credit_used: 0,
      })
      .select("id")
      .single();

    if (error || !agent) {
      console.error("createAgentApplication insert failed", error);
      throw new Error("Could not submit your application. Please try again.");
    }

    await notifyNewAgentApplication({
      agentId: agent.id,
      companyName,
      market,
      contactName,
      contactPhone,
      contactEmail,
      licenseUrl,
      wantsMou,
      notes,
    });

    return { ok: true, agentId: agent.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}
