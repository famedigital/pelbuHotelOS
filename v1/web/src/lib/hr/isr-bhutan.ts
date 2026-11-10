/**
 * Bhutan Internal Service Rules (ISR) preparation guide.
 * Reference frame (not legal advice / not a substitute for the signed PDF):
 * - Labour and Employment Act of Bhutan 2007 (and amendments)
 * - Regulation on Working Conditions 2022
 * - NPPF contribution rules; Income Tax Act (payroll)
 *
 * The hotel must draft, submit to the competent Labour office, obtain approval,
 * sign, and upload the signed PDF here as the official record.
 */

export type IsrStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "active"
  | "superseded";

export const ISR_STATUS_LABEL: Record<IsrStatus, string> = {
  draft: "Draft",
  submitted: "Submitted to Labour",
  approved: "Labour approved",
  active: "Active (signed PDF on file)",
  superseded: "Superseded",
};

export type IsrChecklistSection = {
  id: string;
  title: string;
  blurb: string;
  items: string[];
};

/** Sections a Bhutan hotel ISR typically must cover before Labour submission. */
export const BHUTAN_ISR_CHECKLIST: IsrChecklistSection[] = [
  {
    id: "scope",
    title: "1. Scope & definitions",
    blurb: "Who the rules bind and how terms are used.",
    items: [
      "Employer legal name, trade name, property address, trade licence / GST reference",
      "Workers covered: permanent, contract, probation, part-time, casual (as applicable)",
      "Definitions: working time, overtime, rest, workplace, misconduct, ISR version date",
    ],
  },
  {
    id: "hours",
    title: "2. Hours of work, rest & public holidays",
    blurb: "Aligned with Regulation on Working Conditions 2022.",
    items: [
      "Normal daily / weekly hours (hotel shift patterns stated clearly)",
      "Rest breaks and weekly rest day",
      "Overtime: when allowed, rate (e.g. 1.5×), authorisation, record-keeping",
      "Night work / public holiday work and premium if required",
      "Roster publication notice for staff",
    ],
  },
  {
    id: "pay",
    title: "3. Wages, payslips & statutory deductions",
    blurb: "Transparency of pay — never undercut statutory floor rules.",
    items: [
      "Pay period (monthly / fortnightly), pay day, method of payment",
      "Basic wage vs allowances; no illegal deduction clauses",
      "NPPF employee + employer contributions on basic (state % if fixed by plan)",
      "Health contribution / tax (TDS) where applied",
      "Payslip contents; advance / loan recovery rules if any",
    ],
  },
  {
    id: "leave",
    title: "4. Leave & absence",
    blurb: "Must not be less favourable than statutory minimums.",
    items: [
      "Annual leave entitlement, accrual, carry-forward, encashment if any",
      "Sick leave and medical evidence thresholds",
      "Maternity / paternity (as required by law)",
      "Casual / unpaid leave and notice requirements",
      "Blackout seasons for hotels (if any) and approval path",
    ],
  },
  {
    id: "probation",
    title: "5. Recruitment, probation & contracts",
    items: [
      "Written appointment / contract commitment",
      "Probation length and confirmation",
      "Notice periods for resignation / termination (consistent with law)",
      "Work permit / CID obligations where relevant",
    ],
    blurb: "Clear entry and exit so disputes are reduced.",
  },
  {
    id: "conduct",
    title: "6. Conduct, discipline & grievance",
    blurb: "Fair process protects hotel and staff.",
    items: [
      "Standards of conduct (guest service, safety, honesty, attendance)",
      "Prohibited conduct and examples of gross misconduct",
      "Disciplinary steps: verbal → written warning → final → dismissal",
      "Right to be heard / appeal route (supervisor → GM / owner)",
      "Grievance procedure timelines",
    ],
  },
  {
    id: "health",
    title: "7. Health, safety & guest privacy",
    blurb: "Critical for hospitality operations.",
    items: [
      "Workplace safety duties (fire, kitchen, chemicals, heavy lift)",
      "Incident / injury reporting",
      "Food hygiene / uniform / personal hygiene standards where relevant",
      "Guest data, room privacy, and dignity of labour",
      "Anti-harassment and non-discrimination statement",
    ],
  },
  {
    id: "hotel",
    title: "8. Hotel-specific service standards",
    blurb: "Internal house rules staff must follow on duty.",
    items: [
      "Appearance and uniform",
      "Use of mobile phones, social media, guest photos",
      "F&B / bar / minibar handling and waste",
      "Key control, lost & found, and asset care",
      "Confidentiality of rates, agents, and VIP guests",
    ],
  },
  {
    id: "amend",
    title: "9. Amendment, filing & communication",
    blurb: "Labour expects a controlled, versioned document.",
    items: [
      "How amendments are approved (owner / GM) and re-filed with Labour if required",
      "Language of the rules (Dzongkha / English) as practised",
      "How workers receive a copy and acknowledge receipt",
      "Display / keeper of the signed original and this PDF archive",
    ],
  },
];

export const ISR_LABOUR_FILING_STEPS = [
  {
    step: 1,
    title: "Draft",
    body: "Complete the checklist and prepare the full ISR text (Word/PDF). Owner or GM signs internally when ready.",
  },
  {
    step: 2,
    title: "Submit to Labour",
    body: "File with the competent Labour office (district / Ministry as directed). Record office name, date, and reference number.",
  },
  {
    step: 3,
    title: "Labour approved",
    body: "Enter approval date and any stamp / reference on the returned instrument.",
  },
  {
    step: 4,
    title: "Sign & upload PDF",
    body: "Scan the signed (and stamp-approved) ISR as PDF and upload here. Mark Active so this is the in-force copy.",
  },
] as const;
