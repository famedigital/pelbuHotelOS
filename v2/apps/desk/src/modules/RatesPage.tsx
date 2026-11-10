import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  GlassPanel,
  KpiCard,
  ModuleFrame,
  MorphTabs,
  Odometer,
  useIsPhone,
} from "@hos-v2/ui";
import {
  Plus,
  Printer,
  Radio,
  Search,
  Share2,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { RatesMobileView } from "./mobile/RatesMobileView";
import { apiGet, newIdempotencyKey, runCommand, sessionPropertyId } from "../lib/api";
import { ROOM_TYPE_IDS } from "../lib/fo-remote";
import {
  formatNu,
  ymd,
  addDays,
  useFrontOfficeStore,
} from "../lib/front-office-store";
import {
  TYPES,
  cellBandNet,
  cellsForCard,
  useCommercialStore,
  type MealPlan,
  type OccupancyBand,
  type RateCardKind,
  type RoomTypeCode,
} from "../lib/commercial-store";
import {
  composeRateSheetPack,
  listMouAcceptances,
  publicB2bCardIds,
  type RateShareAudience,
} from "../lib/rate-sheet-share";
import { RateSheetPrintOverlay } from "./RateSheetPrintOverlay";
import { RateSheetShareModal } from "./RateSheetShareModal";

const KIND_EDGE: Record<RateCardKind, string> = {
  public: "var(--hos-primary)",
  personal: "var(--hos-brass, #F59E0B)",
  agent: "var(--hos-teal, #0d7377)",
  mou: "var(--hos-ruby, #EF4444)",
  custom: "#111",
};

const OCC_BANDS: { id: OccupancyBand; label: string; hint: string }[] = [
  { id: "double", label: "Double", hint: "2 adults" },
  { id: "single", label: "Single", hint: "1 adult" },
  { id: "extra", label: "Extra", hint: "Extra bed / night" },
  { id: "child", label: "Child", hint: "6–11 yrs · 0–5 free" },
];

function TaxToggle({
  label,
  on,
  onChange,
  hint,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={hint}
      onClick={() => onChange(!on)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
        on
          ? "border-[var(--hos-primary)] bg-[var(--hos-primary)] text-white"
          : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]"
      }`}
    >
      <span
        className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition ${
          on ? "bg-white/30" : "bg-[var(--hos-line)]"
        }`}
      >
        <span
          className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition ${
            on ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
      {label} · {on ? "ON" : "OFF"}
    </button>
  );
}

const KIND_OPTIONS: { id: RateCardKind; label: string }[] = [
  { id: "public", label: "Public" },
  { id: "personal", label: "Personal" },
  { id: "agent", label: "Agent common" },
  { id: "mou", label: "MoU / special" },
  { id: "custom", label: "Custom" },
];

