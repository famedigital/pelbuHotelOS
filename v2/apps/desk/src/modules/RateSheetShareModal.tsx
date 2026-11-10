import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, GlassPanel } from "@hos-v2/ui";
import {
  rateCardById,
  useCommercialStore,
  type MealPlan,
  type Season,
} from "../lib/commercial-store";
import { getPropertyBrand } from "../lib/property-brand";
import {
  absoluteShareUrl,
  composeRateSheetPack,
  issueMouChallenge,
  mintRateShareToken,
  publicB2bCardIds,
  type RateShareAudience,
} from "../lib/rate-sheet-share";
import { RateSheetPrintView } from "./RateSheetPrintView";

type Props = {
  open: boolean;
  onClose: () => void;
  season: Season;
  mealPlan: MealPlan;
  initialAudience?: RateShareAudience;
  initialAgentId?: string;
};

export function RateSheetShareModal({
  open,
  onClose,
  season,
  mealPlan,
  initialAudience = "public_b2b",
  initialAgentId,
}: Props) {
  const rateCards = useCommercialStore((s) => s.rateCards);
  const cells = useCommercialStore((s) => s.cells);
  const agents = useCommercialStore((s) => s.agents);
  const activeCards = useMemo(
    () => rateCards.filter((c) => c.active),
    [rateCards],
  );

  const [audience, setAudience] = useState<RateShareAudience>(initialAudience);
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    publicB2bCardIds(activeCards),
  );
  const [agentId, setAgentId] = useState(initialAgentId ?? agents[0]?.id ?? "");
  const [link, setLink] = useState("");
  const [mouCodeHint, setMouCodeHint] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setAudience(initialAudience);
    setAgentId(initialAgentId ?? agents.find((a) => a.active)?.id ?? "");
    setLink("");
    setMouCodeHint("");
  }, [open, initialAudience, initialAgentId, agents]);

  const mouAgents = agents.filter((a) => a.active);
  const selectedAgent = mouAgents.find((a) => a.id === agentId) ?? mouAgents[0];
  const agentCard = rateCardById(activeCards, selectedAgent?.rateCardId);

  const resolvedCardIds = useMemo(() => {
    if (audience === "public_b2b") return publicB2bCardIds(activeCards);
    if (audience === "mou") {
      return selectedAgent?.rateCardId ? [selectedAgent.rateCardId] : [];
    }
    return selectedIds;
  }, [audience, activeCards, selectedIds, selectedAgent]);

  const previewPack = useMemo(
    () =>
      composeRateSheetPack({
        cards: activeCards,
        cells,
        cardIds: resolvedCardIds,
        season,
        mealPlan,
        agent: audience === "mou" ? selectedAgent : null,
        confidential: audience === "mou",
      }),
    [activeCards, cells, resolvedCardIds, season, mealPlan, audience, selectedAgent],
  );

  if (!open) return null;

  const toggleCard = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const mint = () => {
    if (resolvedCardIds.length === 0) {
      toast.error(
        audience === "mou"
          ? "Agent has no rate card assigned"
          : "Select at least one rate card",
      );
      return;
    }
    if (audience === "mou" && !selectedAgent) {
      toast.error("Pick an MoU agent");
      return;
    }
    startTransition(() => {
      void (async () => {
        try {
          const brand = getPropertyBrand();
          const token = await mintRateShareToken({
            audience,
            cardIds: resolvedCardIds,
            season,
            mealPlan,
            propertyId: brand.propertyId,
            agentId: audience === "mou" ? selectedAgent?.id : undefined,
            title:
              audience === "mou"
                ? `${brand.name} · MoU rates · ${selectedAgent?.name}`
                : `${brand.name} · Rate sheet · ${season.toUpperCase()} ${mealPlan}`,
          });
          const url = absoluteShareUrl(token);
          setLink(url);
          if (audience === "mou" && selectedAgent) {
            const challenge = issueMouChallenge(token, selectedAgent);
            setMouCodeHint(challenge.code);
            toast.success("MoU link minted", {
              description: `One-time code: ${challenge.code} (desk only · TTL 15m)`,
            });
          } else {
            setMouCodeHint("");
            toast.success("Share link ready");
          }
        } catch (err) {
          console.error("[rate-share] mint failed", err);
          toast.error("Could not mint share link");
        }
      })();
    });
  };

  const copyLink = async () => {
    if (!link) {
      mint();
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch (err) {
      console.error("[rate-share] clipboard failed", err);
      toast.error("Copy failed — select the URL manually");
    }
  };

  const copyCode = async () => {
    if (!mouCodeHint) return;
    try {
      await navigator.clipboard.writeText(mouCodeHint);
      toast.success("Verification code copied");
    } catch (err) {
      console.error("[rate-share] code clipboard failed", err);
      toast.error("Copy failed");
    }
  };

  const whatsapp = () => {
    if (!link) {
      toast.error("Mint a link first");
      return;
    }
    const text =
      audience === "mou"
        ? encodeURIComponent(
            `CONFIDENTIAL MoU rates for ${selectedAgent?.name ?? "your agency"}\n${link}\n\nVerify with the one-time code sent separately by the hotel desk.`,
          )
        : encodeURIComponent(
            `${previewPack.brand.name} rate sheet (${season} · ${mealPlan})\n${link}`,
          );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const emailShare = () => {
    if (!link) {
      toast.error("Mint a link first");
      return;
    }
    const subject = encodeURIComponent(
      audience === "mou"
        ? `${previewPack.brand.name} — confidential MoU rates`
        : `${previewPack.brand.name} — rate sheet`,
    );
    const body = encodeURIComponent(
      `Please find our rate sheet:\n\n${link}\n\n${
        audience === "mou"
          ? "This link is confidential. Verify with the one-time code provided separately, then accept MoU terms to view."
          : "Open the link to view or print the tariff sheet."
      }`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-share-title"
    >
      <GlassPanel className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="rate-share-title" className="text-lg font-semibold text-[var(--hos-ink)]">
              Share rate sheet
            </h2>
            <p className="text-[12px] text-[var(--hos-ink-3)]">
              Public + B2B open · MoU needs verify + accept
            </p>
          </div>
          <Button size="sm" variant="secondary" className="!min-h-10 shrink-0" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          {(
            [
              {
                id: "public_b2b" as const,
                label: "Public + B2B",
                hint: "PUBLIC · PERSONAL · AGT-COMMON",
              },
              {
                id: "selected" as const,
                label: "Selected cards",
                hint: "Pick any active cards",
              },
              {
                id: "mou" as const,
                label: "MoU / agent",
                hint: "Verify + sign gate",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAudience(opt.id)}
              className={`min-h-14 rounded-xl border px-3 py-2.5 text-left transition ${
                audience === opt.id
                  ? "border-[var(--hos-primary)] bg-[var(--hos-primary)]/10"
                  : "border-[var(--hos-line)] bg-[var(--hos-cell)]"
              }`}
            >
              <div className="text-[13px] font-semibold text-[var(--hos-ink)]">
                {opt.label}
              </div>
              <div className="text-[11px] text-[var(--hos-ink-3)]">{opt.hint}</div>
            </button>
          ))}
        </div>

        {audience === "selected" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeCards.map((c) => {
              const on = selectedIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCard(c.id)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                    on
                      ? "border-[var(--hos-primary)] bg-[var(--hos-primary)] text-white"
                      : "border-[var(--hos-line)] text-[var(--hos-ink-2)]"
                  }`}
                >
                  {c.code}
                </button>
              );
            })}
          </div>
        ) : null}

        {audience === "mou" ? (
          <label className="mt-3 flex flex-col gap-1 text-[11px]">
            <span className="uppercase text-[var(--hos-ink-3)]">Agent MoU</span>
            <select
              value={selectedAgent?.id ?? ""}
              onChange={(e) => setAgentId(e.target.value)}
              className="hos-cell rounded-lg px-2 py-2 text-xs"
            >
              {mouAgents.map((a) => {
                const card = rateCardById(activeCards, a.rateCardId);
                return (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name} → {card?.code ?? "NO CARD"}
                  </option>
                );
              })}
            </select>
            {agentCard ? (
              <span className="text-[11px] text-[var(--hos-ink-3)]">
                Packs card {agentCard.code} · {agentCard.kind}
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-[var(--hos-ruby,#ef4444)]">
                Assign a rate card on Agents before minting
              </span>
            )}
          </label>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button size="sm" className="!min-h-11" disabled={pending} onClick={mint}>
            {pending ? "Minting…" : "Mint link"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="!min-h-11"
            onClick={() => void copyLink()}
          >
            Copy link
          </Button>
          <Button size="sm" variant="secondary" className="!min-h-11" onClick={whatsapp}>
            WhatsApp
          </Button>
          <Button size="sm" variant="secondary" className="!min-h-11" onClick={emailShare}>
            Email
          </Button>
        </div>

        {link ? (
          <div className="mt-3 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2">
            <div className="break-all font-mono text-[11px] text-[var(--hos-ink-2)]">
              {link}
            </div>
            {mouCodeHint ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="m-0 text-[12px] font-semibold text-[var(--hos-primary)]">
                  One-time code: {mouCodeHint}
                </p>
                <Button size="sm" variant="secondary" onClick={() => void copyCode()}>
                  Copy code
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 max-h-[28vh] overflow-auto rounded-lg border border-[var(--hos-line)] bg-white sm:max-h-[40vh]">
          <div
            className="origin-top scale-[0.42] sm:scale-[0.65]"
            style={{ width: "210mm" }}
          >
            <RateSheetPrintView pack={previewPack} />
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
