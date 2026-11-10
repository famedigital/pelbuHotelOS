import type { TelegramDocOcr } from "../../platform/memory-store.js";
import { geminiVisionJsonOnce, readGeminiKey } from "./gemini-vision.js";

const IDENTITY_PROMPT = `You are extracting identity / immigration fields from a hotel guest document photo (passport, Bhutan CID, or Bhutan SDF / sustainable development fee receipt).
Return ONLY JSON:
{
  "kind": "passport" | "sdf",
  "fullName": string,
  "passportOrCid": string,
  "nationality": string,
  "sdfRef": string | null,
  "confidence": number
}
Rules:
- kind=passport for passport biodata page or national ID/CID card.
- kind=sdf for SDF payment / fee receipts / immigration fee slips.
- passportOrCid = passport number or CID number (strip spaces).
- nationality = country or "Bhutanese" for CID.
- sdfRef = receipt / journal / SDF reference when kind=sdf, else null.
- confidence 0..1.
If unreadable, still return best-effort strings (empty allowed) with low confidence.`;

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function asNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeOcrPayload(raw: unknown): TelegramDocOcr {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kindRaw = asString(o.kind).toLowerCase();
  const kind: "passport" | "sdf" = kindRaw === "sdf" ? "sdf" : "passport";
  const fullName = asString(o.fullName || o.name || o.full_name);
  const passportOrCid = asString(
    o.passportOrCid || o.passport || o.cid || o.documentNumber || o.document_no,
  );
  const nationality = asString(o.nationality || o.country);
  const sdfRef = asString(o.sdfRef || o.sdf_ref || o.receiptNo || o.reference) || undefined;
  const confidence = Math.max(0, Math.min(1, asNumber(o.confidence) || 0.5));
  return {
    kind,
    fullName: fullName || undefined,
    passportOrCid: passportOrCid || undefined,
    nationality: nationality || undefined,
    sdfRef: kind === "sdf" ? sdfRef : undefined,
    confidence,
    raw: o,
  };
}

/** Dev / e2e path when Gemini is unavailable. */
export function simulateOcr(input?: {
  kind?: "passport" | "sdf";
  fullName?: string;
  passportOrCid?: string;
  nationality?: string;
  sdfRef?: string;
}): TelegramDocOcr {
  const kind = input?.kind ?? "passport";
  return {
    kind,
    fullName: input?.fullName?.trim() || "Simulated Guest",
    passportOrCid:
      input?.passportOrCid?.trim() ||
      (kind === "sdf" ? "SDF-SIM-001" : "P-BT-SIM-0001"),
    nationality: input?.nationality?.trim() || "International",
    sdfRef: kind === "sdf" ? input?.sdfRef?.trim() || "SDF-SIM-001" : undefined,
    confidence: 0.42,
    raw: { simulated: true },
  };
}

export async function ocrIdentityOrSdf(input: {
  mime: string;
  dataBase64: string;
  hintKind?: "passport" | "sdf";
  simulate?: boolean;
  simulateFields?: {
    fullName?: string;
    passportOrCid?: string;
    nationality?: string;
    sdfRef?: string;
  };
}): Promise<{ ok: true; ocr: TelegramDocOcr } | { ok: false; error: string }> {
  if (input.simulate || process.env.HERMES_OCR_SIMULATE === "1") {
    return {
      ok: true,
      ocr: simulateOcr({
        kind: input.hintKind,
        ...input.simulateFields,
      }),
    };
  }
  const key = readGeminiKey();
  if (!key) {
    return {
      ok: false,
      error: "GEMINI_API_KEY not configured — enable HERMES_OCR_SIMULATE=1 for desk smoke",
    };
  }
  const hint =
    input.hintKind === "sdf"
      ? " Prefer classifying as SDF if this looks like a fee receipt."
      : input.hintKind === "passport"
        ? " Prefer classifying as passport/CID."
        : "";
  const raw = await geminiVisionJsonOnce(
    key,
    IDENTITY_PROMPT + hint,
    input.mime || "image/jpeg",
    input.dataBase64,
    25_000,
  );
  if (!raw) {
    return { ok: false, error: "Gemini OCR returned no usable JSON" };
  }
  const ocr = normalizeOcrPayload(raw);
  if (input.hintKind && ocr.kind !== input.hintKind && (ocr.confidence ?? 0) < 0.7) {
    ocr.kind = input.hintKind;
  }
  return { ok: true, ocr };
}
