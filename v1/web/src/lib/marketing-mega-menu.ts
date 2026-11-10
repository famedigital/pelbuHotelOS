export type MarketingMegaLink = {
  href: string;
  title: string;
  description?: string;
};

export type MarketingMegaColumn = {
  heading: string;
  items: MarketingMegaLink[];
};

export type MarketingMegaSection = {
  label: string;
  /** Single href replaces mega panel (e.g. Pricing). */
  href?: string;
  columns?: MarketingMegaColumn[];
};

/** Innora SaaS marketing mega structure. */
export function buildMarketingMegaMenu(): MarketingMegaSection[] {
  return [
    {
      label: "Product",
      columns: [
        {
          heading: "Front office",
          items: [
            {
              href: "/demo",
              title: "Desk & arrivals",
              description: "Day sheet, check-in, and in-house in one place.",
            },
            {
              href: "/demo",
              title: "Folio & AR",
              description: "Guest bills, deposits, and travel-agent credit.",
            },
            {
              href: "/demo",
              title: "POS & F&B",
              description: "Restaurant, cafe, and room charge on the same folio.",
            },
          ],
        },
        {
          heading: "Portfolio",
          items: [
            {
              href: "/for/chain",
              title: "Multi-property",
              description: "One platform login model per hotel — clear isolation.",
            },
            {
              href: "/pricing",
              title: "BTN-ready rates",
              description: "Seasons, agent tiers, and public rack without Excel.",
            },
          ],
        },
      ],
    },
    {
      label: "Solutions",
      columns: [
        {
          heading: "Who it's for",
          items: [
            {
              href: "/for/leased",
              title: "Leased hotels",
              description: "Operators who need clean books and desk speed.",
            },
            {
              href: "/for/independent",
              title: "Independent",
              description: "Owner-run properties graduating from spreadsheets.",
            },
            {
              href: "/for/chain",
              title: "Small chains",
              description: "Shared agent directory, separate hotel logins.",
            },
          ],
        },
      ],
    },
    {
      label: "Pricing",
      href: "/pricing",
      columns: [
        {
          heading: "Plans",
          items: [
            {
              href: "/pricing",
              title: "Pricing",
              description: "Transparent packages for Bhutan operations.",
            },
            {
              href: "/conditions",
              title: "Conditions",
              description: "What is included before you book a demo.",
            },
          ],
        },
      ],
    },
    {
      label: "Company",
      columns: [
        {
          heading: "Learn more",
          items: [
            {
              href: "/demo",
              title: "Book a demo",
              description: "See desk, folio, and agent flows live.",
            },
            {
              href: "/status",
              title: "Status",
              description: "Platform health.",
            },
            {
              href: "/changelog",
              title: "Changelog",
              description: "What shipped recently.",
            },
          ],
        },
      ],
    },
  ];
}
