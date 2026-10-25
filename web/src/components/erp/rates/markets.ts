export const RATE_MARKETS = [
  { code: "public", label: "Public / rack" },
  { code: "agents", label: "Agents" },
  { code: "mou_agents", label: "Contract agents" },
  { code: "friends", label: "Friends" },
  { code: "family", label: "Family" },
  { code: "mutual_friends", label: "Mutual friends" },
] as const;

export const RATE_SEASONS = [
  { code: "peak", label: "Peak" },
  { code: "lean", label: "Lean" },
  { code: "off", label: "Off" },
] as const;

export const NAMED_RATE_LABELS = [
  "Contract",
  "Fill-up",
  "Festival",
  "Personal",
  "Standard",
] as const;

export function marketLabel(code: string): string {
  return RATE_MARKETS.find((market) => market.code === code)?.label ?? code;
}

export function seasonLabel(code: string): string {
  return RATE_SEASONS.find((season) => season.code === code)?.label ?? code;
}
