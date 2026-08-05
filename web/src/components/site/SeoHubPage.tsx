import { EngineShell } from "@/components/site/EngineShell";
import { Button } from "@/components/ui/button";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import Link from "next/link";

export type SeoHubSection = {
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
};

export type SeoHubFaq = { question: string; answer: string };

/**
 * Long-form, indexable landing page for local-search intent.
 * One H1, clear sections, FAQs (JSON-LD), conversion CTAs — no keyword stuffing.
 */
export function SeoHubPage({
  breadcrumbs,
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  sections,
  faqs = [],
}: {
  breadcrumbs: Array<{ name: string; path: string }>;
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  sections: SeoHubSection[];
  faqs?: SeoHubFaq[];
}) {
  const schema = [
    breadcrumbJsonLd(breadcrumbs),
    ...(faqs.length ? [faqJsonLd(faqs)] : []),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
      />
      <EngineShell
        breadcrumbs={breadcrumbs.map((item, i, arr) =>
          i === arr.length - 1 ? { name: item.name } : item,
        )}
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <>
            <Button asChild>
              <Link href={primaryHref}>{primaryLabel}</Link>
            </Button>
            {secondaryHref && secondaryLabel ? (
              <Button asChild variant="outline">
                <Link href={secondaryHref}>{secondaryLabel}</Link>
              </Button>
            ) : null}
          </>
        }
      >
        <div className="mx-auto max-w-3xl space-y-12">
          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h2 className="font-display text-2xl text-ink">
                  {section.title}
                </h2>
                <p className="text-[15px] leading-7 text-muted-foreground">
                  {section.body}
                </p>
                {section.href && section.linkLabel ? (
                  <p>
                    <Link
                      href={section.href}
                      className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
                    >
                      {section.linkLabel}
                    </Link>
                  </p>
                ) : null}
              </section>
            ))}
          </div>

          {faqs.length > 0 ? (
            <section aria-labelledby="seo-hub-faq">
              <h2
                id="seo-hub-faq"
                className="font-display text-2xl text-ink"
              >
                Practical answers
              </h2>
              <div className="mt-5 divide-y divide-border border-y border-border">
                {faqs.map((item) => (
                  <details key={item.question} className="group py-1">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-medium text-ink">
                      {item.question}
                      <span
                        aria-hidden
                        className="text-lg text-muted-foreground transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="max-w-2xl pb-5 text-sm leading-7 text-muted-foreground">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-muted/30 p-6">
            <h2 className="font-display text-xl text-ink">Plan the stay</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Check rooms and rates, then book direct — or message the desk for
              groups, transfers and meal plans.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild>
                <Link href={primaryHref}>{primaryLabel}</Link>
              </Button>
              {secondaryHref && secondaryLabel ? (
                <Button asChild variant="outline">
                  <Link href={secondaryHref}>{secondaryLabel}</Link>
                </Button>
              ) : null}
              <Button asChild variant="ghost">
                <Link href="/contact">Contact desk</Link>
              </Button>
            </div>
          </section>
        </div>
      </EngineShell>
    </>
  );
}
