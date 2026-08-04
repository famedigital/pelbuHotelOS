import { AgentRateGateForm } from "@/components/rates/AgentRateGateForm";
import { RateCardTable } from "@/components/rates/RateCardTable";
import type { AgentRateCard, PublicRateCard } from "@/lib/rate-card";

type Props = {
  card: PublicRateCard;
  agentCard: AgentRateCard | null;
  hasGate: boolean;
};

/**
 * B2B section: SEO-safe when unauthenticated (no rates in HTML).
 * After gate cookie, server renders trade tiers only.
 */
export function AgentRatesSection({ card, agentCard, hasGate }: Props) {
  const hasAnyTrade =
    agentCard != null &&
    (agentCard.agents.rooms.length > 0 ||
      agentCard.mouAgents.rooms.length > 0);

  return (
    <section
      id="trade"
      className="scroll-mt-24 space-y-6 border-t border-border pt-10"
      aria-labelledby="trade-rates-heading"
    >
      <div>
        <p className="text-sm font-medium text-sky-700">Travel trade</p>
        <h2
          id="trade-rates-heading"
          className="mt-1 font-display text-2xl text-foreground md:text-3xl"
        >
          Partner rates
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          For registered travel partners. Trade rates are confidential and shown
          only after you provide a contact email and WhatsApp.
        </p>
      </div>

      {!hasGate || !agentCard ? (
        <AgentRateGateForm propertyWhatsApp={card.whatsapp} />
      ) : (
        <div className="space-y-8">
          <p
            className="rounded-lg border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-900"
            role="status"
          >
            Confidential — for travel partners only. Do not republish. Rates
            subject to availability, stay dates, and partner terms.
          </p>

          {!hasAnyTrade ? (
            <p className="text-sm text-muted-foreground">
              No published trade rates for this property yet.{" "}
              <a
                href="/agents"
                className="font-medium text-sky-700 underline-offset-4 hover:underline"
              >
                Apply as a partner
              </a>{" "}
              or contact reservations on WhatsApp.
            </p>
          ) : (
            <>
              {agentCard.agents.rooms.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground">
                    Agent rates
                  </h3>
                  <RateCardTable
                    rooms={agentCard.agents.rooms}
                    seasons={card.seasons}
                    currentSeasonKind={card.currentSeasonKind}
                    caption="Per room, per night (Nu). Standard agent tier from the live rate matrix."
                  />
                </div>
              ) : null}

              {agentCard.mouAgents.rooms.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground">
                    MoU agent rates
                  </h3>
                  <RateCardTable
                    rooms={agentCard.mouAgents.rooms}
                    seasons={card.seasons}
                    currentSeasonKind={card.currentSeasonKind}
                    caption="Per room, per night (Nu). MoU partners only."
                  />
                </div>
              ) : null}
            </>
          )}

          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href="/agents"
              className="font-medium text-sky-700 underline-offset-4 hover:underline"
            >
              Partner onboarding
            </a>
            <a
              href="/agents/login"
              className="font-medium text-sky-700 underline-offset-4 hover:underline"
            >
              Agent portal
            </a>
            {card.whatsapp ? (
              <a
                href={`https://wa.me/${card.whatsapp.replace(/\D+/g, "")}`}
                className="font-medium text-sky-700 underline-offset-4 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp desk
              </a>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
