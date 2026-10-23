import {
  MarkLinkPaidForm,
} from "@/components/erp/FolioOpsForms";
import { FolioActivityTable } from "@/components/erp/FolioActivityTable";
import { FolioActionsPanel } from "@/components/erp/FolioActionsPanel";
import { FolioRoomPosItemsPanel } from "@/components/erp/FolioRoomPosItemsPanel";
import { ErpDetailBack } from "@/components/erp/ErpDetailBack";
import { FolioStaleRefreshBanner } from "@/components/erp/FolioStaleRefreshBanner";
import { Card, CardContent } from "@/components/ui/card";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { effectiveGstRate } from "@/lib/property-settings";
import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import {
  buildStayHubReopenHref,
  parseStayHubBoard,
  parseStayHubStep,
} from "@/lib/folio/stay-hub-cycle";
import { buildStayMoneySteps } from "@/lib/folio/stay-money-cycle";
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
    advanced?: string;
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
  source_id?: string | null;
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
      "id, label, status, booking_id, agent_id, master_folio_id, folio_type, property_id, created_at, agents(company_name), folio_lines(id, description, total_btn, gst_btn, service_charge_btn, service_charge_applied, source_type, source_id, status, is_comp, void_reason, reverses_line_id, created_at, business_date, bill_to)",
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
    { data: mealPlanRows },
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
            "id, status, check_in, check_out, contact_name, adults, children, meal_plan_code, meal_plan_amount_btn, agent_id, payment_mode, agents(company_name), room_assignments(room_units(label))",
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
    admin
      .from("meal_plans")
      .select("code, name")
      .eq("property_id", activePropertyId)
      .eq("is_active", true)
      .order("sort_order"),
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

  const bookingStatus = (booking?.status as string) ?? "confirmed";
  const moneyInput = {
    status: bookingStatus,
    hasFolio: true,
    hasCharges: chargeLines.length > 0,
    hasInvoice: Boolean(invoiceDoc),
    balanceBtn: balance,
  };
  const processSteps = buildStayMoneySteps(moneyInput);
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
    agentCompany?.trim() ||
    (folio.label as string);

  const roomDoors = [
    ...new Set(
      (
        (booking?.room_assignments as
          | Array<{
              room_units?:
                | { label?: string | null }
                | { label?: string | null }[]
                | null;
            }>
          | null) ?? []
      )
        .map((row) => {
          const unit = Array.isArray(row.room_units)
            ? row.room_units[0]
            : row.room_units;
          const label = unit?.label?.trim() ?? "";
          return label.match(/\d{2,4}/)?.[0] ?? label;
        })
        .filter(Boolean),
    ),
  ].sort();
  const pax =
    Number(booking?.adults ?? 0) + Number(booking?.children ?? 0);
  const mealCode = (booking?.meal_plan_code as string | undefined) ?? "";
  const mealName =
    (mealPlanRows ?? []).find((row) => row.code === mealCode)?.name ??
    mealCode;
  const sheetDate = (iso: string) => {
    const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  };
  const stayFacts = [
    roomDoors.length ? `Rooms ${roomDoors.join(", ")}` : null,
    booking?.check_in && booking?.check_out
      ? `${sheetDate(booking.check_in as string)} – ${sheetDate(booking.check_out as string)}`
      : null,
    mealName || null,
    pax > 0 ? `${pax} pax` : null,
  ].filter(Boolean);

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

  return (
    <div className="erp mx-auto w-full max-w-none p-3 md:p-4">
      {stayReturnHref ? (
        <a
          href={stayReturnHref}
          className="sticky top-0 z-30 -mx-3 mb-2 flex min-h-10 items-center gap-2 border-b border-primary/20 bg-primary/5 px-3 py-2 text-sm font-medium text-foreground md:-mx-4 md:px-4"
        >
          <span aria-hidden>←</span>
          <span className="min-w-0 truncate">
            Back to {guestTitle || "stay"}
          </span>
        </a>
      ) : null}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {!stayReturnHref ? (
            <ErpDetailBack href="/erp/bills?tab=invoices" label="Bills" />
          ) : null}
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
            {guestTitle}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stayFacts.join(" · ") || (isMaster ? "Master bill" : "Bill")}
            {folio.master_folio_id ? (
              <>
                {" · "}
                <a
                  href={`/erp/folios/${folio.master_folio_id as string}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Group bill
                </a>
              </>
            ) : null}
            {!stayReturnHref && defaultStayHubHref ? (
              <>
                {" · "}
                <a
                  href={defaultStayHubHref}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Stay
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Due</p>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums leading-none",
              balance > 0.5 ? "text-citrus-600" : "text-foreground",
            )}
          >
            {formatBtn(balance)}
          </p>
        </div>
      </div>
      <FolioStaleRefreshBanner folioId={id} initialVersion={folioVersion} />

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
            mealPlanCode={
              (booking?.meal_plan_code as string | undefined) ?? null
            }
            mealPlans={(mealPlanRows ?? []).map((m) => ({
              code: m.code as string,
              name: m.name as string,
            }))}
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

      <section aria-labelledby="folio-activity-heading" className="mt-3">
          <h2 id="folio-activity-heading" className="sr-only">
            Bill
          </h2>

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
                <details className="mt-2">
                  <summary className="cursor-pointer px-1 py-2 text-xs text-muted-foreground">
                    Voided and reversal lines ({accountingLines.length})
                  </summary>
                  <ul className="divide-y border">
                    {accountingLines.map((line) => (
                      <li
                        key={`acct-${line.id}`}
                        className="flex flex-wrap items-baseline justify-between gap-2 px-2 py-1.5 text-xs text-muted-foreground"
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

          {roomPosOrders.length > 0 ? (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium">Food and drink on the room</h3>
              <FolioRoomPosItemsPanel orders={roomPosOrders} />
            </div>
          ) : null}
      </section>
    </div>
  );
}
