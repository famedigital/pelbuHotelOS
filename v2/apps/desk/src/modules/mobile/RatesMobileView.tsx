import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  Odometer,
  springPress,
  springSoft,
} from "@hos-v2/ui";
import {
  Archive,
  Plus,
  Printer,
  Share2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { formatNu, useFrontOfficeStore } from "../../lib/front-office-store";
import {
  TYPES,
  cellBandNet,
  cellsForCard,
  useCommercialStore,
  type MealPlan,
  type OccupancyBand,
  type RateCardKind,
  type RateCell,
  type RoomTypeCode,
  type Season,
} from "../../lib/commercial-store";
import {
  composeRateSheetPack,
  publicB2bCardIds,
  type RateShareAudience,
} from "../../lib/rate-sheet-share";
import { RateSheetPrintOverlay } from "../RateSheetPrintOverlay";
import { RateSheetShareModal } from "../RateSheetShareModal";

const OCC_BANDS: { id: OccupancyBand; label: string; hint: string }[] = [
  { id: "double", label: "Double", hint: "2 adults" },
  { id: "single", label: "Single", hint: "1 adult" },
  { id: "extra", label: "Extra", hint: "Extra bed" },
  { id: "child", label: "Child", hint: "6–11 yrs" },
];

const KIND_OPTIONS: { id: RateCardKind; label: string }[] = [
  { id: "public", label: "Public" },
  { id: "personal", label: "Personal" },
  { id: "agent", label: "Agent" },
  { id: "mou", label: "MoU" },
  { id: "custom", label: "Custom" },
];

const KIND_EDGE: Record<RateCardKind, string> = {
  public: "var(--hos-primary)",
  personal: "var(--hos-brass, #F59E0B)",
  agent: "var(--hos-teal, #0d7377)",
  mou: "var(--hos-ruby, #EF4444)",
  custom: "#111",
};

function fmtShort(n: number): string {
  const v = Math.round(n);
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return String(v);
}

/** Phone Rates — mission-control chrome, glanceable room rows, sheet editor. */
export function RatesMobileView() {
  const reduce = useReducedMotion();
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

  const [showNew, setShowNew] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<RateCardKind>("custom");
  const [cloneFrom, setCloneFrom] = useState(selectedRateCardId);
  const [editDrafts, setEditDrafts] = useState<Partial<Record<string, string>>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [shareAudience, setShareAudience] =
    useState<RateShareAudience>("public_b2b");
  const [shareAgentId, setShareAgentId] = useState<string | undefined>();
  const [printOpen, setPrintOpen] = useState(false);
  const [editType, setEditType] = useState<RoomTypeCode | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const activeCards = rateCards.filter((c) => c.active);
  const selected =
    activeCards.find((c) => c.id === selectedRateCardId) ?? activeCards[0];
  const visible = selected
    ? cellsForCard(cells, selected.id, season, mealPlan)
    : [];
  const assignedAgents = agents.filter((a) => a.rateCardId === selected?.id);

  const avgNet = useMemo(
    () =>
      visible.reduce((s, c) => s + cellBandNet(c, "double"), 0) /
      Math.max(1, TYPES.length),
    [visible],
  );
  const sample = quoteDisplay(Math.round(avgNet || 0));
  const fieldMode =
    !scInclusive && !gstInclusive
      ? "Base net"
      : [scInclusive ? "Incl SC" : null, gstInclusive ? "Incl GST" : null]
          .filter(Boolean)
          .join(" · ");

  useEffect(() => {
    setEditDrafts({});
  }, [selectedRateCardId, season, mealPlan, scOn, gstOn, scInclusive, gstInclusive]);

  const draftKey = (type: RoomTypeCode, band: OccupancyBand) => `${type}:${band}`;

  const printPack = composeRateSheetPack({
    cards: activeCards,
    cells,
    cardIds: selected ? [selected.id] : publicB2bCardIds(activeCards),
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

  const runStripGstBills = () => {
    void stripGstFromOpenBills().then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`GST removed from ${res.stays} stay bill(s)`, {
        description: `${res.linesReposted} line(s) re-posted · API ACK`,
      });
    });
  };

  const commitBand = (
    type: RoomTypeCode,
    band: OccupancyBand,
    raw: string | undefined,
  ) => {
    if (!selected) return;
    if (raw === undefined || raw === "") {
      setEditDrafts((d) => {
        const next = { ...d };
        delete next[draftKey(type, band)];
        return next;
      });
      return;
    }
    setOccupancyRate(selected.id, type, band, netFromShown(Number(raw) || 0));
    setEditDrafts((d) => {
      const next = { ...d };
      delete next[draftKey(type, band)];
      return next;
    });
  };

  const editingTypeMeta = TYPES.find((t) => t.code === editType);
  const editingCell = editType
    ? visible.find((c) => c.typeCode === editType)
    : undefined;

  return (
    <div className="hos-mobile-page !gap-2.5">
      {/* Hero */}
      <motion.div
        className="hos-mobile-hero"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
      >
        <div className="min-w-0">
          <h1 className="hos-mobile-hero-title">Rate cards</h1>
          <p className="hos-mobile-hero-meta">
            {selected?.code ?? "—"} · {season === "peak" ? "Peak" : "Lean"} ·{" "}
            {mealPlan}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            className="hos-btn-tactile !min-h-10 !min-w-10 !rounded-xl !px-0"
            aria-label="Print rate sheet"
            onClick={() => setPrintOpen(true)}
          >
            <Printer className="size-4" strokeWidth={2} />
          </Button>
          <Button
            size="sm"
            className="hos-btn-ink hos-btn-spring !min-h-10 !rounded-xl !px-3 text-[12px] font-bold"
            onClick={() => {
              const mouAgent = agents.find((a) => a.rateCardId === selected?.id);
              if (selected?.kind === "mou" || mouAgent) {
                setShareAudience("mou");
                setShareAgentId(mouAgent?.id);
              } else {
                setShareAudience("public_b2b");
                setShareAgentId(undefined);
              }
              setShareOpen(true);
            }}
          >
            <Share2 className="size-3.5" strokeWidth={2} />
            Share
          </Button>
        </div>
      </motion.div>

      {/* KPI strip */}
      <div className="hos-mobile-kpi-grid">
        <div className="hos-mobile-kpi-cell" data-glow="sapphire">
          <span className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
            Avg base
          </span>
          <Odometer
            value={Math.round(avgNet)}
            prefix="Nu. "
            className="mt-0.5 font-mono text-[1.05rem] font-black tabular-nums tracking-tight text-[var(--hos-ink)]"
          />
          <p className="m-0 mt-0.5 truncate text-[10px] font-medium text-[var(--hos-ink-3)]">
            {selected?.code ?? "—"}
          </p>
        </div>
        <div className="hos-mobile-kpi-cell" data-glow="gold">
          <span className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
            Sell
          </span>
          <Odometer
            value={sample.total}
            prefix="Nu. "
            className="mt-0.5 font-mono text-[1.05rem] font-black tabular-nums tracking-tight text-[var(--hos-ink)]"
          />
          <p className="m-0 mt-0.5 truncate text-[10px] font-medium text-[var(--hos-ink-3)]">
            SC {scOn ? "on" : "off"} · GST {gstOn ? "on" : "off"}
          </p>
        </div>
        <div className="hos-mobile-kpi-cell" data-glow="emerald">
          <span className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
            Cards
          </span>
          <Odometer
            value={activeCards.length}
            className="mt-0.5 font-mono text-[1.05rem] font-black tabular-nums tracking-tight text-[var(--hos-ink)]"
          />
          <p className="m-0 mt-0.5 truncate text-[10px] font-medium text-[var(--hos-ink-3)]">
            Active
          </p>
        </div>
        <div className="hos-mobile-kpi-cell">
          <span className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
            Agents
          </span>
          <Odometer
            value={assignedAgents.length}
            className="mt-0.5 font-mono text-[1.05rem] font-black tabular-nums tracking-tight text-[var(--hos-ink)]"
          />
          <p className="m-0 mt-0.5 truncate text-[10px] font-medium text-[var(--hos-ink-3)]">
            On this card
          </p>
        </div>
      </div>

      {/* Card picker */}
      <div className="hos-mobile-segment-rail -mx-1 px-1">
        {activeCards.map((c) => {
          const n = agents.filter((a) => a.rateCardId === c.id).length;
          const active = selected?.id === c.id;
          return (
            <motion.button
              key={c.id}
              type="button"
              data-active={active ? "true" : undefined}
              onClick={() => selectRateCard(c.id)}
              whileTap={reduce ? undefined : { scale: 0.96, transition: springPress }}
              className="hos-mobile-segment !gap-1.5"
              style={
                active
                  ? { boxShadow: `inset 0 -2px 0 0 ${KIND_EDGE[c.kind]}` }
                  : undefined
              }
            >
              {c.code}
              {n > 0 ? (
                <span className="hos-mobile-segment-count">{n}</span>
              ) : null}
            </motion.button>
          );
        })}
        <motion.button
          type="button"
          data-active={showNew ? "true" : undefined}
          onClick={() => setShowNew((v) => !v)}
          whileTap={reduce ? undefined : { scale: 0.96, transition: springPress }}
          className="hos-mobile-segment !gap-1 border-dashed"
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
          {showNew ? "Close" : "New"}
        </motion.button>
      </div>

      {/* Season + meal — single control strip */}
      <div className="hos-mobile-pass !flex-row !flex-wrap !items-center !gap-1.5 !p-1.5">
        <div className="flex min-w-0 flex-1 gap-0.5 rounded-xl bg-[color-mix(in_srgb,var(--hos-ink)_4%,transparent)] p-0.5">
          {(["peak", "lean"] as Season[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeason(s)}
              className={`min-h-9 flex-1 rounded-[10px] text-[12px] font-bold capitalize transition ${
                season === s
                  ? "bg-[#111] text-white shadow-sm"
                  : "text-[var(--hos-ink-2)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-[1.4] gap-0.5 rounded-xl bg-[color-mix(in_srgb,var(--hos-ink)_4%,transparent)] p-0.5">
          {(["EP", "CP", "MAP", "AP"] as MealPlan[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMealPlan(m)}
              className={`min-h-9 flex-1 rounded-[10px] text-[11px] font-bold transition ${
                mealPlan === m
                  ? "bg-[#111] text-white shadow-sm"
                  : "text-[var(--hos-ink-2)]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* New card form */}
      <AnimatePresence initial={false}>
        {showNew ? (
          <motion.div
            key="new"
            initial={reduce ? false : { opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={reduce ? undefined : { opacity: 0, height: 0 }}
            transition={springSoft}
            className="overflow-hidden"
          >
            <div className="hos-mobile-pass space-y-2.5 !p-3">
              <p className="m-0 text-[11px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]">
                New rate card
              </p>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Code · AGT7-SPECIAL"
                className="hos-input w-full !min-h-11 !rounded-xl !px-3 font-mono !text-[15px]"
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Display name"
                className="hos-input w-full !min-h-11 !rounded-xl !px-3 !text-[15px]"
              />
              <div className="hos-mobile-segment-rail">
                {KIND_OPTIONS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    data-active={newKind === k.id ? "true" : undefined}
                    onClick={() => setNewKind(k.id)}
                    className="hos-mobile-segment"
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <select
                value={cloneFrom}
                onChange={(e) => setCloneFrom(e.target.value)}
                className="hos-input w-full !min-h-11 !rounded-xl !px-3 !text-[14px]"
              >
                {activeCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    Clone from {c.code}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                className="hos-btn-ink !min-h-11 w-full !rounded-xl"
                onClick={submitNew}
              >
                Create card
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Selected card + tax chip */}
      {selected ? (
        <div
          className="hos-mobile-pass !gap-2 !p-3"
          style={{ borderLeftWidth: 3, borderLeftColor: KIND_EDGE[selected.kind] }}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <strong className="truncate text-[14px] text-[var(--hos-ink)]">
                  {selected.name}
                </strong>
                <Badge tone="teal">{selected.kind}</Badge>
              </div>
              <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                {selected.code}
                {" · "}
                {assignedAgents.length
                  ? assignedAgents.map((a) => a.code).join(" · ")
                  : "No agents"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              className="hos-btn-tactile shrink-0 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2 text-[11px] font-bold text-[var(--hos-primary)]"
            >
              Assign
            </button>
            {selected.kind !== "public" ? (
              <button
                type="button"
                aria-label="Archive rate card"
                className="hos-btn-tactile inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ruby,#ef4444)]"
                onClick={() => {
                  const res = archiveRateCard(selected.id);
                  if (!res.ok) toast.error(res.error);
                  else toast.success("Archived");
                }}
              >
                <Archive className="size-4" strokeWidth={2} />
              </button>
            ) : null}
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setTaxOpen(true)}
              className="hos-btn-tactile inline-flex min-h-10 flex-1 items-center gap-2 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 text-left"
            >
              <SlidersHorizontal
                className="size-3.5 shrink-0 text-[var(--hos-ink-3)]"
                strokeWidth={2}
              />
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--hos-ink)]">
                {fieldMode}
                {!gstOn ? " · GST off" : ""}
              </span>
            </button>
            {!gstOn ? (
              <button
                type="button"
                onClick={runStripGstBills}
                className="hos-btn-tactile shrink-0 rounded-xl border border-[var(--hos-line)] bg-[color-mix(in_srgb,var(--hos-brass)_14%,var(--hos-cell))] px-3 text-[11px] font-bold text-[var(--hos-brass-ink)]"
              >
                Strip GST
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Room list — glanceable bands */}
      {TYPES.length === 0 ? (
        <EmptyState title="No room types" description="Add inventory first" />
      ) : (
        <div className="flex flex-col gap-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
              Rooms · {TYPES.length}
            </span>
            <span className="text-[10px] text-[var(--hos-ink-3)]">
              Tap row to edit · {fieldMode}
            </span>
          </div>
          {TYPES.map((t, i) => {
            const cell = visible.find((c) => c.typeCode === t.code);
            const doubleSell = quoteDisplay(cell ? cellBandNet(cell, "double") : 0);
            return (
              <motion.button
                key={t.code}
                type="button"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.18) }}
                whileTap={reduce ? undefined : { scale: 0.985 }}
                onClick={() => setEditType(t.code)}
                className="hos-mobile-pass hos-butter-card w-full !gap-2.5 text-left active:brightness-[0.98]"
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: selected
                    ? KIND_EDGE[selected.kind]
                    : "#111",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="hos-mobile-avatar !text-[10px]">
                    {t.code.replace("-", "")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-[var(--hos-ink)]">
                      {t.name}
                    </div>
                    <div className="text-[10px] font-medium text-[var(--hos-ink-3)]">
                      {t.code} · edit occupancy bands
                    </div>
                  </div>
                  <div className="text-right">
                    <Odometer
                      value={doubleSell.total}
                      prefix="Nu. "
                      className="font-mono text-[14px] font-black tabular-nums text-[var(--hos-ink)]"
                    />
                    <div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                      Dbl sell
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {OCC_BANDS.map((b) => {
                    const net = cell ? cellBandNet(cell, b.id) : 0;
                    const isDbl = b.id === "double";
                    return (
                      <div
                        key={b.id}
                        className={`rounded-xl px-1.5 py-1.5 text-center ${
                          isDbl
                            ? "bg-[color-mix(in_srgb,var(--hos-primary)_12%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--hos-primary)_28%,transparent)]"
                            : "bg-[color-mix(in_srgb,var(--hos-ink)_4%,transparent)]"
                        }`}
                      >
                        <div className="text-[8px] font-black uppercase tracking-wider text-[var(--hos-ink-3)]">
                          {b.label.slice(0, 3)}
                        </div>
                        <div
                          className={`font-mono text-[12px] font-bold tabular-nums ${
                            isDbl ? "text-[var(--hos-primary)]" : "text-[var(--hos-ink)]"
                          }`}
                        >
                          {fmtShort(shownFromNet(net))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Tax sheet */}
      <AnimatePresence>
        {taxOpen ? (
          <SheetShell
            title="Tax & price field"
            onClose={() => setTaxOpen(false)}
            reduce={Boolean(reduce)}
          >
            <p className="m-0 text-[12px] text-[var(--hos-ink-3)]">
              Always store base net. Toggles only change what you type and see.
            </p>
            {!gstOn ? (
              <div className="rounded-xl border border-[var(--hos-line)] bg-[color-mix(in_srgb,var(--hos-brass)_12%,var(--hos-cell))] px-3 py-2.5">
                <p className="m-0 text-[12px] font-semibold text-[var(--hos-brass-ink)]">
                  GST is OFF (new license / not eligible).
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 !min-h-11 w-full !rounded-xl"
                  onClick={runStripGstBills}
                >
                  Strip GST from open bills
                </Button>
              </div>
            ) : null}
            <ToggleRow label="Service charge 10%" on={scOn} onChange={setScOn} />
            <ToggleRow
              label="GST / BST"
              on={gstOn}
              onChange={(v) => {
                setGstOn(v);
                if (!v) {
                  toast.message("GST off", {
                    action: { label: "Strip bills", onClick: runStripGstBills },
                  });
                }
              }}
            />
            <div className="h-px bg-[var(--hos-line)]" />
            <ToggleRow
              label="Show / type incl. SC"
              on={scInclusive}
              onChange={setScInclusive}
              disabled={!scOn}
            />
            <ToggleRow
              label="Show / type incl. GST"
              on={gstInclusive}
              onChange={setGstInclusive}
              disabled={!gstOn}
            />
          </SheetShell>
        ) : null}
      </AnimatePresence>

      {/* Occupancy editor sheet */}
      <AnimatePresence>
        {editType && editingTypeMeta ? (
          <SheetShell
            title={editingTypeMeta.name}
            subtitle={`${editingTypeMeta.code} · ${fieldMode} · save on blur`}
            onClose={() => setEditType(null)}
            reduce={Boolean(reduce)}
          >
            <BandEditorGrid
              typeCode={editType}
              cell={editingCell}
              editDrafts={editDrafts}
              setEditDrafts={setEditDrafts}
              draftKey={draftKey}
              commitBand={commitBand}
              shownFromNet={shownFromNet}
              netFromShown={netFromShown}
              quoteDisplay={quoteDisplay}
              scOn={scOn}
              gstOn={gstOn}
              disabled={!selected}
            />
            <Button
              size="sm"
              className="hos-btn-ink !min-h-12 w-full !rounded-xl"
              onClick={() => setEditType(null)}
            >
              Done
            </Button>
          </SheetShell>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {assignOpen && selected ? (
          <SheetShell
            title={`Assign · ${selected.code}`}
            subtitle="Tap operator to attach or detach this card"
            onClose={() => setAssignOpen(false)}
            reduce={Boolean(reduce)}
          >
            <div className="flex flex-wrap gap-2">
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
                      className={`min-h-11 rounded-full border px-3 text-[12px] font-semibold ${
                        on
                          ? "border-[var(--hos-primary)] bg-[var(--hos-primary)] text-white"
                          : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]"
                      }`}
                    >
                      {a.code}
                    </button>
                  );
                })}
            </div>
            <Button
              size="sm"
              className="hos-btn-ink !min-h-11 w-full !rounded-xl"
              onClick={() => setAssignOpen(false)}
            >
              Done
            </Button>
          </SheetShell>
        ) : null}
      </AnimatePresence>

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
        title={`${selected?.code ?? "sheet"} · ${season} · ${mealPlan}`}
      />
    </div>
  );
}

function ToggleRow({
  label,
  on,
  onChange,
  disabled,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-3.5 text-left transition ${
        on
          ? "border-[var(--hos-primary)] bg-[color-mix(in_srgb,var(--hos-primary)_12%,var(--hos-cell))]"
          : "border-[var(--hos-line)] bg-[var(--hos-cell)]"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <span className="text-[13px] font-semibold text-[var(--hos-ink)]">{label}</span>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
          on ? "bg-[var(--hos-primary)]" : "bg-[var(--hos-line)]"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${
            on ? "left-[1.35rem]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function SheetShell({
  title,
  subtitle,
  onClose,
  children,
  reduce,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  reduce: boolean;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[85] flex flex-col justify-end bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? undefined : { opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="max-h-[88vh] overflow-y-auto rounded-t-3xl border border-[var(--hos-line)] border-b-0 bg-[var(--hos-surface)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-18px_48px_-24px_rgba(15,23,42,0.35)]"
        initial={reduce ? false : { y: 40 }}
        animate={{ y: 0 }}
        exit={reduce ? undefined : { y: 48 }}
        transition={springSoft}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--hos-line)]" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="m-0 text-[1.05rem] font-bold text-[var(--hos-ink)]">
              {title}
            </h2>
            {subtitle ? (
              <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="hos-btn-tactile inline-flex size-10 items-center justify-center rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>
        <div className="flex flex-col gap-2.5">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function BandEditorGrid({
  typeCode,
  cell,
  editDrafts,
  setEditDrafts,
  draftKey,
  commitBand,
  shownFromNet,
  netFromShown,
  quoteDisplay,
  scOn,
  gstOn,
  disabled,
}: {
  typeCode: RoomTypeCode;
  cell: RateCell | undefined;
  editDrafts: Partial<Record<string, string>>;
  setEditDrafts: Dispatch<SetStateAction<Partial<Record<string, string>>>>;
  draftKey: (type: RoomTypeCode, band: OccupancyBand) => string;
  commitBand: (
    type: RoomTypeCode,
    band: OccupancyBand,
    raw: string | undefined,
  ) => void;
  shownFromNet: (net: number) => number;
  netFromShown: (shown: number) => number;
  quoteDisplay: (net: number) => { total: number };
  scOn: boolean;
  gstOn: boolean;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {OCC_BANDS.map((b) => {
        const key = draftKey(typeCode, b.id);
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
          <label
            key={b.id}
            className={`flex flex-col gap-1 rounded-2xl border p-2.5 ${
              editing
                ? "border-[var(--hos-primary)] bg-[color-mix(in_srgb,var(--hos-primary)_8%,var(--hos-cell))]"
                : "border-[var(--hos-line)] bg-[var(--hos-cell)]"
            }`}
          >
            <span className="flex items-baseline justify-between gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-[var(--hos-ink)]">
                {b.label}
              </span>
              <span className="text-[9px] font-medium text-[var(--hos-ink-3)]">
                {b.hint}
              </span>
            </span>
            <input
              type="text"
              inputMode="numeric"
              aria-label={`${typeCode} ${b.label}`}
              value={editing ? draft : String(display)}
              disabled={disabled}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d.]/g, "");
                setEditDrafts((d) => ({ ...d, [key]: raw }));
              }}
              onBlur={() => commitBand(typeCode, b.id, editDrafts[key])}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="hos-cell w-full rounded-xl px-2.5 py-3 font-mono text-[1.25rem] font-black tabular-nums tracking-tight"
            />
            <span
              className={`font-mono text-[11px] tabular-nums ${
                editing ? "text-[var(--hos-primary)]" : "text-[var(--hos-ink-3)]"
              }`}
            >
              Sell {formatNu(q.total)}
              {scOn || gstOn ? "" : ""}
            </span>
          </label>
        );
      })}
    </div>
  );
}
