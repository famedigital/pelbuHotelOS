import { PublicAnswerPage } from "@/components/site/PublicAnswerPage";
import { loadCmsPage } from "@/lib/cms";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadCmsPage("olakha-thimphu");
  return {
    title: page?.seo_title ?? "Stay in Olakha, Thimphu | Pelbu Suites",
    description:
      page?.meta_description ??
      "Plan a practical Olakha base for a stay in Thimphu.",
    alternates: {
      canonical: page?.canonical_path ?? "/stay/olakha-thimphu",
    },
  };
}

export default async function OlakhaThimphuPage() {
  const page = await loadCmsPage("olakha-thimphu");
  if (!page) notFound();

  return (
    <PublicAnswerPage
      page={page}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Stay in Olakha", path: "/stay/olakha-thimphu" },
      ]}
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border p-5">
          <h2 className="text-base font-semibold text-ink">
            Keep the day simple
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Start with breakfast or coffee, return for dinner, and request a
            steam session or treatment without planning another cross-town
            stop.
          </p>
        </div>
        <div className="rounded-2xl border border-border p-5">
          <h2 className="text-base font-semibold text-ink">
            Arrive with the details settled
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Check live rooms first, then ask the desk about transport,
            meal-plan, meeting, guide, or driver arrangements that apply to
            your stay.
          </p>
        </div>
      </section>
    </PublicAnswerPage>
  );
}
