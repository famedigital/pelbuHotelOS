import {
  MarkLinkPaidForm,
  TransferLineForm,
  VoidLineButton,
} from "@/components/erp/FolioOpsForms";
import { FolioActionsPanel } from "@/components/erp/FolioActionsPanel";
import { StayMoneyCycleLegend } from "@/components/erp/StayMoneyCycleLegend";
import { StayMoneyProcessStrip } from "@/components/erp/StayMoneyProcessStrip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  buildStayMoneySteps,
  stayMoneyNextAction,
} from "@/lib/folio/stay-money-cycle";
import { formatBtn } from "@/lib/pricing";
import { netFolioBalance } from "@/lib/folio/balance";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Folio | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

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

function billToLabel(billTo: string | null | undefined, isPayment: boolean) {
  if (isPayment) return null;
  if (billTo === "agent") return "Room package → agent";
  return "Food & extras → guest";
}

function sourceLabel(sourceType: string) {
  const map: Record<string, string> = {
    room: "Room",
    meal_plan: "Meal plan",
    payment: "Payment",
    deposit: "Deposit",
    comp: "Comp",
    pos: "F&B / POS",
    order: "F&B / banquet",
    laundry: "Laundry",
    damage: "Damage",
    cancel_fee: "Cancel fee",
    no_show_fee: "No-show fee",
  };
  return map[sourceType] ?? sourceType.replace(/_/g, " ");
}

