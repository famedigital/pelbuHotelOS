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
const GEMINI_MODEL_FALLBACKS = [
  "gemini-3.8-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
];

async function generateGeminiJsonOnce(input: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<GeminiJsonResult> {
  const model = input.model.trim() || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: input.timeoutMs ? AbortSignal.timeout(input.timeoutMs) : undefined,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts: [{ text: input.user }] }],
        generationConfig: {
          temperature: input.temperature ?? 0.2,
          maxOutputTokens: input.maxOutputTokens,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 403 || /denied access|API key not valid/i.test(body)) {
        return {
          ok: false,
          error:
            "Google refused this Gemini key. In AI Studio, turn on the Gemini API for that project, create a new key, and paste it in Settings.",
        };
      }
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

export async function generateGeminiJson(input: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<GeminiJsonResult> {
  const first = input.model.trim() || "gemini-2.5-flash";
  const models = [first, ...GEMINI_MODEL_FALLBACKS.filter((model) => model !== first)];
  let last: GeminiJsonResult = { ok: false, error: "Gemini request failed." };
  for (const model of models) {
    last = await generateGeminiJsonOnce({ ...input, model });
    if (last.ok) return last;
    if (!last.error.includes("404")) return last;
  }
  return last;
}

const FAST_MODELS = ["gemini-2.5-flash-lite", "gemini-2.0-flash"];

/** Short JSON call for the desk chat. One model, then one fallback on 404. */
export async function generateGeminiJsonFast(input: {
  apiKey: string;
  system: string;
  user: string;
}): Promise<GeminiJsonResult> {
  let last: GeminiJsonResult = { ok: false, error: "Gemini request failed." };
  for (const model of FAST_MODELS) {
    last = await generateGeminiJsonOnce({
      ...input,
      model,
      timeoutMs: 8000,
      maxOutputTokens: 180,
      temperature: 0,
    });
    if (last.ok) return last;
    if (!last.error.includes("404")) return last;
  }
  return last;
}

/** Hard rule copy for every assist prompt. */
export const GEMINI_CONSENT_SYSTEM = `
You assist a Bhutan hotel front desk (Innora / Hotel OS).
Return ONLY valid JSON matching the schema the user describes.
You DRAFT suggestions. You never instruct silent deletes, voids, payments, or invoice issues.
The human must Confirm before any write. Prefer plain words: Due, Collect, Bill, Check in, Check out.
`.trim();
