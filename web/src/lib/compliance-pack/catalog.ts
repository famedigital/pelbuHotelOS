/** DOT / BFDA / MoLHR / BAFRA printable compliance pack for Pelbu Suites. */

export type ComplianceDocKind = "isr" | "form" | "poster";

/** Department that owns printing / daily use of this doc */
export type ComplianceDepartment =
  | "all"
  | "management"
  | "hr"
  | "stores"
  | "kitchen"
  | "fnb"
  | "housekeeping"
  | "engineering";

export type ComplianceDocMeta = {
  slug: string;
  kind: ComplianceDocKind;
  title: string;
  blurb: string;
  /** HCS / gate codes this supports */
  checklistCodes: string[];
  href: string;
  /** Primary owner for department binders */
  department?: ComplianceDepartment;
  /** BAFRA / BFDA food-safety pack */
  bafra?: boolean;
};

export const COMPLIANCE_DEPARTMENTS: {
  id: ComplianceDepartment;
  label: string;
}[] = [
  { id: "management", label: "Management / GM" },
  { id: "hr", label: "Human Resources" },
  { id: "stores", label: "Stores & Receiving" },
  { id: "kitchen", label: "Kitchen / Food Production" },
  { id: "fnb", label: "F&B Service" },
  { id: "housekeeping", label: "Housekeeping" },
  { id: "engineering", label: "Engineering / Maintenance" },
];

