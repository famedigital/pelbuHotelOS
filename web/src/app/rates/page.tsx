import { AgentRatesSection } from "@/components/rates/AgentRatesSection";
import { RateCardTable } from "@/components/rates/RateCardTable";
import { EngineShell } from "@/components/site/EngineShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readAgentRateViewSession } from "@/lib/agent-rate-view";
import {
  loadAgentRateCard,
  loadPublicRateCard,
  seasonLabel,
} from "@/lib/rate-card";
import {
  breadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Room rates | Pelbu Suites",
  description:
    "Public rack rates for rooms at Pelbu Suites, Olakha Thimphu — peak, lean and off seasons. Book direct or ask your agent about trade terms.",
  alternates: { canonical: "/rates" },
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

export default async function RatesPage() {
  const propertyId = await resolvePublicPropertyId();
  const admin = createSupabaseAdminClient();

  const card = propertyId
    ? await loadPublicRateCard(admin, propertyId)
    : null;

  let agentCard = null;
  let hasGate = false;
  if (propertyId && card) {
    const session = await readAgentRateViewSession(propertyId);
    hasGate = Boolean(session);
    if (session) {
      // Only after validated cookie — never load agent tiers for crawlers / cold visits
      agentCard = await loadAgentRateCard(admin, propertyId);
    }
  }

  const propertyName = card?.propertyName ?? "Pelbu Suites";
  const taxLabel = card?.inclusiveOfGstSc
    ? "Inc. GST+SC"
    : "Excl. GST+SC";
  const seasonNote = card
    ? `Current season in Thimphu: ${seasonLabel(card.currentSeasonKind)}.`
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Room rates", path: "/rates" },
            ]),
          ),
        }}
      />
      <EngineShell
        eyebrow={propertyName}
        title="Room rates"
        description={
          seasonNote
            ? `Published rack rates by season at ${propertyName}, Olakha. ${seasonNote}`
            : `Published rack rates by season at ${propertyName}, Olakha.`
        }
        actions={
          <Button asChild variant="citrus">
            <a href="/book">Book a stay</a>
          </Button>
        }
      >
        {!card ? (
          <p className="text-sm text-muted-foreground">
            Rates will appear once the property rate matrix is configured. Call
            the desk or{" "}
            <a href="/book" className="font-medium text-sky-700 underline">
              check live availability
            </a>
            .
          </p>
        ) : (
          <div className="space-y-12">
            <section
              aria-labelledby="rack-rates-heading"
              className="space-y-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2
                    id="rack-rates-heading"
                    className="font-display text-2xl text-foreground md:text-3xl"
                  >
                    Rack rates
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Public best available tier from the live rate matrix. Figures
                    are per room, per night in Nu (BTN).
                  </p>
                </div>
                <Badge variant="sky">{taxLabel}</Badge>
              </div>

              <RateCardTable
                rooms={card.publicTier.rooms}
                seasons={card.seasons}
                currentSeasonKind={card.currentSeasonKind}
              />

              {card.defaultMealPlan || card.mealPlans.length > 0 ? (
                <div className="max-w-2xl space-y-1.5 text-sm text-muted-foreground">
                  {card.defaultMealPlan ? (
                    <p>
                      Default meal plan:{" "}
                      <span className="font-medium text-foreground">
                        {card.defaultMealPlan.name}
                      </span>
                      {card.defaultMealPlan.code
                        ? ` (${card.defaultMealPlan.code})`
                        : null}
                      {card.defaultMealPlan.blurb
                        ? ` — ${card.defaultMealPlan.blurb}`
                        : null}
                      . Room-only (EP) and package plans are selectable when you
                      book.
                    </p>
                  ) : null}
                  {card.mealPlans.length > 1 ? (
                    <p>
                      Meal plans available:{" "}
                      {card.mealPlans
                        .map((m) => `${m.name} (${m.code})`)
                        .join(", ")}
                      .
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <a href="/book">Check dates &amp; book</a>
                </Button>
                <Button asChild variant="outline">
                  <a href="/rooms">Compare rooms</a>
                </Button>
              </div>

              <aside className="max-w-2xl space-y-2 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
                <p>
                  Rates are subject to availability and can change without
                  notice. Live quotes on the booking form may differ by date,
                  promotion, or inventory.
                </p>
                <p>
                  {card.inclusiveOfGstSc
                    ? "Listed amounts are inclusive of GST and service charge (when SC is applied on the property)."
                    : "Listed amounts exclude GST and service charge unless your quote says otherwise. Final tax is calculated at booking and on the folio."}
                </p>
              </aside>
            </section>

            <AgentRatesSection
              card={card}
              agentCard={agentCard}
              hasGate={hasGate}
            />
          </div>
        )}
      </EngineShell>
    </>
  );
}