export default async function FolioDetailPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const activePropertyId = await resolveActivePropertyId(admin);

  const { data: folio } = await admin
    .from("folios")
    .select(
      "id, label, status, booking_id, master_folio_id, folio_type, property_id, created_at, folio_lines(id, description, total_btn, gst_btn, service_charge_btn, service_charge_applied, source_type, status, is_comp, void_reason, reverses_line_id, created_at, business_date, bill_to)",
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

  const { data: links } = await admin
    .from("payment_links")
    .select("id, token, amount_btn, status, purpose, created_at, payee_name")
    .eq("folio_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: invoiceDoc } = await admin
    .from("fiscal_documents")
    .select("id, doc_no")
    .eq("folio_id", id)
    .eq("doc_kind", "invoice")
    .eq("status", "issued")
    .maybeSingle();

  const bookingId = (folio.booking_id as string | null) ?? null;
  const { data: booking } = bookingId
    ? await admin
        .from("bookings")
        .select(
          "id, status, check_in, check_out, contact_name, meal_plan_code, meal_plan_amount_btn, agent_id, payment_mode, agents(company_name)",
        )
        .eq("id", bookingId)
        .maybeSingle()
    : { data: null };

  const { data: siblingFolios } = bookingId
    ? await admin
        .from("folios")
        .select("id, label, status")
        .eq("property_id", activePropertyId)
        .eq("booking_id", bookingId)
        .eq("status", "open")
        .neq("id", id)
        .limit(20)
    : { data: [] as { id: string; label: string; status: string }[] };

  const transferTargets = (siblingFolios ?? []).map((f) => ({
    id: f.id as string,
    label: (f.label as string) || (f.id as string).slice(0, 8),
  }));

  const { data: masterRows } = await admin
    .from("folios")
    .select("id, label")
    .eq("property_id", activePropertyId)
    .eq("status", "open")
    .eq("folio_type", "master")
    .neq("id", id)
    .order("created_at", { ascending: false })
    .limit(40);
  const masterCandidates = (masterRows ?? []).map((f) => ({
    id: f.id as string,
    label: (f.label as string) || (f.id as string).slice(0, 8),
  }));

  const { data: damageItems } = await admin
    .from("property_damage_items")
    .select("id, label, amount_btn")
    .eq("property_id", activePropertyId)
    .eq("is_active", true)
    .order("sort_order");

  const { data: childFolios } =
    (folio.folio_type as string) === "master"
      ? await admin
          .from("folios")
          .select("id, label, status")
          .eq("property_id", activePropertyId)
          .eq("master_folio_id", id)
          .order("created_at", { ascending: true })
          .limit(40)
      : { data: [] as { id: string; label: string; status: string }[] };

  const lines = ((folio.folio_lines as FolioLine[] | null) ?? []).sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const balance = netFolioBalance(lines);
  const folioStatus = (folio.status as string) ?? "open";
  const isOpen = folioStatus === "open";
  const isMaster = (folio.folio_type as string) === "master";

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
  const needsDay1 =
    isOpen &&
    bookingStatus === "checked_in" &&
    (chargeLines.length === 0 ||
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

  const statusBlurb = needsDay1
    ? "No room charges yet — post day-1 package first so the balance is real."
    : balance > 0.5
      ? "Open balance — collect payment or issue the tax invoice when ready."
      : chargeLines.length > 0
        ? "Balance clear. Checkout when the guest departs."
        : "Open folio — charges appear after check-in, POS, or night audit.";

  const guestTitle =
    (booking?.contact_name as string | undefined)?.trim() ||
    (folio.label as string);

  return (
    <div className="erp mx-auto w-full max-w-[1100px] p-4 md:p-6">
      {/* Sticky identity + next action */}
      <div className="sticky top-0 z-20 -mx-4 mb-5 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
              {isMaster ? "Master folio" : "Guest folio"} · money &amp; print
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {guestTitle}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-medium tracking-wide uppercase",
                  isOpen
                    ? "bg-accent/10 text-accent"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {folioStatus}
              </span>
              {booking ? (
                <span className="tracking-wide uppercase">
                  {bookingStatus.replace(/_/g, " ")}
                </span>
              ) : null}
              {booking ? (
                <span>
                  {booking.check_in as string} → {booking.check_out as string}
                </span>
              ) : null}
              {bookingId ? (
                <a
                  href={`/erp/reservations?booking=${bookingId}&step=stay_money`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Stay hub
                </a>
              ) : null}
              {folio.master_folio_id ? (
                <a
                  href={`/erp/folios/${folio.master_folio_id as string}`}
                  className="font-mono text-accent underline-offset-4 hover:underline"
                >
                  master {(folio.master_folio_id as string).slice(0, 8)}
                </a>
              ) : null}
            </p>
          </div>

          <div className="flex min-w-[10rem] flex-col items-end gap-2 sm:min-w-[12rem]">
            <div className="text-right">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Balance due
              </p>
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  balance > 0.5 ? "text-destructive" : "text-foreground",
                )}
              >
                {formatBtn(balance)}
              </p>
            </div>
            {isOpen ? (
              <a
                href={
                  needsDay1 || currentStep?.id === "charges"
                    ? "#folio-actions"
                    : currentStep?.id === "invoice"
                      ? "#folio-actions"
                      : bookingStatus === "checked_in" &&
                          bookingId &&
                          Math.abs(balance) <= 0.5
                        ? `/erp/check-out?id=${bookingId}`
                        : "#folio-actions"
                }
                className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90"
              >
                {primaryNextLabel}
              </a>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{statusBlurb}</p>
      </div>

      {/* Stay money progress — Charges / Invoice / Paid language */}
      <div className="mb-5 space-y-2 rounded-xl border bg-card px-4 py-3">
        <StayMoneyProcessStrip steps={processSteps} />
        <p className="text-[11px] text-muted-foreground">
          Progress:{" "}
          <span className="font-medium text-foreground">Charges</span>
          {" · "}
          <span className="font-medium text-foreground">Invoice</span>
          {" · "}
          <span className="font-medium text-foreground">Paid</span>
          {invoiceDoc ? (
            <>
              {" · "}
              Invoice{" "}
              <span className="font-mono text-foreground">
                {invoiceDoc.doc_no as string}
              </span>
            </>
          ) : null}
        </p>
      </div>

      {/* 1. Balances — who owes what */}
      <section aria-labelledby="folio-balances-heading" className="mb-6">
        <h2
          id="folio-balances-heading"
          className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase"
        >
          Balances
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          One folio for the stay. Room package often bills the agent; food and
          hotel extras bill the guest.
        </p>
        <div
          className={cn(
            "mt-3 grid gap-3",
            hasAgentSplit ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3",
          )}
        >
          {hasAgentSplit ? (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Room package → agent
              </p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
                {formatBtn(agentCharges)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {agentCompany
                  ? agentCompany
                  : booking?.agent_id
                    ? "Agent on booking"
                    : "Agent share on lines"}
                {(booking?.payment_mode as string | undefined)
                  ? ` · ${String((booking?.payment_mode as string)).replace(/_/g, " ")}`
                  : ""}
              </p>
            </div>
          ) : null}
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {hasAgentSplit
                ? "Food & extras → guest"
                : "Charges on folio"}
            </p>
            <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
              {formatBtn(hasAgentSplit ? guestCharges : chargesTotal)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Posted sellable lines (not payments)
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Paid
            </p>
            <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
              {formatBtn(paymentsTotal)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Payments &amp; deposits recorded
            </p>
          </div>
          <div
            className={cn(
              "rounded-xl border p-4",
              balance > 0.5
                ? "border-destructive/30 bg-destructive/5"
                : "bg-card",
            )}
          >
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Open balance
            </p>
            <p
              className={cn(
                "mt-2 text-lg font-semibold tabular-nums",
                balance > 0.5 ? "text-destructive" : "text-foreground",
              )}
            >
              {formatBtn(balance)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Charges − paid (net)
            </p>
          </div>
        </div>
      </section>

      {/* 2 + 3: Actions first on mobile; Activity left / Actions right on desktop */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* 3. Actions — intent groups, sticky on desktop */}
        <aside
          id="folio-actions"
          className="order-1 min-w-0 space-y-3 lg:order-2 lg:sticky lg:top-[7.5rem] lg:self-start"
          aria-labelledby="folio-actions-heading"
        >
          <div>
            <h2
              id="folio-actions-heading"
              className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase"
            >
              Actions
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Open only what you need — collect, invoice, post, or adjust.
            </p>
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
            defaultGroup={defaultActionGroup}
          />
        </aside>

        <section
          aria-labelledby="folio-activity-heading"
          className="order-2 min-w-0 space-y-4 lg:order-1"
        >
          <div>
            <h2
              id="folio-activity-heading"
              className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase"
            >
              Activity
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Charges and payments in order — void or transfer on a line if
              needed.
            </p>
          </div>

          <Card className="gap-0 p-0">
            <CardHeader className="border-b px-4 py-3 sm:px-5">
              <CardTitle className="text-sm font-medium text-foreground">
                Folio lines
                <span className="ml-2 font-normal text-muted-foreground">
                  ({lines.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {lines.length === 0 ? (
                  <li className="space-y-3 px-4 py-8 text-sm text-muted-foreground sm:px-5">
                    <p className="font-medium text-foreground">No lines yet</p>
                    <p>
                      Check-in opens the folio. Day-1 room rent and priced meal
                      plans should post at check-in (or use{" "}
                      <strong className="font-medium text-foreground">
                        Post room charges
                      </strong>{" "}
                      in Actions). Later nights post at{" "}
                      <a
                        href="/erp/night-audit"
                        className="text-accent underline-offset-4 hover:underline"
                      >
                        night audit
                      </a>
                      . POS, laundry, and desk charges appear here when posted.
                    </p>
                    {bookingStatus === "checked_in" ? (
                      <p className="rounded-md border border-amber-500/30 bg-amber-50/60 px-3 py-2 text-xs text-foreground dark:bg-amber-950/30">
                        Guest is checked in with an empty folio — open{" "}
                        <strong>Post room charges</strong> under Actions so the
                        balance reflects the stay before you collect payment.
                      </p>
                    ) : null}
                  </li>
                ) : (
                  lines.map((line) => {
                    const amount = Number(line.total_btn);
                    const isPayment = isPaymentSource(line.source_type);
                    const voided = line.status === "voided";
                    const payor = billToLabel(line.bill_to, isPayment);
                    return (
                      <li key={line.id} className="px-4 py-3 text-sm sm:px-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p
                            className={cn(
                              "min-w-0 flex-1",
                              voided
                                ? "text-muted-foreground line-through"
                                : "text-foreground",
                            )}
                          >
                            {line.description}
                            {line.is_comp ? (
                              <span className="ml-2 text-[10px] font-semibold tracking-wide text-accent uppercase">
                                comp
                              </span>
                            ) : null}
                          </p>
                          <p
                            className={cn(
                              "tabular-nums",
                              isPayment
                                ? "text-foreground/70"
                                : "text-foreground",
                              voided && "opacity-50 line-through",
                            )}
                          >
                            {formatBtn(amount)}
                          </p>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{sourceLabel(line.source_type)}</span>
                          {payor ? (
                            <>
                              <span aria-hidden>·</span>
                              <span
                                className={cn(
                                  line.bill_to === "agent"
                                    ? "text-foreground/80"
                                    : "text-muted-foreground",
                                )}
                              >
                                {payor}
                              </span>
                            </>
                          ) : null}
                          {voided ? (
                            <>
                              <span aria-hidden>·</span>
                              <span className="uppercase">voided</span>
                            </>
                          ) : null}
                          {line.business_date ? (
                            <>
                              <span aria-hidden>·</span>
                              <span>{line.business_date}</span>
                            </>
                          ) : null}
                          {line.service_charge_applied &&
                          Number(line.service_charge_btn ?? 0) > 0 ? (
                            <>
                              <span aria-hidden>·</span>
                              <span>
                                SC {formatBtn(Number(line.service_charge_btn ?? 0))}
                              </span>
                            </>
                          ) : null}
                          {Number(line.gst_btn) > 0 ? (
                            <>
                              <span aria-hidden>·</span>
                              <span>GST {formatBtn(Number(line.gst_btn))}</span>
                            </>
                          ) : null}
                          {line.void_reason ? (
                            <>
                              <span aria-hidden>·</span>
                              <span>{line.void_reason}</span>
                            </>
                          ) : null}
                        </p>
                        {isOpen &&
                        !voided &&
                        !isPayment &&
                        line.source_type !== "comp" ? (
                          <div className="mt-1 space-y-1">
                            <VoidLineButton lineId={line.id} />
                            <TransferLineForm
                              lineId={line.id}
                              siblingFolios={transferTargets}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })
                )}
              </ul>
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
      </div>
    </div>
  );
}