export const COMPLIANCE_PACK: ComplianceDocMeta[] = [
  {
    slug: "isr",
    kind: "isr",
    title: "Internal Service Rules (ISR)",
    blurb:
      "Full Pelbu Suites ISR draft with MoLHR Chief Labour Administrator cover — print, sign, submit, then upload under Team → ISR.",
    checklistCodes: ["10.1.1", "gate.14"],
    href: "/erp/compliance/isr",
    department: "hr",
  },
  {
    slug: "bafra-dept-matrix",
    kind: "form",
    title: "BAFRA department record matrix (Clause 8.13)",
    blurb:
      "Who owns each mandatory record type — print as the cover sheet for department binders.",
    checklistCodes: ["8.13", "gate.4"],
    href: "/erp/compliance/forms/bafra-dept-matrix",
    department: "management",
    bafra: true,
  },
  {
    slug: "bafra-licenses",
    kind: "form",
    title: "BAFRA licences & regulatory documents checklist",
    blurb:
      "Food business licence, medical certs, pest contract, water test, waste clearance — expiry & file location.",
    checklistCodes: ["gate.4", "6.2.9"],
    href: "/erp/compliance/forms/bafra-licenses",
    department: "management",
    bafra: true,
  },
  {
    slug: "bafra-self-audit",
    kind: "form",
    title: "BAFRA weekly self-inspection checklist",
    blurb:
      "Management internal audit: licences, temps, chemicals, handwash, pest, water, logbooks.",
    checklistCodes: ["8.13", "gate.4"],
    href: "/erp/compliance/forms/bafra-self-audit",
    department: "management",
    bafra: true,
  },
  {
    slug: "capa",
    kind: "form",
    title: "Corrective & preventive action (CAPA) log",
    blurb: "Findings, root cause, corrective/preventive actions, owner, close-out.",
    checklistCodes: ["8.13(b)(xii)"],
    href: "/erp/compliance/forms/capa",
    department: "management",
    bafra: true,
  },
  {
    slug: "recall-traceability",
    kind: "form",
    title: "Product recall & traceability log",
    blurb: "Batch/lot, supplier, distribution, recall action — Clause 8.13(b)(iv).",
    checklistCodes: ["8.13(b)(iv)"],
    href: "/erp/compliance/forms/recall-traceability",
    department: "management",
    bafra: true,
  },
  {
    slug: "fire-drill",
    kind: "form",
    title: "Fire drill & evacuation attendance",
    blurb: "Date, scenario, staff present, assembly point, drill lead sign-off.",
    checklistCodes: ["gate.10", "7.2.14"],
    href: "/erp/compliance/forms/fire-drill",
    department: "management",
  },
  {
    slug: "incident-sop",
    kind: "form",
    title: "Incident reporting SOP",
    blurb: "Communication flow template for guest/staff/food-borne incidents.",
    checklistCodes: ["gate.12", "7.4.4", "7.1.4"],
    href: "/erp/compliance/forms/incident-sop",
    department: "management",
  },
  {
    slug: "incident-log",
    kind: "form",
    title: "Incident log book",
    blurb: "Blank rows for date, type, action, follow-up, closed-by.",
    checklistCodes: ["gate.12", "7.1.4"],
    href: "/erp/compliance/forms/incident-log",
    department: "management",
  },
  {
    slug: "training-plan",
    kind: "form",
    title: "Annual training plan",
    blurb: "Topics, frequency, owner, target roles for the year.",
    checklistCodes: ["gate.14", "10.1.2", "10.1.3", "8.13(b)(ix)"],
    href: "/erp/compliance/forms/training-plan",
    department: "hr",
    bafra: true,
  },
  {
    slug: "training-attendance",
    kind: "form",
    title: "Training attendance sheet",
    blurb: "Session title, date, trainer, staff signatures.",
    checklistCodes: ["gate.14", "10.1.2", "8.13(b)(ix)"],
    href: "/erp/compliance/forms/training-attendance",
    department: "hr",
    bafra: true,
  },
  {
    slug: "medical-cert",
    kind: "form",
    title: "Staff medical & BAFRA cert register",
    blurb: "Name, role, medical exam date, BAFRA/food-handler cert, expiry.",
    checklistCodes: ["6.2.4", "6.2.9", "8.13(b)(viii)"],
    href: "/erp/compliance/forms/medical-cert",
    department: "hr",
    bafra: true,
  },
  {
    slug: "receiving-log",
    kind: "form",
    title: "Receiving & temperature control log",
    blurb:
      "Incoming materials: supplier, vehicle, arrival temp, expiry, accept/reject.",
    checklistCodes: ["8.13(b)(i)", "6.2.3"],
    href: "/erp/compliance/forms/receiving-log",
    department: "stores",
    bafra: true,
  },
  {
    slug: "sop-food-storage",
    kind: "form",
    title: "SOP 02 — Safe food storage & inventory",
    blurb: "FIFO, raw-below-RTE, dry goods off floor, twice-daily fridge checks.",
    checklistCodes: ["6.2.1", "8.13(b)(v)"],
    href: "/erp/compliance/forms/sop-food-storage",
    department: "stores",
    bafra: true,
  },
  {
    slug: "sop-personal-hygiene",
    kind: "form",
    title: "SOP 01 — Personal hygiene of food handlers",
    blurb:
      "Full policy: medical fitness, uniform, jewellery, 20-second handwash, illness/injury, training.",
    checklistCodes: ["6.2.6", "6.2.4", "gate.4"],
    href: "/erp/compliance/forms/sop-personal-hygiene",
    department: "kitchen",
    bafra: true,
  },
  {
    slug: "sop-food-prep",
    kind: "form",
    title: "SOP 03 — Food preparation & cooking",
    blurb:
      "Colour-coded boards, safe thaw, cook ≥75°C, hot hold >60°C, cold ≤4°C.",
    checklistCodes: ["6.2.3", "8.13(b)(iii)"],
    href: "/erp/compliance/forms/sop-food-prep",
    department: "kitchen",
    bafra: true,
  },
  {
    slug: "sop-kitchen-cleaning",
    kind: "form",
    title: "SOP 04 — Kitchen cleaning, sanitization & waste",
    blurb: "Clean-as-you-go, 3-sink method, bins, grease traps, chemical control.",
    checklistCodes: ["6.2.1", "6.2.2", "8.12(d)"],
    href: "/erp/compliance/forms/sop-kitchen-cleaning",
    department: "kitchen",
    bafra: true,
  },
  {
    slug: "temp-log",
    kind: "form",
    title: "Fridge & freezer temperature log",
    blurb: "AM/PM readings by unit — print blank sheets for the kitchen wall.",
    checklistCodes: ["6.2.1", "6.2.3", "gate.4", "8.13(b)(iii)"],
    href: "/erp/compliance/forms/temp-log",
    department: "kitchen",
    bafra: true,
  },
  {
    slug: "cook-temp-time",
    kind: "form",
    title: "Cooking & holding temperature/time log",
    blurb: "Core cook, hot hold, cold hold — Clause 8.13(b)(iii).",
    checklistCodes: ["8.13(b)(iii)", "6.2.3"],
    href: "/erp/compliance/forms/cook-temp-time",
    department: "kitchen",
    bafra: true,
  },
  {
    slug: "cleaning",
    kind: "form",
    title: "Kitchen cleaning sign-off (generic)",
    blurb: "Area checklist with shift lead initials — prefer daily/weekly/monthly BAFRA sheets.",
    checklistCodes: ["6.2.1", "6.2.2", "8.13(b)(vi)"],
    href: "/erp/compliance/forms/cleaning",
    department: "kitchen",
    bafra: true,
  },
  {
    slug: "cleaning-daily",
    kind: "form",
    title: "Kitchen cleaning log — Daily (BAFRA)",
    blurb:
      "AM / PM / Close checklist: surfaces, boards, floors, drains, bins, handwash, chemical lock-up.",
    checklistCodes: ["6.2.1", "6.2.2", "8.13(b)(vi)", "8.12(d)"],
    href: "/erp/compliance/forms/cleaning-daily",
    department: "kitchen",
    bafra: true,
  },
  {
    slug: "cleaning-weekly",
    kind: "form",
    title: "Kitchen cleaning log — Weekly (BAFRA)",
    blurb:
      "Deep clean ovens/fryers, fridge/freezer interiors, hood filters, grease trap, pest points.",
    checklistCodes: ["6.2.1", "6.2.2", "8.13(b)(vi)", "8.13(b)(vii)"],
    href: "/erp/compliance/forms/cleaning-weekly",
    department: "kitchen",
    bafra: true,
  },
  {
    slug: "cleaning-monthly",
    kind: "form",
    title: "Kitchen cleaning log — Monthly (BAFRA)",
    blurb:
      "Ceilings/vents, exhaust deep clean, walk-in & dry store audit, ice machine, chemical store, CAPA.",
    checklistCodes: ["6.2.1", "8.13(b)(vi)", "8.13(b)(x)", "8.12(d)"],
    href: "/erp/compliance/forms/cleaning-monthly",
    department: "kitchen",
    bafra: true,
  },
  {
    slug: "food-waste",
    kind: "form",
    title: "Food-waste management log",
    blurb: "Daily kitchen / F&B waste by type, weight/volume, disposal route.",
    checklistCodes: ["gate.13", "8.3.2"],
    href: "/erp/compliance/forms/food-waste",
    department: "kitchen",
    bafra: true,
  },
  {
    slug: "pest-control",
    kind: "form",
    title: "Pest control log",
    blurb: "Visit date, contractor, areas treated, chemicals, next due.",
    checklistCodes: ["gate.5", "7.1.2", "8.13(b)(vii)"],
    href: "/erp/compliance/forms/pest-control",
    department: "engineering",
    bafra: true,
  },
  {
    slug: "calibration",
    kind: "form",
    title: "Equipment calibration log",
    blurb: "Thermometers, probes, scales — pass/fail and next due.",
    checklistCodes: ["8.13(b)(x)"],
    href: "/erp/compliance/forms/calibration",
    department: "engineering",
    bafra: true,
  },
  {
    slug: "waste-segregation",
    kind: "form",
    title: "Waste segregation & recycling log",
    blurb: "Collection dates by stream (wet / dry / recyclable / hazardous).",
    checklistCodes: ["6.3.2", "8.3.5", "8.3.6"],
    href: "/erp/compliance/forms/waste-segregation",
    department: "housekeeping",
    bafra: true,
  },
  {
    slug: "security-patrol",
    kind: "form",
    title: "Security patrol log",
    blurb: "Round times, areas checked, observations, signature.",
    checklistCodes: ["7.3.9"],
    href: "/erp/compliance/forms/security-patrol",
    department: "management",
  },
  {
    slug: "waste-bins",
    kind: "poster",
    title: "Waste segregation bin poster",
    blurb: "Wall poster — colour-coded wet / dry / recyclable / hazardous.",
    checklistCodes: ["6.3.1", "6.3.2", "8.3.5"],
    href: "/erp/compliance/posters/waste-bins",
    department: "housekeeping",
  },
  {
    slug: "recycling",
    kind: "poster",
    title: "Recycling & re-use poster",
    blurb: "Guest/staff reminder for bottles, cardboard, glass, compost route.",
    checklistCodes: ["8.3.6", "gate.13"],
    href: "/erp/compliance/posters/recycling",
    department: "housekeeping",
  },
  {
    slug: "handwash",
    kind: "poster",
    title: "Handwash / food hygiene poster",
    blurb: "BAFRA-style kitchen handwash steps for staff wash stations.",
    checklistCodes: ["6.2.1", "6.2.6", "gate.4"],
    href: "/erp/compliance/posters/handwash",
    department: "kitchen",
    bafra: true,
  },
  {
    slug: "food-safety",
    kind: "poster",
    title: "Food safety kitchen rules poster",
    blurb: "Temp danger zone, cross-contamination, uniform, illness reporting.",
    checklistCodes: ["6.2.3", "7.1.4", "gate.4"],
    href: "/erp/compliance/posters/food-safety",
    department: "kitchen",
    bafra: true,
  },
];

export function getComplianceDoc(slug: string) {
  return COMPLIANCE_PACK.find((d) => d.slug === slug) ?? null;
}

export function complianceDocsForDepartment(dept: ComplianceDepartment) {
  return COMPLIANCE_PACK.filter(
    (d) => d.department === dept || (dept === "fnb" && d.slug === "sop-personal-hygiene"),
  );
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
