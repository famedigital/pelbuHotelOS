/** Phase G gate — never auto-redirect v1. */
export function isDeskCutoverEnabled(): boolean {
  return process.env.V2_DESK_CUTOVER?.trim() === "true";
}
