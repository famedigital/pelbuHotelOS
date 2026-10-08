import Link from "next/link";
import type { Metadata } from "next";
import { ProductFrame } from "@/components/marketing/ProductFrame";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";
import { CATALOG_PACKAGES } from "@/lib/pricing-catalog";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} — hotel software for Bhutan`,
  description: SITE_DESCRIPTION,
  robots: { index: true, follow: true },
};

const classic = CATALOG_PACKAGES.find((pkg) => pkg.code === "classic");
const plus = CATALOG_PACKAGES.find((pkg) => pkg.code === "plus");
const portfolio = CATALOG_PACKAGES.find((pkg) => pkg.code === "portfolio");
const chain = CATALOG_PACKAGES.find((pkg) => pkg.code === "chain");

const RING = ["Trade", "DOT", "BAFRA", "Agent", "Guide", "Driver", "Supplier"] as const;

const ANSWERS = [
  {
    problem:
      "A generic folio cannot keep up. Groups, meal plans, extra beds, and comps change during the stay.",
    module: "Dynamic folio",
    answer: "Room, EP or MAP, extras, splits, and comps stay on one bill.",
  },
  {
    problem: "Guests rarely pay online. Agents run on credit.",
    module: "Agent credit and the city ledger",
    answer: "The account is there when there is no online payment.",
  },
  {
    problem: "Guides and drivers are part of the arrival, not a normal room sale.",
    module: "Guide and driver beds",
    answer: "They are recorded with the group, not lost in a notebook.",
  },
  {
    problem: "Direct guests are the exception. The book is agents and groups.",
    module: "Agent and group reservations",
    answer: "That is the normal way a stay is made.",
  },
  {
    problem:
      "The kitchen buys vegetables, meat, gas, and groceries from local suppliers, on accounts.",
    module: "Supplier bills and stores",
    answer: "Vegetables, meat, gas, and groceries are on the hotel’s accounts.",
  },
  {
    problem: "Trade, DOT, and BAFRA still have to be ready when an inspector comes.",
    module: "DOT assessment",
    answer:
      "The Hotel Classification checklist for Trade, DOT, and BAFRA / BFDA, which is how the desk names the food licence.",
  },
] as const;

const SCREENS = [
  {
    id: "desk",
    title: "Front desk",
    body: "Who arrives, who leaves, and who is in house.",
    media: MARKETING_MEDIA.screenToday,
    url: "app.innorahotel.com/erp/today",
  },
  {
    id: "pos",
    title: "Point of sale",
    body: "A sale is a table, a room, or the counter. A room charge hits the folio in BTN.",
    media: MARKETING_MEDIA.screenPos,
    url: "app.innorahotel.com/erp/pos",
  },
  {
    id: "folio",
    title: "Night audit",
    body: "Run it last. When it finishes, the business date rolls.",
    media: MARKETING_MEDIA.screenNight,
    url: "app.innorahotel.com/erp/night-audit",
  },
] as const;

function btn(amount: number | undefined) {
  return amount ? `BTN ${amount.toLocaleString("en-BT")}` : "";
}

export default function MarketingHomePage() {
  const buyers = [
    {
      href: "/for/leased",
      title: "Leased",
      price: portfolio ? `${btn(portfolio.msrpBtnMo)} a month per property` : "",
    },
    {
      href: "/for/independent",
      title: "Independent",
      price: classic
        ? `Classic ${btn(classic.msrpBtnMo)} a month${plus ? `. POS from Plus, ${btn(plus.msrpBtnMo)}` : ""}`
        : "",
    },
    {
      href: "/for/chain",
      title: "Chain",
      price: chain ? `From ${btn(chain.msrpBtnMo)} a month` : "",
    },
  ];

  return (
    <div className="bg-background text-foreground">
      <section id="product" className="mx-auto grid max-w-6xl scroll-mt-28 items-center gap-10 px-6 pb-8 pt-28 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)] md:px-10 md:pt-32">
        <div>
          <h1 className="font-display text-4xl tracking-tight md:text-5xl">
            Hotel software built for how Bhutan actually sells rooms
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            We spent seventeen years running hotels here. Indian brands, UK
            brands, and other generic systems assume a simple stay and a guest
            who pays online. Tourism in Bhutan does not work that way.
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            A hotel has to work with Trade, DOT, and BAFRA, with travel agents,
            guides, and drivers, and with suppliers of vegetables, meat, gas,
            and groceries. Innora was built for that desk, by people from
            Bhutan, Kerala, and Singapore.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link
              href="/demo"
              className="inline-flex h-12 items-center rounded-full bg-cta px-8 text-sm font-semibold"
            >
              Book a demo
            </Link>
            <Link href="/pricing" className="text-primary">
              See pricing
            </Link>
          </div>
        </div>
        <div>
          <ProductFrame url="app.innorahotel.com">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={MARKETING_MEDIA.screenDesk.src}
              alt={MARKETING_MEDIA.screenDesk.alt}
              width={1440}
              height={900}
              className="h-auto w-full"
            />
          </ProductFrame>
          <p className="mt-3 text-sm text-muted-foreground">
            Owner and general manager board. Occupancy, arrivals, and the month.
          </p>
        </div>
      </section>

      <section className="border-y border-border bg-secondary">
        <div className="mx-auto max-w-6xl px-6 py-12 md:px-10">
          <h2 className="font-display text-3xl tracking-tight">
            The hotel sits in the middle of this
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-x-8 sm:grid-cols-4 lg:grid-cols-7">
            {RING.map((name) => (
              <li key={name} className="border-t-2 border-foreground pt-3 text-sm font-medium">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:px-10">
        <h2 className="font-display text-3xl tracking-tight">The problems</h2>
        <ol className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {ANSWERS.map((row, index) => (
            <li key={row.module} className="border-t border-border pt-4">
              <span className="font-display text-3xl text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-3 max-w-md text-base leading-relaxed">{row.problem}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="answers" className="scroll-mt-28 border-y border-border bg-secondary">
        <div className="mx-auto max-w-6xl px-6 py-16 md:px-10">
          <h2 className="font-display text-3xl tracking-tight">What answers each one</h2>
          <ol className="mt-8">
            {ANSWERS.map((row, index) => (
              <li
                key={row.module}
                className="grid gap-3 border-b border-border py-8 md:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1.1fr)] md:gap-8"
              >
                <span className="font-display text-2xl text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-display text-2xl tracking-tight">{row.module}</p>
                  <p className="mt-2 text-base leading-relaxed">{row.answer}</p>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground md:pt-2">
                  {row.problem}
                </p>
              </li>
            ))}
          </ol>
          <p id="prints" className="mt-8 max-w-2xl scroll-mt-28 text-base leading-relaxed">
            The same desk prints the day sheet, registration, invoice, receipt,
            voucher, and kitchen ticket, and holds the rota for front office,
            housekeeping, food and beverage, maintenance, and management.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <h2 className="font-display text-3xl tracking-tight">The product</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            The desk, the charge, and the close of the day.
          </p>
        </div>
        <div className="mt-8 space-y-10">
          {SCREENS.map((screen, index) => (
            <div key={screen.id}>
              {screen.id === "folio" ? (
                <p className="mb-10 border-y border-border py-4 text-base">
                  Checkout sits between the room charge and night audit. Late
                  morning, the stay settles to cash, card, or the agent’s city
                  ledger.
                </p>
              ) : null}
              <div id={screen.id} className="scroll-mt-28">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
                  <p className="font-display text-2xl tracking-tight">
                    <span className="mr-3 text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {screen.title}
                  </p>
                  <p className="max-w-md text-sm text-muted-foreground">{screen.body}</p>
                </div>
                <ProductFrame url={screen.url}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={screen.media.src}
                    alt={screen.media.alt}
                    width={screen.media.width}
                    height={screen.media.height}
                    loading="lazy"
                    className="h-auto w-full"
                  />
                </ProductFrame>
              </div>
            </div>
          ))}
        </div>
        <p id="site" className="mt-10 scroll-mt-28 border-t border-border pt-6 text-base">
          Guests book on the hotel’s own site from the same rooms the desk
          sells.{" "}
          <Link href="/demo" className="text-primary">
            See it on a demo
          </Link>
          .
        </p>
      </section>

      <section className="border-t border-border bg-secondary">
        <div className="mx-auto max-w-6xl px-6 py-16 md:px-10">
          <h2 className="font-display text-4xl tracking-tight">
            {classic ? `Classic, ${btn(classic.msrpBtnMo)} a month` : "Priced in BTN"}
          </h2>
          {classic?.roomMax ? (
            <p className="mt-3 text-muted-foreground">
              For hotels up to {classic.roomMax} rooms.
            </p>
          ) : null}
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {buyers.map((row) => (
              <div key={row.href} className="border-t-2 border-foreground pt-4">
                <p className="font-display text-2xl">{row.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{row.price}</p>
                <Link href={row.href} className="mt-4 inline-block text-primary">
                  Read more
                </Link>
              </div>
            ))}
          </div>
          <Link
            href="/demo"
            className="mt-10 inline-flex h-12 items-center rounded-full bg-cta px-8 text-sm font-semibold"
          >
            Book a demo
          </Link>
        </div>
      </section>
    </div>
  );
}
