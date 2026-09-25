import {
  agentRateTier,
  type RateTier,
} from "@/lib/rates";

/** FO rate pickup on DeskBook — maps to sheet tier / NC / custom. */
export type RatePickupKind =
  | "public"
  | "personal"
  | "agent"
  | "special"
  | "nc"
  | "custom";

export type PersonalSubTier = "friends" | "family" | "mutual_friends";

export type RatePickupOption = {
  value: RatePickupKind;
  label: string;
};

export type RatePickupAgent = {
  company_name: string;
  rate_tier?: string | null;
};

const PERSONAL_LABELS: Record<PersonalSubTier, string> = {
  friends: "Friends",
  family: "Family",
  mutual_friends: "Mutual",
};

export const PERSONAL_SUB_OPTIONS: {
  id: PersonalSubTier;
  label: string;
}[] = [
  { id: "friends", label: "Friends" },
  { id: "family", label: "Family" },
  { id: "mutual_friends", label: "Mutual" },
];

/** Whether agent profile uses a non-generic sheet tier (MOU / special). */
export function agentHasSpecialTier(
  rateTier: string | null | undefined,
): boolean {
  return agentRateTier(rateTier) !== "agents";
}

export function buildRatePickupOptions(
  agent: RatePickupAgent | null | undefined,
): RatePickupOption[] {
  const opts: RatePickupOption[] = [
    { value: "public", label: "Public rate" },
    { value: "personal", label: "Personal guest" },
  ];
  const name = agent?.company_name?.trim();
  if (name) {
    if (agentHasSpecialTier(agent?.rate_tier)) {
      opts.push({
        value: "special",
        label: `Special · ${name}`,
      });
    } else {
      opts.push({
        value: "agent",
        label: `Agent · ${name}`,
      });
    }
  }
  opts.push(
    { value: "nc", label: "NC (complimentary)" },
    { value: "custom", label: "Custom" },
  );
  return opts;
}

export type ResolvedRatePickup = {
  /** Sheet tier for preview/submit; null when NC/custom don't need walk-in tier. */
  rateTier: RateTier | null;
  guestRateKind: "rack" | "comp";
  /** Clear line agreed overrides when switching onto this pickup. */
  clearAgreed: boolean;
  /** Open the Nu/night dialog after selecting Custom. */
  openCustomDialog: boolean;
  /** Short label for left-rail summary. */
  summaryLabel: string;
};

export function resolveRatePickup(input: {
  pickup: RatePickupKind;
  personalSub: PersonalSubTier;
  agent: RatePickupAgent | null | undefined;
}): ResolvedRatePickup {
  const { pickup, personalSub, agent } = input;
  const agentName = agent?.company_name?.trim() || "Agent";

  switch (pickup) {
    case "public":
      return {
        rateTier: "public",
        guestRateKind: "rack",
        clearAgreed: true,
        openCustomDialog: false,
        summaryLabel: "Public",
      };
    case "personal":
      return {
        rateTier: personalSub,
        guestRateKind: "rack",
        clearAgreed: true,
        openCustomDialog: false,
        summaryLabel: `Personal · ${PERSONAL_LABELS[personalSub]}`,
      };
    case "agent":
      return {
        rateTier: agentRateTier(agent?.rate_tier),
        guestRateKind: "rack",
        clearAgreed: true,
        openCustomDialog: false,
        summaryLabel: `Agent · ${agentName}`,
      };
    case "special":
      return {
        rateTier: agentRateTier(agent?.rate_tier),
        guestRateKind: "rack",
        clearAgreed: true,
        openCustomDialog: false,
        summaryLabel: `Special · ${agentName}`,
      };
    case "nc":
      return {
        rateTier: null,
        guestRateKind: "comp",
        clearAgreed: false,
        openCustomDialog: false,
        summaryLabel: "NC",
      };
    case "custom":
      return {
        rateTier: null,
        guestRateKind: "rack",
        clearAgreed: false,
        openCustomDialog: true,
        summaryLabel: "Custom",
      };
    default:
      return {
        rateTier: "public",
        guestRateKind: "rack",
        clearAgreed: true,
        openCustomDialog: false,
        summaryLabel: "Public",
      };
  }
}

/** Keep pickup valid when agent is cleared or gains/loses special tier. */
export function coerceRatePickup(
  pickup: RatePickupKind,
  agent: RatePickupAgent | null | undefined,
): RatePickupKind {
  if ((pickup === "agent" || pickup === "special") && !agent) {
    return "public";
  }
  if (pickup === "agent" && agent && agentHasSpecialTier(agent.rate_tier)) {
    return "special";
  }
  if (pickup === "special" && agent && !agentHasSpecialTier(agent.rate_tier)) {
    return "agent";
  }
  return pickup;
}
