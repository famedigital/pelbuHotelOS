/** Service conditions — bump CONDITIONS_VERSION when copy changes. */

export const CONDITIONS_VERSION = "2026-09-15";

export const SUPPORT_HOURS = "Mon–Sat 09:00–18:00 (Bhutan time)";

export type ConditionRule = {
  title: string;
  body: string;
};

export const CONDITION_RULES: ConditionRule[] = [
  {
    title: "Payment first",
    body: "Onboarding and staff training fees are due before login credentials are issued. Monthly or annual AMC is due by the invoice date. After 7 days’ written notice of non-payment, desk access may be suspended until the account is current.",
  },
  {
    title: "Named contacts only",
    body: "Each property may register a maximum of two authorised callers or WhatsApp numbers. Support for other callers is redirected to documentation or the authorised contacts.",
  },
  {
    title: "Support hours",
    body: `Standard support is available ${SUPPORT_HOURS}. Outside those hours we only treat true emergencies: payment gateway failure or complete login outage.`,
  },
  {
    title: "Fair use",
    body: "After training, included how-to support is about 4 hours per month per property. Extra time is billable at BTN 1,500 per hour after written notice. Retraining because staff did not attend or follow training is a paid refresher, not free support.",
  },
  {
    title: "No abuse",
    body: "Insults, threats, or harassment of Fame Digital or distributor staff are not tolerated. Support may be limited to critical outages; repeated abuse may result in account suspension.",
  },
  {
    title: "Your duties",
    body: "You must provide accurate room counts, tax details, and bank payment proof; keep trained staff on the desk; not share owner passwords; and report software defects with clear steps or screenshots.",
  },
  {
    title: "What we fix for free",
    body: "Confirmed software defects are fixed at no charge. Operational advice, data entry, “do night audit for us,” OTA dispute handling, and third-party hardware issues are out of scope or paid separately.",
  },
  {
    title: "Your data",
    body: "You own your hotel data. Exports are available while AMC is current. One-time onboarding and training fees are non-refundable once go-live has started.",
  },
  {
    title: "Room band honesty",
    body: "If live room units exceed your package band, you must upgrade within 30 days or we may soft-lock adding more rooms until you do.",
  },
  {
    title: "Distributor first",
    body: "If your hotel is under a partner office, contact that partner first. Fame Digital is for escalation — not a second helpdesk for the same request.",
  },
];
