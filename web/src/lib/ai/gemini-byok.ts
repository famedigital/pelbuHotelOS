import "server-only";

import { decryptSecret } from "@/lib/ai/secret-crypto";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type GeminiByokConfig = {
  enabled: boolean;
  model: string;
  apiKey: string | null;
  configured: boolean;
};

export async function loadGeminiByok(
  admin: Admin,
  propertyId: string,
): Promise<GeminiByokConfig> {
  const { data } = await admin
    .from("property_ai_settings")
    .select("gemini_api_key_enc, gemini_model, enabled")
    .eq("property_id", propertyId)
    .maybeSingle();

  const apiKey = decryptSecret(data?.gemini_api_key_enc as string | null);
  const model =
    (data?.gemini_model as string | null)?.trim() || "gemini-2.0-flash";
  const enabled = Boolean(data?.enabled) && Boolean(apiKey);
  return {
    enabled,
    model,
    apiKey,
    configured: Boolean(apiKey),
  };
}

export type GeminiJsonResult =
  | { ok: true; data: unknown; model: string }
  | { ok: false; error: string };

/**
 * Call Gemini with a JSON-only response. Never writes to the DB.
 * Desk Assist must show the draft and wait for human Confirm.
 */
export async function generateGeminiJson(input: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<GeminiJsonResult> {
  const model = input.model.trim() || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts: [{ text: input.user }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Gemini error ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text =
      json.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("")
        .trim() ?? "";
    if (!text) return { ok: false, error: "Gemini returned an empty draft." };
    try {
      return { ok: true, data: JSON.parse(text) as unknown, model };
    } catch {
      return { ok: false, error: "Gemini returned non-JSON; discard and retry." };
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Gemini request failed.",
    };
  }
}

/** Hard rule copy for every assist prompt. */
export const GEMINI_CONSENT_SYSTEM = `
You assist a Bhutan hotel front desk (Innora / Hotel OS).
Return ONLY valid JSON matching the schema the user describes.
You DRAFT suggestions. You never instruct silent deletes, voids, payments, or invoice issues.
The human must Confirm before any write. Prefer plain words: Due, Collect, Bill, Check in, Check out.
`.trim();
