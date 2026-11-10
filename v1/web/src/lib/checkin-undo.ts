/** Day-1 auto-post sources that undo-check-in may reverse. */
export const UNDO_CI_SAFE_SOURCE_TYPES = new Set([
  "room",
  "meal_plan",
  "extra_bed",
]);

export type UndoCiLine = {
  source_type: string | null;
  status?: string | null;
};

/**
 * Pure guard for undo check-in folio safety (used by server action + unit tests).
 */
export function assertUndoCheckInLinesSafe(
  lines: UndoCiLine[],
  opts?: { hasPayments?: boolean },
): string | null {
  if (opts?.hasPayments) {
    return "Payments are posted on this folio. Settle or reverse them before undoing check-in.";
  }
  for (const line of lines) {
    if ((line.status ?? "posted") !== "posted") continue;
    const st = String(line.source_type ?? "");
    if (st === "payment" || st === "adjustment") {
      return "Folio has settlement or adjustment lines. Reverse those first, then undo check-in.";
    }
    if (!UNDO_CI_SAFE_SOURCE_TYPES.has(st)) {
      return `Cannot undo — folio has other charges (${st || "unknown"}). Void them first.`;
    }
  }
  return null;
}

/** Accept empty phone (walk-in later) or assert format when present. */
export function normalizeOptionalPhone(
  raw: string | null | undefined,
): { ok: true; phone: string } | { ok: false; error: string } {
  const phone = (raw ?? "").trim();
  if (!phone) return { ok: true, phone: "" };
  // Same rule as assertPhone
  if (!/^\+?[0-9][0-9\s-]{6,18}$/.test(phone)) {
    return {
      ok: false,
      error:
        "Enter a valid phone number (include country code if outside Bhutan).",
    };
  }
  return { ok: true, phone };
}
