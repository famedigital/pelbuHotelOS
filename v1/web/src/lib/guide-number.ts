/** A mobile or `name:` placeholder left by the rack import is not a guide number. */
export function isPlaceholderGuideNumber(
  value: string | null | undefined,
): boolean {
  const v = (value ?? "").trim();
  if (!v) return true;
  if (/^name:/i.test(v)) return true;
  const compact = v.replace(/[\s()-]/g, "");
  if (/^\+?975\d{8}$/.test(compact) || /^\d{8}$/.test(compact)) return true;
  return false;
}

/** Eight-digit mobile stored in the guide-number field, if that is all it is. */
export function guidePhoneFromPlaceholder(
  value: string | null | undefined,
): string | null {
  if (!isPlaceholderGuideNumber(value)) return null;
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 8) return digits;
  if (digits.length === 11 && digits.startsWith("975")) return digits.slice(3);
  return null;
}
