/** DOT / BFDA / MoLHR printable compliance pack for Pelbu Suites. */

export type ComplianceDocKind = "isr" | "form" | "poster";

export type ComplianceDocMeta = {
  slug: string;
  kind: ComplianceDocKind;
  title: string;
  blurb: string;
  /** HCS / gate codes this supports */
  checklistCodes: string[];
  href: string;
};

export const COMPLIANCE_PACK: ComplianceDocMeta[] = [
  {
    slug: "isr",
    kind: "isr",
    title: "Internal Service Rules (ISR)",
    blurb:
      "Full Pelbu Suites ISR draft with MoLHR Chief Labour Administrator cover — print, sign, submit, then upload under Team → ISR.",
    checklistCodes: ["10.1.1", "gate.14"],
    href: "/erp/compliance/isr",
  },
  {
    slug: "fire-drill",
    kind: "form",
    title: "Fire drill & evacuation attendance",
    blurb: "Date, scenario, staff present, assembly point, drill lead sign-off.",
    checklistCodes: ["gate.10", "7.2.14"],
    href: "/erp/compliance/forms/fire-drill",
  },
  {
    slug: "incident-sop",
    kind: "form",
    title: "Incident reporting SOP",
    blurb: "Communication flow template for guest/staff/food-borne incidents.",
    checklistCodes: ["gate.12", "7.4.4", "7.1.4"],
    href: "/erp/compliance/forms/incident-sop",
  },
  {
    slug: "incident-log",
    kind: "form",
    title: "Incident log book",
    blurb: "Blank rows for date, type, action, follow-up, closed-by.",
    checklistCodes: ["gate.12", "7.1.4"],
    href: "/erp/compliance/forms/incident-log",
  },
  {
    slug: "training-plan",
    kind: "form",
    title: "Annual training plan",
    blurb: "Topics, frequency, owner, target roles for the year.",
    checklistCodes: ["gate.14", "10.1.2", "10.1.3"],
    href: "/erp/compliance/forms/training-plan",
  },
  {
    slug: "training-attendance",
    kind: "form",
    title: "Training attendance sheet",
    blurb: "Session title, date, trainer, staff signatures.",
    checklistCodes: ["gate.14", "10.1.2"],
    href: "/erp/compliance/forms/training-attendance",
  },
  {
    slug: "pest-control",
    kind: "form",
    title: "Pest control log",
    blurb: "Visit date, contractor, areas treated, chemicals, next due.",
    checklistCodes: ["gate.5", "7.1.2"],
    href: "/erp/compliance/forms/pest-control",
  },
  {
    slug: "food-waste",
    kind: "form",
    title: "Food-waste management log",
    blurb: "Daily kitchen / F&B waste by type, weight/volume, disposal route.",
    checklistCodes: ["gate.13", "8.3.2"],
    href: "/erp/compliance/forms/food-waste",
  },
  {
    slug: "temp-log",
    kind: "form",
    title: "Fridge & freezer temperature log",
    blurb: "AM/PM readings by unit — print blank sheets for the kitchen wall.",
    checklistCodes: ["6.2.1", "6.2.3", "gate.4"],
    href: "/erp/compliance/forms/temp-log",
  },
  {
    slug: "cleaning",
    kind: "form",
    title: "Kitchen cleaning sign-off",
    blurb: "Area checklist with shift lead initials.",
    checklistCodes: ["6.2.1", "6.2.2"],
    href: "/erp/compliance/forms/cleaning",
  },
  {
    slug: "medical-cert",
    kind: "form",
    title: "Staff medical & BAFRA cert register",
    blurb: "Name, role, medical exam date, BAFRA/food-handler cert, expiry.",
    checklistCodes: ["6.2.4", "6.2.9"],
    href: "/erp/compliance/forms/medical-cert",
  },
  {
    slug: "waste-segregation",
    kind: "form",
    title: "Waste segregation & recycling log",
    blurb: "Collection dates by stream (wet / dry / recyclable / hazardous).",
    checklistCodes: ["6.3.2", "8.3.5", "8.3.6"],
    href: "/erp/compliance/forms/waste-segregation",
  },
  {
    slug: "security-patrol",
    kind: "form",
    title: "Security patrol log",
    blurb: "Round times, areas checked, observations, signature.",
    checklistCodes: ["7.3.9"],
    href: "/erp/compliance/forms/security-patrol",
  },
  {
    slug: "waste-bins",
    kind: "poster",
    title: "Waste segregation bin poster",
    blurb: "Wall poster — colour-coded wet / dry / recyclable / hazardous.",
    checklistCodes: ["6.3.1", "6.3.2", "8.3.5"],
    href: "/erp/compliance/posters/waste-bins",
  },
  {
    slug: "recycling",
    kind: "poster",
    title: "Recycling & re-use poster",
    blurb: "Guest/staff reminder for bottles, cardboard, glass, compost route.",
    checklistCodes: ["8.3.6", "gate.13"],
    href: "/erp/compliance/posters/recycling",
  },
  {
    slug: "handwash",
    kind: "poster",
    title: "Handwash / food hygiene poster",
    blurb: "BAFRA-style kitchen handwash steps for staff wash stations.",
    checklistCodes: ["6.2.1", "6.2.6", "gate.4"],
    href: "/erp/compliance/posters/handwash",
  },
  {
    slug: "food-safety",
    kind: "poster",
    title: "Food safety kitchen rules poster",
    blurb: "Temp danger zone, cross-contamination, uniform, illness reporting.",
    checklistCodes: ["6.2.3", "7.1.4", "gate.4"],
    href: "/erp/compliance/posters/food-safety",
  },
];

export function getComplianceDoc(slug: string) {
  return COMPLIANCE_PACK.find((d) => d.slug === slug) ?? null;
}

export const PELBU_PROPERTY = {
  name: "Pelbu Suites",
  legalName: "Pelbu Suites",
  address: "Olakha, Thimphu, Bhutan",
  addressDetail: "Next to Shop No. 7 / Asha Bakery, Olakha",
  phone: "+975 16193410",
  email: "pelbusuites@gmail.com",
  tradeLicenseHint: "Trade licence on file (Settings → Compliance)",
} as const;
