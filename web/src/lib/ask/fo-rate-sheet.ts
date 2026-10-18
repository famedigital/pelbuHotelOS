import type { RateTier } from "@/lib/rates";
import { isRateTier } from "@/lib/rates";

/** One FO-facing rate sheet list — select, don't invent. */
export type FoRateSheetOption = {
  value: RateTier | "custom";
  label: string;
};

export const FO_RATE_SHEET_OPTIONS: FoRateSheetOption[] = [
  { value: "public", label: "Public" },
  { value: "agents", label: "Agents" },
  { value: "mou_agents", label: "MOU" },
  { value: "friends", label: "Friends" },
  { value: "family", label: "Family" },
  { value: "custom", label: "Custom…" },
];

export function defaultFoRateTier(hasAgent: boolean): RateTier {
  return hasAgent ? "agents" : "public";
}

export function parseFoRateTier(
  raw: string | null | undefined,
): RateTier | "custom" | null {
  if (!raw) return null;
  if (raw === "custom") return "custom";
  if (isRateTier(raw)) return raw;
  return null;
}
