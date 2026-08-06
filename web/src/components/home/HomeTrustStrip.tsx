import type { PublicPropertyProfile } from "@/lib/public-property";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";

type Props = {
  property: PublicPropertyProfile | null;
  fromPriceBtn?: number | null;
  seasonName?: string | null;
  taxInclusive?: boolean;
  /** When rates failed or none published — still push the rate card. */
  ratesMissing?: boolean;
};

type Fact = {
  key: string;
  label: string;
  href?: string;
  external?: boolean;
};

/**
 * Proof strip under the hero — NAP, money, and stay CTAs.
 * Mobile: horizontal chips only (no repeated place string / dense link wall).
 * Desktop: full wrap layout with Practical answers.
 */
export function HomeTrustStrip({
  property,
  fromPriceBtn,
  seasonName,
  taxInclusive,
  ratesMissing,
}: Props) {
  const checkIn = property?.checkInTime;
  const checkOut = property?.checkOutTime;
  const fromLabel =
    fromPriceBtn != null && fromPriceBtn > 0
      ? `From ${formatBtn(fromPriceBtn)} / night${taxInclusive ? " · inc. tax" : ""}`
      : null;
  const fromChip =
    fromPriceBtn != null && fromPriceBtn > 0
      ? `From ${formatBtn(fromPriceBtn)}/nt`
      : ratesMissing
        ? "Live rates"
        : "Rate card";

  const whatsappDigits = property?.whatsapp?.replace(/\D+/g, "") || null;

  const desktopFacts: Fact[] = [{ key: "place", label: "Olakha · Thimphu · Bhutan" }];

  if (fromLabel) {
    desktopFacts.push({
      key: "price",
      label: seasonName ? `${fromLabel} · ${seasonName}` : fromLabel,
      href: "/rates",
    });
  } else {
    desktopFacts.push({
      key: "rates",
      label: ratesMissing ? "Live rate card" : "Public rate card",
      href: "/rates",
    });
  }

  if (checkIn) {
    desktopFacts.push({
      key: "checkin",
      label: checkOut
        ? `In ${checkIn} · out ${checkOut}`
        : `Check-in from ${checkIn}`,
    });
  }

  if (property?.mapsUrl) {
    desktopFacts.push({
      key: "map",
      label: "Open map",
      href: property.mapsUrl,
      external: true,
    });
  }

  if (whatsappDigits) {
    desktopFacts.push({
      key: "wa",
      label: "WhatsApp the desk",
      href: `https://wa.me/${whatsappDigits}`,
      external: true,
    });
  } else if (property?.phone) {
    desktopFacts.push({
      key: "phone",
      label: property.phone,
      href: `tel:${property.phone.replace(/\s+/g, "")}`,
    });
  }

  desktopFacts.push({ key: "book", label: "Book dates", href: "/book" });

  // Mobile chips — no place (already on hero eyebrow); no Book (tab + dock).
  const mobileChips: Fact[] = [
    { key: "price", label: fromChip, href: "/rates" },
  ];
  if (checkIn) {
    mobileChips.push({
      key: "checkin",
      label: checkOut ? `In ${checkIn} · out ${checkOut}` : `In from ${checkIn}`,
    });
  }
  if (whatsappDigits) {
    mobileChips.push({
      key: "wa",
      label: "WhatsApp",
      href: `https://wa.me/${whatsappDigits}`,
      external: true,
    });
  } else if (property?.phone) {
    mobileChips.push({
      key: "phone",
      label: "Call desk",
      href: `tel:${property.phone.replace(/\s+/g, "")}`,
    });
  }
  if (property?.mapsUrl) {
    mobileChips.push({
      key: "map",
      label: "Map",
      href: property.mapsUrl,
      external: true,
    });
  }

  const chipClass =
    "inline-flex shrink-0 items-center rounded-full border border-sky-100 bg-white px-3 py-1.5 text-xs font-medium text-sky-ink/85 shadow-sm";

  return (
    <section
      aria-label="Property facts"
      className="border-b border-border/70 bg-gradient-to-b from-sky-50/80 to-background"
    >
      {/* Mobile: horizontal chips */}
      <div className="md:hidden">
        <div className="flex gap-2 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mobileChips.map((fact) => {
            if (fact.href) {
              return fact.external ? (
                <a
                  key={fact.key}
                  href={fact.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={chipClass}
                >
                  {fact.label}
                </a>
              ) : (
                <Link key={fact.key} href={fact.href} className={chipClass}>
                  {fact.label}
                </Link>
              );
            }
            return (
              <span key={fact.key} className={chipClass}>
                {fact.label}
              </span>
            );
          })}
        </div>
        <div className="flex justify-end border-t border-border/40 px-4 py-2">
          <Link
            href="/faq"
            className="text-xs font-semibold text-sky-700 hover:text-sky-900"
          >
            FAQ →
          </Link>
        </div>
      </div>

      {/* Desktop: full strip */}
      <div className="mx-auto hidden max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 md:flex md:px-8">
        {desktopFacts.map((fact) => {
          const className =
            "text-sm font-medium text-sky-ink/80 transition-colors hover:text-sky-700";
          if (fact.href) {
            return fact.external ? (
              <a
                key={fact.key}
                href={fact.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {fact.label}
              </a>
            ) : (
              <Link key={fact.key} href={fact.href} className={className}>
                {fact.label}
              </Link>
            );
          }
          return (
            <p key={fact.key} className="text-sm font-medium text-sky-ink/80">
              {fact.label}
            </p>
          );
        })}
        <Link
          href="/faq"
          className="ml-auto text-sm font-semibold text-sky-700 hover:text-sky-900"
        >
          Practical answers →
        </Link>
      </div>
    </section>
  );
}
