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

/**
 * Proof strip under the hero — NAP, money, and always-on stay CTAs.
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

  const whatsappDigits = property?.whatsapp?.replace(/\D+/g, "") || null;

  const facts: Array<{
    key: string;
    label: string;
    href?: string;
    external?: boolean;
  }> = [
    { key: "place", label: "Olakha · Thimphu · Bhutan" },
  ];

  if (fromLabel) {
    facts.push({
      key: "price",
      label: seasonName ? `${fromLabel} · ${seasonName}` : fromLabel,
      href: "/rates",
    });
  } else {
    facts.push({
      key: "rates",
      label: ratesMissing
        ? "Live rate card"
        : "Public rate card",
      href: "/rates",
    });
  }

  if (checkIn) {
    facts.push({
      key: "checkin",
      label: checkOut
        ? `In ${checkIn} · out ${checkOut}`
        : `Check-in from ${checkIn}`,
    });
  }

  if (property?.mapsUrl) {
    facts.push({
      key: "map",
      label: "Open map",
      href: property.mapsUrl,
      external: true,
    });
  }

  if (whatsappDigits) {
    facts.push({
      key: "wa",
      label: "WhatsApp the desk",
      href: `https://wa.me/${whatsappDigits}`,
      external: true,
    });
  } else if (property?.phone) {
    facts.push({
      key: "phone",
      label: property.phone,
      href: `tel:${property.phone.replace(/\s+/g, "")}`,
    });
  }

  facts.push({ key: "book", label: "Book dates", href: "/book" });

  return (
    <section
      aria-label="Property facts"
      className="border-b border-border/70 bg-gradient-to-b from-sky-50/80 to-background"
    >
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 md:px-8">
        {facts.map((fact) => {
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