export function RatesPage() {
  const isPhone = useIsPhone();
  const season = useCommercialStore((s) => s.season);
  const mealPlan = useCommercialStore((s) => s.mealPlan);
  const scOn = useCommercialStore((s) => s.scOn);
  const gstOn = useCommercialStore((s) => s.gstOn);
  const scInclusive = useCommercialStore((s) => s.scInclusive);
  const gstInclusive = useCommercialStore((s) => s.gstInclusive);
  const cells = useCommercialStore((s) => s.cells);
  const rateCards = useCommercialStore((s) => s.rateCards);
  const agents = useCommercialStore((s) => s.agents);
  const selectedRateCardId = useCommercialStore((s) => s.selectedRateCardId);
  const setSeason = useCommercialStore((s) => s.setSeason);
  const setMealPlan = useCommercialStore((s) => s.setMealPlan);
  const setScOn = useCommercialStore((s) => s.setScOn);
  const setGstOn = useCommercialStore((s) => s.setGstOn);
  const setScInclusive = useCommercialStore((s) => s.setScInclusive);
  const setGstInclusive = useCommercialStore((s) => s.setGstInclusive);
  const selectRateCard = useCommercialStore((s) => s.selectRateCard);
  const setOccupancyRate = useCommercialStore((s) => s.setOccupancyRate);
  const createRateCard = useCommercialStore((s) => s.createRateCard);
  const archiveRateCard = useCommercialStore((s) => s.archiveRateCard);
  const assignAgentRateCard = useCommercialStore((s) => s.assignAgentRateCard);
  const quoteDisplay = useCommercialStore((s) => s.quoteDisplay);
  const shownFromNet = useCommercialStore((s) => s.shownFromNet);
  const netFromShown = useCommercialStore((s) => s.netFromShown);
  const stripGstFromOpenBills = useFrontOfficeStore((s) => s.stripGstFromOpenBills);

  const runStripGstBills = () => {
    void stripGstFromOpenBills().then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`GST removed from ${res.stays} stay bill(s)`, {
        description: `${res.linesReposted} line(s) re-posted · SC only · API ACK`,
      });
    });
  };

  const [showNew, setShowNew] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<RateCardKind>("custom");
  const [cloneFrom, setCloneFrom] = useState(selectedRateCardId);
  const [ariStatus, setAriStatus] = useState<"idle" | "publishing" | "queued" | "failed">(
    "idle",
  );
  const [snapPlans, setSnapPlans] = useState(0);
  /** Draft strings so typing "5" is not converted mid-keystroke to "4" */
  const [editDrafts, setEditDrafts] = useState<Partial<Record<string, string>>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [shareAudience, setShareAudience] =
    useState<RateShareAudience>("public_b2b");
  const [shareAgentId, setShareAgentId] = useState<string | undefined>();
  const [printOpen, setPrintOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [acceptTick, setAcceptTick] = useState(0);
  const [taxOpen, setTaxOpen] = useState(false);
  const [cardQuery, setCardQuery] = useState("");

  useEffect(() => {
    setEditDrafts({});
  }, [selectedRateCardId, season, mealPlan, scOn, gstOn, scInclusive, gstInclusive]);

  const draftKey = (type: RoomTypeCode, band: OccupancyBand) => `${type}:${band}`;

  useEffect(() => {
    let cancelled = false;
    void apiGet<{ ok: boolean; ratePlans: unknown[] }>(
      `/v1/rates/snapshot?propertyId=${sessionPropertyId()}`,
    )
      .then((snap) => {
        if (!cancelled) setSnapPlans(snap.ratePlans?.length ?? 0);
      })
      .catch((err) => {
        console.warn("[rates] snapshot hydrate failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const publishAri = async () => {
    if (!selected) {
      toast.error("Select a rate card");
      return;
    }
    setAriStatus("publishing");
    const plan = await runCommand<{ id: string }>("rates.createPlan", {
      code: selected.code,
      name: selected.name,
      mealPlan,
      idempotencyKey: newIdempotencyKey(),
    });
    let ratePlanId: string | null = null;
    if (plan.ok) {
      ratePlanId = plan.data.id;
    } else {
      const snap = await apiGet<{
        ok: boolean;
        ratePlans: { id: string; code: string }[];
      }>(`/v1/rates/snapshot?propertyId=${sessionPropertyId()}`);
      ratePlanId = snap.ratePlans.find((p) => p.code === selected.code)?.id ?? null;
      if (!ratePlanId) {
        setAriStatus("failed");
        toast.error(plan.error, { description: "Could not create or find rate plan" });
        return;
      }
    }
    const fromDate = ymd(new Date());
    const toDate = addDays(fromDate, 14);
    let failed = 0;
    for (const cell of visible) {
      const roomTypeId = ROOM_TYPE_IDS[cell.typeCode as RoomTypeCode];
      if (!roomTypeId) continue;
      const pub = await runCommand("rates.publishRange", {
        ratePlanId,
        roomTypeId,
        fromDate,
        toDate,
        typedAmountBtn: cell.netAmount,
        mode:
          scOn && scInclusive && gstOn && gstInclusive
            ? "all_in"
            : scOn && scInclusive
              ? "incl_sc"
              : "net",
        idempotencyKey: newIdempotencyKey(),
      });
      if (!pub.ok) failed += 1;
    }
    if (failed > 0) {
      setAriStatus("failed");
      toast.error(`ARI publish partial fail · ${failed} type(s)`, {
        description: "Queued cells that succeeded; check API logs",
      });
      return;
    }
    setAriStatus("queued");
    toast.success("ARI range queued", {
      description: `${selected.code} · ${fromDate}→${toDate} · status=queued (not live Channex)`,
    });
  };

  const activeCards = useMemo(
    () => rateCards.filter((c) => c.active),
    [rateCards],
  );
  const filteredCards = useMemo(() => {
    const q = cardQuery.trim().toLowerCase();
    if (!q) return activeCards;
    return activeCards.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.kind.toLowerCase().includes(q),
    );
  }, [activeCards, cardQuery]);
  const selected =
    activeCards.find((c) => c.id === selectedRateCardId) ?? activeCards[0];
  const visible = selected
    ? cellsForCard(cells, selected.id, season, mealPlan)
    : [];

  const avgNet =
    visible.reduce((s, c) => s + cellBandNet(c, "double"), 0) /
    Math.max(1, TYPES.length);
  const sample = quoteDisplay(Math.round(avgNet || 0));

  const assignedAgents = agents.filter((a) => a.rateCardId === selected?.id);

  const printPack = composeRateSheetPack({
    cards: activeCards,
    cells,
    cardIds: selected
      ? [selected.id]
      : publicB2bCardIds(activeCards),
    season,
    mealPlan,
    confidential: selected?.kind === "mou",
  });

  const submitNew = () => {
    const res = createRateCard({
      code: newCode,
      name: newName,
      kind: newKind,
      cloneFromId: cloneFrom || undefined,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Rate card created", { description: newName || newCode });
    setShowNew(false);
    setNewCode("");
    setNewName("");
  };

  if (isPhone) return <RatesMobileView />;

  const fieldModeLabel =
    !scInclusive && !gstInclusive
      ? "Base net"
      : [scInclusive ? "Incl SC" : null, gstInclusive ? "Incl GST" : null]
          .filter(Boolean)
          .join(" · ");

  return (
    <ModuleFrame
      title="Rates"
      description="Card matrix · occupancy bands · share / print · ARI"
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            className="hos-btn-ink !rounded-xl"
            onClick={() => setShowNew((v) => !v)}
          >
            <Plus className="size-3.5" strokeWidth={2.25} />
            {showNew ? "Cancel" : "New card"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="!rounded-xl"
            onClick={() => setPrintOpen(true)}
          >
            <Printer className="size-3.5" strokeWidth={2} />
            Print
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="!rounded-xl"
            onClick={() => {
              setShareAudience("public_b2b");
              setShareAgentId(undefined);
              setShareOpen(true);
            }}
          >
            <Share2 className="size-3.5" strokeWidth={2} />
            Share
          </Button>
          {selected?.kind === "mou" || assignedAgents[0] ? (
            <Button
              size="sm"
              variant="secondary"
              className="!rounded-xl"
              onClick={() => {
                setShareAudience("mou");
                setShareAgentId(assignedAgents[0]?.id);
                setShareOpen(true);
              }}
            >
              MoU
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            className="!rounded-xl"
            disabled={ariStatus === "publishing"}
            onClick={() => {
              void publishAri();
            }}
          >
            <Radio className="size-3.5" strokeWidth={2} />
            {ariStatus === "publishing" ? "…" : "ARI"}
          </Button>
          <Badge tone={snapPlans > 0 ? "success" : "muted"}>API {snapPlans}</Badge>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
      {showNew ? (
        <GlassPanel className="grid gap-3 p-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="uppercase text-[var(--hos-ink-3)]">Code</span>
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="AGT7-SPECIAL"
              className="hos-input rounded-xl px-3 py-2 font-mono text-xs"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="uppercase text-[var(--hos-ink-3)]">Name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Agent 7 special MoU"
              className="hos-input rounded-xl px-3 py-2 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="uppercase text-[var(--hos-ink-3)]">Kind</span>
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as RateCardKind)}
              className="hos-input rounded-xl px-3 py-2 text-xs"
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="uppercase text-[var(--hos-ink-3)]">Clone from</span>
            <select
              value={cloneFrom}
              onChange={(e) => setCloneFrom(e.target.value)}
              className="hos-input rounded-xl px-3 py-2 text-xs"
            >
              {activeCards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button size="sm" className="hos-btn-ink !rounded-xl" onClick={submitNew}>
              Create card
            </Button>
          </div>
        </GlassPanel>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard label="Season" value={season === "peak" ? "Peak" : "Lean"} delta="Yield" />
        <KpiCard label="Meal" value={mealPlan} delta="Filter" />
        <div className="hos-mobile-kpi-cell !min-h-[4.5rem] justify-center p-3">
          <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
            Avg base
          </span>
          <Odometer
            value={Math.round(avgNet)}
            prefix="Nu. "
            className="mt-0.5 font-mono text-[1.15rem] font-black tabular-nums text-[var(--hos-ink)]"
          />
          <p className="m-0 mt-0.5 text-[10px] text-[var(--hos-ink-3)]">
            {selected?.code ?? "—"}
          </p>
        </div>
        <div className="hos-mobile-kpi-cell !min-h-[4.5rem] justify-center p-3" data-glow="gold">
          <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
            Sample sell
          </span>
          <Odometer
            value={sample.total}
            prefix="Nu. "
            className="mt-0.5 font-mono text-[1.15rem] font-black tabular-nums text-[var(--hos-ink)]"
          />
          <p className="m-0 mt-0.5 text-[10px] text-[var(--hos-ink-3)]">
            SC {scOn ? "on" : "off"} · GST {gstOn ? "on" : "off"}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-3 lg:flex-row">
        <GlassPanel className="flex w-full shrink-0 flex-col gap-2 p-2.5 lg:w-60">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
              Cards · {activeCards.length}
            </span>
          </div>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--hos-ink-3)]"
              strokeWidth={2}
            />
            <input
              value={cardQuery}
              onChange={(e) => setCardQuery(e.target.value)}
              placeholder="Filter cards…"
              className="hos-input w-full !rounded-xl !py-2 !pl-8 !pr-2 !text-[12px]"
            />
          </div>
          <div className="hos-scrollbar-slim flex max-h-[min(52vh,28rem)] gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0">
          {filteredCards.length === 0 ? (
            <p className="m-0 px-2 py-3 text-[11px] text-[var(--hos-ink-3)]">No cards match</p>
          ) : null}
          {filteredCards.map((c) => {
            const n = agents.filter((a) => a.rateCardId === c.id).length;
            const active = selected?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => selectRateCard(c.id)}
                className={`min-w-[8rem] shrink-0 rounded-xl border px-3 py-2.5 text-left text-xs transition lg:min-w-0 ${
                  active
                    ? "border-[var(--hos-primary)] bg-[color-mix(in_srgb,var(--hos-primary)_12%,var(--hos-cell))] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                    : "border-transparent bg-transparent hover:bg-[color-mix(in_srgb,var(--hos-ink)_4%,transparent)]"
                }`}
                style={{ borderLeftWidth: 3, borderLeftColor: KIND_EDGE[c.kind] }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-bold ${active ? "text-[var(--hos-primary)]" : "text-[var(--hos-ink)]"}`}>
                    {c.code}
                  </span>
                  {n > 0 ? (
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--hos-ink)_8%,transparent)] px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-[var(--hos-ink-3)]">
                      {n}
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 truncate text-[10px] text-[var(--hos-ink-3)]">{c.name}</div>
                <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                  {c.kind}
                </div>
              </button>
            );
          })}
          </div>
        </GlassPanel>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <MorphTabs
              glowId="ratesSeasonGlow"
              value={season}
              onChange={setSeason}
              items={[
                { id: "peak", label: "Peak" },
                { id: "lean", label: "Lean" },
              ]}
            />
            <MorphTabs
              glowId="ratesMealGlow"
              value={mealPlan}
              onChange={setMealPlan}
              items={(["EP", "CP", "MAP", "AP"] as MealPlan[]).map((m) => ({
                id: m,
                label: m,
              }))}
            />
            <button
              type="button"
              onClick={() => setTaxOpen((v) => !v)}
              className="hos-btn-tactile inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 text-[11px] font-semibold text-[var(--hos-ink-2)]"
            >
              <SlidersHorizontal className="size-3.5" strokeWidth={2} />
              {fieldModeLabel}
              {!gstOn ? " · GST off" : ""}
            </button>
          </div>

          {taxOpen ? (
            <GlassPanel className="flex flex-col gap-2 p-3">
              {!gstOn ? (
                <div className="flex flex-col gap-2 rounded-xl border border-[var(--hos-line)] bg-[color-mix(in_srgb,var(--hos-brass)_10%,var(--hos-cell))] px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="m-0 text-[11px] text-[var(--hos-brass-ink)]">
                    GST OFF — new license. Strip old GST lines from open bills if needed.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="!h-8 shrink-0 !rounded-full text-[11px]"
                    onClick={runStripGstBills}
                  >
                    Strip GST from bills
                  </Button>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <TaxToggle
                  label="Service charge"
                  on={scOn}
                  onChange={setScOn}
                  hint="10% SC on base"
                />
                <TaxToggle
                  label="GST"
                  on={gstOn}
                  onChange={(v) => {
                    setGstOn(v);
                    if (!v) {
                      toast.message("GST off", {
                        action: { label: "Strip bills", onClick: runStripGstBills },
                      });
                    }
                  }}
                  hint="Keep OFF until GST-eligible"
                />
                <TaxToggle
                  label="Incl. SC in field"
                  on={scInclusive}
                  onChange={setScInclusive}
                  hint={scOn ? "Type / see with SC" : "Turn SC on first"}
                />
                <TaxToggle
                  label="Incl. GST in field"
                  on={gstInclusive}
                  onChange={setGstInclusive}
                  hint={gstOn ? "Type / see with GST" : "Turn GST on first"}
                />
              </div>
            </GlassPanel>
          ) : null}

          {selected ? (
            <div
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5"
              style={{ borderLeftWidth: 3, borderLeftColor: KIND_EDGE[selected.kind] }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[14px] text-[var(--hos-ink)]">{selected.name}</strong>
                  <Badge tone="teal">{selected.kind}</Badge>
                  <span className="font-mono text-[11px] text-[var(--hos-ink-3)]">
                    {selected.code}
                  </span>
                </div>
                <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                  {assignedAgents.length
                    ? `Assigned ${assignedAgents.map((a) => a.code).join(" · ")}`
                    : "No agents on this card"}
                  {" · "}
                  Fields = {fieldModeLabel} · save on blur
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="!rounded-xl"
                onClick={() => setAssignOpen((v) => !v)}
              >
                <Users className="size-3.5" strokeWidth={2} />
                {assignOpen ? "Done" : "Assign"}
              </Button>
              {selected.kind !== "public" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const res = archiveRateCard(selected.id);
                    if (!res.ok) toast.error(res.error);
                    else toast.success("Rate card archived");
                  }}
                >
                  Archive
                </Button>
              ) : null}
            </div>
          ) : null}

          {assignOpen && selected ? (
            <GlassPanel className="flex flex-wrap gap-2 p-3">
              {agents
                .filter((a) => a.active)
                .map((a) => {
                  const on = a.rateCardId === selected.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        if (on) {
                          const pub =
                            activeCards.find((c) => c.code === "PUBLIC")?.id ??
                            activeCards[0]?.id;
                          if (!pub) return;
                          const res = assignAgentRateCard(a.id, pub);
                          if (!res.ok) toast.error(res.error);
                          else toast.success(`${a.code} → PUBLIC`);
                          return;
                        }
                        const res = assignAgentRateCard(a.id, selected.id);
                        if (!res.ok) toast.error(res.error);
                        else toast.success(`${a.code} → ${selected.code}`);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                        on
                          ? "border-[var(--hos-primary)] bg-[var(--hos-primary)] text-white"
                          : "border-[var(--hos-line)] text-[var(--hos-ink-2)]"
                      }`}
                    >
                      {a.code}
                    </button>
                  );
                })}
            </GlassPanel>
          ) : null}

          {listMouAcceptances().length > 0 ? (
            <GlassPanel className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <strong className="text-[11px] uppercase tracking-wide text-[var(--hos-ink-3)]">
                  MoU acceptances
                </strong>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAcceptTick((n) => n + 1)}
                >
                  Refresh
                </Button>
              </div>
              <ul className="m-0 max-h-28 list-none space-y-1 overflow-y-auto p-0 text-[11px]">
                {listMouAcceptances()
                  .slice(0, 8)
                  .map((a) => (
                    <li
                      key={`${a.id}-${acceptTick}`}
                      className="flex flex-wrap justify-between gap-2 border-b border-[var(--hos-line)] py-1"
                    >
                      <span>
                        {a.agentName} · {a.signerName}
                      </span>
                      <span className="font-mono text-[var(--hos-ink-3)]">
                        {new Date(a.acceptedAt).toLocaleString("en-GB")}
                      </span>
                    </li>
                  ))}
              </ul>
            </GlassPanel>
          ) : null}

          <GlassPanel className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--hos-line)] bg-[color-mix(in_srgb,var(--hos-surface)_90%,transparent)] px-3.5 py-2">
              <p className="m-0 text-[11px] font-medium text-[var(--hos-ink-3)]">
                Matrix · {season} · {mealPlan} · {fieldModeLabel}
              </p>
              <span className="text-[10px] text-[var(--hos-ink-3)]">Enter / blur saves</span>
            </div>
            <div className="hos-scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--hos-line)] bg-[var(--hos-cell)] text-[10px] uppercase tracking-wide text-[var(--hos-ink-3)]">
                  <th className="sticky left-0 z-[1] bg-[var(--hos-cell)] px-3 py-2.5">
                    Room
                  </th>
                  {OCC_BANDS.map((b) => (
                    <th key={b.id} className="px-2 py-2.5" title={b.hint}>
                      {b.label}
                      <div className="font-normal normal-case tracking-normal text-[9px] opacity-70">
                        {b.hint}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right">Dbl sell</th>
                </tr>
              </thead>
              <tbody>
                {TYPES.map((t, rowIdx) => {
                  const cell = visible.find((c) => c.typeCode === t.code);
                  const doubleSell = quoteDisplay(
                    cell ? cellBandNet(cell, "double") : 0,
                  );
                  const zebra =
                    rowIdx % 2 === 0
                      ? "bg-[var(--hos-cell)]"
                      : "bg-[color-mix(in_srgb,var(--hos-ink)_2.5%,var(--hos-cell))]";
                  return (
                    <tr
                      key={t.code}
                      className={`border-b border-[var(--hos-line)] ${zebra} hover:bg-[color-mix(in_srgb,var(--hos-primary)_6%,var(--hos-cell))]`}
                    >
                      <td className={`sticky left-0 z-[1] px-3 py-2.5 align-middle ${zebra}`}>
                        <strong className="block text-[12px] text-[var(--hos-ink)]">
                          {t.code}
                        </strong>
                        <div className="text-[10px] text-[var(--hos-ink-3)]">{t.name}</div>
                      </td>
                      {OCC_BANDS.map((b) => {
                        const key = draftKey(t.code, b.id);
                        const storedNet = cell ? cellBandNet(cell, b.id) : 0;
                        const draft = editDrafts[key];
                        const editing = draft !== undefined;
                        const liveNet =
                          editing && draft !== ""
                            ? netFromShown(Number(draft) || 0)
                            : storedNet;
                        const q = quoteDisplay(liveNet);
                        const display = shownFromNet(storedNet);
                        return (
                          <td key={b.id} className="px-2 py-2 align-middle">
                            <input
                              type="text"
                              inputMode="numeric"
                              aria-label={`${t.code} ${b.label}`}
                              value={editing ? draft : String(display)}
                              disabled={!selected}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^\d.]/g, "");
                                setEditDrafts((d) => ({ ...d, [key]: raw }));
                              }}
                              onFocus={(e) => e.currentTarget.select()}
                              onBlur={() => {
                                if (!selected) return;
                                const raw = editDrafts[key];
                                if (raw === undefined || raw === "") {
                                  setEditDrafts((d) => {
                                    const next = { ...d };
                                    delete next[key];
                                    return next;
                                  });
                                  return;
                                }
                                setOccupancyRate(
                                  selected.id,
                                  t.code,
                                  b.id,
                                  netFromShown(Number(raw) || 0),
                                );
                                setEditDrafts((d) => {
                                  const next = { ...d };
                                  delete next[key];
                                  return next;
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className={`w-[5.75rem] rounded-xl border px-2.5 py-2 font-mono text-xs font-semibold tabular-nums outline-none transition focus:border-[var(--hos-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--hos-primary)_25%,transparent)] ${
                                editing
                                  ? "border-[var(--hos-primary)] bg-white text-[var(--hos-ink)]"
                                  : "border-[var(--hos-line)] bg-[var(--hos-surface)] text-[var(--hos-ink)]"
                              }`}
                            />
                            <div
                              className={`mt-1 font-mono text-[9px] tabular-nums ${
                                editing
                                  ? "text-[var(--hos-primary)]"
                                  : "text-[var(--hos-ink-3)]"
                              }`}
                            >
                              → {formatNu(q.total)}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right align-middle font-mono text-[13px] font-black tabular-nums text-[var(--hos-ink)]">
                        {formatNu(doubleSell.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <p className="m-0 border-t border-[var(--hos-line)] px-3.5 py-2 text-[10px] text-[var(--hos-ink-3)]">
              Child 0–5 free · 6–11 Child rate · 12+ adult · Extra = third person / mattress
            </p>
          </GlassPanel>
        </div>
      </div>
    </div>

      <RateSheetShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        season={season}
        mealPlan={mealPlan}
        initialAudience={shareAudience}
        initialAgentId={shareAgentId}
      />

      <RateSheetPrintOverlay
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        pack={printPack}
        title={`Print / Save PDF · ${selected?.code ?? "sheet"} · ${season} · ${mealPlan}`}
      />
    </ModuleFrame>
  );
}
