/** Front-office routes that use the command-desk skin. */
const FO_EXACT = new Set([
  "/erp/stayview",
  "/erp/arrivals",
  "/erp/in-house",
  "/erp/departures",
  "/erp/calendar",
]);

export function isFoCommandPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return FO_EXACT.has(path);
}
