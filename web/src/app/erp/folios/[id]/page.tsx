import {
  MarkLinkPaidForm,
  TransferLineForm,
  VoidLineButton,
} from "@/components/erp/FolioOpsForms";
import { FolioActivityTable } from "@/components/erp/FolioActivityTable";
import { FolioActionsPanel } from "@/components/erp/FolioActionsPanel";
import { FolioSplit } from "@/components/erp/FolioSplit";
import { FolioRoomPosItemsPanel } from "@/components/erp/FolioRoomPosItemsPanel";
import { ErpDetailBack } from "@/components/erp/ErpDetailBack";
import { FolioStaleRefreshBanner } from "@/components/erp/FolioStaleRefreshBanner";
import { StayMoneyCycleLegend } from "@/components/erp/StayMoneyCycleLegend";
import { StayMoneyProcessStrip } from "@/components/erp/StayMoneyProcessStrip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { effectiveGstRate } from "@/lib/property-settings";
import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import {
  buildStayHubReopenHref,
  parseStayHubBoard,
  parseStayHubStep,
  stayHubBackTargetLabel,
} from "@/lib/folio/stay-hub-cycle";
import {
  buildStayMoneySteps,
  stayMoneyNextAction,
} from "@/lib/folio/stay-money-cycle";
import { loadRoomChargePosOrders } from "@/lib/folio/room-pos-orders";
import { formatBtn } from "@/lib/pricing";
import { netFolioBalance } from "@/lib/folio/balance";
import { isAgentOpenItemFolio } from "@/lib/folio/agent-open-item";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { folioVersionFingerprint } from "@/lib/folio/version-fingerprint";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Folio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    stay?: string;
    booking?: string;
    panel?: string;
    board?: string;
  }>;
};

type FolioLine = {
  id: string;
  description: string;
  total_btn: number;
  gst_btn: number;
  service_charge_btn?: number;
  service_charge_applied?: boolean;
  source_type: string;
  status: string;
  is_comp?: boolean;
  void_reason?: string | null;
  reverses_line_id?: string | null;
  created_at: string;
  business_date?: string | null;
  bill_to?: string | null;
};

function isPaymentSource(sourceType: string) {
  return sourceType === "payment" || sourceType === "deposit";
}

/** Guest-facing activity rows: pair void + reversal as one Cancelled story. */
type ActivityRow =
  | { kind: "line"; line: FolioLine }
  | {
      kind: "cancelled";
      original: FolioLine;
      reversal: FolioLine;
    };

function buildActivityRows(lines: FolioLine[]): {
  rows: ActivityRow[];
  accountingLines: FolioLine[];
} {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const reversalByOriginal = new Map<string, FolioLine>();
  for (const line of lines) {
    if (line.reverses_line_id) {
      reversalByOriginal.set(line.reverses_line_id, line);
    }
  }

  const consumed = new Set<string>();
  const rows: ActivityRow[] = [];
  const accountingLines: FolioLine[] = [];

  for (const line of lines) {
    if (consumed.has(line.id)) continue;

    if (line.status === "voided") {
      const reversal = reversalByOriginal.get(line.id);
      if (reversal) {
        rows.push({ kind: "cancelled", original: line, reversal });
        consumed.add(line.id);
        consumed.add(reversal.id);
        accountingLines.push(line, reversal);
        continue;
      }
    }

    // Orphan reversal (no voided original in list) still as accounting noise
    if (line.reverses_line_id) {
      const original = byId.get(line.reverses_line_id);
      if (original?.status === "voided" && consumed.has(original.id)) {
        continue;
      }
      if (original?.status === "voided") {
        // handled when walking original
        continue;
      }
      accountingLines.push(line);
      continue;
    }

    if (line.status === "voided") {
      accountingLines.push(line);
      rows.push({ kind: "line", line });
      continue;
    }

    rows.push({ kind: "line", line });
  }

  return { rows, accountingLines };
}

