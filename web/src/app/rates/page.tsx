import { AgentRatesSection } from "@/components/rates/AgentRatesSection";
import { RatePackagesTable } from "@/components/rates/RatePackagesTable";
import { EngineShell } from "@/components/site/EngineShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readAgentRateViewSession } from "@/lib/agent-rate-view";
import { formatBtn } from "@/lib/pricing";
import {
  loadAgentRateCard,
  loadPublicRateCard,
  seasonLabel,
} from "@/lib/rate-card";
import {
  breadcrumbJsonLd,
  roomRatesOfferJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";
import type { Metadata } from "next";

import { PAGE_SEO, buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  ...PAGE_SEO.rates,
  path: "/rates",
  robots: { index: true, follow: true },
});

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

  const publicRoomPrices = card
    ? card.publicTier.rooms
        .map((row) => row.amounts[card.currentSeasonKind])
        .filter((n): n is number => typeof n === "number" && n > 0)
    : [];
  const lowPrice = publicRoomPrices.length
    ? Math.min(...publicRoomPrices)
    : null;
  const highPrice = publicRoomPrices.length
    ? Math.max(...publicRoomPrices)
    : null;

  const schema = [
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Room rates", path: "/rates" },
    ]),
  ];
  if (lowPrice != null) {
    schema.push(
      roomRatesOfferJsonLd({
        lowPriceBtn: lowPrice,
        highPriceBtn: highPrice,
        description: seasonNote
          ? `Public rack rates by season. ${seasonNote}`
          : undefined,
      }),
    );
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(schema),
        }}
      />
      <EngineShell
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Room rates" },
        ]}
        eyebrow={propertyName}
        title="Room rates"
        description={
          seasonNote
            ? `Room and meal package rates by season at ${propertyName}, Olakha. ${seasonNote}`
            : `Room and meal package rates by season at ${propertyName}, Olakha.`
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
              aria-labelledby="package-rates-heading"
              className="space-y-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2
                    id="package-rates-heading"
                    className="font-display text-2xl text-foreground md:text-3xl"
                  >
                    Rate packages
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Prices per room / night. Meal package columns include double
                    occupancy meals (adult meal rate × 2). Room only is EP.
                    Choose Peak, Lean, or Off season.
                  </p>
                </div>
                <Badge variant="sky">{taxLabel}</Badge>
              </div>

              <RatePackagesTable
                card={card.packages}
                seasons={card.seasons.map((s) => ({
                  kind: s.kind,
                  startsOn: s.startsOn,
                  endsOn: s.endsOn,
                }))}
                currentSeasonKind={card.currentSeasonKind}
                mode="public"
                taxInclusive={card.inclusiveOfGstSc}
              />

              {card.defaultMealPlan || card.mealPlans.length > 0 ? (
                <div className="max-w-2xl space-y-1.5 text-sm text-muted-foreground">
                  {card.defaultMealPlan ? (
                    <p>
                      Default meal plan when you book:{" "}
                      <span className="font-medium text-foreground">
                        {card.defaultMealPlan.name}
                      </span>
                      {card.defaultMealPlan.code
                        ? ` (${card.defaultMealPlan.code})`
                        : null}
                      {card.defaultMealPlan.blurb
                        ? ` — ${card.defaultMealPlan.blurb}`
                        : null}
                      . You can pick room-only or another package on the booking
                      form; the live quote uses your dates and occupancy.
                    </p>
                  ) : null}
                  {card.mealPlans.length > 1 ? (
                    <p>
                      Meal plans available:{" "}
                      {card.mealPlans
                        .map((m) => {
                          const adult = m.amount_btn_per_adult_night;
                          if (adult != null && adult > 0) {
                            return `${m.name} (${m.code}) from ${formatBtn(adult)}/adult/night`;
                          }
                          return `${m.name} (${m.code})`;
                        })
                        .join("; ")}
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
                  promotion, occupancy, or inventory.
                </p>
                <p>
                  {card.inclusiveOfGstSc
                    ? "Listed amounts are inclusive of GST and service charge (when SC is applied on the property)."
                    : "Listed amounts exclude GST and service charge unless your quote says otherwise. Final tax is calculated at booking and on the folio."}
                </p>
                <p>{card.packages.childNote} Exact child counts apply at booking.</p>
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
