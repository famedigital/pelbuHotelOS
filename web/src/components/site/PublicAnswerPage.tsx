import { EngineShell } from "@/components/site/EngineShell";
import { Button } from "@/components/ui/button";
import type { CmsPage } from "@/lib/cms";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";

export function PublicAnswerPage({
  page,
  breadcrumbs,
  children,
}: {
  page: CmsPage;
  breadcrumbs: Array<{ name: string; path: string }>;
  children?: React.ReactNode;
}) {
  const schema = [breadcrumbJsonLd(breadcrumbs)];
  if (page.faq_json.length > 0) schema.push(faqJsonLd(page.faq_json));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
      />
      <EngineShell
        eyebrow={page.eyebrow}
        title={page.title}
        description={page.body}
        actions={
          <>
            {page.primary_cta_href && page.primary_cta_label ? (
              <Button asChild>
                <a href={page.primary_cta_href}>{page.primary_cta_label}</a>
              </Button>
            ) : null}
            {page.secondary_cta_href && page.secondary_cta_label ? (
              <Button asChild variant="outline">
                <a href={page.secondary_cta_href}>
                  {page.secondary_cta_label}
                </a>
              </Button>
            ) : null}
          </>
        }
      >
        <div className="mx-auto max-w-3xl space-y-10">
          {children}
          {page.faq_json.length > 0 ? (
            <section aria-labelledby="answers-heading">
              <h2
                id="answers-heading"
                className="font-display text-2xl text-ink"
              >
                Practical answers
              </h2>
              <div className="mt-5 divide-y divide-border border-y border-border">
                {page.faq_json.map((item) => (
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
        </div>
      </EngineShell>
    </>
  );
}