export default async function FolioDetailPage({ params, searchParams }: Props) {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const { id } = await params;
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const activePropertyId = await resolveActivePropertyId(admin);

  const { data: folio } = await admin
    .from("folios")
    .select(
      "id, label, status, booking_id, agent_id, master_folio_id, folio_type, property_id, created_at, agents(company_name), folio_lines(id, description, total_btn, gst_btn, service_charge_btn, service_charge_applied, source_type, status, is_comp, void_reason, reverses_line_id, created_at, business_date, bill_to)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!folio) notFound();

  try {
    assertDeskProperty(
      activePropertyId,
      folio.property_id as string,
      "Folio",
    );
  } catch {
    notFound();
  }

  const bookingId = (folio.booking_id as string | null) ?? null;

  // Guest stay money jobs open in Hub; keep Advanced ledger with ?advanced=1.
  if (
    bookingId &&
    sp.advanced !== "1" &&
    sp.stay !== "1" &&
    (folio.folio_type as string) !== "master" &&
    (folio.folio_type as string) !== "walk_in"
  ) {
    redirect(
      buildStayHubReopenHref({
        bookingId,
        panel: "stay_money",
        board: "stayview",
      }),
    );
  }

  const [
    { data: links },
    { data: invoiceDoc },
    { data: booking },
    { data: siblingFolios },
    { data: masterRows },
    { data: damageItems },
    { data: minibarItems },
    { data: childFolios },
    { data: propertyTax },
  ] = await Promise.all([
    admin
      .from("payment_links")
      .select("id, token, amount_btn, status, purpose, created_at, payee_name")
      .eq("folio_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("fiscal_documents")
      .select("id, doc_no")
      .eq("folio_id", id)
      .eq("doc_kind", "invoice")
      .eq("status", "issued")
      .maybeSingle(),
    bookingId
      ? admin
          .from("bookings")
          .select(
            "id, status, check_in, check_out, contact_name, meal_plan_code, meal_plan_amount_btn, agent_id, payment_mode, agents(company_name)",
          )
          .eq("id", bookingId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    bookingId
      ? admin
          .from("folios")
          .select("id, label, status")
          .eq("property_id", activePropertyId)
          .eq("booking_id", bookingId)
          .eq("status", "open")
          .neq("id", id)
          .limit(20)
      : Promise.resolve({ data: [] as { id: string; label: string; status: string }[] }),
    admin
      .from("folios")
      .select("id, label")
      .eq("property_id", activePropertyId)
      .eq("status", "open")
      .eq("folio_type", "master")
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("property_damage_items")
      .select("id, label, amount_btn")
      .eq("property_id", activePropertyId)
      .eq("is_active", true)
      .order("sort_order"),
    admin
      .from("property_minibar_items")
      .select("id, label, amount_btn, category")
      .eq("property_id", activePropertyId)
      .eq("is_active", true)
      .order("sort_order"),
    (folio.folio_type as string) === "master"
      ? admin
          .from("folios")
          .select("id, label, status")
          .eq("property_id", activePropertyId)
          .eq("master_folio_id", id)
          .order("created_at", { ascending: true })
          .limit(40)
      : Promise.resolve({ data: [] as { id: string; label: string; status: string }[] }),
    admin
      .from("properties")
      .select("gst_enabled, gst_rate")
      .eq("id", activePropertyId)
      .maybeSingle(),
  ]);

  const roomPosOrders = bookingId
    ? await loadRoomChargePosOrders(
        admin,
        activePropertyId,
        bookingId,
      ).catch(() => [])
    : [];

  const transferTargets = (siblingFolios ?? []).map((f) => ({
    id: f.id as string,
    label: (f.label as string) || (f.id as string).slice(0, 8),
  }));

  const masterCandidates = (masterRows ?? []).map((f) => ({
    id: f.id as string,
    label: (f.label as string) || (f.id as string).slice(0, 8),
  }));

  const lines = ((folio.folio_lines as FolioLine[] | null) ?? []).sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const { rows: activityRows, accountingLines } = buildActivityRows(lines);

  const balance = netFolioBalance(lines);
  const folioStatus = (folio.status as string) ?? "open";
  const isOpen = folioStatus === "open";
  const isMaster = (folio.folio_type as string) === "master";
  const agentOpenItem = isAgentOpenItemFolio({
    agent_id: folio.agent_id as string | null,
    booking_id: folio.booking_id as string | null,
  });

  const chargeLines = lines.filter(
    (line) =>
      line.status === "posted" &&
      !isPaymentSource(line.source_type) &&
      line.source_type !== "comp",
  );
  const paymentLines = lines.filter(
    (line) =>
      line.status === "posted" && isPaymentSource(line.source_type),
  );
  const chargesTotal = chargeLines.reduce(
    (sum, line) => sum + Number(line.total_btn),
    0,
  );
  const paymentsTotal = paymentLines.reduce(
    (sum, line) => sum + Math.abs(Number(line.total_btn)),
    0,
  );

  const agentCharges = chargeLines
    .filter((line) => (line.bill_to ?? "guest") === "agent")
    .reduce((sum, line) => sum + Number(line.total_btn), 0);
  const guestCharges = chargeLines
    .filter((line) => (line.bill_to ?? "guest") !== "agent")
    .reduce((sum, line) => sum + Number(line.total_btn), 0);
  const hasAgentSplit =
    agentCharges > 0.5 ||
    Boolean(booking?.agent_id) ||
    chargeLines.some((l) => l.bill_to === "agent");

  const bookingStatus = (booking?.status as string) ?? "confirmed";
  const moneyInput = {
    status: bookingStatus,
    hasFolio: true,
    hasCharges: chargeLines.length > 0,
    hasInvoice: Boolean(invoiceDoc),
    balanceBtn: balance,
  };
  const processSteps = buildStayMoneySteps(moneyInput);
  const nextAction = stayMoneyNextAction(moneyInput);
  const currentStep = processSteps.find((s) => s.current);

  const agentsRaw = booking?.agents as
    | { company_name?: string | null }
    | { company_name?: string | null }[]
    | null
    | undefined;
  const agentCompany =
    (Array.isArray(agentsRaw) ? agentsRaw[0] : agentsRaw)?.company_name ??
    null;

  const arrivalDate =
    (booking?.check_in as string | undefined) ??
    new Date().toISOString().slice(0, 10);
  const mealAmt = Number(booking?.meal_plan_amount_btn ?? 0);
  const hasRoomLine = lines.some(
    (l) => l.status === "posted" && l.source_type === "room",
  );
  const needsDay1 =
    isOpen &&
    bookingStatus === "checked_in" &&
    !agentOpenItem &&
    (!hasRoomLine ||
      chargeLines.length === 0 ||
      (mealAmt > 0 &&
        !lines.some(
          (l) => l.source_type === "meal_plan" && l.status === "posted",
        )));

  const primaryNextLabel = needsDay1
    ? "Post day-1 room + meals"
    : nextAction.label === "Post charges"
      ? "Post room charges"
      : nextAction.label === "Issue invoice"
        ? "Issue tax invoice"
        : nextAction.label === "Collect payment"
          ? "Collect payment"
          : nextAction.label === "Check out"
            ? "Checkout guest"
            : balance > 0.5
              ? "Collect payment"
              : chargeLines.length > 0
                ? "Ready for checkout"
                : "Review folio";

  const defaultActionGroup: "collect" | "invoice" | "post" | "adjust" =
    needsDay1
      ? "post"
      : currentStep?.id === "charges"
        ? "post"
        : currentStep?.id === "invoice"
          ? "invoice"
          : currentStep?.id === "paid" || balance > 0.5
            ? "collect"
            : "collect";

  const statusBlurb = agentOpenItem
    ? balance > 0.5
      ? "Travel-agent F&B open item — invoice issued, collect when the agency pays."
      : "Agent invoice paid."
    : needsDay1
    ? "No room charges yet — post day-1 package first so the balance is real."
    : balance > 0.5
      ? "Open balance — collect payment or issue the tax invoice when ready."
      : chargeLines.length > 0
        ? "Balance due Nu 0 · Nothing to collect"
        : "Open folio — charges appear after check-in, POS, or night audit.";

  const agentJoin = folio.agents as
    | { company_name?: string | null }
    | { company_name?: string | null }[]
    | null;
  const folioAgentName = Array.isArray(agentJoin)
    ? agentJoin[0]?.company_name
    : agentJoin?.company_name;

  const guestTitle =
    (booking?.contact_name as string | undefined)?.trim() ||
    folioAgentName?.trim() ||
    (folio.label as string);

  const folioVersion = folioVersionFingerprint({
    status: folioStatus,
    lines,
  });

  const deskRole = await getDeskRole();
  const showManagerActions =
    deskRole == null ||
    deskRole === "gm" ||
    deskRole === "owner" ||
    deskRole === "front_desk" ||
    deskRole === "cashier";

  const stayReturnRequested = sp.stay === "1";
  const stayReturnBooking = (sp.booking ?? "").trim() || bookingId;
  const stayReturnValid =
    stayReturnRequested &&
    Boolean(stayReturnBooking) &&
    (!bookingId || stayReturnBooking === bookingId);
  const stayReturnPanel =
    parseStayHubStep(sp.panel) ??
    (bookingStatus === "checked_out" ? "check_out" : "stay_money");
  const stayReturnBoard = parseStayHubBoard(sp.board);
  const stayReturnHref =
    stayReturnValid && stayReturnBooking
      ? buildStayHubReopenHref({
          bookingId: stayReturnBooking,
          panel: stayReturnPanel,
          board:
            stayReturnBoard !== "auto"
              ? stayReturnBoard
              : bookingStatus === "checked_in" || bookingStatus === "checked_out"
                ? "in_house"
                : "reservations",
        })
      : null;
  const stayReturnPanelLabel = stayHubBackTargetLabel(
    stayReturnPanel,
    bookingStatus,
  );
  const defaultStayHubHref = bookingId
    ? buildStayHubReopenHref({
        bookingId,
        panel: "stay_money",
        board:
          bookingStatus === "checked_in" || bookingStatus === "checked_out"
            ? "in_house"
            : "reservations",
      })
    : null;

  const primaryHref =
    needsDay1 || currentStep?.id === "charges" || currentStep?.id === "invoice"
      ? "#folio-collect"
      : bookingStatus === "checked_in" &&
          bookingId &&
          Math.abs(balance) <= 0.5
        ? `/erp/check-out?id=${bookingId}`
        : "#folio-collect";

  return (
    <div className="erp mx-auto w-full max-w-[1100px] p-3 pb-24 md:p-4 md:pb-4">
      {stayReturnHref ? (
        <a
          href={stayReturnHref}
          className="sticky top-0 z-30 -mx-3 mb-2 flex min-h-10 items-center gap-2 border-b border-primary/20 bg-primary/5 px-3 py-2 text-sm font-medium text-foreground md:-mx-4 md:px-4"
        >
          <span aria-hidden>←</span>
          <span className="min-w-0 truncate">
            Back to stay
            {guestTitle ? ` · ${guestTitle}` : ""}
            {` · ${stayReturnPanelLabel}`}
          </span>
        </a>
      ) : null}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ErpDetailBack href="/erp/folios" label="City ledger" />
        {defaultStayHubHref ? (
          <a
            href={defaultStayHubHref}
            className="inline-flex h-8 items-center rounded-md border px-2.5 text-sm hover:bg-muted"
          >
            Open stay
          </a>
        ) : null}
      </div>
      <FolioStaleRefreshBanner folioId={id} initialVersion={folioVersion} />

      {/* Clear Desk money hero — balance first, one next action */}
      <div
        className={cn(
          "sticky z-20 -mx-3 mb-3 border-b bg-background px-3 py-2.5 md:-mx-4 md:px-4",
          stayReturnHref ? "top-10" : "top-0",
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              {isMaster ? "Master folio" : "Guest folio"}
            </p>
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">
              {guestTitle}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 font-medium",
                  isOpen
                    ? "bg-sky-100 text-sky-800"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {folioStatus}
              </span>
              {booking ? (
                <span>{bookingStatus.replace(/_/g, " ")}</span>
              ) : null}
              {booking ? (
                <span className="tabular-nums">
                  {booking.check_in as string} → {booking.check_out as string}
                </span>
              ) : null}
              {folio.master_folio_id ? (
                <a
                  href={`/erp/folios/${folio.master_folio_id as string}`}
                  className="font-mono text-primary underline-offset-4 hover:underline"
                >
                  master {(folio.master_folio_id as string).slice(0, 8)}
                </a>
              ) : null}
            </p>
          </div>

          <div className="flex min-w-[9rem] flex-col items-end gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Due</p>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums leading-none md:text-3xl",
                balance > 0.5 ? "text-citrus-600" : "text-mint-600",
              )}
            >
              {formatBtn(balance)}
            </p>
            {isOpen ? (
              <a
                href={primaryHref}
                className={cn(
                  "inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium",
                  balance > 0.5
                    ? "bg-citrus text-sky-ink hover:bg-citrus-soft"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {primaryNextLabel}
              </a>
            ) : null}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <StayMoneyProcessStrip steps={processSteps} />
          {invoiceDoc ? (
            <span className="text-xs text-muted-foreground">
              INV{" "}
              <span className="font-mono text-foreground">
                {invoiceDoc.doc_no as string}
              </span>
              {invoiceDoc ? (
                <>
                  {" · "}
                  <a
                    href={`/erp/invoices/${invoiceDoc.id as string}/print?bill=master`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Print
                  </a>
                </>
              ) : null}
            </span>
          ) : null}
        </div>
        {statusBlurb ? (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
            {statusBlurb}
          </p>
        ) : null}
      </div>

      {/* Dense money strip — charges / paid / due */}
      <section
        aria-labelledby="folio-balances-heading"
        className="mb-3 grid gap-2 sm:grid-cols-3"
      >
        <h2 id="folio-balances-heading" className="sr-only">
          Balances
        </h2>
        {hasAgentSplit ? (
          <div className="rounded-lg border bg-card px-3 py-2 sm:col-span-3 sm:grid sm:grid-cols-4 sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0">
            <div className="rounded-lg border bg-card px-3 py-2">
              <p className="text-xs text-muted-foreground">Agent package</p>
              <p className="text-base font-semibold tabular-nums">
                {formatBtn(agentCharges)}
              </p>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <p className="text-xs text-muted-foreground">Guest extras</p>
              <p className="text-base font-semibold tabular-nums">
                {formatBtn(guestCharges)}
              </p>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-base font-semibold tabular-nums">
                {formatBtn(paymentsTotal)}
              </p>
            </div>
            <div
              className={cn(
                "rounded-lg border px-3 py-2",
                balance > 0.5 ? "border-citrus/40 bg-citrus-tint" : "bg-card",
              )}
            >
              <p className="text-xs text-muted-foreground">Open</p>
              <p className="text-base font-semibold tabular-nums">
                {formatBtn(balance)}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-lg border bg-card px-3 py-2">
              <p className="text-xs text-muted-foreground">Charges</p>
              <p className="text-base font-semibold tabular-nums">
                {formatBtn(chargesTotal)}
              </p>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-base font-semibold tabular-nums">
                {formatBtn(paymentsTotal)}
              </p>
            </div>
            <div
              className={cn(
                "rounded-lg border px-3 py-2",
                balance > 0.5 ? "border-citrus/40 bg-citrus-tint" : "bg-card",
              )}
            >
              <p className="text-xs text-muted-foreground">Open</p>
              <p className="text-base font-semibold tabular-nums">
                {formatBtn(balance)}
              </p>
            </div>
          </>
        )}
      </section>

      {/* Mobile sticky Collect */}
      {isOpen && balance > 0.5 ? (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t bg-background p-2 md:hidden">
          <a
            href="#folio-collect"
            className="flex h-11 w-full items-center justify-center rounded-lg bg-citrus text-sm font-semibold text-sky-ink"
          >
            Collect {formatBtn(balance)}
          </a>
        </div>
      ) : null}

      {/* 2 + 3: Actions first on mobile; Activity left / Actions right on desktop */}
      <FolioSplit>
        {/* 3. Actions — intent groups, sticky on desktop */}
        <aside
          id="folio-actions"
          className="order-1 min-w-0 space-y-2 lg:order-2 lg:sticky lg:top-24 lg:self-start"
          aria-labelledby="folio-actions-heading"
        >
          <div>
            <h2
              id="folio-actions-heading"
              className="text-xs font-medium text-muted-foreground"
            >
              Collect &amp; actions
            </h2>
          </div>
          <FolioActionsPanel
            folioId={folio.id as string}
            folioOpen={isOpen}
            bookingId={bookingId}
            bookingCheckedIn={bookingStatus === "checked_in"}
            needsDay1={needsDay1}
            arrivalDate={arrivalDate}
            balanceDue={balance}
            invoiceNo={(invoiceDoc?.doc_no as string | undefined) ?? null}
            invoiceDocId={(invoiceDoc?.id as string | undefined) ?? null}
            isMaster={isMaster}
            hasMaster={Boolean(folio.master_folio_id)}
            masterCandidates={masterCandidates}
            damageItems={(damageItems ?? []).map((d) => ({
              id: d.id as string,
              label: d.label as string,
              amountBtn: d.amount_btn == null ? null : Number(d.amount_btn),
            }))}
            minibarItems={(minibarItems ?? []).map((m) => ({
              id: m.id as string,
              label: m.label as string,
              amountBtn: Number(m.amount_btn ?? 0),
              category: (m.category as string) || "minibar",
            }))}
            defaultGroup={defaultActionGroup}
            showManagerActions={showManagerActions}
          />
        </aside>

        <section
          aria-labelledby="folio-activity-heading"
          className="order-2 min-w-0 space-y-4 lg:order-1"
        >
          {bookingId ? (
            <div>
              <h2
                id="folio-pos-heading"
                className="text-xs font-medium text-muted-foreground"
              >
                Room F&amp;B
              </h2>
              <div className="mt-3">
                <FolioRoomPosItemsPanel orders={roomPosOrders} />
              </div>
            </div>
          ) : null}

          <div>
            <h2
              id="folio-activity-heading"
              className="text-xs font-medium text-muted-foreground"
            >
              Ledger
              <span className="ml-1.5 font-normal">
                ({activityRows.length}
                {accountingLines.length > 0
                  ? ` · ${accountingLines.length} accounting`
                  : ""}
                )
              </span>
            </h2>
          </div>

          <Card className="gap-0 rounded-lg p-0 shadow-none">
            <CardHeader className="sr-only">
              <CardTitle>Folio lines</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <FolioActivityTable
                lines={activityRows.flatMap((row) =>
                  row.kind === "cancelled"
                    ? [{ ...row.original, status: "voided" as const }]
                    : [row.line],
                )}
                isOpen={isOpen}
                transferTargets={transferTargets}
                gstRate={effectiveGstRate(propertyTax, 0)}
                balance={balance}
              />
              {accountingLines.length > 0 ? (
                <details className="border-t">
                  <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/40 sm:px-5">
                    Show all accounting lines ({accountingLines.length})
                  </summary>
                  <ul className="divide-y border-t bg-muted/20">
                    {accountingLines.map((line) => (
                      <li
                        key={`acct-${line.id}`}
                        className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2 text-xs text-muted-foreground sm:px-5"
                      >
                        <span>
                          {line.status === "voided" ? "Voided · " : ""}
                          {line.reverses_line_id ? "Reversal · " : ""}
                          {line.description}
                        </span>
                        <span className="tabular-nums">
                          {formatBtn(Number(line.total_btn))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </CardContent>
          </Card>

          {(links ?? []).length > 0 ? (
            <section aria-labelledby="folio-links-heading">
              <h3
                id="folio-links-heading"
                className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
              >
                Deposit links
              </h3>
              <Card className="mt-2 gap-0 p-0">
                <CardContent className="p-0">
                  <ul className="divide-y">
                    {(links ?? []).map((l) => (
                      <li key={l.id as string} className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-medium text-foreground">
                            {formatBtn(Number(l.amount_btn))} ·{" "}
                            {l.status as string}
                          </p>
                          <a
                            href={`/pay/${l.token as string}`}
                            className="font-mono text-xs text-accent underline-offset-4 hover:underline"
                          >
                            /pay/{(l.token as string).slice(0, 8)}…
                          </a>
                        </div>
                        {l.payee_name ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {l.payee_name as string}
                          </p>
                        ) : null}
                        {(l.status as string) === "open" ? (
                          <MarkLinkPaidForm linkId={l.id as string} />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          ) : null}

          {isMaster && (childFolios ?? []).length > 0 ? (
            <section aria-labelledby="folio-children-heading">
              <h3
                id="folio-children-heading"
                className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
              >
                Linked guest folios
              </h3>
              <Card className="mt-2 gap-0 p-0">
                <CardContent className="p-0">
                  <ul className="divide-y">
                    {(childFolios ?? []).map((c) => (
                      <li key={c.id as string} className="px-4 py-2 text-sm">
                        <a
                          href={`/erp/folios/${c.id as string}`}
                          className="text-accent underline-offset-4 hover:underline"
                        >
                          {(c.label as string) ||
                            (c.id as string).slice(0, 8)}
                        </a>
                        <span className="ml-2 text-xs text-muted-foreground uppercase">
                          {c.status as string}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          ) : null}

          <details className="rounded-lg border border-accent/20 bg-accent/5">
            <summary className="cursor-pointer list-none px-4 py-3 text-xs font-medium text-foreground [&::-webkit-details-marker]:hidden">
              How stay money works (Charges → Invoice → Paid)
            </summary>
            <div className="border-t border-accent/10 px-2 pb-3">
              <StayMoneyCycleLegend compact className="border-0 bg-transparent" />
            </div>
          </details>
        </section>
      </FolioSplit>
    </div>
  );
}
