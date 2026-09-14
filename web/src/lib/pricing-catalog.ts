/** Catalog packages & fees — seeds match /admin editable table. */

export type PackageCode = "classic" | "plus" | "pro" | "portfolio" | "chain";

export type CatalogPackage = {
  code: PackageCode;
  name: string;
  roomMin: number;
  roomMax: number | null;
  msrpBtnMo: number;
  msrpBtnYear: number;
  royaltyBtnMo: number;
  includes: string[];
  notIncluded: string[];
  featureFlags: {
    channel: boolean;
    pos: boolean;
    finance: boolean;
    payroll: boolean;
    multiProperty: boolean;
  };
};

export const CATALOG_PACKAGES: CatalogPackage[] = [
  {
    code: "classic",
    name: "Classic",
    roomMin: 1,
    roomMax: 15,
    msrpBtnMo: 3500,
    msrpBtnYear: 35000,
    royaltyBtnMo: 1200,
    includes: [
      "Front office reservations & stay view",
      "Check-in / check-out & folios",
      "Housekeeping board",
      "Night audit",
      "Basic reports",
      "Staff logins within seat limit",
      "Ticket support in business hours (fair use)",
    ],
    notIncluded: [
      "Channel manager / OTA sync",
      "Custom reports or data entry by our staff",
      "On-site visits beyond training days",
      "24×7 WhatsApp",
      "Guest booking website",
      "Fixing hotel Wi‑Fi, printers, or PCs",
    ],
    featureFlags: {
      channel: false,
      pos: false,
      finance: false,
      payroll: false,
      multiProperty: false,
    },
  },
  {
    code: "plus",
    name: "Plus",
    roomMin: 16,
    roomMax: 40,
    msrpBtnMo: 5500,
    msrpBtnYear: 55000,
    royaltyBtnMo: 1800,
    includes: [
      "Everything in Classic",
      "POS / F&B light",
      "Finance light (expenses, vendors)",
    ],
    notIncluded: [
      "Channel manager",
      "Full payroll / HR suite",
      "Unlimited consulting support",
    ],
    featureFlags: {
      channel: false,
      pos: true,
      finance: true,
      payroll: false,
      multiProperty: false,
    },
  },
  {
    code: "pro",
    name: "Pro",
    roomMin: 41,
    roomMax: 80,
    msrpBtnMo: 8500,
    msrpBtnYear: 85000,
    royaltyBtnMo: 2500,
    includes: [
      "Everything in Plus",
      "Channel manager connectivity",
      "Stronger inventory & reporting",
    ],
    notIncluded: ["Dedicated account manager", "Custom development"],
    featureFlags: {
      channel: true,
      pos: true,
      finance: true,
      payroll: false,
      multiProperty: false,
    },
  },
  {
    code: "portfolio",
    name: "Portfolio (leased)",
    roomMin: 1,
    roomMax: null,
    msrpBtnMo: 3000,
    msrpBtnYear: 30000,
    royaltyBtnMo: 1000,
    includes: [
      "Per-property Classic-grade desk",
      "One owner account, many locations",
      "Property switcher",
      "Portfolio fee 2,000 BTN/mo on top (see pricing)",
    ],
    notIncluded: ["Consolidated chain P&L (coming later)", "Shared guest CRS across brands"],
    featureFlags: {
      channel: false,
      pos: true,
      finance: true,
      payroll: false,
      multiProperty: true,
    },
  },
  {
    code: "chain",
    name: "Chain",
    roomMin: 81,
    roomMax: null,
    msrpBtnMo: 12000,
    msrpBtnYear: 120000,
    royaltyBtnMo: 3000,
    includes: [
      "Custom quote from floor price",
      "Multi-property brand standards",
      "Priority onboarding",
    ],
    notIncluded: ["Unlimited free customisation"],
    featureFlags: {
      channel: true,
      pos: true,
      finance: true,
      payroll: true,
      multiProperty: true,
    },
  },
];

export const ONE_TIME_FEES = {
  onboardingBtn: 25_000,
  trainingBtn: 15_000,
  trainingSeatsIncluded: 5,
  extraTraineeBtn: 2_500,
  extraPortfolioPropertySetupBtn: 10_000,
  portfolioFeeMoBtn: 2_000,
  fairUseHoursMo: 4,
  billableSupportHourBtn: 1_500,
} as const;

export function formatBtn(n: number): string {
  return `BTN ${n.toLocaleString("en-BT")}`;
}
