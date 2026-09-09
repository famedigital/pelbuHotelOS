/**
 * Operational guidance for self-assessment (not official DOT legal text).
 * Catalog criteria remain the source of “what is on the form.”
 */

export type GuidanceSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  links?: Array<{ label: string; href: string }>;
};

export const OVERVIEW_GUIDANCE: GuidanceSection = {
  id: "overview",
  title: "DOT, Trade, and BFDA (BAFRA)",
  paragraphs: [
    "This module is a digital walk-through of Bhutan’s Hotel Classification System (2024) assessor checklists (3★ mid-scale / 4★ premium). Use it to prepare your property before Department of Tourism (DOT) inspectors arrive.",
    "Three regulators show up in the form even though classification is DOT-owned:",
    "Trade / MoICE — valid trade license, TPN, license-holder contacts (Property info + Entry gate #2).",
    "BFDA (formerly BAFRA) — food safety / sanitation clearance for premises that serve food (Entry gate #4 + Kitchen / F&B sections).",
    "DOT — full physical & service standards on this checklist plus the scoring sheet. Entry-gate items are absolute: if any are No, you are not ready for physical classification assessment.",
  ],
  bullets: [
    "Self-assessment only — this is not an online filing to government portals.",
    "Photograph evidence and save remarks so the owner/GM can fix gaps before inspection day.",
    "Mark Recreation / MICE as N/A only if the hotel truly has no such facilities (do not mark N/A to hide missing M items).",
  ],
};

export const SCORING_GUIDANCE: GuidanceSection = {
  id: "scoring",
  title: "How M, Q, and P scoring works",
  paragraphs: [
    "M — Mandatory: score 1 (meets) or 0 (does not). All required mandatory indicators for the star level must be met. Missing M fails classification even if optional points are high. Official scoring sheets: 3★ needs 163 M, 4★ needs 192 M.",
    "Q — Quality: rate 1–5. These evaluate cleanliness, maintenance, and guest experience in more detail. A rating below 1 on required quality indicators fails the property.",
    "P — Optional / premium points: award 0 up to the maximum shown on that criterion. Useful to lift excellence bands; they cannot replace failed M items.",
    "X — Not applicable for this star level. Leave as N/A; no score entry.",
    "Custom size / qty notes (e.g. “22 sqm+”, “4 psc”) are Mandatory — measure and answer Yes/No; put the measured value in remarks.",
  ],
  bullets: [
    "Entry gate: all 20 items Yes before you treat the assessment as “ready.”",
    "Live scoreboard on the Score step mirrors the official roll-up by area.",
    "When ready, print the summary pack for the owner walk-through.",
  ],
};

export const WALK_ORDER_GUIDANCE: GuidanceSection = {
  id: "walk-order",
  title: "Recommended walk order",
  paragraphs: [
    "Work the steps in this order so evidence and staff interviews line up with how assessors typically move through the building.",
  ],
  bullets: [
    "1. Complete Property information (license, TPN, rooms, staff counts).",
    "2. Entry gate on the desk: pull Trade license, insurance, BFDA clearance, pest contract, SOPs, fire-drill records into folders or photo them.",
    "3. Public areas & reception (General + Reception) — signage, smoking policy, lobby, PMS, payments, luggage.",
    "4. Sample guest rooms and bathrooms (Bedroom + Bathroom) — size, fittings, linen, amenities.",
    "5. F&B and kitchen — menus, service hours, cook certification, storage, hand-wash, extraction.",
    "6. Health & safety — fire, first aid, emergency power, security.",
    "7. Environment, quality/online, HR paperwork.",
    "8. Recreation and MICE only if the hotel operates them; otherwise mark section N/A on the Score step.",
  ],
};

export const SECTION_GUIDANCE: Record<
  string,
  { title: string; tips: string[] }
