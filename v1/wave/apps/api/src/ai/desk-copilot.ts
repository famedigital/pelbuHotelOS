import { z } from "zod";
import type { HotelOsSupabase } from "@hotel-os/db";
import type { DeskJwt } from "../auth.js";
import { decryptSecret, liveGeminiModel } from "./secret-crypto.js";

const requestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  context: z
    .object({
      route: z.string().optional(),
      bookingId: z.string().uuid().optional(),
      confirmationCode: z.string().optional(),
    })
    .optional(),
});

export type DeskDraftAction = {
  type:
    | "open_stay"
    | "fast_book"
    | "post_charge"
    | "post_payment"
    | "check_in"
    | "navigate"
    | "run_report"
    | "none";
  label: string;
  payload: Record<string, unknown>;
  requiresConfirm: boolean;
};

async function loadByokKey(
  admin: HotelOsSupabase,
  propertyId: string,
): Promise<{ apiKey: string; model: string } | null> {
  const { data, error } = await admin
    .from("property_ai_settings")
    .select("gemini_api_key_enc, gemini_model, enabled")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.enabled) return null;
  const key = decryptSecret(data.gemini_api_key_enc as string | null);
  if (!key) return null;
  return { apiKey: key, model: liveGeminiModel(data.gemini_model as string | null) };
}

function heuristicDraft(prompt: string): {
  reply: string;
  actions: DeskDraftAction[];
} {
  const p = prompt.toLowerCase();
  const codeMatch = prompt.match(/\b(PS|INV|BK)[- ]?\d{2,4}[- ]?\d{3,6}\b/i);
  if (codeMatch) {
    return {
      reply: `Open stay ${codeMatch[0].toUpperCase()}? Confirm to navigate StayHub.`,
      actions: [
        {
          type: "open_stay",
          label: `Open ${codeMatch[0].toUpperCase()}`,
          payload: { confirmationCode: codeMatch[0].toUpperCase() },
          requiresConfirm: true,
        },
      ],
    };
  }
  if (p.includes("fast book") || p.includes("new booking") || p.includes("reserve")) {
    return {
      reply: "Draft Fast Book ready. Confirm to open the booking form.",
      actions: [
        {
          type: "fast_book",
          label: "Open Fast Book",
          payload: {},
          requiresConfirm: true,
        },
      ],
    };
  }
  if (p.includes("night audit")) {
    return {
      reply: "Night audit draft — Confirm runs the server audit RPC.",
      actions: [
        {
          type: "navigate",
          label: "Open Night Audit",
          payload: { path: "/night-audit" },
          requiresConfirm: true,
        },
      ],
    };
  }
  if (p.includes("pos") || p.includes("food") || p.includes("kot")) {
    return {
      reply: "Open POS / KOT workspace?",
      actions: [
        {
          type: "navigate",
          label: "Open POS",
          payload: { path: "/pos" },
          requiresConfirm: false,
        },
      ],
    };
  }
  return {
    reply:
      "I can draft Fast Book, open stays by PS-code, jump POS/HK/reports, or prepare night audit. Money always needs Confirm.",
    actions: [
      {
        type: "none",
        label: "No action",
        payload: {},
        requiresConfirm: false,
      },
    ],
  };
}

export async function deskCopilotDraft(
  admin: HotelOsSupabase,
  jwt: DeskJwt,
  body: unknown,
) {
  const input = requestSchema.parse(body);
  const byok = await loadByokKey(admin, jwt.propertyId);

  if (!byok) {
    const draft = heuristicDraft(input.prompt);
    return {
      ok: true,
      provider: "heuristic",
      model: null,
      ...draft,
      note: "Property BYOK Gemini key not configured — using local command drafts only.",
    };
  }

  const system = `You are Hotel OS desk copilot for Bhutan boutique hotels.
Reply briefly. Propose at most 3 draft actions as JSON.
Actions types: open_stay, fast_book, post_charge, post_payment, check_in, navigate, run_report, none.
Never invent folio balances. Money actions must set requiresConfirm=true.
Return ONLY JSON: {"reply":string,"actions":[{"type":string,"label":string,"payload":object,"requiresConfirm":boolean}]}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(byok.model)}:generateContent?key=${encodeURIComponent(byok.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${system}\n\nRoute: ${input.context?.route ?? "unknown"}\nBooking: ${input.context?.bookingId ?? input.context?.confirmationCode ?? "none"}\nStaff prompt: ${input.prompt}`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
    }),
  });

  if (!res.ok) {
    const draft = heuristicDraft(input.prompt);
    return {
      ok: true,
      provider: "heuristic",
      model: byok.model,
      ...draft,
      note: `Gemini error ${res.status}; fell back to heuristics.`,
    };
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
    "";
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      reply: string;
      actions: DeskDraftAction[];
    };
    return {
      ok: true,
      provider: "gemini",
      model: byok.model,
      reply: parsed.reply,
      actions: (parsed.actions || []).map((a) => ({
        ...a,
        requiresConfirm:
          a.requiresConfirm ||
          ["post_charge", "post_payment", "check_in", "fast_book"].includes(
            a.type,
          ),
      })),
    };
  } catch {
    const draft = heuristicDraft(input.prompt);
    return {
      ok: true,
      provider: "gemini-raw",
      model: byok.model,
      reply: text.slice(0, 800) || draft.reply,
      actions: draft.actions,
    };
  }
}
