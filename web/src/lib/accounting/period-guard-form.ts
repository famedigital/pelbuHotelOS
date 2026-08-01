import type { PeriodGuardOptions } from "@/lib/accounting/period-guard";

/** Parse optional manager override fields from desk form posts. */
export function periodGuardFromForm(
  formData: FormData,
  propertyId: string,
): PeriodGuardOptions | undefined {
  const managerPin = String(formData.get("manager_pin") ?? "").trim();
  const overrideReason = String(formData.get("period_override_reason") ?? "").trim();
  if (!managerPin && !overrideReason) return undefined;
  return {
    propertyId,
    managerPin: managerPin || null,
    overrideReason: overrideReason || null,
  };
}
