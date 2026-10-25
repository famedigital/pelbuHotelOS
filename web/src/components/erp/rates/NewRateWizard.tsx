"use client";

import {
  addNamedRateOffer,
  upsertRoomRate,
  type ErpRatesState,
} from "@/app/actions/erp-rates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { NAMED_RATE_LABELS, RATE_MARKETS, RATE_SEASONS, marketLabel, seasonLabel } from "./markets";

const initial: ErpRatesState = { ok: false };

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

const STEPS = ["Kind", "Who", "Room", "Price"] as const;

export function NewRateWizard({
  open,
  onOpenChange,
  roomTypes,
  agents,
  defaultTier = "public",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomTypes: { id: string; name: string }[];
  agents: { id: string; company_name: string }[];
  defaultTier?: string;
}) {
  const router = useRouter();
  const wasOpen = useRef(false);
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<"market" | "named">("market");
  const [label, setLabel] = useState<string>("Fill-up");
  const [tier, setTier] = useState(defaultTier);
  const [agentId, setAgentId] = useState("");
  const [guestLabel, setGuestLabel] = useState("");
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? "");
  const [season, setSeason] = useState("lean");
  const [doubleNu, setDoubleNu] = useState("");
  const [singleNu, setSingleNu] = useState("");

  const [marketState, marketAction, marketPending] = useActionState(
    upsertRoomRate,
    initial,
  );
  const [namedState, namedAction, namedPending] = useActionState(
    addNamedRateOffer,
    initial,
  );
  const pending = kind === "market" ? marketPending : namedPending;
  const state = kind === "market" ? marketState : namedState;

  useEffect(() => {
    if (open && !wasOpen.current) {
      setStep(0);
      setTier(defaultTier);
    }
    wasOpen.current = open;
  }, [open, defaultTier]);

  function closeAfterSave() {
    onOpenChange(false);
    setStep(0);
    router.refresh();
  }

  useActionToast(marketState, { onSuccess: closeAfterSave });
  useActionToast(namedState, { onSuccess: closeAfterSave });

  const roomName =
    roomTypes.find((room) => room.id === roomTypeId)?.name ?? "Room";
  const agentName =
    agents.find((agent) => agent.id === agentId)?.company_name ?? "";

  const whoReady = kind === "market" || label.trim().length >= 2;
  const roomReady = Boolean(roomTypeId);
  const priceReady =
    doubleNu.trim() !== "" && Number.isFinite(Number(doubleNu)) && Number(doubleNu) >= 0;

  function next() {
    if (step === 1 && !whoReady) return;
    if (step === 2 && !roomReady) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New rate</DialogTitle>
          <DialogDescription>
            {kind === "market"
              ? "A market rate is the standard Nu for a room, season, and tier."
              : "A named rate is a contract, fill-up, or guest price the folio can draw."}
          </DialogDescription>
        </DialogHeader>

        <ol className="flex gap-1" aria-label="Wizard steps">
          {STEPS.map((name, index) => (
            <li key={name} className="min-w-0 flex-1">
              <span
                className={cn(
                  "flex h-8 items-center justify-center rounded-md border text-[11px] font-medium tracking-wide",
                  index === step
                    ? "border-accent bg-accent/10 text-foreground"
                    : index < step
                      ? "border-input bg-muted text-foreground"
                      : "border-transparent text-muted-foreground",
                )}
              >
                {index + 1}. {name}
              </span>
            </li>
          ))}
        </ol>

        <form
          action={kind === "market" ? marketAction : namedAction}
          className="space-y-4"
          onSubmit={(event) => {
            if (step < STEPS.length - 1 || !priceReady) {
              event.preventDefault();
              if (step < STEPS.length - 1) next();
            }
          }}
        >
          <input type="hidden" name="rate_tier" value={tier} />
          <input type="hidden" name="room_type_id" value={roomTypeId} />
          <input type="hidden" name="season_kind" value={season} />
          <input type="hidden" name="amount_btn" value={doubleNu} />
          <input type="hidden" name="amount_single_btn" value={singleNu} />
          {kind === "named" ? (
            <>
              <input type="hidden" name="label" value={label} />
              <input type="hidden" name="agent_id" value={agentId} />
              <input type="hidden" name="guest_label" value={guestLabel} />
            </>
          ) : null}

          {step === 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <KindCard
                selected={kind === "market"}
                title="Market rate"
                body="Standard price for public, agents, friends, or family."
                onSelect={() => setKind("market")}
              />
              <KindCard
                selected={kind === "named"}
                title="Named rate"
                body="Contract, fill-up, festival, or one guest."
                onSelect={() => setKind("named")}
              />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {kind === "named" ? (
                <label className="space-y-1.5 text-sm sm:col-span-2">
                  <span className="text-muted-foreground">Name</span>
                  <select
                    className={selectClass}
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                  >
                    {NAMED_RATE_LABELS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="space-y-1.5 text-sm sm:col-span-2">
                <span className="text-muted-foreground">Market</span>
                <select
                  className={selectClass}
                  value={tier}
                  onChange={(event) => setTier(event.target.value)}
                >
                  {RATE_MARKETS.map((market) => (
                    <option key={market.code} value={market.code}>
                      {market.label}
                    </option>
                  ))}
                </select>
              </label>
              {kind === "named" ? (
                <>
                  <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Agent</span>
                    <select
                      className={selectClass}
                      value={agentId}
                      onChange={(event) => setAgentId(event.target.value)}
                    >
                      <option value="">All in this market</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.company_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Guest name</span>
                    <Input
                      value={guestLabel}
                      onChange={(event) => setGuestLabel(event.target.value)}
                      placeholder="Optional"
                      className="h-10"
                    />
                  </label>
                </>
              ) : (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  This saves the standard price for {marketLabel(tier)}. Use a
                  named rate when one agent or guest needs a different price.
                </p>
              )}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {roomTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  Add a sellable guest room type in Settings before creating a rate.
                </p>
              ) : null}
              <label className="space-y-1.5 text-sm">
                <span className="text-muted-foreground">Room category</span>
                <select
                  className={selectClass}
                  value={roomTypeId}
                  onChange={(event) => setRoomTypeId(event.target.value)}
                  required
                >
                  {roomTypes.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="text-muted-foreground">Season</span>
                <select
                  className={selectClass}
                  value={season}
                  onChange={(event) => setSeason(event.target.value)}
                >
                  {RATE_SEASONS.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <dl className="grid gap-2 rounded-lg border bg-muted/30 px-3 py-3 text-sm sm:grid-cols-2">
                <ReviewItem
                  label="Rate"
                  value={
                    kind === "market"
                      ? marketLabel(tier)
                      : `${label} · ${marketLabel(tier)}`
                  }
                />
                <ReviewItem
                  label="Who"
                  value={
                    kind === "market"
                      ? "Standard market"
                      : agentName || guestLabel || "Everyone in this market"
                  }
                />
                <ReviewItem label="Room" value={roomName} />
                <ReviewItem label="Season" value={seasonLabel(season)} />
              </dl>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="text-muted-foreground">Double Nu</span>
                  <Input
                    inputMode="decimal"
                    value={doubleNu}
                    onChange={(event) => setDoubleNu(event.target.value)}
                    required
                    className="h-10 tabular-nums"
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="text-muted-foreground">Single Nu</span>
                  <Input
                    inputMode="decimal"
                    value={singleNu}
                    onChange={(event) => setSingleNu(event.target.value)}
                    placeholder="Optional"
                    className="h-10 tabular-nums"
                  />
                </label>
              </div>
              {state.error ? (
                <p className="text-sm text-destructive">{state.error}</p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={step === 0 || pending}
              onClick={() => setStep((current) => Math.max(current - 1, 0))}
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                disabled={(step === 1 && !whoReady) || (step === 2 && !roomReady)}
                onClick={next}
              >
                Continue
              </Button>
            ) : (
              <Button type="submit" disabled={pending || !priceReady}>
                {pending ? "Saving…" : "Save rate"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function KindCard({
  selected,
  title,
  body,
  onSelect,
}: {
  selected: boolean;
  title: string;
  body: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-lg border px-3 py-3 text-left transition-colors",
        selected
          ? "border-accent bg-accent/10"
          : "border-input hover:bg-muted",
      )}
      aria-pressed={selected}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{body}</span>
    </button>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
