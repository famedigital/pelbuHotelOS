"use client";

import { putFnBOnAgentTab } from "@/app/actions/erp-folio-ops";
import type { StayHubMoneyPayload } from "@/app/actions/stay-hub";
import type { BookableAgent } from "@/components/erp/AgentPicker";
import { CheckOutForm } from "@/components/erp/CheckInForm";
import {
  IssueInvoiceButton,
  PostCheckInChargesForm,
} from "@/components/erp/FolioOpsForms";
import {
  FolioPaymentForm,
  type FolioSettleMethod,
} from "@/components/erp/FolioPaymentForm";
import { FolioRoomPosItemsPanel } from "@/components/erp/FolioRoomPosItemsPanel";
import { StayHubFolioLedgerTable } from "@/components/erp/stay-hub/StayHubFolioLedgerTable";
import { Button } from "@/components/ui/button";
import { isCreditAgentStatus } from "@/lib/agents/status";
import {
  classifyBillLine,
  type BillKind,
} from "@/lib/folio/bill-kinds";
import {
  foPaymentModeLabel,
  foPaymentModeShort,
} from "@/lib/folio/fo-settlement";
import { buildLedgerStripSummary } from "@/lib/folio/ledger-summary";
import {
  buildFolioPageHref,
  type StayHubBoard,
  type StayHubStepId,
} from "@/lib/folio/stay-hub-cycle";
import { formatGuestBtn, roundGuestWholeBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

export type DeskSettleMode = "settle" | "checkout";

export type DeskSettlePanelProps = {
  bookingId: string;
  status: string;
  money: StayHubMoneyPayload | null;
  checkIn: string;
  earlyCheckoutFeeBtn?: number | null;
  lateCheckoutFeeBtn?: number | null;
  hasInvoice: boolean;
  onMoneyChanged: () => void;
  /** Paint voided line immediately before server round-trip. */
  onOptimisticVoidLine?: (lineId: string) => void;
  onCheckedOut?: () => void;
  /** settle = Folio tab (room/POS/print); checkout = balance + check-out only */
  mode?: DeskSettleMode;
  stayPanel?: StayHubStepId | null;
  stayBoard?: StayHubBoard | string | null;
  /**
   * StayHub tool tab: bill overview vs collect form vs advanced.
   * Parent owns tabs; when "collect", payment form is expanded.
   */
  toolTab?: "bill" | "collect" | "advanced";
  onRequestCollect?: () => void;
  collectAnchorRef?: RefObject<HTMLDivElement | null>;
  postChargesAnchorRef?: RefObject<HTMLDivElement | null>;
  /** Extra Advanced-tab content (master tools, manager forms). */
  advancedExtra?: ReactNode;
};

type TabId = "room" | "pos" | "all";

/**
 * Compact Folio settle — due bar + activity list.
 * StayHub owns sticky CTA / hierarchy; no dual-sticky master footer.
 * Checkout tab must NOT mount this — use CheckOutForm there.
 */
export function DeskSettlePanel({
  bookingId,
  status,
  money,
  checkIn,
  earlyCheckoutFeeBtn,
  lateCheckoutFeeBtn,
  hasInvoice,
  onMoneyChanged,
  onOptimisticVoidLine,
  mode = "settle",
  stayPanel = "stay_money",
  stayBoard = "auto",
  toolTab = "bill",
  onRequestCollect,
  collectAnchorRef,
  postChargesAnchorRef,
  advancedExtra,
}: DeskSettlePanelProps) {
  const [tab, setTab] = useState<TabId>("all");
  const [payPreset, setPayPreset] = useState<{
    amount: number;
    method: FolioSettleMethod;
  } | null>(null);
  const folioId = money?.folioId ?? null;
  const dues = Number(money?.balanceBtn ?? 0);
  const guestDue = roundGuestWholeBtn(
    Math.max(0, Number(money?.guestVisibleBalanceBtn ?? dues)),
  );
  const isInHouse = status === "checked_in";
  const isCheckedOut = status === "checked_out";
  const balanceClear = dues <= 0.5;
  const showCollect = !balanceClear && guestDue > 0.5;

  const stayFolioHref = folioId
    ? buildFolioPageHref({
        folioId,
        stayReturn: true,
        bookingId,
        panel: stayPanel ?? "stay_money",
        board: stayBoard,
      })
    : null;
  const receiptHref = folioId
    ? buildFolioPageHref({
        folioId,
        pathSuffix: "/receipt",
      })
    : null;
  const lines = money?.lines ?? [];
  const postedOnly = useMemo(
    () => lines.filter((l) => (l.status ?? "posted") === "posted"),
    [lines],
  );
  const roomLines = useMemo(
    () =>
      postedOnly.filter((l) => {
        const g = classifyBillLine(l);
        return g === "room" || g === "hotel_adj" || g === "other";
      }),
    [postedOnly],
  );
  const posLines = useMemo(
    () =>
      postedOnly.filter((l) => {
        return classifyBillLine(l) === "fnb";
      }),
    [postedOnly],
  );

  const roomTotal = roomLines.reduce((s, l) => s + Number(l.total_btn ?? 0), 0);
  const posTotal = posLines.reduce((s, l) => s + Number(l.total_btn ?? 0), 0);
  const ledgerSummary =
    money?.ledgerSummary ?? buildLedgerStripSummary(lines);
  const posGuestCharges = posLines
    .filter((l) => (l.bill_to ?? "guest") !== "agent")
    .reduce((s, l) => s + Number(l.total_btn ?? 0), 0);
  const posAgentCharges = posLines
    .filter((l) => (l.bill_to ?? "guest") === "agent")
    .reduce((s, l) => s + Number(l.total_btn ?? 0), 0);
  /** Cap F&B settle at guest-visible due so chips never overshoot remaining. */
  const posGuestDueHint = roundGuestWholeBtn(
    Math.min(
      guestDue,
      Math.max(0, posGuestCharges),
    ),
  );
  const agentRoom = Number(money?.agentChargesBtn ?? 0);
  const agentName = money?.agentName ?? null;
  const agentId = money?.agentId ?? null;
  const paymentMode = (money?.paymentMode ?? "").toLowerCase();
  const bookableAgent: BookableAgent | null =
    agentId && agentName
      ? {
          id: agentId,
          company_name: agentName,
          market: money?.agentMarket ?? "bhutan",
          status: money?.agentStatus ?? "directory",
        }
      : null;
  const [localAgentStatus, setLocalAgentStatus] = useState<string | null>(
    money?.agentStatus ?? null,
  );
  useEffect(() => {
    setLocalAgentStatus(money?.agentStatus ?? null);
  }, [money?.agentStatus, money?.agentId]);
  const settleAgent: BookableAgent | null = bookableAgent
    ? {
        ...bookableAgent,
        status: localAgentStatus ?? bookableAgent.status,
      }
    : null;
  const agentCreditEligible = settleAgent
    ? isCreditAgentStatus(settleAgent.status)
    : false;
  const hasPos =
    posLines.length > 0 || (money?.roomPosOrders?.length ?? 0) > 0;
  const hasRoom = roomLines.length > 0;
  /** Always expose Room / POS / All so F&B is never hidden behind a dual-only condition. */
  const showSplitTabs = true;
  /** StayHub identity rail already shows agent — denser DueBar. */
  const denseDue = stayPanel === "stay_money";

  // Prefer a clean all-lines ledger on open (FO can filter Room / POS).
  useEffect(() => {
    setTab("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per folio
  }, [folioId]);

  // Must stay above early returns — folio load used to add this hook mid-render
  // and crash StayHub ("Rendered more hooks than during the previous render").
  const ledgerLinesForTab = useMemo(() => {
    if (tab === "room") {
      return lines.filter((l) => {
        const st = (l.status ?? "posted").toLowerCase();
        if (st !== "posted" && st !== "voided") return false;
        if (st === "posted") {
          const g = classifyBillLine(l);
          return g === "room" || g === "hotel_adj" || g === "other";
        }
        // voided room-ish: same classification
        const g = classifyBillLine(l);
        return g === "room" || g === "hotel_adj" || g === "other";
      });
    }
    if (tab === "pos") {
      return lines.filter((l) => classifyBillLine(l) === "fnb");
    }
    return lines;
  }, [lines, tab]);

  function openSettle(opts?: {
    amount?: number;
    method?: FolioSettleMethod;
  }) {
    const amount = roundGuestWholeBtn(
      Math.max(0, opts?.amount ?? guestDue),
    );
    setPayPreset({
      amount: amount > 0.5 ? amount : guestDue,
      method: opts?.method ?? "cash",
    });
    onRequestCollect?.();
  }

  if (!folioId) {
    return (
      <div className="rounded-md border bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
        Folio opens at check-in. Room rent posts day-1; F&B when charged to room.
      </div>
    );
  }

  if (isCheckedOut) {
    return (
      <div className="space-y-2 rounded-md border bg-card p-3">
        <p className="text-sm font-medium">Guest checked out</p>
        <p className="text-xs text-muted-foreground">
          Level 4 correction (invoice / reopen) — manager / accounts only.
        </p>
        {money?.invoiceDocId ? (
          <Button asChild variant="outline" className="min-h-11">
            <Link
              href={`/erp/invoices/${money.invoiceDocId}/print?bill=master`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Reprint master invoice
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="ghost" className="min-h-11">
          <Link href={stayFolioHref ?? `/erp/folios/${folioId}`}>
            Open folio / city ledger
          </Link>
        </Button>
      </div>
    );
  }

  // Defensive checkout branch — StayHub should not pass mode="checkout"
  if (mode === "checkout") {
    return (
      <div className="space-y-3">
        <DueBar
          dues={dues}
          roomTotal={roomTotal}
          posTotal={posTotal}
          agentName={money?.agentName}
          paymentMode={paymentMode}
          agentRoom={agentRoom}
          showCollect={false}
          onCollect={undefined}
          invoiceSlot={null}
        />
        {isInHouse ? (
          <CheckOutForm
            bookingId={bookingId}
            rooms={money?.roomLabels ?? []}
            folioBalance={dues}
            earlyFeeDefaultBtn={earlyCheckoutFeeBtn}
            lateFeeDefaultBtn={lateCheckoutFeeBtn}
          />
        ) : null}
      </div>
    );
  }

  const displayLines =
    tab === "pos" ? posLines : tab === "room" ? roomLines : postedOnly;

  const collectExpanded = toolTab === "collect" && showCollect;
  const showBill = toolTab === "bill";
  const showAdvanced = toolTab === "advanced";

  const ledgerEmpty =
    !money?.hasCharges
      ? "No charges yet — post day-1 above, or wait for night audit room nights."
      : tab === "room"
        ? "No room lines yet."
        : tab === "pos"
          ? hasPos
            ? "No F&B folio lines yet — tickets below may still be open."
            : "No F&B charged to room yet."
          : "No lines yet.";

  if (showAdvanced) {
    return (
      <div className="space-y-2">
        <DueBar
          dense
          dues={dues}
          roomTotal={roomTotal}
          posTotal={posTotal}
          agentName={null}
          paymentMode={paymentMode}
          agentRoom={agentRoom}
          showCollect={false}
          onCollect={undefined}
          invoiceSlot={null}
        />
        <MasterActionsBlock
          dense
          folioId={folioId}
          dues={dues}
          invoiceNo={money?.invoiceNo}
          invoiceDocId={money?.invoiceDocId}
          folioAdvanceHref={stayFolioHref}
          receiptHref={receiptHref}
          hasInvoice={hasInvoice}
        />
        {advancedExtra}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {showBill ? (
        <p className="text-[10px] leading-snug text-muted-foreground">
          In-stay bill — post charges and collect here. Void, comp, and manager
          tools:{" "}
          <Link
            href={stayFolioHref ?? `/erp/folios/${folioId}`}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            full folio
          </Link>
          {" · "}
          Advanced tab.
        </p>
      ) : null}
      {/* Dense StayHub: due+settle live on left rail + footer — skip duplicate bar CTA */}
      <DueBar
        dense={denseDue}
        hideCta={denseDue}
        dues={dues}
        roomTotal={roomTotal}
        posTotal={posTotal}
        agentName={denseDue ? null : money?.agentName}
        paymentMode={paymentMode}
        agentRoom={agentRoom}
        showCollect={showCollect && showBill && !denseDue}
        onCollect={
          showCollect && showBill && !denseDue
            ? () => {
                openSettle({ amount: guestDue, method: "cash" });
              }
            : undefined
        }
        invoiceSlot={
          money?.invoiceDocId && showBill ? (
            <Button
              asChild
              variant="outline"
              className="min-h-8 h-8 px-2.5 text-xs"
            >
              <Link
                href={`/erp/invoices/${money.invoiceDocId}/print?bill=master`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Invoice
              </Link>
            </Button>
          ) : null
        }
      />

      {showBill && (hasPos || posTotal > 0.5) && tab === "room" ? (
        <button
          type="button"
          onClick={() => setTab("pos")}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/20 px-2 py-1 text-left text-[11px] transition-colors hover:bg-muted/40"
        >
          <span className="font-medium text-foreground">POS / F&amp;B also posted</span>
          <span className="tabular-nums text-muted-foreground">
            {formatGuestBtn(posTotal)}
          </span>
        </button>
      ) : null}
      {collectExpanded ? (
        <div
          ref={collectAnchorRef as RefObject<HTMLDivElement>}
          className="space-y-1.5"
        >
          <p className="text-[11px] font-medium text-muted-foreground">
            {agentName ? "Settle · cash or agent AR" : "Collect payment"}
          </p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Confirmation <span className="font-medium text-foreground">PS-…</span>{" "}
            is the stay note. Tax invoice{" "}
            <span className="font-medium text-foreground">INV-…</span> is issued
            from Folio when GST needs it.
          </p>
          <FolioPaymentForm
            key={`pay-${payPreset?.method ?? "cash"}-${payPreset?.amount ?? guestDue}-${localAgentStatus ?? "x"}`}
            folioId={folioId}
            suggestedAmount={payPreset?.amount ?? guestDue}
            defaultMethod={payPreset?.method ?? "cash"}
            emphasized
            compact
            agentName={agentName}
            agent={settleAgent}
            agentCreditEligible={agentCreditEligible}
            onAgentPromoted={(next) => {
              setLocalAgentStatus(next.status);
              onMoneyChanged();
            }}
            onUseCashFromPromote={() => {
              setPayPreset({
                amount: payPreset?.amount ?? guestDue,
                method: "cash",
              });
            }}
            amountPresets={[
              ...(guestDue > 0.5
                ? [
                    {
                      id: "full-guest",
                      label: "Full guest due",
                      amount: guestDue,
                    },
                  ]
                : []),
              ...(posGuestDueHint > 0.5
                ? [
                    {
                      id: "pos-only",
                      label: "POS / F&B only",
                      amount: posGuestDueHint,
                    },
                  ]
                : []),
            ]}
          />
        </div>
      ) : null}

      {showBill ? (
        <>
          {!money?.hasCharges ? (
            <div ref={postChargesAnchorRef as RefObject<HTMLDivElement>}>
              <details className="group rounded-md border bg-muted/15">
                <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-medium select-none [&::-webkit-details-marker]:hidden">
                  <span>Day-1 room charges</span>
                  <span className="text-[10px] text-muted-foreground">
                    Post
                  </span>
                </summary>
                <div className="border-t px-2.5 py-2">
                  <PostCheckInChargesForm
                    folioId={folioId}
                    defaultDate={checkIn}
                  />
                </div>
              </details>
            </div>
          ) : null}

          {showSplitTabs ? (
            <div
              className="flex gap-0.5 rounded-md border bg-muted/25 p-0.5"
              role="tablist"
              aria-label="Bill sections"
            >
              {(
                [
                  { id: "all" as const, label: "All" },
                  {
                    id: "room" as const,
                    label: "Room",
                    hint: formatGuestBtn(roomTotal),
                  },
                  {
                    id: "pos" as const,
                    label: "POS",
                    hint: formatGuestBtn(posTotal),
                  },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "min-h-8 flex-1 rounded px-1.5 text-[11px] font-medium transition-colors",
                    tab === t.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  {"hint" in t && t.hint ? (
                    <span className="ml-1 tabular-nums text-muted-foreground opacity-80">
                      {t.hint}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {(tab === "pos" || tab === "all") &&
          (hasPos || posTotal > 0.5) &&
          agentId ? (
            <PosPayorStrip
              folioId={folioId}
              hasPos={hasPos}
              posTotal={posTotal}
              posGuestCharges={posGuestCharges}
              posAgentCharges={posAgentCharges}
              posGuestDueHint={posGuestDueHint}
              agentName={agentName}
              agentId={agentId}
              canCollect={showCollect}
              onCollectGuestFnB={() =>
                openSettle({ amount: posGuestDueHint, method: "cash" })
              }
              onChargeAgentAr={() =>
                openSettle({
                  amount: posGuestDueHint > 0.5 ? posGuestDueHint : guestDue,
                  method: "agent_credit",
                })
              }
              onMovedToAgent={onMoneyChanged}
            />
          ) : null}

          <StayHubFolioLedgerTable
            lines={ledgerLinesForTab}
            summary={
              tab === "all"
                ? ledgerSummary
                : buildLedgerStripSummary(displayLines)
            }
            siblingFolios={
              tab === "all" ? (money?.siblingFolios ?? []) : []
            }
            empty={ledgerEmpty}
            onVoided={onMoneyChanged}
            onOptimisticVoid={onOptimisticVoidLine}
          />

          {tab === "pos" || tab === "all" ? (
            <FolioRoomPosItemsPanel
              orders={money?.roomPosOrders ?? []}
              onChanged={onMoneyChanged}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function PosPayorStrip({
  folioId,
  hasPos,
  posTotal,
  posGuestCharges,
  posAgentCharges,
  posGuestDueHint,
  agentName,
  agentId,
  canCollect,
  onCollectGuestFnB,
  onChargeAgentAr,
  onMovedToAgent,
}: {
  folioId: string;
  hasPos: boolean;
  posTotal: number;
  posGuestCharges: number;
  posAgentCharges: number;
  posGuestDueHint: number;
  agentName: string | null;
  agentId: string | null;
  canCollect: boolean;
  onCollectGuestFnB: () => void;
  onChargeAgentAr: () => void;
  onMovedToAgent: () => void;
}) {
  const [tabState, tabAction, tabPending] = useActionState(
    putFnBOnAgentTab,
    { ok: false },
  );

  useEffect(() => {
    if (tabState.ok) onMovedToAgent();
  }, [tabState.ok, onMovedToAgent]);

  return (
    <div className="space-y-1.5 rounded-md border border-sky-500/25 bg-sky-500/5 px-2 py-1.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-foreground">
            POS / F&amp;B · usually guest pays
          </p>
          <p className="text-[10px] text-muted-foreground">
            {hasPos
              ? `Charged ${formatGuestBtn(posTotal)} · guest ${formatGuestBtn(posGuestCharges)}`
              : "No room-charge F&B yet."}
            {posAgentCharges > 0.5
              ? ` · agent tab ${formatGuestBtn(posAgentCharges)}`
              : ""}
          </p>
        </div>
      </div>

      {tabState.error ? (
        <p className="text-xs text-destructive" role="status">
          {tabState.error}
        </p>
      ) : null}
      {tabState.ok && tabState.message ? (
        <p className="text-xs text-emerald-800 dark:text-emerald-200" role="status">
          {tabState.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {canCollect && posGuestDueHint > 0.5 ? (
          <Button
            type="button"
            variant="citrus"
            size="sm"
            className="min-h-9"
            onClick={onCollectGuestFnB}
          >
            Guest pays F&amp;B · {formatGuestBtn(posGuestDueHint)}
          </Button>
        ) : null}
        {agentId && posGuestDueHint > 0.5 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            onClick={onChargeAgentAr}
          >
            Charge agent AR · F&amp;B
          </Button>
        ) : null}
        {agentId && posGuestCharges > 0.5 ? (
          <form
            action={tabAction}
            className="inline"
            onSubmit={() => {
              window.setTimeout(onMovedToAgent, 700);
            }}
          >
            <input type="hidden" name="folio_id" value={folioId} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="min-h-9"
              disabled={tabPending}
            >
              {tabPending ? "Moving…" : "Put F&B on agent tab"}
            </Button>
          </form>
        ) : null}
      </div>
      {agentId ? (
        <p className="text-[10px] leading-snug text-muted-foreground">
          AR posts to agent book now · Agent tab reclassifies payor only.
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground">
          Attach an agent on Details for agent tab / AR.
        </p>
      )}
    </div>
  );
}

function DueBar({
  dues,
  roomTotal,
  posTotal,
  agentName,
  paymentMode,
  agentRoom,
  showCollect,
  onCollect,
  invoiceSlot,
  dense = false,
  hideCta = false,
}: {
  dues: number;
  roomTotal: number;
  posTotal: number;
  agentName?: string | null;
  paymentMode: string;
  agentRoom: number;
  showCollect: boolean;
  onCollect?: () => void;
  invoiceSlot: ReactNode;
  /** Hide agent line; smaller total (agent/due live on left rail). */
  dense?: boolean;
  /** StayHub: no second Settle — rail + footer own collection. */
  hideCta?: boolean;
}) {
  const clear = dues <= 0.5;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card",
        dense ? "px-2 py-1.5" : "px-2.5 py-2",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p
            className={cn(
              "font-semibold tracking-tight tabular-nums",
              dense ? "text-base" : "text-lg sm:text-xl",
              !clear && "text-maroon",
            )}
          >
            {clear ? "Clear" : formatGuestBtn(dues)}
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            Room {formatGuestBtn(roomTotal)}
            <span aria-hidden> · </span>
            POS {formatGuestBtn(posTotal)}
            {dense && agentRoom > 0.5
              ? ` · agent ~${formatGuestBtn(agentRoom)}`
              : ""}
          </p>
        </div>
        {!dense && agentName ? (
          <p className="truncate text-[10px] text-muted-foreground">
            {agentName}
            {paymentMode
              ? ` · ${foPaymentModeShort(paymentMode)}`
              : ""}
            {agentRoom > 0.5
              ? ` · agent rooms ~${formatGuestBtn(agentRoom)}`
              : ""}
          </p>
        ) : !dense && paymentMode ? (
          <p className="truncate text-[10px] text-muted-foreground">
            {foPaymentModeLabel(paymentMode)}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {!hideCta && showCollect && onCollect ? (
          <Button
            type="button"
            variant="citrus"
            className={cn(
              "px-3",
              dense ? "min-h-9 h-9 text-xs" : "min-h-11 sm:min-h-9",
            )}
            onClick={onCollect}
          >
            {agentName || dense ? "Settle" : "Collect"}
          </Button>
        ) : null}
        {invoiceSlot}
      </div>
    </div>
  );
}

function MasterActionsBlock({
  folioId,
  dues,
  invoiceNo,
  invoiceDocId,
  folioAdvanceHref,
  receiptHref,
  dense = false,
}: {
  folioId: string;
  dues: number;
  invoiceNo?: string | null;
  invoiceDocId?: string | null;
  folioAdvanceHref?: string | null;
  receiptHref?: string | null;
  hasInvoice?: boolean;
  dense?: boolean;
}) {
  const balanceClear = dues <= 0.5;
  const advanceHref =
    folioAdvanceHref ??
    buildFolioPageHref({ folioId, stayReturn: false });
  const printReceiptHref =
    receiptHref ?? buildFolioPageHref({ folioId, pathSuffix: "/receipt" });

  return (
    <div
      className={cn(
        "rounded-md border bg-muted/10",
        dense ? "space-y-1 px-2 py-1.5" : "space-y-1.5 px-2.5 py-2",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <p className="text-[10px] font-medium text-muted-foreground">
          {balanceClear ? "Documents · balance clear" : "Documents · master"}
        </p>
        <div className="flex flex-wrap items-center gap-0.5">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 min-h-7 px-2 text-[11px]"
          >
            <Link
              href={printReceiptHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              Receipt
            </Link>
          </Button>
          {invoiceDocId ? (
            <PrintBillLinks
              folioId={folioId}
              invoiceDocId={invoiceDocId}
              bill="master"
              compact
            />
          ) : null}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 min-h-7 px-2 text-[11px]"
          >
            <Link href={advanceHref}>Full folio</Link>
          </Button>
        </div>
      </div>
      {!invoiceDocId ? (
        <details className="group rounded-md border bg-background">
          <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 px-2 py-1 text-[11px] font-medium select-none [&::-webkit-details-marker]:hidden">
            <span>Issue tax invoice</span>
            <span className="text-[10px] text-muted-foreground">Expand</span>
          </summary>
          <div className="border-t px-2 py-2">
            <IssueInvoiceButton
              folioId={folioId}
              invoiceNo={invoiceNo}
              invoiceDocId={invoiceDocId}
              embedded
              secondary
            />
          </div>
        </details>
      ) : null}
      {!dense ? (
        <p className="text-[10px] text-muted-foreground">
          Group / tour:{" "}
          <Link
            href={advanceHref}
            className="underline-offset-2 hover:underline"
          >
            folio advanced
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function PrintBillLinks({
  invoiceDocId,
  bill,
  compact,
}: {
  folioId: string;
  invoiceDocId?: string | null;
  bill: BillKind;
  compact?: boolean;
}) {
  if (!invoiceDocId) {
    return (
      <span className="text-[10px] text-muted-foreground">
        Print after issue
      </span>
    );
  }
  const label =
    bill === "master"
      ? compact
        ? "Invoice"
        : "Master invoice"
      : bill === "room"
        ? "Room invoice"
        : "F&B invoice";
  return (
    <Button
      asChild
      variant="outline"
      className={cn(compact ? "min-h-9 h-9 px-2.5 text-xs" : "min-h-11")}
    >
      <Link
        href={`/erp/invoices/${invoiceDocId}/print?bill=${bill}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </Link>
    </Button>
  );
}
