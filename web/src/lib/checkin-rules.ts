export type GuestOrigin =
  | "international"
  | "regional"
  | "official"
  | "local";

export function normalizeGuestOrigin(value: string | null | undefined): GuestOrigin {
  if (
    value === "regional" ||
    value === "official" ||
    value === "local" ||
    value === "international"
  ) {
    return value;
  }
  return "international";
}

export function guideRequired(origin: GuestOrigin): boolean {
  return origin === "international";
}

/** SDF reference required for international / regional tourist flows. */
export function sdfRequired(origin: GuestOrigin): boolean {
  return origin === "international" || origin === "regional";
}

/** Passport preferred for international; CID acceptable for local/official. */
export function idLabel(origin: GuestOrigin): string {
  if (origin === "local" || origin === "official") return "CID / ID";
  if (origin === "regional") return "Passport / CID";
  return "Passport";
}

export function validateCheckInDocs(args: {
  origin: GuestOrigin;
  guideNumber: string | null | undefined;
  guests: Array<{
    fullName: string;
    passportOrCid: string;
    sdfRef: string;
  }>;
  hasDriverBeds: boolean;
  driverName: string | null | undefined;
}): string | null {
  if (guideRequired(args.origin) && !args.guideNumber?.trim()) {
    return "Guide number is required for international tourists.";
  }
  if (args.hasDriverBeds && !args.driverName?.trim()) {
    return "Driver name is required when driver beds are assigned.";
  }
  if (args.guests.length === 0) {
    return "Add at least one guest.";
  }
  for (const [i, guest] of args.guests.entries()) {
    if (!guest.fullName.trim()) {
      return `Guest ${i + 1}: full name is required.`;
    }
    if (!guest.passportOrCid.trim()) {
      return `Guest ${i + 1}: ${idLabel(args.origin)} is required.`;
    }
    if (sdfRequired(args.origin) && !guest.sdfRef.trim()) {
      return `Guest ${i + 1}: SDF reference is required.`;
    }
  }
  return null;
}

export function inventoryKindLabel(kind: string): string {
  switch (kind) {
    case "guide_comp":
      return "Guide bed";
    case "driver_comp":
      return "Driver bed";
    case "staff":
      return "Staff";
    default:
      return "Guest room";
  }
}
