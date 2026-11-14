/**
 * Pure resolve for single sign-in → hotel desk vs portal role.
 * Hotel org membership always wins over portal accounts.
 */

export type UnifiedLoginKind = "hotel" | "agent" | "guide" | "driver" | "none";

export type UnifiedLoginSignals = {
  isOrgMember: boolean;
  isAgent: boolean;
  isGuide: boolean;
  isDriver: boolean;
};

export function resolveUnifiedLoginKind(
  signals: UnifiedLoginSignals,
): UnifiedLoginKind {
  if (signals.isOrgMember) return "hotel";
  if (signals.isAgent) return "agent";
  if (signals.isGuide) return "guide";
  if (signals.isDriver) return "driver";
  return "none";
}

export function defaultPortalHomeRoute(
  role: "agent" | "guide" | "driver",
): string {
  if (role === "agent") return "/partner";
  if (role === "guide") return "/guide";
  return "/driver";
}