> = {
  gate: {
    title: "Entry gate (desk assessment)",
    tips: [
      "Trade license: current document, holder CID and phone (match Property info).",
      "BFDA clearance: Food Safety License or local hygiene clearance if you serve food.",
      "Public liability & statutory insurance: certificates with dates visible.",
      "Pest control contract: signed, recent service records.",
      "24/7 contact + security: roster or SOP showing coverage.",
      "Fire drills, disaster plan, incident SOP, training attendance: paper or digital logs with dates — print blanks from /erp/compliance.",
      "Water treatment & QMS/SOP evidence: link operations SOPs (front desk, HK, kitchen).",
      "Upload photos or PDFs on each failed/pending row; masters in Settings → Compliance and printable pack at /erp/compliance.",
    ],
  },
  general: {
    title: "General / public areas",
    tips: [
      "Check external and directional signage lighting after dusk.",
      "Confirm minimum room count for star class (8 rooms mid-scale+).",
      "Public toilets: soap, dry option, gender separation, ventilation.",
      "Document parking type (on-site / nearby / tour bus).",
    ],
  },
  reception: {
    title: "Reception & services",
    tips: [
      "PMS for check-in/out: Pelbu OS desk counts as your PMS — be ready to demonstrate.",
      "Cashless payments + 24h or extended desk hours per star requirement.",
      "English-speaking staff on duty; luggage / wake-up / baby equipment on request.",
      "Photograph lobby seating and reception desk.",
    ],
  },
  bedroom: {
    title: "Bedrooms",
    tips: [
      "Measure room/bathroom sizes against the form notes for your star.",
      "Sample 3–5 rooms of each type; photo bed linen, wardrobe, privacy locks, DND signs.",
      "X rows are not required for this star — skip scoring.",
    ],
  },
  bathroom: {
    title: "Bathrooms",
    tips: [
      "Hot/cold water, soap, towels per guest, WC paper + spare, bin, lighting at basin.",
      "Higher stars: bathrobes, slippers, cosmetic amenities — check star M vs P rows.",
    ],
  },
  fnb: {
    title: "Food & beverage",
    tips: [
      "If you have no F&B, still complete applicable rows honestly; kitchen/BFDA still apply when you cook.",
      "Menus, opening days, crockery quality, non-smoking F&B areas.",
    ],
  },
  kitchen: {
    title: "Kitchen operations (BFDA focus)",
    tips: [
      "Segregated cold/dry storage, extraction, hand-wash points.",
      "At least one trained/certified cook on duty (BFDA / HACCP skills).",
      "Medical checks / head covering for production staff where required.",
      "Drinking water treatment evidence matches entry gate water item.",
    ],
  },
  health: {
    title: "Health & safety",
    tips: [
      "Fire extinguishers, exit lighting, assembly point signage — photo + last inspection date in remarks.",
      "First-aid kit location known to staff; emergency contacts posted.",
      "Electrical safety and emergency power as applicable.",
    ],
  },
  environment: {
    title: "Environmental practices",
    tips: [
      "Sustainability guide / practices and CSR initiative documentation (also on entry gate).",
      "Waste segregation, food-waste program, energy/water saving measures.",
    ],
  },
  quality: {
    title: "Quality control & online",
    tips: [
      "Website / booking content accurate; response process for reviews.",
      "Operational SOPs and guest feedback loop evidence.",
    ],
  },
  hr: {
    title: "Human resources",
    tips: [
      "Staff list with roles, FT/PT status, qualifications.",
      "Training plan + attendance (entry gate + this section).",
      "Use /erp/hr and /erp/training as supporting systems; print or screenshot for the binder.",
    ],
  },
  recreation: {
    title: "Recreational facilities",
    tips: [
      "If the hotel has no pool/spa/gym, mark this section N/A on the Score step.",
      "If present: safety signage, opening hours, cleanliness photos.",
    ],
  },
  mice: {
    title: "Event facilities (MICE)",
    tips: [
      "Mark N/A if no meeting/event spaces.",
      "If present: capacity, AV, seating, toilets access, F&B support for events.",
    ],
  },
};

/** Map entry-gate item codes to compliance vault category codes where useful. */
export const GATE_EVIDENCE_HINTS: Record<
  string,
  { tip: string; complianceCode?: string }
> = {
  "gate.2": {
    tip: "Upload or open the current Trade license.",
    complianceCode: "trade_license",
  },
  "gate.3": {
    tip: "Public liability / statutory insurance certificates.",
    complianceCode: "insurance",
  },
  "gate.4": {
    tip: "BFDA Food Safety License or local hygiene clearance.",
  },
  "gate.5": {
    tip: "Signed pest control contract + last service report.",
  },
  "gate.10": {
    tip: "Fire drill attendance logs and evacuation procedure document.",
    complianceCode: "fire_safety",
  },
  "gate.11": {
    tip: "Written disaster management plan with review date.",
  },
  "gate.12": {
    tip: "Incident reporting SOP template and communication flow.",
  },
  "gate.14": {
    tip: "Annual training plan with attendance sheets.",
  },
  "gate.19": {
    tip: "Water treatment equipment proof / lab or vendor report.",
  },
  "gate.20": {
    tip: "QMS / operational SOP pack (FO, HK, Kitchen).",
  },
};

export function sectionGuidance(key: string) {
  return SECTION_GUIDANCE[key] ?? null;
}
